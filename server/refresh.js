import {fixturesByDate,teamHistory,leagueHistory,oddsByDate} from './apiFootball.js'
import {getStatsOddsForFixture,statsApiConfigured} from './statsApi.js'
import {verifiedMarkets} from './odds.js'
import {venueSample,buildBoard,tierGate} from './engine.js'
import {buildOver25Profile} from './over25.js'
import {saveBoard,listBoards} from './store.js'
import {buildLearningProfiles} from './learning.js'
import {ENGINE_VERSION,SCHEDULED,FORM_SAMPLE} from './config.js'

const jobs=new Map()
const leagueCache=new Map()
const teamCache=new Map()
const splitCache=new Map()

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let i=0
  async function worker(){
    while(true){
      const x=i++
      if(x>=items.length)return
      out[x]=await fn(items[x],x)
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return out
}

function publicFixture(f,status='scheduled'){
  return{
    fixtureId:f?.fixture?.id,kickoff:f?.fixture?.date,status:f?.fixture?.status?.short||'NS',
    league:f?.league?.name||'',country:f?.league?.country||'',
    home:f?.teams?.home?.name||'',away:f?.teams?.away?.name||'',
    homeLogo:f?.teams?.home?.logo||null,awayLogo:f?.teams?.away?.logo||null,
    availability:status
  }
}

const leagueKey=(league,season)=>`${league}|${season}`

async function getLeagueHistory(league,season){
  const key=leagueKey(league,season)
  if(!leagueCache.has(key))leagueCache.set(key,leagueHistory(league,season).catch(()=>[]))
  return leagueCache.get(key)
}

async function getTeamHistory(teamId){
  const key=String(teamId??'')
  if(!key)return[]
  if(!teamCache.has(key))teamCache.set(key,teamHistory(teamId).catch(()=>[]))
  return teamCache.get(key)
}

function mergeUnique(...groups){
  const map=new Map()
  for(const rows of groups)for(const f of rows||[]){
    const key=String(f?.fixture?.id??`${f?.fixture?.date}|${f?.teams?.home?.id}|${f?.teams?.away?.id}`)
    if(!map.has(key))map.set(key,f)
  }
  return[...map.values()]
}

function lastNVenue(rows,teamId,venue,n=FORM_SAMPLE){
  return (rows||[]).filter(f=>{
    const done=['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||'').toUpperCase())
    if(!done)return false
    return venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)
  }).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,n)
}
function ppgFor(rows,teamId,venue){
  let pts=0,played=0
  for(const f of rows){
    const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
    if(!Number.isFinite(h)||!Number.isFinite(a))continue
    const own=venue==='home'?h:a,opp=venue==='home'?a:h
    played++;pts+=own>opp?3:own===opp?1:0
  }
  return played?pts/played:0
}
function splitTable(history,venue){
  const ids=new Map()
  for(const f of history||[]){
    const t=venue==='home'?f?.teams?.home:f?.teams?.away
    if(t?.id)ids.set(String(t.id),{id:t.id,name:t.name||''})
  }
  const rows=[]
  for(const t of ids.values()){
    const sample=lastNVenue(history,t.id,venue)
    if(sample.length<FORM_SAMPLE)continue
    rows.push({...t,ppg:ppgFor(sample,t.id,venue),played:sample.length})
  }
  rows.sort((a,b)=>b.ppg-a.ppg||String(a.name).localeCompare(String(b.name)))
  return new Map(rows.map((r,i)=>[String(r.id),{position:i+1,size:rows.length,ppg:+r.ppg.toFixed(2),played:r.played,sampleReady:true,venue}]))
}
function cachedSplitTable(leagueId,season,venue,history){
  const key=`${leagueId}|${season}|${venue}`
  if(!splitCache.has(key))splitCache.set(key,splitTable(history,venue))
  return splitCache.get(key)
}
async function learningProfiles(){
  try{
    const end=new Date(),start=new Date(end.getTime()-60*86400000)
    const rows=await listBoards(start.toISOString().slice(0,10),end.toISOString().slice(0,10))
    return buildLearningProfiles(rows.map(x=>x.payload).filter(Boolean),20)
  }catch{return[]}
}

