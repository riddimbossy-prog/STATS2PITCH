import {buildLearningProfiles,buildLearningState,publicLearning} from './learning.js'

const ELITE_FEED_TOKEN=Deno.env.get('STATS2PITCH_ELITE_FEED_TOKEN')||''
const ENGINE_VERSION='stats2pitch-v5-var-tips'
const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'UTC'
const SPORTYBET_COUNTRY=(Deno.env.get('SPORTYBET_COUNTRY')||'gh').replace(/[^a-z]/gi,'').toLowerCase()||'gh'
const SPORTYBET_BASE=(Deno.env.get('SPORTYBET_BASE')||'https://www.sportybet.com').replace(/\/$/,'')
const TTL_MS=Math.max(15,Number(Deno.env.get('AUTO_REFRESH_TTL_MINUTES')||45))*60_000
const ADMIN_EMAILS=['stats2pitch@gmail.com',...(Deno.env.get('STATS2PITCH_ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)]
const GITHUB_TOKEN=Deno.env.get('STATS2PITCH_GITHUB_TOKEN')||''
const GITHUB_REPO=Deno.env.get('STATS2PITCH_GITHUB_REPO')||'riddimbossy-prog/STATS2PITCH'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200,cache='no-store')=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':cache}})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const finite=(v:any)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
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
function clientIp(req:Request){
  const xf=req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||''
  return xf.split(',')[0].trim()
}
function deviceOf(raw:string){
  return ['mobile','desktop','tablet'].includes(raw)?raw:'mobile'
}
async function lookupGeo(req:Request){
  const ip=clientIp(req)
  const fallback={country:'GH',countryName:'Ghana',city:'Accra'}
  if(!ip||ip==='127.0.0.1'||ip.startsWith(':'))return fallback
  try{
    const r=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,city`,{headers:{Accept:'application/json'}})
    const d=await r.json()
    if(d?.success!==false&&d?.country_code){
      return{country:String(d.country_code).toUpperCase().slice(0,2),countryName:String(d.country||'Unknown'),city:String(d.city||'')}
    }
  }catch{}
  return fallback
}
function accraDay(input:Date|string|number=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Accra',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(input))
}
function lastDays(n:number){
  return Array.from({length:n},(_,i)=>accraDay(Date.now()-(n-1-i)*86_400_000))
}
const REGION_INDEX:Record<string,string>={}
function addRegion(name:string, codes:string){
  for(const c of codes.split(' ')) REGION_INDEX[c]=name
}
addRegion('Africa','DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW')
addRegion('Europe','AL AT BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LT LU MT MD ME NL MK NO PL PT RO RS SK SI ES SE CH UA GB')
addRegion('North America','US CA MX GT HN NI CR PA CU DO HT JM TT')
addRegion('South America','AR BO BR CL CO EC GY PY PE UY VE')
addRegion('Asia','AE SA QA KW BH OM IL JO LB TR IR IQ IN PK BD LK NP CN HK TW JP KR VN TH MY SG ID PH KH LA MM KZ UZ')
addRegion('Oceania','AU NZ PG FJ')
function regionOf(code:string){
  return REGION_INDEX[String(code||'').toUpperCase()]||'Unknown'
}
function pruneDays(days:Record<string,unknown>){
  const keep=new Set(lastDays(62))
  const out:Record<string,unknown>={}
  for(const [k,v] of Object.entries(days||{})) if(keep.has(k)) out[k]=v
  return out
}
function visitorFromUser(u:any, now=Date.now()){
  const m=u?.user_metadata||{}
  const last=Date.parse(m.last_seen_at||'')
  const online=Number.isFinite(last)&&now-last<120000
  const sessions=Math.max(1,Number(m.session_count||m.login_count||1))
  const total=Math.max(0,Number(m.total_seconds||0))
  const country=String(m.country||'').toUpperCase()||'—'
  const activeDays=Object.keys(m.presence_days||{})
  if(m.last_seen_at){
    const day=accraDay(m.last_seen_at)
    if(!activeDays.includes(day)) activeDays.push(day)
  }
  return{
    id:u.id,
    email:u.email||'',
    name:String(u.email||'user').split('@')[0],
    country,
    countryName:m.country_name||m.country||'Unknown',
    city:m.city||'',
    region:regionOf(country),
    loginCount:Number(m.login_count||0),
    sessionCount:sessions,
    totalSeconds:total,
    avgSessionSeconds:sessions?Math.round(total/sessions):0,
    lastSeenAt:m.last_seen_at||null,
    createdAt:u.created_at||m.first_seen_at||null,
    lastPath:m.last_path||'/',
    device:m.device||'mobile',
    activeDays,
    online
  }
}
function analyticsFrom(visitors:any[]){
  const series=lastDays(30).map(day=>{
    const online=visitors.filter((v:any)=>(v.activeDays||[]).includes(day)).length
    const neu=visitors.filter((v:any)=>v.createdAt&&accraDay(v.createdAt)===day).length
    return {day,online,newUsers:neu}
  })
  const createdIn=(n:number)=>visitors.filter((v:any)=>v.createdAt&&lastDays(n).includes(accraDay(v.createdAt))).length
  const activeIn=(n:number)=>visitors.filter((v:any)=>(v.activeDays||[]).some((d:string)=>lastDays(n).includes(d))).length
  const regionMap:Record<string,{name:string,count:number,online:number}>={}
  const countryMap:Record<string,{code:string,name:string,region:string,count:number,online:number}>={}
  for(const v of visitors){
    const region=v.region||'Unknown'
    regionMap[region]=regionMap[region]||{name:region,count:0,online:0}
    regionMap[region].count++
    if(v.online) regionMap[region].online++
    const code=String(v.country||'')
    if(code&&code!=='—'){
      countryMap[code]=countryMap[code]||{code,name:v.countryName||code,region,count:0,online:0}
      countryMap[code].count++
      if(v.online) countryMap[code].online++
    }
  }
  return{
    newUsers:{day:createdIn(1),week:createdIn(7),month:createdIn(30),total:visitors.length},
    active:{day:activeIn(1),week:activeIn(7),month:activeIn(30)},
    series,
    regions:Object.values(regionMap).sort((a,b)=>b.count-a.count),
    countries:Object.values(countryMap).sort((a,b)=>b.count-a.count)
  }
}
async function listAuthUsers(){
  const out:any[]=[]
  if(!SUPABASE_SERVICE_ROLE_KEY)return out
  for(let page=1;page<=10;page++){
    const r=await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,{
      headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`}
    })
    const d=await r.json().catch(()=>({}))
    const users=Array.isArray(d?.users)?d.users:[]
    out.push(...users)
    if(users.length<200)break
  }
  return out
}
async function recordPresence(user:any, req:Request, body:any){
  const now=new Date()
  const meta=user.user_metadata||{}
  const last=Date.parse(meta.last_seen_at||'')
  const isNewSession=!Number.isFinite(last)||now.getTime()-last>30*60*1000
  const seconds=Math.max(0,Math.min(180,Math.round(Number(body?.seconds||15))))
  let country=String(meta.country||'')
  let countryName=String(meta.country_name||'')
  let city=String(meta.city||'')
  if(!country){
    const geo=await lookupGeo(req)
    country=geo.country
    countryName=geo.countryName
    city=geo.city
  }
  const day=accraDay(now)
  const days=pruneDays((meta.presence_days&&typeof meta.presence_days==='object')?meta.presence_days:{})
  const cur:any=days[day]&&typeof days[day]==='object'?days[day]:{hits:0,seconds:0}
  days[day]={hits:Number(cur.hits||0)+1,seconds:Number(cur.seconds||0)+seconds}
  const next={
    ...meta,
    country,
    country_name:countryName,
    city,
    login_count:Number(meta.login_count||0)+(isNewSession?1:0),
    session_count:Number(meta.session_count||0)+(isNewSession?1:0),
    total_seconds:Number(meta.total_seconds||0)+seconds,
    last_seen_at:now.toISOString(),
    first_seen_at:meta.first_seen_at||now.toISOString(),
    last_login_at:isNewSession?now.toISOString():(meta.last_login_at||now.toISOString()),
    last_path:String(body?.path||'/').slice(0,120),
    device:deviceOf(String(body?.device||'')),
    presence_days:days
  }
  if(SUPABASE_SERVICE_ROLE_KEY){
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,{
      method:'PUT',
      headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({user_metadata:next})
    }).catch(()=>{})
  }
  return visitorFromUser({...user,user_metadata:next}, now.getTime())
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
function isLogo(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)||s.startsWith('/')}
function preferLogo(...values:any[]){
  const urls=values.map(v=>String(v||'').trim()).filter(isLogo)
  return urls.find(u=>/s\.sporty\.net\//i.test(u))||urls[0]||null
}
function attachCrests(board:any){
  if(!board)return board
  const fx=new Map((board.fixtures||[]).map((f:any)=>[String(f.fixtureId),f]))
  const patch=(row:any)=>{
    if(!row)return row
    const f:any=fx.get(String(row.fixtureId))||{}
    const homeLogo=preferLogo(row.homeLogo,f.homeLogo)
    const awayLogo=preferLogo(row.awayLogo,f.awayLogo)
    if(homeLogo===row.homeLogo&&awayLogo===row.awayLogo)return row
    return{...row,homeLogo,awayLogo}
  }
  const next={...board}
  for(const key of ['bestPicks','varTips','filterTips','goalsBankers','comboPicks','h2hPicks','dailyBankers','safestBankers','valueBankers','bankers','priority'])if(Array.isArray(board[key]))next[key]=board[key].map(patch)
  return next
}
function emptyBoard(date:string){return{meta:{date,generatedAt:null,qualified:0,bestPicks:0,varTipsCount:0,filterTipsCount:0,goalsBankersCount:0,comboCount:0,h2hCount:0,safestBankersCount:0,valueBankersCount:0,engineVersion:ENGINE_VERSION,requiresRefresh:true},priority:[],bestPicks:[],varTips:[],filterTips:[],goalsBankers:[],comboPicks:[],h2hPicks:[],dailyBankers:[],safestBankers:[],valueBankers:[],fixtures:[],availableMarkets:[],results:{}}}
function isComboBoardPick(r:any){
  const m=String(r?.market||'')
  const engine=String(r?.engineVersion||r?.engine||'')
  return m.startsWith('combo-')||engine.startsWith('combo-')
}
function splitGoalsAndCombo(board:any={}){
  const rawGoals=Array.isArray(board?.goalsBankers)?board.goalsBankers:[]
  const dedicated=Array.isArray(board?.comboPicks)?board.comboPicks.filter(isComboBoardPick):[]
  const fromGoals=rawGoals.filter(isComboBoardPick)
  return{goalsBankers:rawGoals.filter((r:any)=>!isComboBoardPick(r)),comboPicks:dedicated.length?dedicated:fromGoals}
}
function sanitizeGoalsAndCombo(board:any={}){
  const split=splitGoalsAndCombo(board)
  return{
    ...board,
    goalsBankers:split.goalsBankers,
    comboPicks:split.comboPicks,
    meta:{
      ...(board?.meta||{}),
      goalsBankersCount:split.goalsBankers.length,
      comboCount:split.comboPicks.length,
      comboEngine:board?.meta?.comboEngine||board?.comboMeta?.engine||null
    }
  }
}
const FILTER_ENGINE='perfect-split-v1'
const FILTER_MIN_ODD=1.20
const GOAL_KEYS=new Set(['total-goals','home-team-goals','away-team-goals'])
function goalLine(sel:any){
  const m=String(sel||'').match(/^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/i)
  return m?Number(m[2]):null
}
function isHybridSelection(row:any){
  return /&/.test(String(row?.selection||''))||/&/.test(String(row?.displaySelection||''))
}
function sanitizeFilterTips(rows:any,expectedEngine:any=FILTER_ENGINE){
  const eng=String(expectedEngine||FILTER_ENGINE).trim()||FILTER_ENGINE
  return (Array.isArray(rows)?rows:[]).filter((row:any)=>{
    const got=String(row?.engine||row?.engineVersion||'').trim()
    if(got&&got!==eng)return false
    const odds=Number(row?.odds)
    return Number.isFinite(odds)&&odds>=FILTER_MIN_ODD
  })
}
function sanitizeBestPicks(rows:any){
  return (Array.isArray(rows)?rows:[]).filter((row:any)=>{
    if(isHybridSelection(row))return false
    const k=String(row?.market||'')
    const line=goalLine(row?.selection)
    if(k==='total-goals')return line===1.5||line===2.5||line===3.5
    if(k==='home-team-goals'||k==='away-team-goals'||k==='team-goals')return line===0.5||line===1.5||line===2.5
    return true
  })
}
function sanitizeH2HPicks(rows:any){
  return (Array.isArray(rows)?rows:[]).filter((row:any)=>{
    if(isHybridSelection(row))return false
    const k=String(row?.market||'')
    if(!GOAL_KEYS.has(k))return true
    const line=goalLine(row?.selection)
    return line!=null&&Math.abs(line%1-0.5)<1e-9
  })
}
function slimMeta(meta:any={}){
  return{
    date:meta.date,
    generatedAt:meta.generatedAt||null,
    storedAt:meta.storedAt||null,
    engineVersion:meta.engineVersion,
    engine:meta.engine,
    qualified:meta.qualified,
    bestPicks:meta.bestPicks,
    publishedPicks:meta.publishedPicks,
    firstPublishedAt:meta.firstPublishedAt,
    varTipsEngine:meta.varTipsEngine,
    varTipsCount:meta.varTipsCount,
    filterTipsEngine:meta.filterTipsEngine,
    filterTipsCount:meta.filterTipsCount,
    goalsBankersEngine:meta.goalsBankersEngine,
    goalsBankersCount:meta.goalsBankersCount,
    comboEngine:meta.comboEngine,
    comboCount:meta.comboCount,
    h2hEngine:meta.h2hEngine,
    h2hCount:meta.h2hCount,
    dailyBankersEngine:meta.dailyBankersEngine,
    safestBankersCount:meta.safestBankersCount,
    valueBankersCount:meta.valueBankersCount,
    requiresRefresh:meta.requiresRefresh===true,
    refresh:meta.refresh||null
  }
}
const PICK_KEEP=new Set(['fixtureId','home','away','homeLogo','awayLogo','homeId','awayId','league','country','kickoff','market','marketName','selection','displaySelection','pick','odds','publishedAt','reasons','shortReason','homeConsensus','awayConsensus','consensus','engineRating','comboScore','rank','group','earlySeason','favourite','kind','route','family','engine','engineVersion','classification','homeSplit','awaySplit','bankerChecks','bankerApproved','currentVenueSamples','learning','learningProfile','marketWhy','oddsBook','why','occurrence','h2hHits','h2hMatches','userWhy'])
function slimForm(rows:any){
  return (Array.isArray(rows)?rows:[]).slice(0,5).map((x:any)=>({
    result:x?.result||'',opponent:x?.opponent||'',home:x?.home||'',away:x?.away||'',
    hs:x?.hs??null,as:x?.as??null,date:x?.date||'',venue:x?.venue||'',league:x?.league||''
  }))
}
function slimStats(s:any){
  if(!s||typeof s!=='object')return null
  return{played:s.played??null,winPct:s.winPct??null,ppg:s.ppg??null,gf:s.gf??null,ga:s.ga??null,btts:s.btts??null,over15:s.over15??null,over25:s.over25??null}
}
function slimWhy(why:any){
  if(!why||typeof why!=='object')return null
  const lastHome=slimForm(why.lastMatchesHome||why.last5Home)
  const lastAway=slimForm(why.lastMatchesAway||why.last5Away)
  return{headline:why.headline||'',classification:why.classification||'',homeStats:slimStats(why.homeStats||why.homeAvg),awayStats:slimStats(why.awayStats||why.awayAvg),lastMatchesHome:lastHome,lastMatchesAway:lastAway,h2h:slimForm(why.h2h)}
}
function slimLearning(l:any){
  if(!l||typeof l!=='object')return null
  return{gate:l.gate||'',note:l.note||'',action:l.action||'',label:l.label||'',wins:l.wins??null,losses:l.losses??null,sample:l.sample??null,winRate:l.winRate??null}
}
function slimPick(row:any){
  if(!row||typeof row!=='object')return row
  const out:any={}
  for(const k of PICK_KEEP) if(row[k]!==undefined) out[k]=row[k]
  if(out.why) out.why=slimWhy(out.why)
  if(out.learning) out.learning=slimLearning(out.learning)
  if(Array.isArray(out.reasons)) out.reasons=out.reasons.slice(0,8)
  return out
}
function slimPicks(rows:any){return (Array.isArray(rows)?rows:[]).map(slimPick)}
function slimFixtures(rows:any){
  return (Array.isArray(rows)?rows:[]).map((f:any)=>({fixtureId:f?.fixtureId??null,homeLogo:f?.homeLogo||null,awayLogo:f?.awayLogo||null}))
}
function slimResults(results:any,picks:any[]){
  const src=results&&typeof results==='object'?results:{}
  const keys=new Set<string>()
  for(const p of picks||[]){
    const id=String(p?.fixtureId||'')
    if(id)keys.add(id)
    if(p?.fixtureId!=null&&p?.market)keys.add(`${p.fixtureId}|${p.market}|${String(p.selection||'').trim()}`)
  }
  const out:any={}
  for(const id of keys){
    const r=src[id]
    if(!r)continue
    out[id]={outcome:r.outcome||'pending',matchState:r.matchState||'pending',homeScore:r.homeScore??r.home?.score??null,awayScore:r.awayScore??r.away?.score??null,minute:r.minute||r.clock||null,status:r.status||'',live:r.live===true,finished:r.finished===true,postponed:r.postponed===true,cancelled:r.cancelled===true}
  }
  return out
}
function finalizePublic(empty:any){
  const bags=['bestPicks','varTips','filterTips','goalsBankers','comboPicks','h2hPicks','dailyBankers','safestBankers','valueBankers','bankers','priority']
  const picks:any[]=[]
  for(const k of bags){
    if(Array.isArray(empty[k])){
      empty[k]=slimPicks(empty[k])
      picks.push(...empty[k])
    }
  }
  empty.fixtures=slimFixtures(empty.fixtures)
  empty.results=slimResults(empty.results,picks)
  return empty
}
function publicBoard(board:any={},view='all'){
  const v=['all','var','filter','goals','combo','h2h','bankers'].includes(String(view||''))?String(view):'all'
  const split=splitGoalsAndCombo(board)
  const empty:any={
    meta:slimMeta(board?.meta||{}),
    fixtures:Array.isArray(board?.fixtures)?board.fixtures:[],
    availableMarkets:[],
    results:board?.results&&typeof board.results==='object'?board.results:{},
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    comboPicks:[],
    h2hPicks:[],
    dailyBankers:[],
    safestBankers:[],
    valueBankers:[],
    dailyBankersMeta:null,
    priority:[],
    bankers:[]
  }
  const markets=(rows:any[])=>[...new Set((rows||[]).map((x:any)=>x?.market).filter(Boolean))].sort()
  if(v==='var'){empty.varTips=board?.varTips||[];empty.varTipsMeta=board?.varTipsMeta||null;empty.availableMarkets=markets(empty.varTips);return finalizePublic(empty)}
  if(v==='filter'){
    empty.filterTips=sanitizeFilterTips(board?.filterTips,board?.meta?.filterTipsEngine||board?.filterTipsMeta?.engine)
    empty.filterTipsMeta=board?.filterTipsMeta||null
    empty.availableMarkets=markets(empty.filterTips)
    empty.meta.filterTipsCount=empty.filterTips.length
    return finalizePublic(empty)
  }
  if(v==='goals'){empty.goalsBankers=split.goalsBankers;empty.goalsBankersMeta=board?.goalsBankersMeta||null;empty.availableMarkets=markets(empty.goalsBankers);return finalizePublic(empty)}
  if(v==='combo'){empty.comboPicks=split.comboPicks;empty.comboMeta=board?.comboMeta||null;empty.availableMarkets=markets(empty.comboPicks);return finalizePublic(empty)}
  if(v==='h2h'){
    empty.h2hPicks=sanitizeH2HPicks(board?.h2hPicks)
    empty.h2hMeta=board?.h2hMeta||null
    empty.availableMarkets=markets(empty.h2hPicks)
    empty.meta.h2hCount=empty.h2hPicks.length
    return finalizePublic(empty)
  }
  if(v==='bankers'){
    empty.dailyBankers=board?.dailyBankers||[]
    empty.safestBankers=board?.safestBankers||[]
    empty.valueBankers=board?.valueBankers||[]
    empty.dailyBankersMeta=board?.dailyBankersMeta||null
    empty.availableMarkets=markets([...empty.safestBankers,...empty.valueBankers,...empty.dailyBankers])
    return finalizePublic(empty)
  }
  empty.bestPicks=sanitizeBestPicks(board?.bestPicks)
  empty.availableMarkets=Array.isArray(board?.availableMarkets)&&board.availableMarkets.length?board.availableMarkets:markets(empty.bestPicks)
  empty.meta.publishedPicks=empty.bestPicks.length
  empty.meta.bestPicks=empty.bestPicks.length
  return finalizePublic(empty)
}
function compactResultRows(rows:any[]){return (rows||[]).map((p:any)=>({fixtureId:p?.fixtureId??null,market:p?.market||null,selection:p?.selection||null,result:p?.result||null}))}
async function snapshot(date:string){
  const rows=await rest(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null,payload=row?.payload||null
  if(!payload)return null
  const board=sanitizeGoalsAndCombo({...payload,meta:{...(payload.meta||{}),storedAt:row.generated_at}})
  return{board,generatedAt:row.generated_at}
}
function snapshotState(date:string,row:{board:any,generatedAt:string}|null){
  const raw=row?.board?.meta?.generatedAt||row?.generatedAt||'',at=Date.parse(raw),isFresh=Number.isFinite(at)&&Date.now()-at<TTL_MS
  return{state:isFresh?'complete':row?'stale':'idle',date,generatedAt:raw||null,stale:!isFresh}
}
function normalizeFixture(x:any){
  const status=String(x?.fixture?.status?.short||x?.status||'').toUpperCase(),finished=FINISHED.has(status),live=['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(status),cancelled=['CANC','ABD','AWD','WO'].includes(status),postponed=status==='PST'
  const full=x?.score?.fulltime||{},half=x?.score?.halftime||{}
  const homeScore=finite(full?.home)?Number(full.home):finite(x?.goals?.home)?Number(x.goals.home):finite(x?.home?.score)?Number(x.home.score):finite(x?.homeScore)?Number(x.homeScore):null
  const awayScore=finite(full?.away)?Number(full.away):finite(x?.goals?.away)?Number(x.goals.away):finite(x?.away?.score)?Number(x.away.score):finite(x?.awayScore)?Number(x.awayScore):null
  const homeName=x?.teams?.home?.name||x?.homeName||''
  const awayName=x?.teams?.away?.name||x?.awayName||''
  const clock=x?.fixture?.clock??x?.fixture?.status?.elapsed??x?.clock??x?.minute??null
  return{
    fixtureId:x?.fixture?.id??x?.fixtureId,status,statusLong:x?.fixture?.status?.long||x?.statusLong||'',minute:clock,clock,kickoff:x?.fixture?.date||x?.kickoff,
    league:x?.league?.name||'',country:x?.league?.country||'',
    home:{id:x?.teams?.home?.id,name:homeName,logo:x?.teams?.home?.logo||null,score:homeScore},
    away:{id:x?.teams?.away?.id,name:awayName,logo:x?.teams?.away?.logo||null,score:awayScore},
    homeName,awayName,homeScore,awayScore,
    halftime:{home:finite(half?.home)?Number(half.home):finite(x?.htHome)?Number(x.htHome):null,away:finite(half?.away)?Number(half.away):finite(x?.htAway)?Number(x.htAway):null},
    finished,live,cancelled,postponed,matchState:finished?'settled':live?'live':(cancelled||postponed)?'settled':'upcoming'
  }
}
function nid(raw:any){const m=String(raw??'').match(/(\d+)$/);return m?Number(m[1]):null}
function crest(id:any){return id?`https://img.sportradar.com/ls/crest/big/${id}.png`:null}
function liveClock(ev:any){
  const played=String(ev?.playedSeconds||ev?.playedTime||'').trim()
  const period=String(ev?.matchStatus||'').trim().toUpperCase()
  if(played&&period)return `${played} ${period}`
  return played||period||null
}
function sportyStatus(ev:any){
  const raw=String(ev?.matchStatus||'').toLowerCase(),code=Number(ev?.status)
  if(/postpon/.test(raw))return{short:'PST',long:ev.matchStatus||'Postponed'}
  if(/cancel/.test(raw))return{short:'CANC',long:ev.matchStatus||'Cancelled'}
  if(/abandon/.test(raw))return{short:'ABD',long:ev.matchStatus||'Abandoned'}
  if(/walkover/.test(raw))return{short:'WO',long:ev.matchStatus||'Walkover'}
  if(/not[\s_-]*start|upcoming|ns\b/.test(raw)||code===0)return{short:'NS',long:ev.matchStatus||'Not started'}
  if(/end|finish|close|complete|\bft\b/.test(raw)||code===3)return{short:'FT',long:ev.matchStatus||'Match Finished'}
  if(/\bh1\b|1st|first.?half/.test(raw)||String(ev?.period)==='1')return{short:'1H',long:ev.matchStatus||'1st half'}
  if(/\bht\b|half.?time|pause/.test(raw))return{short:'HT',long:ev.matchStatus||'Half time'}
  if(/\bh2\b|2nd|second.?half/.test(raw)||String(ev?.period)==='2')return{short:'2H',long:ev.matchStatus||'2nd half'}
  if(/extra.?time|\bet\b/.test(raw))return{short:'ET',long:ev.matchStatus||'Extra time'}
  if(/live|in.?play/.test(raw)||code===1||code===2)return{short:'LIVE',long:ev.matchStatus||'Live'}
  return{short:'NS',long:ev.matchStatus||'Not started'}
}
function parsePair(blob:any){
  const m=String(blob??'').match(/(\d+)\s*[-:]\s*(\d+)/)
  return m?{home:Number(m[1]),away:Number(m[2])}:null
}
function sportyScore(ev:any){
  const pairs=[[ev?.homeScore,ev?.awayScore],[ev?.setScore?.home,ev?.setScore?.away],[ev?.score?.home,ev?.score?.away],[ev?.homeGoal,ev?.awayGoal]]
  for(const [h,a] of pairs){const home=Number(h),away=Number(a);if(h!==null&&h!==undefined&&h!==''&&a!==null&&a!==undefined&&a!==''&&Number.isFinite(home)&&Number.isFinite(away))return{home,away}}
  return parsePair(ev?.setScore||ev?.score||ev?.availableScore)||{home:null,away:null}
}
function accraDate(ms:any){
  if(!Number.isFinite(Number(ms)))return ''
  return new Intl.DateTimeFormat('en-CA',{timeZone:APP_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(ms)))
}
function sportyToFixture(ev:any,tournament:any={}){
  const sport=ev?.sport||{},category=sport?.category||{},tour=category?.tournament||tournament||{}
  const status=sportyStatus(ev),goals=sportyScore(ev),kick=Number.isFinite(Number(ev?.estimateStartTime))?new Date(Number(ev.estimateStartTime)).toISOString():null
  const homeId=nid(ev?.homeTeamId),awayId=nid(ev?.awayTeamId)
  return{
    fixture:{id:nid(ev?.eventId)||nid(ev?.gameId),date:kick,status:{short:status.short,long:status.long,elapsed:liveClock(ev)},timestamp:ev?.estimateStartTime||null,clock:liveClock(ev)},
    league:{id:nid(tour?.id)||tour?.id||null,name:tour?.name||'',country:category?.name||tournament?.categoryName||''},
    teams:{home:{id:homeId,name:ev?.homeTeamName||'',logo:ev?.homeTeamIcon||crest(homeId)},away:{id:awayId,name:ev?.awayTeamName||'',logo:ev?.awayTeamIcon||crest(awayId)}},
    goals,score:{fulltime:goals,halftime:{}}
  }
}
function sportyHeaders(){return{Accept:'application/json, text/plain, */*',Origin:SPORTYBET_BASE,Referer:`${SPORTYBET_BASE}/${SPORTYBET_COUNTRY}/sport/football/today`,Clientid:'web',Platform:'web','User-Agent':'Mozilla/5.0'}}
function flattenSporty(data:any){
  const tours=Array.isArray(data)?data:Array.isArray(data?.tournaments)?data.tournaments:[]
  const out:any[]=[]
  for(const tour of tours)for(const ev of tour?.events||[])out.push(sportyToFixture(ev,tour))
  return out
}
async function sportyLiveEvents(){
  const url=new URL(`${SPORTYBET_BASE}/api/${SPORTYBET_COUNTRY}/factsCenter/liveOrPrematchEvents`)
  url.searchParams.set('sportId','sr:sport:1');url.searchParams.set('marketId','1')
  const response=await fetch(url,{headers:sportyHeaders()}),body=await response.json().catch(()=>null)
  if(!response.ok||body?.bizCode!==10000)return[]
  return flattenSporty(body?.data).filter((f:any)=>['LIVE','1H','HT','2H','ET','BT','P','INT'].includes(String(f?.fixture?.status?.short||'')))
}
function keyName(s:any){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function mergeLive(map:Map<string,any>,liveRows:any[],published:any[]){
  const byName=new Map<string,string>()
  for(const p of published||[]){
    const k=keyName(p?.home)+'|'+keyName(p?.away)
    if(k!=='|')byName.set(k,String(p.fixtureId))
  }
  for(const f of liveRows||[]){
    const n=f?.matchState?f:normalizeFixture(f)
    const id=String(n.fixtureId||'')
    if(id&&id!=='undefined'&&id!=='null')map.set(id,n)
    const k=keyName(n.homeName||n.home?.name)+'|'+keyName(n.awayName||n.away?.name)
    const alias=byName.get(k)
    if(alias&&alias!==id)map.set(alias,n)
  }
  return map
}
async function liveScores(date:string, published:any[]=[]){
  const out:any[]=[]
  try{
    const live=await sportyLiveEvents()
    out.push(...live)
  }catch{}
  const have=new Set(out.map((f:any)=>String(f?.fixture?.id||'')))
  const now=Date.now()
  const missing=(published||[])
    .map((p:any)=>p?.fixtureId)
    .filter((id:any,i:number,arr:any[])=>id!=null&&arr.indexOf(id)===i&&!have.has(String(id)))
    .filter((id:any)=>{
      const row=(published||[]).find((p:any)=>String(p.fixtureId)===String(id))
      const k=Date.parse(row?.kickoff||'')
      return Number.isFinite(k)&&k<now
    })
    .slice(0,24)
  const ctrl=typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?AbortSignal.timeout(3500):undefined
  await Promise.all(missing.map(async(id:any)=>{
    const n=nid(id);if(!n)return
    try{
      const res=await fetch(`https://stats.fn.sportradar.com/common/en/Etc:UTC/gismo/stats_match_get/${n}`,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:'https://www.sportybet.com/'},signal:ctrl})
      const body=await res.json().catch(()=>null)
      const data=body?.doc?.[0]?.event==='exception'?null:body?.doc?.[0]?.data
      if(!data)return
      const home=data?.teams?.home||{},away=data?.teams?.away||{}
      const homeId=nid(home.uid||home._id),awayId=nid(away.uid||away._id)
      const ftH=data?.result?.home??data?.periods?.ft?.home,ftA=data?.result?.away??data?.periods?.ft?.away
      const finished=Number.isFinite(Number(ftH))&&Number.isFinite(Number(ftA))
      const uts=Number(data?.time?.uts)
      const short=data?.canceled||data?.cancelled?'CANC':data?.postponed?'PST':data?.walkover?'WO':finished?'FT':'NS'
      const long=short==='CANC'?'Cancelled':short==='PST'?'Postponed':short==='WO'?'Walkover':finished?'Match Finished':'Not started'
      out.push({
        fixture:{id:n,date:Number.isFinite(uts)?new Date(uts*1000).toISOString():null,status:{short,long}},
        league:{id:nid(data?._utid),name:data?.tournament?.name||'',country:data?.realcategory?.name||''},
        teams:{home:{id:homeId,name:home.mediumname||home.name||'',logo:crest(homeId)},away:{id:awayId,name:away.mediumname||away.name||'',logo:crest(awayId)}},
        goals:{home:finished?Number(ftH):null,away:finished?Number(ftA):null},
        score:{fulltime:{home:finished?Number(ftH):null,away:finished?Number(ftA):null},halftime:{home:finite(data?.periods?.p1?.home)?Number(data.periods.p1.home):null,away:finite(data?.periods?.p1?.away)?Number(data.periods.p1.away):null}}
      })
    }catch{}
  }))
  return out.map(normalizeFixture)
}
function ou(s:any){const m=String(s||'').match(/\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null}
function settle(p:any,f:any){
  if(!f)return{outcome:'pending',matchState:'upcoming'}
  if(f.postponed||String(f.status||'').toUpperCase()==='PST')return{outcome:'postponed',matchState:'settled',...f}
  if(f.cancelled)return{outcome:'void',matchState:'settled',...f}
  if(!f.finished)return{outcome:'pending',matchState:f.matchState,...f}
  const h=Number(f.home?.score),a=Number(f.away?.score),market=String(p?.market||''),sel=norm(p?.selection)
  if(!Number.isFinite(h)||!Number.isFinite(a))return{outcome:'pending',matchState:'settled',...f}
  const win=(pass:boolean,voided=false)=>voided?'void':pass?'won':'lost';let outcome='pending'
  if(market==='match-winner'){if(sel==='home'||sel==='1')outcome=win(h>a);else if(sel==='away'||sel==='2')outcome=win(a>h);else if(sel==='draw'||sel==='x')outcome=win(h===a)}
  else if(market==='double-chance'){if(sel==='1x'||sel.includes('home or draw'))outcome=win(h>=a);else if(sel==='x2'||sel.includes('draw or away'))outcome=win(a>=h);else if(sel==='12'||sel.includes('home or away'))outcome=win(h!==a)}
  else if(market==='draw-no-bet'){if(h===a)outcome='void';else if(sel==='home'||sel==='1')outcome=win(h>a);else if(sel==='away'||sel==='2')outcome=win(a>h)}
  else if(market==='both-teams-score'){const yes=h>0&&a>0;if(sel==='yes')outcome=win(yes);else if(sel==='no')outcome=win(!yes)}
  else if(market==='draw-or-over-25'){outcome=win(h===a||(h+a)>2.5)}
  else if(market==='draw-or-under-25'){outcome=win(h===a||(h+a)<2.5)}
  else if(market==='draw-or-gg'||market==='draw-or-btts'){outcome=win(h===a||(h>0&&a>0))}
  else if(market.startsWith('combo-')){
    const total=h+a,gg=h>0&&a>0,anyCleanSheet=h===0||a===0,homeWin=h>a,draw=h===a,awayWin=a>h
    const map:Record<string,boolean>={
      'combo-home-over-25':homeWin||total>2.5,
      'combo-home-under-25':homeWin||total<2.5,
      'combo-draw-over-25':draw||total>2.5,
      'combo-draw-under-25':draw||total<2.5,
      'combo-away-over-25':awayWin||total>2.5,
      'combo-away-under-25':awayWin||total<2.5,
      'combo-home-gg':homeWin||gg,
      'combo-draw-gg':draw||gg,
      'combo-away-gg':awayWin||gg,
      'combo-home-clean-sheet':homeWin||anyCleanSheet,
      'combo-draw-clean-sheet':draw||anyCleanSheet,
      'combo-away-clean-sheet':awayWin||anyCleanSheet
    }
    if(Object.prototype.hasOwnProperty.call(map,market))outcome=win(map[market])
  }
  else if(market==='total-goals'){const q=ou(p?.selection);if(q){const t=h+a;outcome=win(q.side==='over'?t>q.line:t<q.line,t===q.line)}}
  else if(market==='home-team-goals'){const q=ou(p?.selection);if(q)outcome=win(q.side==='over'?h>q.line:h<q.line,h===q.line)}
  else if(market==='away-team-goals'){const q=ou(p?.selection);if(q)outcome=win(q.side==='over'?a>q.line:a<q.line,a===q.line)}
  else if(market==='first-half-goals'&&finite(f.halftime?.home)&&finite(f.halftime?.away)){const t=Number(f.halftime.home)+Number(f.halftime.away),q=ou(p?.selection);if(q)outcome=win(q.side==='over'?t>q.line:t<q.line,t===q.line)}
  else if(market==='first-half-winner'&&finite(f.halftime?.home)&&finite(f.halftime?.away)){const x=Number(f.halftime.home),y=Number(f.halftime.away);if(sel==='home'||sel==='1')outcome=win(x>y);else if(sel==='away'||sel==='2')outcome=win(y>x);else if(sel==='draw'||sel==='x')outcome=win(x===y)}
  return{outcome,matchState:'settled',...f}
}
function decidedOutcome(o:any){return ['won','lost','void','postponed'].includes(String(o||''))}
function pickResultKey(p:any){return `${p?.fixtureId}|${p?.market}|${String(p?.selection||'').trim()}`}
function storedForPick(stored:any,p:any){return stored?.[pickResultKey(p)]||stored?.[String(p?.fixtureId??'')]||null}
function attachResult(p:any,current:any,stored:any){
  const live=current?settle(p,current):null
  if(live&&decidedOutcome(live.outcome))return live
  if(live&&live.matchState==='live')return live
  if(stored&&decidedOutcome(stored.outcome))return stored
  return live||stored||{outcome:'pending',matchState:Date.parse(p?.kickoff)>Date.now()?'upcoming':'pending'}
}
function performanceFromBoards(boards:any[]){
  const groups=new Map<string,any>(),summary={picks:0,won:0,lost:0,void:0,pending:0,winRate:0}
  for(const b of boards)for(const p of b?.bestPicks||[]){
    const r=b?.results?.[String(p.fixtureId)],outcome=r?.outcome||'pending';summary.picks++;if(outcome==='won')summary.won++;else if(outcome==='lost')summary.lost++;else if(outcome==='void'||outcome==='postponed')summary.void++;else summary.pending++
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
  const dated=(boards||[]).map((b:any)=>({...b,date:b?.date||b?.meta?.date,meta:{...(b?.meta||{}),date:b?.date||b?.meta?.date}}))
  const state=buildLearningState(dated,today(),6)
  return{profiles:buildLearningProfiles(dated,20),state:publicLearning(state)}
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
      const date=requestedDate(url),view=url.searchParams.get('view')||'all',row=await snapshot(date),status=snapshotState(date,row),board=attachCrests(row?.board||emptyBoard(date))
      const payload=publicBoard({...board,meta:{...(board.meta||{}),date,refresh:status,requiresRefresh:status.state!=='complete'}},view)
      const cache=payload?.meta?.generatedAt?'public, max-age=60, stale-while-revalidate=240':'no-store'
      return json(payload,200,cache)
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
      const published=[...(board.bestPicks||[]),...(board.varTips||[]),...(board.filterTips||[]),...(board.goalsBankers||[]),...(board.comboPicks||[]),...(board.h2hPicks||[]),...(board.dailyBankers||[]),...(board.bankers||[]),...(board.safestBankers||[]),...(board.valueBankers||[])]
      let fixtures:any[]=[];try{fixtures=await liveScores(date,published)}catch{}
      const map=mergeLive(new Map(),fixtures,published),stored=board?.results||{}
      const withResult=(rows:any[])=>compactResultRows((rows||[]).map((p:any)=>({...p,result:attachResult(p,map.get(String(p.fixtureId)),storedForPick(stored,p))})))
      const picks=withResult(board?.bestPicks)
      const varTips=withResult(board?.varTips)
      const filterTips=withResult(board?.filterTips)
      const split=splitGoalsAndCombo(board)
      const goalsBankers=withResult(split.goalsBankers)
      const comboPicks=withResult(split.comboPicks)
      const h2hPicks=withResult(board?.h2hPicks)
      const dailyBankers=withResult(board?.dailyBankers)
      const bankers=withResult([...(board.bankers||[]),...(board.safestBankers||[]),...(board.valueBankers||[]),...(board.dailyBankers||[])])
      return json({date,picks,varTips,filterTips,goalsBankers,comboPicks,h2hPicks,dailyBankers,bankers},200,'public, max-age=15, stale-while-revalidate=45')
    }
    if(route==='/live-scores'&&req.method==='GET'){const date=requestedDate(url);return json({date,fixtures:await liveScores(date)})}
    if(route==='/performance'&&req.method==='GET'){
      const days=Math.max(1,Math.min(90,Number(url.searchParams.get('days')||30))),rows=await boardRows(days),boards=(rows||[]).map((x:any)=>x.payload).filter(Boolean)
      const learned=learningFromBoards(boards)
      return json({days,...performanceFromBoards(boards),learning:learned.profiles,learningState:learned.state})
    }
    if(route==='/refresh-status'&&req.method==='GET'){const date=requestedDate(url),row=await snapshot(date);return json(snapshotState(date,row))}
    if(route==='/me'&&req.method==='GET'){const me=await verifyUser(req);if(!me)return json({error:'Authentication required'},401);return json({id:me.id,email:me.email||''})}
    if(route==='/presence'&&req.method==='POST'){
      const me=await verifyUser(req);if(!me)return json({error:'Authentication required'},401)
      const body=await req.json().catch(()=>({}))
      return json(await recordPresence(me,req,body))
    }
    if(route==='/admin/overview'&&req.method==='GET'){
      const admin=await verifyAdmin(req);if(!admin)return json({error:'Admin access required'},403)
      const rows=await boardRows(30),boards=(rows||[]).map((x:any)=>x.payload).filter(Boolean),performance=performanceFromBoards(boards),learned=learningFromBoards(boards)
      const latest=(rows||[])[0]||null,meta=latest?.payload?.meta||{},latestPicks=(latest?.payload?.bestPicks||[]).slice(0,25)
      const visitors=(await listAuthUsers()).map((u:any)=>visitorFromUser(u)).sort((a:any,b:any)=>Number(b.online)-Number(a.online)||Date.parse(b.lastSeenAt||0)-Date.parse(a.lastSeenAt||0))
      const stats=analyticsFrom(visitors)
      const online=visitors.filter((v:any)=>v.online).length
      const avgSession=visitors.length?Math.round(visitors.reduce((n:number,v:any)=>n+Number(v.avgSessionSeconds||0),0)/visitors.length):0
      const logins=visitors.reduce((n:number,v:any)=>n+Number(v.loginCount||0),0)
      return json({user:{email:admin.email||''},snapshots:rows.length,users:visitors.length,online,countries:stats.countries.length,avgSession,logins,newUsers:stats.newUsers,active:stats.active,series:stats.series,regions:stats.regions,countryStats:stats.countries,visitors,performance,learning:learned.profiles,learningState:learned.state,latest,health:{footballData:true,sourceFixtures:meta.sourceFixtures||0,scheduledFixtures:meta.scheduledFixtures||0,analyzedFixtures:meta.analyzedFixtures||0,statsVerifiedFixtures:meta.statsVerifiedFixtures||0,historyFallbackTeams:meta.historyFallbackTeams||0},latestPicks})
    }
    if(route==='/admin/refresh'&&req.method==='POST'){
      const admin=await verifyAdmin(req);if(!admin)return json({error:'Admin access required'},403);await dispatchRefresh();return json({ok:true,message:'Refresh requested.'},202)
    }
    return json({error:'Not found'},404)
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Server error'},500)}
})
