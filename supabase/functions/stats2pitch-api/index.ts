const ENGINE_VERSION='stats2pitch-consensus-v3'
const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const API_FOOTBALL_KEY=Deno.env.get('API_FOOTBALL_KEY')||''
const API_FOOTBALL_BASE=(Deno.env.get('API_FOOTBALL_BASE')||'https://v3.football.api-sports.io').replace(/\/$/,'')
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'UTC'
const TTL_MS=Math.max(15,Number(Deno.env.get('AUTO_REFRESH_TTL_MINUTES')||45))*60_000

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))

function today(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:APP_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const pick=(t:string)=>parts.find(x=>x.type===t)?.value||''
  return`${pick('year')}-${pick('month')}-${pick('day')}`
}
function requestedDate(url:URL){
  const v=url.searchParams.get('date')
  return dateOk(v)?String(v):today()
}
function serviceHeaders(){
  return{
    apikey:SUPABASE_SERVICE_ROLE_KEY,
    Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Accept:'application/json',
    'Content-Type':'application/json'
  }
}
async function rest(path:string,init:RequestInit={}){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase service configuration is unavailable')
  const response=await fetch(`${SUPABASE_URL}${path}`,{...init,headers:{...serviceHeaders(),...(init.headers||{})}})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${data?.message||response.statusText}`)
  return data
}
async function verifyUser(req:Request){
  const auth=req.headers.get('authorization')||''
  if(!/^Bearer\s+\S+/i.test(auth)||!SUPABASE_URL||!SUPABASE_ANON_KEY)return null
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:auth}})
  const data=await response.json().catch(()=>null)
  return response.ok&&data?.id?data:null
}
function emptyBoard(date:string){
  return{
    meta:{date,generatedAt:null,qualified:0,bestPicks:0,engineVersion:ENGINE_VERSION,requiresRefresh:true,hosting:'github-pages+supabase'},
    priority:[],bestPicks:[],fixtures:[],availableMarkets:[]
  }
}
async function snapshot(date:string){
  const rows=await rest(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null
  const payload=row?.payload||null
  if(!payload||payload?.meta?.engineVersion!==ENGINE_VERSION)return null
  return{
    board:{...payload,meta:{...(payload.meta||{}),storedAt:row.generated_at}},
    generatedAt:row.generated_at
  }
}
function snapshotState(date:string,row:{board:any,generatedAt:string}|null){
  const raw=row?.board?.meta?.generatedAt||row?.generatedAt||''
  const at=Date.parse(raw)
  const isFresh=Number.isFinite(at)&&Date.now()-at<TTL_MS
  return{state:isFresh?'complete':row?'stale':'idle',date,generatedAt:raw||null,stale:!isFresh,worker:'github-actions',engineVersion:ENGINE_VERSION}
}
function normalizeLive(rows:any[]){
  return(rows||[]).map(x=>({
    fixtureId:x?.fixture?.id,status:x?.fixture?.status?.short||'',statusLong:x?.fixture?.status?.long||'',
    minute:x?.fixture?.status?.elapsed??null,kickoff:x?.fixture?.date,league:x?.league?.name||'',country:x?.league?.country||'',
    home:{id:x?.teams?.home?.id,name:x?.teams?.home?.name||'',logo:x?.teams?.home?.logo||null,score:x?.goals?.home??null},
    away:{id:x?.teams?.away?.id,name:x?.teams?.away?.name||'',logo:x?.teams?.away?.logo||null,score:x?.goals?.away??null}
  }))
}
async function liveScores(date:string){
  if(!API_FOOTBALL_KEY)throw new Error('API_FOOTBALL_KEY is not configured in Supabase secrets')
  const url=new URL(`${API_FOOTBALL_BASE}/fixtures`)
  url.searchParams.set('date',date)
  url.searchParams.set('timezone',APP_TIMEZONE)
  const response=await fetch(url,{headers:{'x-apisports-key':API_FOOTBALL_KEY}})
  const body=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(`API-Football ${response.status}`)
  return normalizeLive(Array.isArray(body?.response)?body.response:[])
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  const url=new URL(req.url)
  const marker='/stats2pitch-api'
  const route=(url.pathname.split(marker)[1]||'/').replace(/\/+$/,'')||'/'
  try{
    if(route==='/health')return json({ok:true,version:'3.0.0',engineVersion:ENGINE_VERSION,hosting:'github-pages+supabase'})
    if(route==='/config')return json({version:'3.0.0',engineVersion:ENGINE_VERSION,hosting:'github-pages+supabase'})

    if(route==='/board'&&req.method==='GET'){
      const date=requestedDate(url),row=await snapshot(date),status=snapshotState(date,row),board=row?.board||emptyBoard(date)
      return json({...board,meta:{...(board.meta||{}),date,refresh:status,requiresRefresh:status.state!=='complete',hosting:'github-pages+supabase'}})
    }
    if(route==='/refresh-status'&&req.method==='GET'){
      const date=requestedDate(url),row=await snapshot(date)
      return json(snapshotState(date,row))
    }
    if(route==='/refresh'&&req.method==='POST'){
      const body=await req.json().catch(()=>({}))
      const date=dateOk(body?.date)?String(body.date):today(),row=await snapshot(date)
      return json({ok:true,job:snapshotState(date,row),message:'Prediction generation is owned by the GitHub Actions Refresh Boards worker.'},202)
    }
    if(route==='/live-scores'&&req.method==='GET'){
      const date=requestedDate(url)
      return json({date,fixtures:await liveScores(date)})
    }

    if(route==='/me'&&req.method==='GET'){
      const me=await verifyUser(req)
      if(!me)return json({error:'Authentication required'},401)
      return json({id:me.id,email:me.email||''})
    }

    return json({error:'Not found'},404)
  }catch(error){
    console.error(error)
    return json({error:error instanceof Error?error.message:'Server error'},500)
  }
})