export async function refreshNow(date,onProgress=()=>{}){
  const learned=await learningProfiles()
  onProgress({stage:'fixtures-and-odds',done:0,total:2})
  const raw=await fixturesByDate(date)
  onProgress({stage:'fixtures-and-odds',done:1,total:2,fixtures:raw.length})
  const oddsMap=await oddsByDate(date)
  onProgress({stage:'fixtures-and-odds',done:2,total:2,fixtures:raw.length,oddsFixtures:oddsMap.size})

  const scheduled=raw.filter(f=>SCHEDULED.has(String(f?.fixture?.status?.short||'').toUpperCase()))
  const leagueKeys=[...new Map(scheduled.map(f=>[
    leagueKey(f?.league?.id,f?.league?.season),
    {league:f?.league?.id,season:Number(f?.league?.season)}
  ])).values()].filter(x=>x.league&&Number.isFinite(x.season))

  let historyDone=0
  onProgress({stage:'league-history',done:0,total:leagueKeys.length,fixtures:scheduled.length})
  await mapLimit(leagueKeys,2,async x=>{
    await Promise.all([
      getLeagueHistory(x.league,x.season),
      x.season>0?getLeagueHistory(x.league,x.season-1):Promise.resolve([])
    ])
    historyDone++
    onProgress({stage:'league-history',done:historyDone,total:leagueKeys.length,fixtures:scheduled.length})
  })

  let done=0,statsVerified=0,fallbackTeams=0
  const analyzed=await mapLimit(scheduled,Math.max(1,Number(process.env.REFRESH_CONCURRENCY||2)),async f=>{
    try{
      const homeId=f?.teams?.home?.id,awayId=f?.teams?.away?.id
      const leagueId=f?.league?.id,season=Number(f?.league?.season)

      const current=Number.isFinite(season)?await getLeagueHistory(leagueId,season):[]
      const previous=Number.isFinite(season)&&season>0?await getLeagueHistory(leagueId,season-1):[]
      const currentHomeFixtures=venueSample(current,homeId,'home')
      const currentAwayFixtures=venueSample(current,awayId,'away')
      const earlySeasonHome=currentHomeFixtures.length<FORM_SAMPLE
      const earlySeasonAway=currentAwayFixtures.length<FORM_SAMPLE
      const earlySeason=earlySeasonHome||earlySeasonAway
      const over25Profile=buildOver25Profile(current,homeId,awayId,{xg:f?.over25Xg||f?.xg||null})
      let history=mergeUnique(current,previous)
      let homeFixtures=venueSample(history,homeId,'home')
      let awayFixtures=venueSample(history,awayId,'away')
      const homeSplit=cachedSplitTable(leagueId,season,'home',history).get(String(homeId))||null
      const awaySplit=cachedSplitTable(leagueId,season,'away',history).get(String(awayId))||null

      if(homeFixtures.length<FORM_SAMPLE){
        history=mergeUnique(history,await getTeamHistory(homeId))
        fallbackTeams++
        homeFixtures=venueSample(history,homeId,'home')
      }
      if(awayFixtures.length<FORM_SAMPLE){
        history=mergeUnique(history,await getTeamHistory(awayId))
        fallbackTeams++
        awayFixtures=venueSample(history,awayId,'away')
      }
      if(homeFixtures.length<FORM_SAMPLE||awayFixtures.length<FORM_SAMPLE){
        done++
        onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams})
        return null
      }

      const apiOdds=oddsMap.get(String(f?.fixture?.id))||[]
      const statsOdds=statsApiConfigured()?await getStatsOddsForFixture(f).catch(()=>null):null
      if(statsOdds)statsVerified++
      const marketOdds=verifiedMarkets({apiPayload:apiOdds,statsPayload:statsOdds,fixture:f})

      done++
      onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams})
      return{
        fixtureId:f.fixture.id,league:f.league?.name||'',country:f.league?.country||'',kickoff:f.fixture.date,
        home:{id:homeId,name:f.teams.home.name,logo:f.teams.home.logo||null,fixtures:homeFixtures},
        away:{id:awayId,name:f.teams.away.name,logo:f.teams.away.logo||null,fixtures:awayFixtures},
        earlySeason,earlySeasonHome,earlySeasonAway,
        currentVenueSamples:{home:currentHomeFixtures.length,away:currentAwayFixtures.length},
        over25Profile,
        homeSplit,awaySplit,marketOdds
      }
    }catch(error){
      console.warn(`Fixture ${f?.fixture?.id||'unknown'} skipped: ${error?.message||error}`)
      done++
      onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams})
      return null
    }
  })

  const fixtures=analyzed.filter(Boolean)
  const tierEligible=fixtures.filter(f=>tierGate(f).allowed)
  const board=buildBoard(tierEligible,{
    date,generatedAt:new Date().toISOString(),engineVersion:ENGINE_VERSION,
    sourceFixtures:raw.length,scheduledFixtures:scheduled.length,analyzedFixtures:fixtures.length,
    tierEligibleFixtures:tierEligible.length,sameTierOrUnverifiedSkipped:fixtures.length-tierEligible.length,
    over25ProfiledFixtures:fixtures.filter(f=>f.over25Profile).length,
    statsVerifiedFixtures:statsVerified,historyFallbackTeams:fallbackTeams
  },learned)
  const picks=new Map(board.bestPicks.map(p=>[String(p.fixtureId),p]))
  const eligibleIds=new Set(tierEligible.map(f=>String(f.fixtureId)))
  board.fixtures=raw.filter(f=>eligibleIds.has(String(f?.fixture?.id))).map(f=>publicFixture(f,picks.has(String(f?.fixture?.id))?'qualified':'no-qualified-pick'))
  const saved=await saveBoard(date,board)
  return saved
}

export function refreshStatus(date){return jobs.get(date)||{state:'idle',date}}

export function startRefresh(date){
  if(jobs.get(date)?.state==='running')return jobs.get(date)
  const job={state:'running',date,startedAt:new Date().toISOString(),progress:{stage:'start'}}
  jobs.set(date,job)
  refreshNow(date,p=>job.progress=p).then(board=>{
    job.state='complete'
    job.completedAt=new Date().toISOString()
    job.result={bestPicks:board.bestPicks.length,qualified:board.priority.length}
  }).catch(e=>{
    job.state='failed'
    job.error=e.message
    job.completedAt=new Date().toISOString()
  })
  return job
}
