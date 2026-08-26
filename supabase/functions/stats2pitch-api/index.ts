const ELITE_FEED_TOKEN=Deno.env.get('STATS2PITCH_ELITE_FEED_TOKEN')||''
const ENGINE_VERSION='stats2pitch-v5-var-tips'
const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const API_FOOTBALL_KEY=Deno.env.get('API_FOOTBALL_KEY')||''
const API_FOOTBALL_BASE=(Deno.env.get('API_FOOTBALL_BASE')||'https://v3.football.api-sports.io').replace(/\/$/,'')
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'UTC'
const TTL_MS=Math.max(15,Number(Deno.env.get('AUTO_REFRESH_TTL_MINUTES')||45))*60_000
const ADMIN_EMAILS=(Deno.env.get('STATS2PITCH_ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
const GITHUB_TOKEN=Deno.env.get('STATS2PITCH_GITHUB_TOKEN')||''
const GITHUB_REPO=Deno.env.get('STATS2PITCH_GITHUB_REPO')||'riddimbossy-prog/STATS2PITCH'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const finite=(v:any)=>Number.isFinite(Number(v))
const norm=(s:any)=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const FINISHED=new Set(['FT','AET','PEN'])

function today(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:APP_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const pick=(t:string)=>parts.find(x=>x.type===t)?.value||''
  return`${pick('year')}-${pick('month')}-${pick('day')}`
}
function requestedDate(url:URL){const v=url.searchParams.get('date');return dateOk(v)?String(v):today()}
function addDays(date:string,delta:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)}
function serviceHeaders(){return{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,Accept:'application/json','Content-Type':'application/json'}}
async function rest(path:string,init:RequestInit={}){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Storage is unavailable')
  const response=await fetch(`${SUPABASE_URL}${path}`,{...init,headers:{...serviceHeaders(),...(init.headers||{})}})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(`Storage ${response.status}`)
  return data
}
async function verifyUser(req:Request){
  const auth=req.headers.get('authorization')||''
  if(!/^Bearer\s+\S+/i.test(auth)||!SUPABASE_URL||!SUPABASE_ANON_KEY)return null
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:auth}})
  const data=await response.json().catch(()=>null)
  return response.ok&&data?.id?data:null
}
async function verifyAdmin(req:Request){
  const user=await verifyUser(req);if(!user)return null
  const role=String(user?.app_metadata?.role||user?.user_metadata?.role||'').toLowerCase()
  const email=String(user?.email||'').toLowerCase()
  return role==='admin'||ADMIN_EMAILS.includes(email)?user:null
}
function eliteAuthorized(req:Request){
  if(!ELITE_FEED_TOKEN)return false
  const bearer=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  return bearer===ELITE_FEED_TOKEN
}
function eliteItems(board:any,date:string){
  const source=Array.isArray(board?.varTips)?board.varTips:(Array.isArray(board?.bestPicks)?board.bestPicks:[])
  return source
    .filter((row:any)=>String(row?.engine||'')==='away-fav-streak-v1')
    .filter((row:any)=>['btts','away-win','away-o15','over-15'].includes(String(row?.route||'')))
    .sort((a:any,b:any)=>Date.parse(a?.kickoff||0)-Date.parse(b?.kickoff||0))
    .map((row:any,index:number)=>{
      const home=String(row?.home||row?.home_team||'')
      const away=String(row?.away||row?.away_team||'')
      const market=String(row?.market||'')
      const marketName=market==='both-teams-score'?'Both Teams To Score':market==='match-winner'?'Match winner':market==='away-team-goals'?'Away team goals':market==='total-goals'?'Total goals':market||'Market'
      return{
        id:`stats2pitch-${row?.fixtureId||index}-${market||'market'}`,
        source:'stats2pitch',
        source_fixture_id:row?.fixtureId?String(row.fixtureId):null,
        prediction_date:date,
        fixture:home&&away?`${home} vs ${away}`:'Fixture',
        home_team:home||null,
        away_team:away||null,
        home_logo:row?.homeLogo||row?.home_logo||null,
        away_logo:row?.awayLogo||row?.away_logo||null,
        league:row?.league||null,
        country:row?.country||null,
        kickoff:row?.kickoff||null,
        market:marketName,
        pick:row?.displaySelection||row?.pick||row?.selection||'Selection',
        average_odds:Number.isFinite(Number(row?.odds))?Number(row.odds):null,
        classification:'elite_supported',
        label:'Elite',
        status:'upcoming',
        last_verified_at:board?.meta?.generatedAt||new Date().toISOString()
      }
    })
}
function emptyBoard(date:string){return{meta:{date,generatedAt:null,qualified:0,bestPicks:0,varTipsCount:0,engineVersion:ENGINE_VERSION,requiresRefresh:true},priority:[],bestPicks:[],varTips:[],fixtures:[],availableMarkets:[],results:{}}}
async function snapshot(date:string){
  const rows=await rest(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null,payload=row?.payload||null
  if(!payload||payload?.meta?.engineVersion!==ENGINE_VERSION)return null
  return{board:{...payload,meta:{...(payload.meta||{}),storedAt:row.generated_at}},generatedAt:row.generated_at}
}
function snapshotState(date:string,row:{board:any,generatedAt:string}|null){
  const raw=row?.board?.meta?.generatedAt||row?.generatedAt||'',at=Date.parse(raw),isFresh=Number.isFinite(at)&&Date.now()-at<TTL_MS
  return{state:isFresh?'complete':row?'stale':'idle',date,generatedAt:raw||null,stale:!isFresh}
}
function normalizeFixture(x:any){
  const status=String(x?.fixture?.status?.short||'').toUpperCase(),finished=FINISHED.has(status),live=['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(status),cancelled=['CANC','PST','ABD','AWD','WO'].includes(status)
  const full=x?.score?.fulltime||{},half=x?.score?.halftime||{}
  return{
    fixtureId:x?.fixture?.id,status,statusLong:x?.fixture?.status?.long||'',minute:x?.fixture?.status?.elapsed??null,kickoff:x?.fixture?.date,
    league:x?.league?.name||'',country:x?.league?.country||'',
    home:{id:x?.teams?.home?.id,name:x?.teams?.home?.name||'',logo:x?.teams?.home?.logo||null,score:finite(full?.home)?Number(full.home):finite(x?.goals?.home)?Number(x.goals.home):null},
    away:{id:x?.teams?.away?.id,name:x?.teams?.away?.name||'',logo:x?.teams?.away?.logo||null,score:finite(full?.away)?Number(full.away):finite(x?.goals?.away)?Number(x.goals.away):null},
    halftime:{home:finite(half?.home)?Number(half.home):null,away:finite(half?.away)?Number(half.away):null},
    finished,live,cancelled,matchState:finished?'settled':live?'live':cancelled?'settled':'upcoming'
  }
}
async function liveScores(date:string){
  if(!API_FOOTBALL_KEY)throw new Error('Live scores are temporarily unavailable')
  const url=new URL(`${API_FOOTBALL_BASE}/fixtures`);url.searchParams.set('date',date);url.searchParams.set('timezone',APP_TIMEZONE)
  const response=await fetch(url,{headers:{'x-apisports-key':API_FOOTBALL_KEY}}),body=await response.json().catch(()=>null)
  if(!response.ok)throw new Error('Live scores are temporarily unavailable')
  return(Array.isArray(body?.response)?body.response:[]).map(normalizeFixture)
}
function ou(s:any){const m=String(s||'').match(/\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null}
function settle(p:any,f:any){
  if(!f)return{outcome:'pending',matchState:'upcoming'}
  if(f.cancelled)return{outcome:'void',matchState:'settled',...f}
  if(!f.finished)return{outcome:'pending',matchState:f.matchState,...f}
  const h=Number(f.home?.score),a=Number(f.away?.score),market=String(p?.market||''),sel=norm(p?.selection)
  if(!Number.isFinite(h)||!Number.isFinite(a))return{outcome:'pending',matchState:'settled',...f}
  const win=(pass:boolean,voided=false)=>voided?'void':pass?'won':'lost';let outcome='pending'
  if(market==='match-winner'){if(sel==='home'||sel==='1')outcome=win(h>a);else if(sel==='away'||sel==='2')outcome=win(a>h);else if(sel==='draw'||sel==='x')outcome=win(h===a)}
  else if(market==='double-chance'){if(sel==='1x'||sel.includes('home or draw'))outcome=win(h>=a);else if(sel==='x2'||sel.includes('draw or away'))outcome=win(a>=h);else if(sel==='12'||sel.includes('home or away'))outcome=win(h!==a)}
  else if(market==='draw-no-bet'){if(h===a)outcome='void';else if(sel==='home'||sel==='1')outcome=win(h>a);else if(sel==='away'||sel==='2')outcome=win(a>h)}
  else if(market==='both-teams-score'){const yes=h>0&&a>0;if(sel==='yes')outcome=win(yes);else if(sel==='no')outcome=win(!yes)}
  else if(market==='total-goals'){const q=ou(p?.selection);if(q){const t=h+a;outcome=win(q.side==='over'?t>q.line:t<q.line,t===q.line)}}
  else if(market==='home-team-goals'){const q=ou(p?.selection);if(q)outcome=win(q.side==='over'?h>q.line:h<q.line,h===q.line)}
  else if(market==='away-team-goals'){const q=ou(p?.selection);if(q)outcome=win(q.side==='over'?a>q.line:a<q.line,a===q.line)}
  else if(market==='first-half-goals'&&finite(f.halftime?.home)&&finite(f.halftime?.away)){const t=Number(f.halftime.home)+Number(f.halftime.away),q=ou(p?.selection);if(q)outcome=win(q.side==='over'?t>q.line:t<q.line,t===q.line)}
  else if(market==='first-half-winner'&&finite(f.halftime?.home)&&finite(f.halftime?.away)){const x=Number(f.halftime.home),y=Number(f.halftime.away);if(sel==='home'||sel==='1')outcome=win(x>y);else if(sel==='away'||sel==='2')outcome=win(y>x);else if(sel==='draw'||sel==='x')outcome=win(x===y)}
  return{outcome,matchState:'settled',...f}
}
function performanceFromBoards(boards:any[]){
  const groups=new Map<string,any>(),summary={picks:0,won:0,lost:0,void:0,pending:0,winRate:0}
  for(const b of boards)for(const p of b?.bestPicks||[]){
    const r=b?.results?.[String(p.fixtureId)],outcome=r?.outcome||'pending';summary.picks++;if(outcome==='won')summary.won++;else if(outcome==='lost')summary.lost++;else if(outcome==='void')summary.void++;else summary.pending++
    if(!['won','lost'].includes(outcome))continue
    for(const dimension of ['market','country','league','confidence']){
      const value=dimension==='confidence'?(Number(p?.consensus)===100?'100%':`${Number(p?.consensus)||0}%`):String(p?.[dimension]||'Unknown'),k=`${dimension}|${value}`,g=groups.get(k)||{dimension,value,picks:0,won:0,lost:0}
      g.picks++;if(outcome==='won')g.won++;else g.lost++;groups.set(k,g)
    }
  }
  const decided=summary.won+summary.lost;summary.winRate=decided?Math.round(summary.won*1000/decided)/10:0
  const rows=[...groups.values()].map(g=>({...g,winRate:g.picks?Math.round(g.won*1000/g.picks)/10:0})).sort((a,b)=>b.picks-a.picks||b.winRate-a.winRate)
  return{summary,groups:rows}
}
function learningFromBoards(boards:any[]){
  const groups=new Map<string,any>()
  for(const b of boards)for(const p of b?.bestPicks||[]){const r=b?.results?.[String(p.fixtureId)];if(!r||!['won','lost'].includes(r.outcome))continue;const key=`${String(p.country||'').toLowerCase()}|${String(p.league||'').toLowerCase()}|${String(p.market||'').toLowerCase()}`,g=groups.get(key)||{key,country:p.country||'',league:p.league||'',market:p.market||'',wins:0,losses:0,sample:0};g.sample++;if(r.outcome==='won')g.wins++;else g.losses++;groups.set(key,g)}
  return[...groups.values()].map(g=>{const winRate=Math.round(g.wins*1000/g.sample)/10;let gate='standard';if(g.sample>=30&&winRate<50)gate='skip';else if(g.sample>=20&&winRate<58)gate='100-only';return{...g,winRate,gate,ready:g.sample>=20}}).sort((a,b)=>b.sample-a.sample)
}
async function boardRows(days=30){const end=today(),start=addDays(end,-Math.max(1,Math.min(90,days))+1);return await rest(`/rest/v1/prediction_snapshots?select=snapshot_date,payload,generated_at&snapshot_date=gte.${start}&snapshot_date=lte.${end}&order=snapshot_date.desc`)}
async function dispatchRefresh(){
  if(!GITHUB_TOKEN)throw new Error('Refresh control is not configured')
  const response=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/refresh-board.yml/dispatches`,{method:'POST',headers:{Authorization:`Bearer ${GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:'main'})})
  if(!response.ok)throw new Error('Refresh request failed')
  return true
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  const url=new URL(req.url),marker='/stats2pitch-api',route=(url.pathname.split(marker)[1]||'/').replace(/\/+$/,'')||'/'
  try{
    if(route==='/health')return json({ok:true,version:'4.0.0',engineVersion:ENGINE_VERSION})
    if(route==='/config')return json({version:'4.0.0',engineVersion:ENGINE_VERSION})
    if(route==='/board'&&req.method==='GET'){
      const date=requestedDate(url),row=await snapshot(date),status=snapshotState(date,row),board=row?.board||emptyBoard(date)
      return json({...board,meta:{...(board.meta||{}),date,refresh:status,requiresRefresh:status.state!=='complete'}})
    }
    if((route==='/export/elite'||route==='/api/export/elite')&&req.method==='GET'){
      if(!eliteAuthorized(req))return json({error:'unauthorized'},401)
      const date=requestedDate(url),row=await snapshot(date)
      if(!row?.board?.meta?.generatedAt)return json({error:'missing-snapshot',date},409)
      const items=eliteItems(row.board,date)
      return json({version:4,source:'stats2pitch',date,generated_at:row.board.meta.generatedAt,count:items.length,items})
    }
    if(route==='/results'&&req.method==='GET'){
      const date=requestedDate(url),row=await snapshot(date),board=row?.board||emptyBoard(date)
      let fixtures:any[]=[];try{fixtures=await liveScores(date)}catch{}
      const map=new Map(fixtures.map(f=>[String(f.fixtureId),f])),stored=board?.results||{}
      const picks=(board?.bestPicks||[]).map((p:any)=>{const current=map.get(String(p.fixtureId));const result=current?settle(p,current):stored[String(p.fixtureId)]||{outcome:'pending',matchState:Date.parse(p.kickoff)>Date.now()?'upcoming':'pending'};return{...p,result}})
      const varTips=(board?.varTips||[]).map((p:any)=>{const current=map.get(String(p.fixtureId));const result=current?settle(p,current):{outcome:'pending',matchState:Date.parse(p.kickoff)>Date.now()?'upcoming':'pending'};return{...p,result}})
      return json({date,picks,varTips,fixtures})
    }
    if(route==='/live-scores'&&req.method==='GET'){const date=requestedDate(url);return json({date,fixtures:await liveScores(date)})}
    if(route==='/performance'&&req.method==='GET'){
      const days=Math.max(1,Math.min(90,Number(url.searchParams.get('days')||30))),rows=await boardRows(days),boards=(rows||[]).map((x:any)=>x.payload).filter(Boolean)
      return json({days,...performanceFromBoards(boards),learning:learningFromBoards(boards)})
    }
    if(route==='/refresh-status'&&req.method==='GET'){const date=requestedDate(url),row=await snapshot(date);return json(snapshotState(date,row))}
    if(route==='/me'&&req.method==='GET'){const me=await verifyUser(req);if(!me)return json({error:'Authentication required'},401);return json({id:me.id,email:me.email||''})}
    if(route==='/admin/overview'&&req.method==='GET'){
      const admin=await verifyAdmin(req);if(!admin)return json({error:'Admin access required'},403)
      const rows=await boardRows(30),boards=(rows||[]).map((x:any)=>x.payload).filter(Boolean),performance=performanceFromBoards(boards),learning=learningFromBoards(boards)
      const latest=(rows||[])[0]||null,meta=latest?.payload?.meta||{},latestPicks=(latest?.payload?.bestPicks||[]).slice(0,25)
      return json({user:{email:admin.email||''},snapshots:rows.length,performance,learning,latest,health:{footballData:Boolean(API_FOOTBALL_KEY),sourceFixtures:meta.sourceFixtures||0,scheduledFixtures:meta.scheduledFixtures||0,analyzedFixtures:meta.analyzedFixtures||0,statsVerifiedFixtures:meta.statsVerifiedFixtures||0,historyFallbackTeams:meta.historyFallbackTeams||0},latestPicks})
    }
    if(route==='/admin/refresh'&&req.method==='POST'){
      const admin=await verifyAdmin(req);if(!admin)return json({error:'Admin access required'},403);await dispatchRefresh();return json({ok:true,message:'Refresh requested.'},202)
    }
    return json({error:'Not found'},404)
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Server error'},500)}
})
