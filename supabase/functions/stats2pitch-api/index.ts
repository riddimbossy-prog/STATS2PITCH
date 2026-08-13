const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const API_FOOTBALL_KEY=Deno.env.get('API_FOOTBALL_KEY')||''
const API_FOOTBALL_BASE=(Deno.env.get('API_FOOTBALL_BASE')||'https://v3.football.api-sports.io').replace(/\/$/,'')
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'UTC'
const ALLOW_PUBLIC_SIGNUP=String(Deno.env.get('ALLOW_PUBLIC_SIGNUP')||'true').toLowerCase()!=='false'
const ELITE_TOKEN=Deno.env.get('STATS2PITCH_ELITE_FEED_TOKEN')||''
const TTL_MS=Math.max(15,Number(Deno.env.get('AUTO_REFRESH_TTL_MINUTES')||45))*60_000

const cors={
  'Access-Control-Allow-Origin':Deno.env.get('STATS2PITCH_ALLOWED_ORIGIN')||'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
function today(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:APP_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const pick=(t:string)=>parts.find(x=>x.type===t)?.value||''
  return`${pick('year')}-${pick('month')}-${pick('day')}`
}
function requestedDate(url:URL){const v=url.searchParams.get('date');return dateOk(v)?String(v):today()}
function serviceHeaders(extra:Record<string,string>={}){return{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,Accept:'application/json','Content-Type':'application/json',...extra}}
async function rest(path:string,init:RequestInit={}){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase service configuration is unavailable')
  const response=await fetch(`${SUPABASE_URL}${path}`,{...init,headers:{...serviceHeaders(),...(init.headers||{})}})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${data?.message||data?.error_description||response.statusText}`)
  return data
}
async function verifyUser(req:Request){
  const auth=req.headers.get('authorization')||''
  if(!/^Bearer\s+\S+/i.test(auth)||!SUPABASE_URL||!SUPABASE_ANON_KEY)return null
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:auth}})
  const data=await response.json().catch(()=>null)
  return response.ok&&data?.id?data:null
}
function emptyBoard(date:string){return{meta:{date,generatedAt:null,qualified:0,bestPicks:0,requiresRefresh:true,hosting:'github-pages+supabase'},groups:{single:[],two:[],threePlus:[]},priority:[],bestPicks:[],availableMarkets:[]}}
async function snapshot(date:string){
  const rows=await rest(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null
  if(!row)return null
  return{board:{...row.payload,meta:{...(row.payload?.meta||{}),storedAt:row.generated_at}},generatedAt:row.generated_at}
}
function snapshotState(date:string,row:{board:any,generatedAt:string}|null){
  const raw=row?.board?.meta?.generatedAt||row?.generatedAt||''
  const at=Date.parse(raw)
  const isFresh=Number.isFinite(at)&&Date.now()-at<TTL_MS
  return{state:isFresh?'complete':row?'stale':'idle',date,generatedAt:raw||null,stale:!isFresh,worker:'github-actions'}
}
function normalizeLive(rows:any[]){return(rows||[]).map(x=>({fixtureId:x?.fixture?.id,status:x?.fixture?.status?.short||'',statusLong:x?.fixture?.status?.long||'',minute:x?.fixture?.status?.elapsed??null,kickoff:x?.fixture?.date,league:x?.league?.name||'',country:x?.league?.country||'',leagueLogo:x?.league?.logo||null,countryFlag:x?.league?.flag||null,home:{id:x?.teams?.home?.id,name:x?.teams?.home?.name||'',logo:x?.teams?.home?.logo||null,score:x?.goals?.home??null},away:{id:x?.teams?.away?.id,name:x?.teams?.away?.name||'',logo:x?.teams?.away?.logo||null,score:x?.goals?.away??null}}))}
async function liveScores(date:string){
  if(!API_FOOTBALL_KEY)throw new Error('API_FOOTBALL_KEY is not configured in Supabase secrets')
  const url=new URL(`${API_FOOTBALL_BASE}/fixtures`);url.searchParams.set('date',date);url.searchParams.set('timezone',APP_TIMEZONE)
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12_000)
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{'x-apisports-key':API_FOOTBALL_KEY}})
    const body=await response.json().catch(()=>null)
    if(!response.ok)throw new Error(`API-Football ${response.status}: ${body?.message||response.statusText}`)
    const errors=body?.errors&&typeof body.errors==='object'?Object.values(body.errors).filter(Boolean):[]
    if(errors.length)throw new Error(`API-Football rejected request: ${errors.join('; ')}`)
    return normalizeLive(Array.isArray(body?.response)?body.response:[])
  }finally{clearTimeout(timer)}
}
const text=(value:any)=>String(value??'').trim()
const number=(value:any)=>{const n=Number(value);return Number.isFinite(n)?n:null}
function teamName(value:any,fallback=''){if(typeof value==='string')return text(value);if(value&&typeof value==='object')return text(value.name||value.team_name||value.teamName);return text(fallback)}
function fixtureName(row:any){const direct=text(row?.match)||text(row?.fixture);if(direct&&!/^(fixture|match)$/i.test(direct))return direct;const home=teamName(row?.home,text(row?.homeTeam||row?.home_team)),away=teamName(row?.away,text(row?.awayTeam||row?.away_team));return home&&away?`${home} vs ${away}`:home||away||'Fixture'}
function finalSelection(row:any){return text(row?.selectionLabel)||text(row?.selectedTeam)||text(row?.pick)||text(row?.selection)||'Selection'}
function finalMarket(row:any){const market=text(row?.market);if(market==='DNB')return'Draw No Bet';if(market==='DC')return text(row?.downgradeMarket)||'Double Chance';return market||text(row?.marketLabel)||'Market'}
function priorityClass(row:any){const priority=text(row?.priorityLabel).toUpperCase();if(priority==='ELITE')return'elite_strong';const rating=number(row?.engineRating)??number(row?.elite_score)??70;return rating>=88?'elite_strong':'elite_supported'}
function reason(row:any){const direct=text(row?.shortReason)||text(row?.reason);if(direct)return direct;if(Array.isArray(row?.reasons)&&row.reasons.length)return row.reasons.map(text).filter(Boolean).slice(0,8).join(' • ');return'Qualified by Stats2Pitch split-stat and market-safety rules.'}
function buildEliteFeed(board:any,{date,limit=10}:{date:string,limit:number}){
  const safeLimit=Math.max(1,Math.min(10,Number(limit)||10))
  const items=(Array.isArray(board?.bestPicks)?board.bestPicks:[]).filter((row:any)=>text(row?.contradiction||'LOW').toUpperCase()!=='HIGH').slice(0,safeLimit).map((row:any,index:number)=>{
    const home=teamName(row?.home,text(row?.homeTeam||row?.home_team)),away=teamName(row?.away,text(row?.awayTeam||row?.away_team))
    return{id:`stats2pitch-${text(row?.fixtureId)||index}-${text(row?.market)||'market'}`,source:'stats2pitch',source_fixture_id:text(row?.fixtureId)||null,prediction_date:date||board?.meta?.date||null,fixture:fixtureName(row),home_team:home||null,away_team:away||null,league:text(row?.league||row?.competition)||null,country:text(row?.country)||null,kickoff:row?.kickoff||row?.date||row?.fixtureDate||null,market:finalMarket(row),pick:finalSelection(row),average_odds:number(row?.odds),classification:priorityClass(row),label:'Stats2Pitch Elite',elite_score:Math.round(number(row?.engineRating)??70),engine_rating:number(row?.engineRating),family_count:number(row?.familyCount),families:Array.isArray(row?.filterFamilies)?row.filterFamilies:Array.isArray(row?.families)?row.families:[],contradiction:text(row?.contradiction||'LOW').toUpperCase(),status:'upcoming',reason:reason(row),last_verified_at:board?.meta?.generatedAt||new Date().toISOString()}
  })
  return{version:2,source:'stats2pitch',date:date||board?.meta?.date||null,generated_at:board?.meta?.generatedAt||null,count:items.length,max:10,items}
}
function eliteAuthorized(req:Request){if(!ELITE_TOKEN)return false;return text(req.headers.get('authorization')).replace(/^Bearer\s+/i,'')===ELITE_TOKEN}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  const url=new URL(req.url),marker='/stats2pitch-api',route=(url.pathname.split(marker)[1]||'/').replace(/\/+$/,'')||'/'
  try{
    if(route==='/health')return json({ok:true,version:'2.2.0',hosting:'github-pages+supabase',refreshWorker:'github-actions'})
    if(route==='/config')return json({allowPublicSignup:ALLOW_PUBLIC_SIGNUP,version:'2.2.0',hosting:'github-pages+supabase'})
    if(route.startsWith('/export/elite')){
      if(!eliteAuthorized(req))return json({error:'Elite feed authorization required'},401)
      const date=requestedDate(url),row=await snapshot(date)
      if(route==='/export/elite'&&req.method==='GET')return json(buildEliteFeed(row?.board||emptyBoard(date),{date,limit:Math.max(1,Math.min(10,Number(url.searchParams.get('limit'))||10))}))
      if(route==='/export/elite/refresh-status'&&req.method==='GET')return json(snapshotState(date,row))
      if(route==='/export/elite/refresh'&&req.method==='POST'){
        const status=snapshotState(date,row)
        if(status.state==='complete')return json({status:'ready',date,generated_at:status.generatedAt,count:Array.isArray(row?.board?.bestPicks)?row.board.bestPicks.length:0})
        return json({status:'scheduled-worker',date,generated_at:status.generatedAt,message:'GitHub Actions owns prediction generation after the Render migration.'},202)
      }
      return json({error:'Not found'},404)
    }
    const me=await verifyUser(req)
    if(!me)return json({error:'Authentication required'},401)
    if(route==='/me'&&req.method==='GET')return json({id:me.id,email:me.email||''})
    if(route==='/board'&&req.method==='GET'){
      const date=requestedDate(url),row=await snapshot(date),status=snapshotState(date,row),board=row?.board||emptyBoard(date)
      return json({...board,meta:{...(board.meta||{}),date,refresh:status,requiresRefresh:status.state!=='complete',hosting:'github-pages+supabase'}})
    }
    if(route==='/refresh-status'&&req.method==='GET'){const date=requestedDate(url),row=await snapshot(date);return json(snapshotState(date,row))}
    if(route==='/refresh'&&req.method==='POST'){
      const body=await req.json().catch(()=>({})),date=dateOk(body?.date)?String(body.date):today(),row=await snapshot(date)
      return json({ok:true,job:snapshotState(date,row),message:'The Render refresh endpoint has been retired. GitHub Actions refreshes the saved board automatically.'},202)
    }
    if(route==='/live-scores'&&req.method==='GET'){const date=requestedDate(url);return json({date,fixtures:await liveScores(date)})}
    return json({error:'Not found'},404)
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Server error'},500)}
})
