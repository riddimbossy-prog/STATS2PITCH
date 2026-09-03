import {sportyFixturesByDate} from './sportyBet.js'
import {hydrateSportyComboMarkets} from './comboMarketHydrator.js'
import {buildComboBoard} from './comboEngine.js'
import {teamLastX,leagueFormPack,matchGoalEvents,nid,overallSample,hasMatchStats,teamVersus} from './sportyStats.js'
import {verifiedMarkets} from './odds.js'
import {venueSample,buildBoard} from './engine.js'
import {buildBankerRules,buildLeagueScoringProfile,evaluateBankerFixture,buildOverallTable} from './bankerEngine.js'
import {buildOver25Profile} from './over25.js'
import {saveBoard,listBoards} from './store.js'
import {buildLearningState, publicLearning} from './learning.js'
import {SCHEDULED,FORM_SAMPLE} from './config.js'
import {h2hSnapshot,last5Overall,teamStats} from './pickWhy.js'


const jobs=new Map(),leagueCache=new Map(),teamCache=new Map(),splitCache=new Map(),standingCache=new Map(),eventCache=new Map()

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let i=0
  async function worker(){while(true){const x=i++;if(x>=items.length)return;out[x]=await fn(items[x],x)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out
}
function publicFixture(f,status='scheduled'){return{fixtureId:f?.fixture?.id,kickoff:f?.fixture?.date,status:f?.fixture?.status?.short||'NS',league:f?.league?.name||'',country:f?.league?.country||'',home:f?.teams?.home?.name||'',away:f?.teams?.away?.name||'',homeId:f?.teams?.home?.id??null,awayId:f?.teams?.away?.id??null,homeLogo:f?.teams?.home?.logo||null,awayLogo:f?.teams?.away?.logo||null,availability:status}}
async function getLeaguePack(utid,country){
  const key=String(utid??'')
  if(!key)return{current:[],previous:[],extra:[],currentSeasonId:null,previousSeasonId:null,teams:0}
  if(leagueCache.has(key))return leagueCache.get(key)
  const pending=leagueFormPack(utid,country).catch(error=>{
    leagueCache.delete(key)
    console.warn(`league pack ${key}: ${error?.message||error}`)
    return{current:[],previous:[],extra:[],currentSeasonId:null,previousSeasonId:null,teams:0}
  })
  leagueCache.set(key,pending)
  return pending
}
async function getTeamHistory(teamId){
  const key=String(teamId??'')
  if(!key)return[]
  if(teamCache.has(key))return teamCache.get(key)
  const pending=teamLastX(teamId).catch(error=>{
    teamCache.delete(key)
    console.warn(`team last-x ${key}: ${error?.message||error}`)
    return[]
  })
  teamCache.set(key,pending)
  return pending
}
function mergeUnique(...groups){const map=new Map();for(const rows of groups)for(const f of rows||[]){const key=String(f?.fixture?.id??`${f?.fixture?.date}|${f?.teams?.home?.id}|${f?.teams?.away?.id}`);if(!map.has(key))map.set(key,f)}return[...map.values()]}
function lastNVenue(rows,teamId,venue,n=FORM_SAMPLE){return(rows||[]).filter(f=>{const done=['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||'').toUpperCase());if(!done)return false;return venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)}).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,n)}
function compactScoreRow(f){
  return{
    fixture:{id:f?.fixture?.id,date:f?.fixture?.date,status:{short:String(f?.fixture?.status?.short||'FT')}},
    teams:{home:{id:f?.teams?.home?.id,name:f?.teams?.home?.name||''},away:{id:f?.teams?.away?.id,name:f?.teams?.away?.name||''}},
    goals:{home:f?.goals?.home,away:f?.goals?.away}
  }
}
function venueFormHistory(rows,teamId,venue,n=15){
  return lastNVenue(rows,teamId,venue,n).map(compactScoreRow)
}
function ppgFor(rows,teamId,venue){let pts=0,played=0;for(const f of rows){const h=Number(f?.goals?.home),a=Number(f?.goals?.away);if(!Number.isFinite(h)||!Number.isFinite(a))continue;const own=venue==='home'?h:a,opp=venue==='home'?a:h;played++;pts+=own>opp?3:own===opp?1:0}return played?pts/played:0}
function splitTable(history,venue){const ids=new Map();for(const f of history||[]){const t=venue==='home'?f?.teams?.home:f?.teams?.away;if(t?.id)ids.set(String(t.id),{id:t.id,name:t.name||''})}const rows=[];for(const t of ids.values()){const sample=lastNVenue(history,t.id,venue);if(sample.length<FORM_SAMPLE)continue;rows.push({...t,ppg:ppgFor(sample,t.id,venue),played:sample.length})}rows.sort((a,b)=>b.ppg-a.ppg||String(a.name).localeCompare(String(b.name)));return new Map(rows.map((r,i)=>[String(r.id),{position:i+1,size:rows.length,ppg:+r.ppg.toFixed(2),played:r.played,sampleReady:true,venue}]))}
function cachedSplitTable(leagueId,season,venue,history){const key=`${leagueId}|${season}|${venue}|${FORM_SAMPLE}`;if(!splitCache.has(key))splitCache.set(key,splitTable(history,venue));return splitCache.get(key)}
function cachedOverallTable(leagueId,season,history){const key=`${leagueId}|${season}|overall`;if(!standingCache.has(key))standingCache.set(key,buildOverallTable(history));return standingCache.get(key)}
async function learningProfiles(){
  try{
    const end=new Date(),start=new Date(end.getTime()-60*86400000)
    const rows=await listBoards(start.toISOString().slice(0,10),end.toISOString().slice(0,10))
    const boards=rows.map(x=>({...(x.payload||{}),date:x.snapshot_date,meta:{...(x.payload?.meta||{}),date:x.snapshot_date}})).filter(Boolean)
    return buildLearningState(boards,end.toISOString().slice(0,10),6)
  }catch{
    return buildLearningState([],new Date().toISOString().slice(0,10),6)
  }
}

async function enrichHistoryFixture(row){
  const id=String(row?.fixture?.id??'')
  if(!id)return{...row,events:row?.events||[],eventsComplete:row?.eventsComplete===true}
  if(row?.eventsComplete===true)return row
  if(!eventCache.has(id)){
    eventCache.set(id,matchGoalEvents(id,row?.teams?.home?.id,row?.teams?.away?.id).then(events=>({ok:events.length>0,events})).catch(error=>({ok:false,events:row?.events||[],error:error?.message||String(error)})))
  }
  const event=await eventCache.get(id)
  const events=event.ok?event.events:(row.events||[])
  const h=Number(row?.goals?.home),a=Number(row?.goals?.away)
  const complete=event.ok&&(h+a===0||events.length===h+a)
  return{...row,events,eventsComplete:complete||row?.eventsComplete===true}
}

async function hydrateTransitionSamples(record){
  const unique=new Map()
  for(const row of [...record.home.fixtures,...record.away.fixtures]){const id=String(row?.fixture?.id??'');if(id&&!unique.has(id))unique.set(id,row)}
  const enriched=await mapLimit([...unique.values()],2,enrichHistoryFixture)
  const byId=new Map(enriched.map(row=>[String(row?.fixture?.id??''),row]))
  return{
    ...record,
    home:{...record.home,fixtures:record.home.fixtures.map(row=>byId.get(String(row?.fixture?.id??''))||row)},
    away:{...record.away,fixtures:record.away.fixtures.map(row=>byId.get(String(row?.fixture?.id??''))||row)},
    transitionEventsHydrated:true
  }
}

function teamSideMarket(market,selection){
  const k=String(market||''),n=String(selection||'').toLowerCase()
  if(k==='match-winner')return n==='home'||n==='away'||n==='1'||n==='2'
  if(k==='draw-no-bet')return n==='home'||n==='away'||n==='1'||n==='2'
  if(k==='double-chance')return n.includes('home or draw')||n.includes('draw or away')||n==='1x'||n==='x2'
  return false
}

function needsTransitionEvidence(record){
  const banker=evaluateBankerFixture(record,{ignoreTransition:true}).pick
  return Boolean(banker&&teamSideMarket(banker.market,banker.selection))
}

export async function refreshNow(date,onProgress=()=>{}){
  const learned=await learningProfiles()
  onProgress({stage:'fixtures-and-odds',done:0,total:2})
  let raw=[]
  const feed='sportybet'
  try{
    raw=await sportyFixturesByDate(date)
  }catch(error){
    console.warn(`SportyBet feed ${date}: ${error?.message||error}`)
    raw=[]
  }
  onProgress({stage:'fixtures-and-odds',done:2,total:2,fixtures:raw.length,oddsFixtures:raw.length,feed})
  const scheduled=raw.filter(f=>SCHEDULED.has(String(f?.fixture?.status?.short||'').toUpperCase()))
  await hydrateSportyComboMarkets(scheduled,{concurrency:Math.max(1,Number(process.env.COMBO_MARKET_CONCURRENCY||3))})
  const leagueIds=[...new Set(scheduled.map(f=>nid(f?.league?.id)).filter(Boolean))]
  let historyDone=0
  onProgress({stage:'league-history',done:0,total:leagueIds.length,fixtures:scheduled.length,feed})
  await mapLimit(leagueIds,2,async utid=>{
    const sample=scheduled.find(f=>nid(f?.league?.id)===utid)
    await getLeaguePack(utid,sample?.league?.country||'')
    historyDone++
    onProgress({stage:'league-history',done:historyDone,total:leagueIds.length,fixtures:scheduled.length})
  })

  let done=0,statsVerified=0,fallbackTeams=0,insufficientHistory=0,analysisErrors=0,transitionHydratedFixtures=0,skippedNoStats=0
  const analyzed=await mapLimit(scheduled,Math.max(1,Number(process.env.REFRESH_CONCURRENCY||2)),async f=>{
    try{
      const homeId=f?.teams?.home?.id,awayId=f?.teams?.away?.id,leagueId=nid(f?.league?.id),season=Number(f?.league?.season)
      const pack=await getLeaguePack(leagueId,f?.league?.country||'')
      const current=pack.current||[],previous=pack.previous||[]
      const currentHomeFixtures=venueSample(current,homeId,'home'),currentAwayFixtures=venueSample(current,awayId,'away')
      const earlySeasonHome=currentHomeFixtures.length>0&&currentHomeFixtures.length<FORM_SAMPLE,earlySeasonAway=currentAwayFixtures.length>0&&currentAwayFixtures.length<FORM_SAMPLE
      const bankerLeagueProfile=buildLeagueScoringProfile(mergeUnique(current,previous))
      const [homeHistory,awayHistory,versusRows]=await Promise.all([
        getTeamHistory(homeId),
        getTeamHistory(awayId),
        teamVersus(homeId,awayId)
      ])
      let history=mergeUnique(current,previous,pack.extra,homeHistory,awayHistory)
      const lastMatchesHome=overallSample(history,homeId,FORM_SAMPLE)
      const lastMatchesAway=overallSample(history,awayId,FORM_SAMPLE)
      const statsReady=hasMatchStats(lastMatchesHome,homeId,lastMatchesAway,awayId)
      if(!statsReady)skippedNoStats++
      let homeFixtures=venueSample(history,homeId,'home'),awayFixtures=venueSample(history,awayId,'away')
      const homeFormHistory=venueFormHistory(history,homeId,'home',15)
      const awayFormHistory=venueFormHistory(history,awayId,'away',15)
      if(homeFixtures.length<FORM_SAMPLE)fallbackTeams++
      if(awayFixtures.length<FORM_SAMPLE)fallbackTeams++
      const formReady=homeFixtures.length>=FORM_SAMPLE&&awayFixtures.length>=FORM_SAMPLE
      if(!formReady)insufficientHistory++
      const earlySeason=(currentHomeFixtures.length>0&&currentHomeFixtures.length<FORM_SAMPLE)||(currentAwayFixtures.length>0&&currentAwayFixtures.length<FORM_SAMPLE)
      const homeSplit=formReady?cachedSplitTable(leagueId,season,'home',history).get(String(homeId))||null:null
      const awaySplit=formReady?cachedSplitTable(leagueId,season,'away',history).get(String(awayId))||null:null
      const table=cachedOverallTable(leagueId,season,current)
      const homeStanding=table.get(String(homeId))||null
      const awayStanding=table.get(String(awayId))||null
      const marketOdds=verifiedMarkets({sportyMarkets:f?.sporty?.markets,fixture:f})
      if(marketOdds.length)statsVerified++
      const over25Profile=buildOver25Profile(mergeUnique(current,previous,history),homeId,awayId)
      const h2h=h2hSnapshot(versusRows.length?versusRows:history,homeId,awayId)
      let record={fixtureId:f.fixture.id,league:f.league?.name||'',country:f.league?.country||'',kickoff:f.fixture.date,home:{id:homeId,name:f.teams.home.name,logo:f.teams.home.logo||null,fixtures:homeFixtures,formHistory:homeFormHistory,lastMatches:lastMatchesHome},away:{id:awayId,name:f.teams.away.name,logo:f.teams.away.logo||null,fixtures:awayFixtures,formHistory:awayFormHistory,lastMatches:lastMatchesAway},earlySeason,earlySeasonHome,earlySeasonAway,currentVenueSamples:{home:currentHomeFixtures.length,away:currentAwayFixtures.length},bankerLeagueProfile,over25Profile,homeSplit,awaySplit,homeStanding,awayStanding,marketOdds,sportyMarkets:f?.sporty?.markets||[],formReady,statsReady,sportyEventId:f?.sporty?.eventId||null,sportyGameId:f?.sporty?.gameId||null,feed,leagueHistoryReady:current.length+previous.length>0,h2h,homeStats:teamStats(last5Overall(lastMatchesHome,homeId)),awayStats:teamStats(last5Overall(lastMatchesAway,awayId))}

      if(!statsReady){
        done++;onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams,insufficientHistory,analysisErrors,transitionHydratedFixtures,skippedNoStats})
        return record
      }
      if(formReady&&needsTransitionEvidence(record)){record=await hydrateTransitionSamples(record);transitionHydratedFixtures++}
      done++;onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams,insufficientHistory,analysisErrors,transitionHydratedFixtures,skippedNoStats})
      return record
    }catch(error){analysisErrors++;console.warn(`Fixture ${f?.fixture?.id||'unknown'} skipped: ${error?.message||error}`);done++;onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified,fallbackTeams,insufficientHistory,analysisErrors,transitionHydratedFixtures,skippedNoStats});return null}
  })

  const fixtures=analyzed.filter(Boolean),bankerRules=buildBankerRules(fixtures)
  const board=buildBoard(fixtures,{date,generatedAt:new Date().toISOString(),sourceFixtures:raw.length,scheduledFixtures:scheduled.length,analyzedFixtures:fixtures.length,insufficientHistoryFixtures:insufficientHistory,analysisErrorFixtures:analysisErrors,statsVerifiedFixtures:statsVerified,historyFallbackTeams:fallbackTeams,transitionHydratedFixtures,skippedNoStats,feed,bankerRules:bankerRules.meta,diagnostics:{sourceFixtures:raw.length,scheduledFixtures:scheduled.length,insufficientHistoryFixtures:insufficientHistory,analysisErrorFixtures:analysisErrors,analyzedFixtures:fixtures.length,transitionHydratedFixtures,skippedNoStats,qualifiedTips:0,bestPicks:0,varTips:0,filterTips:0,comboPicks:0,bankerRulePicks:bankerRules.picks.length,feed}},learned)
  const comboBoard=buildComboBoard(fixtures,board.meta)
  board.comboPicks=comboBoard.bestPicks;board.comboMeta=comboBoard.meta
  board.meta.comboEngine=comboBoard.meta.engine;board.meta.comboCount=comboBoard.bestPicks.length
  board.goalsBankers=[...(board.goalsBankers||[]),...board.comboPicks]
  board.bankers=bankerRules.picks;board.bankerRulesMeta=bankerRules.meta
  board.meta.diagnostics.qualifiedTips=board.priority.length;board.meta.diagnostics.bestPicks=board.bestPicks.length;board.meta.diagnostics.varTips=(board.varTips||[]).length
  board.meta.diagnostics.varTipsSkipped=board.varTipsMeta?.skipped||{}
  board.meta.diagnostics.filterTips=(board.filterTips||[]).length
  board.meta.diagnostics.filterTipsSkipped=board.filterTipsMeta?.skipped||{}
  board.meta.diagnostics.goalsBankers=(board.goalsBankers||[]).length
  board.meta.diagnostics.goalsBankersSkipped=board.goalsBankersMeta?.skipped||{}
  board.meta.diagnostics.comboPicks=(board.comboPicks||[]).length
  board.meta.diagnostics.comboSkipped=board.comboMeta?.skipped||{}
  board.meta.diagnostics.safestBankers=(board.safestBankers||[]).length
  board.meta.diagnostics.valueBankers=(board.valueBankers||[]).length
  board.meta.diagnostics.dailyBankersEngine=board.dailyBankersMeta?.engine||board.meta?.dailyBankersEngine||null
  board.learning=publicLearning(learned)
  board.meta.learning=board.learning
  const picks=new Map(board.bestPicks.map(p=>[String(p.fixtureId),p])),eligibleIds=new Set(fixtures.map(f=>String(f.fixtureId)))
  const statsById=new Map(fixtures.map(f=>[String(f.fixtureId),f.statsReady!==false]))
  board.fixtures=raw.filter(f=>eligibleIds.has(String(f?.fixture?.id))).map(f=>{
    const id=String(f?.fixture?.id)
    const availability=picks.has(id)?'qualified':(statsById.get(id)===false?'no-stats':'no-qualified-pick')
    return publicFixture(f,availability)
  })
  return saveBoard(date,board)
}

export function refreshStatus(date){return jobs.get(date)||{state:'idle',date}}
export function startRefresh(date){
  if(jobs.get(date)?.state==='running')return jobs.get(date)
  const job={state:'running',date,startedAt:new Date().toISOString(),progress:{stage:'start'}};jobs.set(date,job)
  refreshNow(date,p=>job.progress=p).then(board=>{job.state='complete';job.completedAt=new Date().toISOString();job.result={bestPicks:board.bestPicks.length,qualified:board.priority.length,varTips:board.varTips?.length||0,filterTips:board.filterTips?.length||0,goalsBankers:board.goalsBankers?.length||0,comboPicks:board.comboPicks?.length||0,bankers:board.bankers?.length||0,diagnostics:board.meta?.diagnostics||null}}).catch(e=>{job.state='failed';job.error=e.message;job.completedAt=new Date().toISOString()})
  return job
}