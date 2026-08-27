import {fetchJson} from './http.js'
import {FINISHED} from './config.js'

const BASE=String(process.env.SPORTY_GISMO_BASE||'https://stats.fn.sportradar.com/sportybet/en/Etc:UTC/gismo').replace(/\/+$/,'')
const LASTX=Math.max(10,Math.min(80,Number(process.env.SPORTY_LASTX||40)))
const LEAGUE_CAP=Math.max(8,Number(process.env.SPORTY_LEAGUE_LASTX_CAP||24))
const CONCURRENCY=Math.max(1,Number(process.env.SPORTY_STATS_CONCURRENCY||3))
const TIMEOUT=Number(process.env.SPORTY_GISMO_TIMEOUT_MS||20000)
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))

let lastxCache=new Map(),seasonCache=new Map(),seasonListCache=new Map(),matchCache=new Map(),timelineCache=new Map()
export function resetSportyStatsCache(){
  lastxCache=new Map();seasonCache=new Map();seasonListCache=new Map();matchCache=new Map();timelineCache=new Map()
}

export function nid(raw){
  const m=String(raw??'').match(/(\d+)$/)
  return m?Number(m[1]):null
}
export function crestUrl(id){
  const n=nid(id)
  return n?`https://img.sportradar.com/ls/crest/big/${n}.png`:null
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let i=0
  async function worker(){while(true){const x=i++;if(x>=items.length)return;out[x]=await fn(items[x],x)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return out
}

function gismoData(body){
  const doc=body?.doc?.[0]
  if(!doc)return null
  if(doc.event==='exception')throw new Error(doc.data?.message||'SportyBet stats blocked')
  return doc.data
}

async function call(path){
  const url=`${BASE}/${String(path||'').replace(/^\/+/,'')}`
  const body=await fetchJson(url,{
    headers:{
      Accept:'application/json, text/plain, */*',
      Referer:'https://www.sportybet.com/',
      Origin:'https://www.sportybet.com',
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  },TIMEOUT,{retries:Number(process.env.SPORTY_GISMO_RETRIES||3),baseDelayMs:800})
  return gismoData(body)
}

function matchesOf(data){
  const raw=data?.matches
  if(Array.isArray(raw))return raw
  if(raw&&typeof raw==='object')return Object.values(raw)
  return[]
}

export function seasonYear(m){
  const y=String(m?.season?.year||m?.year||'')
  const hit=y.match(/(\d{2})\s*\/\s*(\d{2})/)
  if(hit){const a=Number(hit[1]);return a>=70?1900+a:2000+a}
  const uts=Number(m?.time?.uts)
  if(Number.isFinite(uts))return new Date(uts*1000).getUTCFullYear()
  return new Date().getUTCFullYear()
}

export function eventsFromComment(comment,homeId,awayId){
  const text=String(comment||'')
  if(!text)return[]
  const events=[]
  let lastH=0,lastA=0,match
  const re=/(\d+)\s*[-:]\s*(\d+)\s*\((\d+)/g
  while((match=re.exec(text))){
    const h=Number(match[1]),a=Number(match[2]),min=Number(match[3])
    let team=null
    if(h>lastH)team=homeId
    else if(a>lastA)team=awayId
    lastH=h;lastA=a
    if(team==null||!Number.isFinite(min))continue
    events.push({type:'Goal',team:{id:team},time:{elapsed:min,extra:0}})
  }
  return events
}

function eventsComplete(finished,home,away,events){
  if(!finished)return false
  const total=Number(home)+Number(away)
  if(total===0)return true
  return Array.isArray(events)&&events.length===total
}

export function gismoToFixture(m,extra={}){
  const home=m?.teams?.home||{},away=m?.teams?.away||{}
  const homeId=nid(home.uid||home._id),awayId=nid(away.uid||away._id)
  const ftH=m?.result?.home??m?.periods?.ft?.home,ftA=m?.result?.away??m?.periods?.ft?.away
  const htH=m?.periods?.p1?.home,htA=m?.periods?.p1?.away
  const finished=Number.isFinite(Number(ftH))&&Number.isFinite(Number(ftA))
  let short='NS',long='Not started'
  if(m?.canceled||m?.cancelled){short='CANC';long='Cancelled'}
  else if(m?.postponed){short='PST';long='Postponed'}
  else if(m?.walkover){short='WO';long='Walkover'}
  else if(finished){short='FT';long='Match Finished'}
  const events=eventsFromComment(m?.comment,homeId,awayId)
  const uts=Number(m?.time?.uts)
  const iso=Number.isFinite(uts)?new Date(uts*1000).toISOString():null
  const matchId=nid(m?._id)
  const utid=nid(m?._utid||m?.uniquetournament?._utid||m?.uniquetournament?._id||extra.utid)
  return{
    fixture:{id:matchId,date:iso,timestamp:Number.isFinite(uts)?uts*1000:null,status:{short,long}},
    league:{
      id:utid,
      name:extra.leagueName||m?.tournament?.name||m?.uniquetournament?.name||'',
      country:extra.country||m?.realcategory?.name||m?.realcategory?.cc?.name||'',
      season:seasonYear(m),
      seasonId:m?._seasonid||null
    },
    teams:{
      home:{id:homeId,name:home.mediumname||home.name||'',logo:crestUrl(home.uid||homeId)},
      away:{id:awayId,name:away.mediumname||away.name||'',logo:crestUrl(away.uid||awayId)}
    },
    goals:{home:finished?Number(ftH):null,away:finished?Number(ftA):null},
    score:{
      fulltime:{home:finished?Number(ftH):null,away:finished?Number(ftA):null},
      halftime:{home:Number.isFinite(Number(htH))?Number(htH):null,away:Number.isFinite(Number(htA))?Number(htA):null}
    },
    events,
    eventsComplete:eventsComplete(finished,ftH,ftA,events),
    sporty:{eventId:matchId?`sr:match:${matchId}`:null,matchId}
  }
}

export async function teamLastX(teamId,n=LASTX){
  const id=nid(teamId)
  if(!id)return[]
  const key=`${id}|${n}`
  if(lastxCache.has(key))return lastxCache.get(key)
  const pending=call(`stats_team_lastx/${id}/${n}`).then(data=>matchesOf(data).map(m=>gismoToFixture(m))).catch(error=>{
    lastxCache.delete(key)
    console.warn(`SportyBet last-x ${id}: ${error?.message||error}`)
    return[]
  })
  lastxCache.set(key,pending)
  return pending
}

export async function tournamentSeasons(utid){
  const id=nid(utid)
  if(!id)return{current:null,previous:null,all:[]}
  if(seasonListCache.has(id))return seasonListCache.get(id)
  const pending=call(`uniquetournament_seasons/${id}`).then(data=>{
    const all=(data?.seasons||[]).filter(s=>s&&s.containsdata!==false)
      .sort((a,b)=>Number(b?.start?.uts||0)-Number(a?.start?.uts||0))
    const current=all.find(s=>s.current===true)||all[0]||null
    const previous=all.find(s=>String(s?._id)!==String(current?._id))||null
    return{current,previous,all}
  }).catch(error=>{
    seasonListCache.delete(id)
    console.warn(`SportyBet seasons ${id}: ${error?.message||error}`)
    return{current:null,previous:null,all:[]}
  })
  seasonListCache.set(id,pending)
  return pending
}

export async function seasonFixtures(seasonId,extra={}){
  const id=nid(seasonId)
  if(!id)return[]
  if(seasonCache.has(id))return seasonCache.get(id)
  const pending=call(`stats_season_fixtures2/${id}`).then(data=>{
    const leagueName=extra.leagueName||data?.name||data?.uniquetournament?.name||''
    const country=extra.country||data?.realcategory?.name||''
    const utid=nid(data?._utid)||extra.utid
    return matchesOf(data).map(m=>gismoToFixture(m,{leagueName,country,utid}))
  }).catch(error=>{
    seasonCache.delete(id)
    console.warn(`SportyBet season ${id}: ${error?.message||error}`)
    return[]
  })
  seasonCache.set(id,pending)
  return pending
}

export async function gismoMatch(matchId){
  const id=nid(matchId)
  if(!id)return null
  if(matchCache.has(id))return matchCache.get(id)
  const pending=call(`stats_match_get/${id}`).then(data=>data?gismoToFixture(data):null).catch(error=>{
    matchCache.delete(id)
    console.warn(`SportyBet match ${id}: ${error?.message||error}`)
    return null
  })
  matchCache.set(id,pending)
  return pending
}

export async function gismoMatches(ids){
  const uniq=[...new Set((ids||[]).map(nid).filter(Boolean))]
  const rows=await mapLimit(uniq,CONCURRENCY,async id=>{
    const row=await gismoMatch(id)
    await sleep(Number(process.env.SPORTY_GISMO_PAUSE_MS||40))
    return row
  })
  return rows.filter(Boolean)
}

export async function matchGoalEvents(matchId,homeId,awayId){
  const id=nid(matchId)
  if(!id)return[]
  if(timelineCache.has(id))return timelineCache.get(id)
  const pending=call(`match_timeline/${id}`).then(data=>{
    const events=Array.isArray(data?.events)?data.events:[]
    return events.filter(e=>e?.type==='goal'||e?._doctype==='goal').map(e=>{
      const side=String(e?.team||'').toLowerCase()
      const teamId=side==='away'?awayId:side==='home'?homeId:null
      return{type:'Goal',team:{id:teamId},time:{elapsed:Number(e?.time)||0,extra:Number(e?.injurytime)||0}}
    })
  }).catch(error=>{
    timelineCache.delete(id)
    console.warn(`SportyBet timeline ${id}: ${error?.message||error}`)
    return[]
  })
  timelineCache.set(id,pending)
  return pending
}

function venueCount(rows,teamId,venue){
  return(rows||[]).filter(f=>{
    if(!FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase()))return false
    return venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)
  }).length
}

export async function leagueFormPack(utid,country=''){
  const id=nid(utid)
  if(!id)return{current:[],previous:[],extra:[],currentSeasonId:null,previousSeasonId:null,teams:0}
  const seasons=await tournamentSeasons(id)
  const currentId=seasons.current?._id||null
  const previousId=seasons.previous?._id||null
  const leagueName=seasons.current?.name||seasons.previous?.name||''
  const extraMeta={leagueName,country,utid:id}
  const[current,previous]=await Promise.all([
    currentId?seasonFixtures(currentId,extraMeta):Promise.resolve([]),
    previousId?seasonFixtures(previousId,extraMeta):Promise.resolve([])
  ])
  const rows=[...current,...previous]
  const teamIds=new Set()
  for(const r of rows){
    if(r?.teams?.home?.id)teamIds.add(Number(r.teams.home.id))
    if(r?.teams?.away?.id)teamIds.add(Number(r.teams.away.id))
  }
  const readyHome=[...teamIds].filter(tid=>venueCount(rows,tid,'home')>=5).length
  let extra=[]
  if(teamIds.size&&readyHome<Math.min(8,teamIds.size)){
    const cap=[...teamIds].slice(0,LEAGUE_CAP)
    const groups=await mapLimit(cap,CONCURRENCY,tid=>teamLastX(tid))
    extra=groups.flat()
  }
  return{current,previous,extra,currentSeasonId:currentId,previousSeasonId:previousId,teams:teamIds.size}
}
