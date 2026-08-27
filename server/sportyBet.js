import {fetchJson} from './http.js'

const COUNTRY=String(process.env.SPORTYBET_COUNTRY||'gh').replace(/[^a-z]/gi,'').toLowerCase()||'gh'
const BASE=String(process.env.SPORTYBET_BASE||'https://www.sportybet.com').replace(/\/+$/,'')
const SPORT='sr:sport:1'
const MARKETS='1,10,11,18,19,20,29,60010,60011,60012'
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
export function resetSportyCache(){cache=null}

function nid(raw){
  const m=String(raw??'').match(/(\d+)$/)
  return m?Number(m[1]):null
}
function accraDate(ms){
  if(!Number.isFinite(Number(ms)))return ''
  return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(ms)))
}
function iso(ms){return Number.isFinite(Number(ms))?new Date(Number(ms)).toISOString():null}

function statusOf(ev){
  const raw=String(ev?.matchStatus||'').toLowerCase()
  const code=Number(ev?.status)
  if(/cancel|abandon|postpon/.test(raw))return{short:'CANC',long:ev.matchStatus||'Cancelled'}
  if(/not[\s_-]*start|upcoming|ns\b/.test(raw)||code===0)return{short:'NS',long:ev.matchStatus||'Not started'}
  if(/end|finish|close|complete|\bft\b/.test(raw)||code===3)return{short:'FT',long:ev.matchStatus||'Match Finished'}
  if(/live|1st|2nd|half|\bht\b|pause|in.?play/.test(raw)||code===1||code===2)return{short:'LIVE',long:ev.matchStatus||'Live'}
  return{short:'NS',long:ev.matchStatus||'Not started'}
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
  return{
    fixture:{id:fixtureId,date:kick,status:{short:status.short,long:status.long},timestamp:ev?.estimateStartTime||null},
    league:{
      id:tour?.id||tournament?.id||null,
      name:tour?.name||tournament?.name||'',
      country:category?.name||tournament?.categoryName||'',
      season:kick?Number(kick.slice(0,4)):new Date().getUTCFullYear()
    },
    teams:{
      home:{id:homeId,name:ev?.homeTeamName||'',logo:ev?.homeTeamIcon||null},
      away:{id:awayId,name:ev?.awayTeamName||'',logo:ev?.awayTeamIcon||null}
    },
    goals,
    score:{fulltime:goals},
    sporty:{
      eventId:ev?.eventId||null,
      gameId:ev?.gameId||null,
      markets:Array.isArray(ev?.markets)?ev.markets:[]
    }
  }
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
  return rows.filter(f=>accraDate(f?.fixture?.timestamp)===want)
}

export async function sportyEvent(eventId){
  if(!eventId)return null
  const data=await call(`/api/${COUNTRY}/factsCenter/event`,{eventId})
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
