import {getFixturesByDateFresh,getStandings,getLeagueFinishedFixtures,getRecentVenueGlobal,getFixtureOdds} from './apiFootball.js'
import {getStatsOddsForFixture,statsApiConfigured} from './statsApi.js'
import {buildCoherentOdds} from './oddsPolicy.js'
import {leagueMature,makeTeamProfile,buildBoard,ENGINE_VERSION,PROFILE_SOURCE,FORM_TABLE_SAMPLE} from './engine.js'
import {loadBoard,saveBoard} from './store.js'

const jobs=new Map()
const configuredFixtureCap=Number(process.env.MAX_FIXTURES_PER_REFRESH||0)
const maxFixtures=Number.isFinite(configuredFixtureCap)&&configuredFixtureCap>0?Math.max(10,configuredFixtureCap):null
const concurrency=Math.max(1,Math.min(8,Number(process.env.REFRESH_CONCURRENCY||4)))
const validOdd=v=>Number.isFinite(Number(v))&&Number(v)>1.001&&Number(v)<1000
const SCHEDULED=new Set(['NS','TBD'])
const FINISHED=new Set(['FT','AET','PEN'])
const liveStatus=s=>!SCHEDULED.has(String(s||'').toUpperCase())
const engineOddKeys=['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes']
const kickMs=x=>{const n=Date.parse(x?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
export const sortKickoff=(rows=[])=>[...(rows||[])].sort((a,b)=>kickMs(a)-kickMs(b)||String(a?.fixtureId??'').localeCompare(String(b?.fixtureId??'')))
function name(v){return String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function outcome(market,names){for(const n of names){const hit=(market?.outcomes||[]).find(o=>name(o?.name)===name(n));if(hit&&validOdd(hit.odd))return Number(hit.odd)}return null}
function extraOdds(marketOdds){
  const dnb=(marketOdds||[]).find(m=>m.marketKey==='draw-no-bet'),dc=(marketOdds||[]).find(m=>m.marketKey==='double-chance')
  return{dnbHome:outcome(dnb,['Home','1']),dnbAway:outcome(dnb,['Away','2']),dc1x:outcome(dc,['Home or draw','Home/Draw','1X']),dcx2:outcome(dc,['Draw or away','Draw/Away','X2'])}
}
function enginePriced(c){return Object.values(c||{}).some(validOdd)}
export function needsOddsFallback(odds){const c=odds?.canonical||{};return engineOddKeys.some(k=>!validOdd(c[k]))}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function worker(){while(true){const x=i++;if(x>=items.length)return;out[x]=await fn(items[x],x)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
function historyKey(row){const id=row?.fixture?.id;if(id!==undefined&&id!==null)return`id:${id}`;return[row?.fixture?.date,row?.teams?.home?.id,row?.teams?.away?.id,row?.goals?.home,row?.goals?.away].join('|')}
export function mergeHistories(...groups){const map=new Map();for(const rows of groups)for(const row of Array.isArray(rows)?rows:[]){const k=historyKey(row);if(!map.has(k))map.set(k,row)}return[...map.values()]}
function statusShort(raw){return String(raw?.fixture?.status?.short||'NS').toUpperCase()}
function statusLong(raw){return String(raw?.fixture?.status?.long||'')}
export function matchStatusLabel(status,minute=null){
  const s=String(status||'NS').toUpperCase()
  if(s==='NS')return'Scheduled'
  if(s==='TBD')return'Time TBD'
  if(s==='1H')return`Live · 1H${minute!=null?` · ${minute}'`:''}`
  if(s==='HT')return'Half Time'
  if(s==='2H')return`Live · 2H${minute!=null?` · ${minute}'`:''}`
  if(s==='ET')return`Extra Time${minute!=null?` · ${minute}'`:''}`
  if(s==='BT')return'Break Time'
  if(s==='P')return'Penalties'
  if(s==='INT')return'Interrupted'
  if(s==='SUSP')return'Suspended'
  if(s==='FT')return'Full Time'
  if(s==='AET')return'Full Time · AET'
  if(s==='PEN')return'Full Time · Pens'
  if(s==='PST')return'Postponed'
  if(s==='CANC')return'Cancelled'
  if(s==='ABD')return'Abandoned'
  if(s==='AWD')return'Awarded'
  if(s==='WO')return'Walkover'
  return status||'Scheduled'
}
function scoreFromRaw(raw){
  const full=raw?.score?.fulltime||{},goals=raw?.goals||{}
  const h=Number.isFinite(Number(full.home))?Number(full.home):Number(goals.home)
  const a=Number.isFinite(Number(full.away))?Number(full.away):Number(goals.away)
  return Number.isFinite(h)&&Number.isFinite(a)?{home:h,away:a}:null
}
function selectedSide(row,raw){
  const selected=String(row?.selectedTeamId??'')
  if(selected&&selected===String(raw?.teams?.home?.id??''))return'home'
  if(selected&&selected===String(raw?.teams?.away?.id??''))return'away'
  const selection=String(row?.selection||'').toLowerCase(),home=String(raw?.teams?.home?.name||'').toLowerCase(),away=String(raw?.teams?.away?.name||'').toLowerCase()
  if(home&&selection.includes(home))return'home'
  if(away&&selection.includes(away))return'away'
  if(/\b1x\b/i.test(row?.selection||''))return'home'
  if(/\bx2\b/i.test(row?.selection||''))return'away'
  return null
}
export function settlePublishedPick(row,raw){
  if(!FINISHED.has(statusShort(raw)))return null
  const score=scoreFromRaw(raw);if(!score)return null
  const h=score.home,a=score.away,total=h+a,market=String(row?.market||'').toUpperCase(),side=selectedSide(row,raw)
  if(market==='1X2'){if(!side)return'REVIEW';return side==='home'?(h>a?'WON':'LOST'):(a>h?'WON':'LOST')}
  if(market==='DNB'){if(!side)return'REVIEW';if(h===a)return'PUSH';return side==='home'?(h>a?'WON':'LOST'):(a>h?'WON':'LOST')}
  if(market==='DC'){if(!side)return'REVIEW';return side==='home'?(h>=a?'WON':'LOST'):(a>=h?'WON':'LOST')}
  if(market==='BTTS')return h>0&&a>0?'WON':'LOST'
  const goal=market.match(/^([OU])(1\.5|2\.5|3\.5)$/)
  if(goal){const line=Number(goal[2]);return goal[1]==='O'?(total>line?'WON':'LOST'):(total<line?'WON':'LOST')}
  return'REVIEW'
}
function publicFixture(raw,availability='scheduled'){
  const f=raw?.fixture||{},league=raw?.league||{},home=raw?.teams?.home||{},away=raw?.teams?.away||{},status=statusShort(raw),score=scoreFromRaw(raw)
  return{fixtureId:f.id,kickoff:f.date,status,statusLong:statusLong(raw),minute:f?.status?.elapsed??null,matchStatus:matchStatusLabel(status,f?.status?.elapsed??null),score,league:league.name||'League',country:league.country||'',leagueLogo:league.logo||null,countryFlag:league.flag||null,homeId:home.id??null,home:home.name||'',homeLogo:home.logo||null,awayId:away.id??null,away:away.name||'',awayLogo:away.logo||null,availability}
}
function normalize(raw,standings,leagueHistory,odds){
  const f=raw.fixture||{},league=raw.league||{},homeTeam=raw.teams?.home||{},awayTeam=raw.teams?.away||{}
  const home=makeTeamProfile({standings,leagueHistory,team:homeTeam,venue:'home'}),away=makeTeamProfile({standings,leagueHistory,team:awayTeam,venue:'away'})
  return{fixtureId:f.id,match:`${home.name} vs ${away.name}`,league:league.name||'League',country:league.country||'',leagueLogo:league.logo||null,countryFlag:league.flag||null,kickoff:f.date,kickoffLocal:new Date(f.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),home,away,odds:{...odds.canonical,...extraOdds(odds.marketOdds)},marketOdds:odds.marketOdds}
}
function reconcilePick(row,rawById){
  const raw=rawById.get(String(row?.fixtureId??''));if(!raw)return row
  const status=statusShort(raw),score=scoreFromRaw(raw)
  return{...row,status,statusLong:statusLong(raw),minute:raw?.fixture?.status?.elapsed??null,matchStatus:matchStatusLabel(status,raw?.fixture?.status?.elapsed??null),score,settlementStatus:settlePublishedPick(row,raw)}
}
function mergeRows(current,previous,rawById){
  const map=new Map()
  for(const row of current||[]){const x=reconcilePick(row,rawById);map.set(`${x.fixtureId}|${x.market}`,x)}
  for(const row of previous||[]){const raw=rawById.get(String(row?.fixtureId??''));if(!raw||SCHEDULED.has(statusShort(raw)))continue;const x=reconcilePick(row,rawById),key=`${x.fixtureId}|${x.market}`;if(!map.has(key))map.set(key,x)}
  return sortKickoff([...map.values()])
}
function reconcilePublishedBoard(board,previous,raw){
  const rawById=new Map((raw||[]).map(x=>[String(x?.fixture?.id??''),x]))
  const sameEngine=String(previous?.meta?.engineVersion||'')===String(ENGINE_VERSION)
  const previousPriority=sameEngine?previous?.priority:[]
  const previousBest=sameEngine?previous?.bestPicks:[]
  board.priority=mergeRows(board.priority,previousPriority,rawById)
  board.bestPicks=mergeRows(board.bestPicks,previousBest,rawById)
  board.groups={single:board.priority.filter(x=>Number(x.filterCount||0)===1),two:board.priority.filter(x=>Number(x.filterCount||0)===2),threePlus:board.priority.filter(x=>Number(x.filterCount||0)>=3)}
  board.availableMarkets=[...new Set(board.priority.map(x=>x.market).filter(Boolean))].sort()
  board.meta.qualified=board.priority.length
  board.meta.bestPicks=board.bestPicks.length
  board.meta.previousSnapshotAccepted=sameEngine
  return board
}
export async function refreshNow(date,onProgress=()=>{}){
  const [raw,previous]=await Promise.all([getFixturesByDateFresh(date),loadBoard(date).catch(()=>null)]),scheduled=raw.filter(x=>SCHEDULED.has(statusShort(x))),leagueCache=new Map(),availability=new Map()
  for(const fixture of scheduled)availability.set(String(fixture?.fixture?.id??''),'scheduled')
  const keys=[...new Set(scheduled.map(x=>`${x?.league?.id}|${x?.league?.season}`).filter(x=>!x.startsWith('undefined')))]
  onProgress({stage:'form-tables',sourceFixtures:raw.length,scheduledFixtures:scheduled.length,leagueCount:keys.length})
  await mapLimit(keys,6,async k=>{
    const[league,season]=k.split('|')
    try{
      const [standings,history]=await Promise.all([getStandings(league,season,{bypassCache:true}),getLeagueFinishedFixtures(league,season,{bypassCache:true})])
      leagueCache.set(k,{standings,history})
    }catch{leagueCache.set(k,{standings:[],history:[]})}
  })

  let matureFromLeague=0,matureFromTeamFallback=0,insufficientSplit=0,fallbackTeams=0
  const splitReady=await mapLimit(scheduled,concurrency,async rawFixture=>{
    const id=String(rawFixture?.fixture?.id??''),k=`${rawFixture?.league?.id}|${rawFixture?.league?.season}`,data=leagueCache.get(k)||{standings:[],history:[]},homeId=rawFixture?.teams?.home?.id,awayId=rawFixture?.teams?.away?.id
    if(leagueMature(data.history,data.standings,homeId,awayId)){matureFromLeague++;availability.set(id,'analysis-ready');return{rawFixture,standings:data.standings,history:data.history,splitSource:'league-season'}}
    const before=rawFixture?.fixture?.date||`${date}T23:59:59Z`
    const [homeFallback,awayFallback]=await Promise.all([
      getRecentVenueGlobal(homeId,'home',FORM_TABLE_SAMPLE,before).catch(()=>[]),
      getRecentVenueGlobal(awayId,'away',FORM_TABLE_SAMPLE,before).catch(()=>[])
    ])
    if(homeFallback.length>=FORM_TABLE_SAMPLE)fallbackTeams++
    if(awayFallback.length>=FORM_TABLE_SAMPLE)fallbackTeams++
    const history=mergeHistories(data.history,homeFallback,awayFallback)
    if(leagueMature(history,data.standings,homeId,awayId)){matureFromTeamFallback++;availability.set(id,'analysis-ready');return{rawFixture,standings:data.standings,history,splitSource:'team-history-fallback'}}
    insufficientSplit++;availability.set(id,'insufficient-split');return null
  })
  const matureAll=splitReady.filter(Boolean),mature=maxFixtures?matureAll.slice(0,maxFixtures):matureAll
  onProgress({stage:'mature',matureAvailable:matureAll.length,matureSelected:mature.length,matureFromLeague,matureFromTeamFallback,historyFallbackTeams:fallbackTeams,insufficientSplit,fixtureCap:maxFixtures||'unlimited'})

  let done=0,priced=0,fallbacks=0
  const enriched=await mapLimit(mature,concurrency,async item=>{
    const {rawFixture,standings,history,splitSource}=item,fixtureId=rawFixture?.fixture?.id,id=String(fixtureId??'')
    try{
      const apiOdds=await getFixtureOdds(fixtureId,{bypassCache:true});let odds=buildCoherentOdds({apiPayload:apiOdds,fixture:rawFixture})
      if(statsApiConfigured()&&needsOddsFallback(odds)){
        try{const stats=await getStatsOddsForFixture(rawFixture,{bypassCache:true});odds=buildCoherentOdds({apiPayload:apiOdds,statsPayload:stats?.payload,fixture:rawFixture});fallbacks++}catch{}
      }
      if(!enginePriced(odds.canonical)){availability.set(id,'waiting-odds');done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return null}
      availability.set(id,'priced');priced++;done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return{...normalize(rawFixture,standings,history,odds),splitSource}
    }catch{availability.set(id,'analysis-unavailable');done++;onProgress({stage:'enrich',done,total:mature.length,priced,fallbacks});return null}
  })
  const fixtures=enriched.filter(Boolean),board=buildBoard(fixtures,{date,generatedAt:new Date().toISOString(),sourceFixtures:raw.length,scheduledFixtures:scheduled.length,matureFixtures:mature.length,matureAvailableFixtures:matureAll.length,matureFromLeague,matureFromTeamFallback,historyFallbackTeams:fallbackTeams,insufficientSplit,fixtureCap:maxFixtures,enrichedFixtures:fixtures.length,oddsFallbacks:fallbacks,engineVersion:ENGINE_VERSION,profileSource:PROFILE_SOURCE,formTableSample:FORM_TABLE_SAMPLE})
  const qualifiedIds=new Set((board.bestPicks||[]).map(x=>String(x?.fixtureId??'')))
  for(const id of qualifiedIds)availability.set(id,'qualified')
  board.fixtures=sortKickoff(raw.map(rawFixture=>publicFixture(rawFixture,availability.get(String(rawFixture?.fixture?.id??''))||'scheduled')))
  reconcilePublishedBoard(board,previous,raw)
  board.meta.publishedFixtures=board.fixtures.length
  board.meta.upcomingFixtures=board.fixtures.filter(x=>SCHEDULED.has(String(x.status||'').toUpperCase())).length
  board.meta.unqualifiedFixtures=board.fixtures.filter(x=>x.availability!=='qualified'&&SCHEDULED.has(String(x.status||'').toUpperCase())).length
  await saveBoard(date,board);return board
}
export function refreshStatus(date){return jobs.get(date)||{state:'idle',date}}
export function startRefresh(date){
  const current=jobs.get(date);if(current?.state==='running')return current
  const job={state:'running',date,startedAt:new Date().toISOString(),progress:{stage:'start'}};jobs.set(date,job)
  refreshNow(date,p=>{job.progress=p}).then(board=>{job.state='complete';job.completedAt=new Date().toISOString();job.result={qualified:board?.meta?.qualified||0,bestPicks:board?.bestPicks?.length||0,publishedFixtures:board?.fixtures?.length||0,sourceFixtures:board?.meta?.sourceFixtures||0}}).catch(e=>{job.state='failed';job.completedAt=new Date().toISOString();job.error=e.message})
  return job
}
