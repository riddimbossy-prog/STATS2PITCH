import {fetchJson} from './http.js'

const COUNTRY=String(process.env.SPORTYBET_COUNTRY||'gh').replace(/[^a-z]/gi,'').toLowerCase()||'gh'
const BASE=String(process.env.SPORTYBET_BASE||'https://www.sportybet.com').replace(/\/+$/,'')
const SPORT='sr:sport:1'
const MARKETS='1,10,11,18,19,20,29,60000,60010,60011,60012,60020'
const PAGE=Math.max(20,Math.min(100,Number(process.env.SPORTYBET_PAGE_SIZE||100)))
const TIMELINE=Math.max(12,Number(process.env.SPORTYBET_TIMELINE||168))
const ZONE=process.env.APP_TIMEZONE||'Africa/Accra'
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))

const headers=()=>({
  Accept:'application/json, text/plain, */*',
  Origin:BASE,
  Referer:`${BASE}/${COUNTRY}/sport/football/today`,
  Clientid:'web',
  Platform:'web',
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
})

let cache=null
let teamCrests=new Map()
let eventCrestCache=new Map()
export function resetSportyCache(){cache=null;teamCrests=new Map();eventCrestCache=new Map()}

function nid(raw){
  const m=String(raw??'').match(/(\d+)$/)
  return m?Number(m[1]):null
}
function crest(id){return id?`https://img.sportradar.com/ls/crest/big/${id}.png`:null}
function crestKey(id){
  const n=nid(id)
  return n!=null?String(n):String(id||'')
}
export function isSportyCrest(url){return /s\.sporty\.net\//i.test(String(url||''))}
export function eventQuery(id){
  const raw=String(id??'').trim()
  if(!raw)return null
  if(/^\d+$/.test(raw))return{gameId:raw}
  return{eventId:raw}
}
export function rememberCrest(id,url){
  if(!id||!isSportyCrest(url))return
  teamCrests.set(crestKey(id),String(url).trim())
}
export function knownCrest(id,fallback=''){
  const cached=teamCrests.get(crestKey(id))
  if(isSportyCrest(cached))return cached
  if(isSportyCrest(fallback))return String(fallback).trim()
  const next=String(fallback||'').trim()
  return next||null
}
export function applyEventIcons(fixture,ev={}){
  rememberCrest(ev?.homeTeamId||fixture?.teams?.home?.id,ev?.homeTeamIcon)
  rememberCrest(ev?.awayTeamId||fixture?.teams?.away?.id,ev?.awayTeamIcon)
  if(fixture?.teams?.home)fixture.teams.home.logo=knownCrest(fixture.teams.home.id,ev?.homeTeamIcon||fixture.teams.home.logo)
  if(fixture?.teams?.away)fixture.teams.away.logo=knownCrest(fixture.teams.away.id,ev?.awayTeamIcon||fixture.teams.away.logo)
  return fixture
}
function needsCrest(fixture){
  return !isSportyCrest(fixture?.teams?.home?.logo)||!isSportyCrest(fixture?.teams?.away?.logo)
}
async function mapLimit(items,limit,fn){
  if(!items.length)return []
  const out=new Array(items.length)
  let i=0
  async function worker(){
    while(true){
      const x=i++
      if(x>=items.length)return
      out[x]=await fn(items[x],x)
    }
  }
  await Promise.all(Array.from({length:Math.min(Math.max(1,limit),items.length)},worker))
  return out
}
function accraDate(ms){
  if(!Number.isFinite(Number(ms)))return ''
  return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(ms)))
}
function iso(ms){return Number.isFinite(Number(ms))?new Date(Number(ms)).toISOString():null}

function statusOf(ev){
  const raw=String(ev?.matchStatus||'').toLowerCase()
  const code=Number(ev?.status)
  if(/postpon/.test(raw))return{short:'PST',long:ev.matchStatus||'Postponed'}
  if(/cancel/.test(raw))return{short:'CANC',long:ev.matchStatus||'Cancelled'}
  if(/abandon/.test(raw))return{short:'ABD',long:ev.matchStatus||'Abandoned'}
  if(/walkover/.test(raw))return{short:'WO',long:ev.matchStatus||'Walkover'}
  if(/not[\s_-]*start|upcoming|ns\b/.test(raw)||code===0)return{short:'NS',long:ev.matchStatus||'Not started'}
  if(/end|finish|close|complete|\bft\b/.test(raw)||code===3)return{short:'FT',long:ev.matchStatus||'Match Finished'}
  if(/live|1st|2nd|half|\bht\b|pause|in.?play/.test(raw)||code===1||code===2)return{short:'LIVE',long:ev.matchStatus||'Live'}
  const goals=scoreOf(ev)
  if(Number.isFinite(Number(goals?.home))&&Number.isFinite(Number(goals?.away))&&code>=3)return{short:'FT',long:ev.matchStatus||'Match Finished'}
  return{short:'NS',long:ev.matchStatus||ev.matchStatus||'Not started'}
}

function scoreOf(ev){
  const pairs=[
    [ev?.homeScore,ev?.awayScore],
    [ev?.setScore?.home,ev?.setScore?.away],
    [ev?.score?.home,ev?.score?.away],
    [ev?.homeGoal,ev?.awayGoal],
    [ev?.sport?.event?.homeScore,ev?.sport?.event?.awayScore]
  ]
  for(const [h,a] of pairs){
    const home=Number(h),away=Number(a)
    if(Number.isFinite(home)&&Number.isFinite(away))return{home,away}
  }
  const blob=String(ev?.setScore||ev?.score||'')
  const m=blob.match(/(\d+)\s*[-:]\s*(\d+)/)
  if(m)return{home:Number(m[1]),away:Number(m[2])}
  return{home:null,away:null}
}

