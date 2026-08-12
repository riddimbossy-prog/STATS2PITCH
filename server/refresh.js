import {getFixturesByDateFresh,getStandings,getLeagueFinishedFixtures,getFixtureOdds} from './apiFootball.js'
import {getStatsOddsForFixture,statsApiConfigured} from './statsApi.js'
import {buildCoherentOdds} from './oddsPolicy.js'
import {leagueMature,makeTeamProfile,buildBoard,ENGINE_VERSION,PROFILE_SOURCE,FORM_TABLE_SAMPLE} from './engine.js'
import {saveBoard} from './store.js'

const jobs=new Map()
const configuredFixtureCap=Number(process.env.MAX_FIXTURES_PER_REFRESH||0)
const maxFixtures=Number.isFinite(configuredFixtureCap)&&configuredFixtureCap>0?Math.max(10,configuredFixtureCap):null
const concurrency=Math.max(1,Math.min(8,Number(process.env.REFRESH_CONCURRENCY||4)))
const validOdd=v=>Number.isFinite(Number(v))&&Number(v)>1.001&&Number(v)<1000
const liveStatus=s=>!['NS','TBD'].includes(String(s||''))
const engineOddKeys=['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes']
function name(v){return String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function outcome(market,names){for(const n of names){const hit=(market?.outcomes||[]).find(o=>name(o?.name)===name(n));if(hit&&validOdd(hit.odd))return Number(hit.odd)}return null}
function extraOdds(marketOdds){
  const dnb=(marketOdds||[]).find(m=>m.marketKey==='draw-no-bet'),dc=(marketOdds||[]).find(m=>m.marketKey==='double-chance')
  return{dnbHome:outcome(dnb,['Home','1']),dnbAway:outcome(dnb,['Away','2']),dc1x:outcome(dc,['Home or draw','Home/Draw','1X']),dcx2:outcome(dc,['Draw or away','Draw/Away','X2'])}
}
function enginePriced(c){return Object.values(c||{}).some(validOdd)}
export function needsOddsFallback(odds){const c=odds?.canonical||{};return engineOddKeys.some(k=>!validOdd(c[k]))}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function worker(){while(true){const x=i++;if(x>=items.length)return;out[x]=await fn(items[x],x)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
function normalize(raw,standings,leagueHistory,odds){
  const f=raw.fixture||{},league=raw.league||{},homeTeam=raw.teams?.home||{},awayTeam=raw.teams?.away||{}
  const home=makeTeamProfile({standings,leagueHistory,team:homeTeam,venue:'home'}),away=makeTeamProfile({standings,leagueHistory,team:awayTeam,venue:'away'})
  return{fixtureId:f.id,match:`${home.name} vs ${away.name}`,league:league.name||'League',country:league.country||'',leagueLogo:league.logo||null,countryFlag:league.flag||null,kickoff:f.date,kickoffLocal:new Date(f.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),home,away,odds:{...odds.canonical,...extraOdds(odds.marketOdds)},marketOdds:odds.marketOdds}
}
export async function refreshNow(date,onProgress=()=>{}){
  const raw=await getFixturesByDateFresh(date),scheduled=raw.filter(x=>!liveStatus(x?.fixture?.status?.short)),leagueCache=new Map()
  const keys=[...new Set(scheduled.map(x=>`${x?.league?.id}|${x?.league?.season}`).filter(x=>!x.startsWith('undefined')))]
  onProgress({stage:'form-tables',sourceFixtures:raw.length,scheduledFixtures:scheduled.length,leagueCount:keys.length})
  await mapLimit(keys,6,async k=>{
    const[league,season]=k.split('|')
    try{
      const [standings,history]=await Promise.all([getStandings(league,season,{bypassCache:true}),getLeagueFinishedFixtures(league,season,{bypassCache:true})])
      leagueCache.set(k,{standings,history})
    }catch{leagueCache.set(k,{standings:[],history:[]})}
  })
  const matureAll=scheduled.filter(x=>{
    const k=`${x?.league?.id}|${x?.league?.season}`,data=leagueCache.get(k)||{standings:[],history:[]}
    return leagueMature(data.history,data.standings,x?.teams?.home?.id,x?.teams?.away?.id)
  })
  const mature=maxFixtures?matureAll.slice(0,maxFixtures):matureAll
  onProgress({stage:'mature',matureAvailable:matureAll.length,matureSelected:mature.length,fixtureCap:maxFixtures||'unlimited'})
  let done=0,priced=0,fallbacks=0
  const enriched=await mapLimit(mature,concurrency,async rawFixture=>{
    const k=`${rawFixture?.league?.id}|${rawFixture?.league?.season}`,data=leagueCache.get(k)||{standings:[],history:[]},fixtureId=rawFixture?.fixture?.id
    try{
      const apiOdds=await getFixtureOdds(fixtureId,{bypassCache:true});let odds=buildCoherentOdds({apiPayload:apiOdds,fixture:rawFixture})
      if(statsApiConfigured()&&needsOddsFallback(odds)){
        try{const stats=await getStatsOddsForFixture(rawFixture,{bypassCache:true});odds=buildCoherentOdds({apiPayload:apiOdds,statsPayload:stats?.payload,fixture:rawFixture});fallbacks++}catch{}
      }
      if(!enginePriced(odds.canonical)){done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return null}
      priced++;done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return normalize(rawFixture,data.standings,data.history,odds)
    }catch{done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return null}
  })
  const fixtures=enriched.filter(Boolean),board=buildBoard(fixtures,{date,generatedAt:new Date().toISOString(),sourceFixtures:raw.length,scheduledFixtures:scheduled.length,matureFixtures:mature.length,matureAvailableFixtures:matureAll.length,fixtureCap:maxFixtures,enrichedFixtures:fixtures.length,oddsFallbacks:fallbacks,engineVersion:ENGINE_VERSION,profileSource:PROFILE_SOURCE,formTableSample:FORM_TABLE_SAMPLE})
  await saveBoard(date,board);return board
}
export function refreshStatus(date){return jobs.get(date)||{state:'idle',date}}
export function startRefresh(date){
  const current=jobs.get(date);if(current?.state==='running')return current
  const job={state:'running',date,startedAt:new Date().toISOString(),progress:{stage:'start'}};jobs.set(date,job)
  refreshNow(date,p=>{job.progress=p}).then(board=>{job.state='complete';job.completedAt=new Date().toISOString();job.result={qualified:board?.meta?.qualified||0,bestPicks:board?.bestPicks?.length||0,sourceFixtures:board?.meta?.sourceFixtures||0}}).catch(e=>{job.state='failed';job.completedAt=new Date().toISOString();job.error=e.message})
  return job
}
