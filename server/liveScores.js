import { getFixturesByDateFresh } from './apiFootball.js'
import { fixtureLifecycle } from './lifecycle.js'

const LIVE_CACHE_MS=Math.max(5000,Number(process.env.LIVE_SCORE_CACHE_MS||20000))
const cache=new Map()

const text=v=>v===null||v===undefined?'':String(v)
const numberOrNull=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null

function normalizeFixture(fixture){
  const life=fixtureLifecycle(fixture)
  return{
    fixtureId:fixture?.fixture?.id??null,
    kickoff:fixture?.fixture?.date||null,
    timezone:fixture?.fixture?.timezone||null,
    venue:fixture?.fixture?.venue?.name||null,
    referee:fixture?.fixture?.referee||null,
    statusShort:life.statusShort,
    statusLong:life.statusLong,
    statusGroup:life.statusGroup,
    elapsed:life.elapsed,
    homeScore:life.homeScore,
    awayScore:life.awayScore,
    halftimeHome:numberOrNull(fixture?.score?.halftime?.home),
    halftimeAway:numberOrNull(fixture?.score?.halftime?.away),
    fulltimeHome:numberOrNull(fixture?.score?.fulltime?.home),
    fulltimeAway:numberOrNull(fixture?.score?.fulltime?.away),
    league:{
      id:fixture?.league?.id??null,
      name:text(fixture?.league?.name)||'Competition',
      country:text(fixture?.league?.country),
      logo:fixture?.league?.logo||null,
      flag:fixture?.league?.flag||null,
      round:text(fixture?.league?.round)
    },
    home:{
      id:fixture?.teams?.home?.id??null,
      name:text(fixture?.teams?.home?.name)||'Home',
      logo:fixture?.teams?.home?.logo||null,
      winner:fixture?.teams?.home?.winner===true
    },
    away:{
      id:fixture?.teams?.away?.id??null,
      name:text(fixture?.teams?.away?.name)||'Away',
      logo:fixture?.teams?.away?.logo||null,
      winner:fixture?.teams?.away?.winner===true
    }
  }
}

function sortScoreboard(a,b){
  const priority={live:0,settled:1,pending:2,upcoming:3,postponed:4}
  const pa=priority[a?.statusGroup]??9,pb=priority[b?.statusGroup]??9
  if(pa!==pb)return pa-pb
  const ta=new Date(a?.kickoff||0).getTime(),tb=new Date(b?.kickoff||0).getTime()
  return ta-tb
}

export async function getDailyLiveScores(date,{force=false}={}){
  const key=String(date||'')
  const hit=cache.get(key)
  if(!force&&hit&&Date.now()-hit.at<LIVE_CACHE_MS)return hit.data
  const raw=await getFixturesByDateFresh(key)
  const fixtures=(Array.isArray(raw)?raw:[]).map(normalizeFixture).sort(sortScoreboard)
  const counts={live:0,settled:0,upcoming:0,pending:0,postponed:0,total:fixtures.length}
  for(const f of fixtures){if(f.statusGroup in counts)counts[f.statusGroup]++}
  const data={date:key,generatedAt:new Date().toISOString(),provider:'API-Football',cacheSeconds:Math.round(LIVE_CACHE_MS/1000),counts,fixtures}
  cache.set(key,{at:Date.now(),data})
  return data
}

export function clearLiveScoreCache(date){if(date)cache.delete(String(date));else cache.clear()}