export function sportyEventToFixture(ev,tournament={}){
  const sport=ev?.sport||{}
  const category=sport?.category||{}
  const tour=category?.tournament||tournament||{}
  const status=statusOf(ev)
  const goals=scoreOf(ev)
  const kick=iso(ev?.estimateStartTime)
  const homeId=nid(ev?.homeTeamId)
  const awayId=nid(ev?.awayTeamId)
  const fixtureId=nid(ev?.eventId)||nid(ev?.gameId)
  const leagueId=nid(tour?.id)||nid(tournament?.id)||tour?.id||tournament?.id||null
  return applyEventIcons({
    fixture:{id:fixtureId,date:kick,status:{short:status.short,long:status.long},timestamp:ev?.estimateStartTime||null},
    league:{
      id:leagueId,
      name:tour?.name||tournament?.name||'',
      country:category?.name||tournament?.categoryName||'',
      season:kick?Number(kick.slice(0,4)):new Date().getUTCFullYear()
    },
    teams:{
      home:{id:homeId,name:ev?.homeTeamName||'',logo:ev?.homeTeamIcon||crest(homeId)},
      away:{id:awayId,name:ev?.awayTeamName||'',logo:ev?.awayTeamIcon||crest(awayId)}
    },
    goals,
    score:{fulltime:goals},
    sporty:{
      eventId:ev?.eventId||null,
      gameId:ev?.gameId||null,
      markets:Array.isArray(ev?.markets)?ev.markets:[]
    }
  },ev)
}

function flattenPage(data){
  const out=[]
  for(const tour of data?.tournaments||[]){
    for(const ev of tour?.events||[])out.push(sportyEventToFixture(ev,tour))
  }
  return out
}

async function call(path,params={}){
  const url=new URL(`${BASE}${path}`)
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))
  const body=await fetchJson(url,{headers:headers()},Number(process.env.SPORTYBET_TIMEOUT_MS||20000),{
    retries:Number(process.env.SPORTYBET_RETRIES||3),
    baseDelayMs:800
  })
  if(body?.bizCode!==10000)throw new Error(`SportyBet ${path} blocked: ${body?.innerMsg||body?.message||body?.bizCode}`)
  return body.data
}

async function loadEventIcons(fixture){
  const eventId=fixture?.sporty?.eventId
  const gameId=fixture?.sporty?.gameId
  const key=String(eventId||gameId||'')
  if(!key)return null
  if(eventCrestCache.has(key))return eventCrestCache.get(key)
  const pending=(async()=>{
    const primary=eventQuery(eventId)||eventQuery(gameId)
    if(!primary)return null
    try{
      return await call(`/api/${COUNTRY}/factsCenter/event`,primary)
    }catch(error){
      const fallback=eventId&&gameId?eventQuery(gameId):null
      if(fallback&&(fallback.gameId||fallback.eventId)!==(primary.gameId||primary.eventId)){
        return call(`/api/${COUNTRY}/factsCenter/event`,fallback)
      }
      throw error
    }
  })()
  eventCrestCache.set(key,pending)
  return pending
}

export async function hydrateSportyCrests(fixtures,{concurrency=4}={}){
  const rows=Array.isArray(fixtures)?fixtures:[]
  for(const f of rows)applyEventIcons(f,{})
  const missing=rows.filter(needsCrest)
  await mapLimit(missing,concurrency,async f=>{
    try{
      const ev=await loadEventIcons(f)
      if(ev)applyEventIcons(f,ev)
    }catch(error){
      console.warn(`SportyBet crest ${f?.sporty?.eventId||f?.sporty?.gameId||f?.fixture?.id}: ${error?.message||error}`)
    }
  })
  for(const f of rows)applyEventIcons(f,{})
  return rows
}

async function fetchPage(pageNum,timeline){
  return call(`/api/${COUNTRY}/factsCenter/pcUpcomingEvents`,{
    sportId:SPORT,
    marketId:MARKETS,
    pageSize:PAGE,
    pageNum,
    timeline
  })
}

export async function sportyUpcoming({timeline=TIMELINE,force=false}={}){
  if(cache&&!force)return cache
  const first=await fetchPage(1,timeline)
  const total=Number(first?.totalNum||0)
  const rows=flattenPage(first)
  const pages=Math.max(1,Math.ceil(total/PAGE))
  for(let page=2;page<=pages;page++){
    await sleep(Number(process.env.SPORTYBET_PAGE_PAUSE_MS||120))
    rows.push(...flattenPage(await fetchPage(page,timeline)))
  }
  cache=rows
  console.log(`SportyBet feed: ${rows.length} football events (timeline ${timeline}h)`)
  return rows
}

export async function sportyFixturesByDate(date){
  const want=String(date||'')
  const rows=await sportyUpcoming()
  const day=rows.filter(f=>accraDate(f?.fixture?.timestamp)===want)
  await hydrateSportyCrests(day)
  return day
}

export async function sportyEvent(eventId){
  const params=eventQuery(eventId)
  if(!params)return null
  const data=await call(`/api/${COUNTRY}/factsCenter/event`,params)
  return data?sportyEventToFixture(data,data?.sport?.category?.tournament||{}):null
}

export async function sportyEventFixtures(eventIds){
  const ids=[...new Set((eventIds||[]).map(id=>String(id||'').trim()).filter(Boolean))]
  const out=[]
  for(const id of ids){
    try{
      const row=await sportyEvent(id)
      if(row)out.push(row)
    }catch(error){
      console.warn(`SportyBet event ${id}: ${error?.message||error}`)
    }
    await sleep(80)
  }
  return out
}
