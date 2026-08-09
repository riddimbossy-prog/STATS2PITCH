import { getFixturesByDate, getStandings, getRecentLeagueVenue, getFixtureOdds } from './apiFootball.js'
import { deriveVenueRecentStats, splitStandingMetrics, overallStandingMetrics, leagueGamesPlayed, leagueTotalCompletedGames, leagueAverageTeamPlayed, hasMinimumLeagueGames, MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY } from './stats.js'
import { getStatsOddsForFixture, statsApiConfigured } from './statsApi.js'
import { getStatsOddsFallback } from './statsFallback.js'
import { buildCoherentOdds } from './oddsPolicy.js'
import { withDeadline } from './providerFetch.js'

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const validOdd=v=>Number.isFinite(Number(v))&&Number(v)>1.001
const emit=(cb,data)=>{try{if(typeof cb==='function')cb(data)}catch{}}
function apiHasPublishableCoverage(coherent){const c=coherent?.canonical||{};return ['home','draw','away'].every(k=>validOdd(c[k]))||[['over15','under15'],['over25','under25'],['over35','under35']].some(([a,b])=>validOdd(c[a])&&validOdd(c[b]))||validOdd(c.bttsYes)&&validOdd(c.bttsNo)}
function hasEnginePrice(odds){return['home','away','over15','under15','over25','under25','over35','under35'].some(k=>validOdd(odds?.[k]))}
async function statsOddsFor(fixture,opts={}){
  if(!statsApiConfigured())return null
  const timeout=Math.max(3000,Number(process.env.STATS_ODDS_MATCH_TIMEOUT_MS||25000))
  try{const primary=await withDeadline(getStatsOddsForFixture(fixture,opts),timeout,'TheStatsAPI odds match');if(primary?.payload)return primary}catch(e){console.warn('Primary additional odds match failed',fixture?.fixture?.id,e.message)}
  try{const fallback=await withDeadline(getStatsOddsFallback(fixture,opts),timeout,'TheStatsAPI fallback odds match');if(fallback?.payload)return fallback}catch(e){console.warn('Fallback additional odds match failed',fixture?.fixture?.id,e.message)}
  return null
}

export async function selectMatureCandidates(upcoming,standingsFor,max=Infinity,onProgress=null){
  const selected=[];let earlySeasonSkipped=0,standingsUnavailable=0
  const pool=Array.isArray(upcoming)?upcoming:[],limit=Number.isFinite(Number(max))?Math.max(0,Number(max)):Infinity
  for(let i=0;i<pool.length;i++){
    if(selected.length>=limit)break
    const f=pool[i]
    try{const st=await standingsFor(f.league.id,f.league.season),leagueMinimumPlayed=leagueGamesPlayed(st),leagueAveragePlayed=leagueAverageTeamPlayed(st),leagueTotalGames=leagueTotalCompletedGames(st);if(!hasMinimumLeagueGames(st,MIN_LEAGUE_GAMES))earlySeasonSkipped++;else selected.push({f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames})}
    catch(e){standingsUnavailable++;console.warn('Standings unavailable while pre-screening fixture',f.fixture?.id,e.message)}
    if(i===0||(i+1)%10===0||i===pool.length-1)emit(onProgress,{phase:'maturity',message:`Checking league maturity: ${i+1}/${pool.length} fixtures`,current:i+1,total:pool.length,selected:selected.length})
  }
  return{selected,earlySeasonSkipped,standingsUnavailable,scanned:pool.length}
}
function spreadAcrossLeagues(candidates){const buckets=new Map();for(const c of candidates||[]){const k=`${c.f?.league?.id}:${c.f?.league?.season}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c)}const out=[];let remaining=true;while(remaining){remaining=false;for(const rows of buckets.values()){if(rows.length){out.push(rows.shift());remaining=true}}}return out}

export async function enrichDate(requestedDate,options={}){
  const onProgress=options?.onProgress,fresh=options?.fresh===true,date=/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')?requestedDate:localDate(),providerOpts=fresh?{bypassCache:true}:{}
  emit(onProgress,{phase:'fixtures',message:`Loading fixtures for ${date}…`,current:0,total:null})
  const raw=await getFixturesByDate(date,providerOpts),max=Math.max(1,Number(process.env.MAX_FIXTURES_PER_REFRESH||60)),upcoming=raw.filter(f=>['NS','TBD'].includes(String(f.fixture?.status?.short||'').toUpperCase())),maxStatsFallbacks=Math.max(0,Number(process.env.MAX_STATS_ODDS_FALLBACKS_PER_REFRESH||20)),standingCache=new Map(),recentCache=new Map()
  emit(onProgress,{phase:'fixtures',message:`Loaded ${raw.length} fixtures; ${upcoming.length} are valid pre-kickoff fixtures.`,current:raw.length,total:raw.length})
  async function standings(league,season){const k=`${league}:${season}`;if(!standingCache.has(k))standingCache.set(k,getStandings(league,season,providerOpts));return standingCache.get(k)}
  async function recentSplit(team,league,season,venue){const k=`${team}:${league}:${season}:${venue}`;if(!recentCache.has(k))recentCache.set(k,getRecentLeagueVenue(team,league,season,venue,10,providerOpts));return recentCache.get(k)}

  const preflight=await selectMatureCandidates(upcoming,standings,upcoming.length,onProgress),candidatePool=spreadAcrossLeagues(preflight.selected),configuredAttempts=Number(process.env.MAX_ENRICHMENT_ATTEMPTS_PER_REFRESH||0),attemptLimit=configuredAttempts>0?Math.min(candidatePool.length,configuredAttempts):candidatePool.length,enriched=[]
  let teamGateSkipped=0,statsOddsFallbacks=0,statsFallbackCapSkipped=0,unpricedSkipped=0,shortSplitHistory=0,enrichmentErrors=0,candidatesAttempted=0
  for(let i=0;i<candidatePool.length&&i<attemptLimit&&enriched.length<max;i++){
    const {f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames}=candidatePool[i];candidatesAttempted++
    emit(onProgress,{phase:'enrich',message:`Finding priced split fixtures: ${enriched.length}/${max} ready (${i+1}/${Math.min(candidatePool.length,attemptLimit)} candidates checked)`,current:i+1,total:Math.min(candidatePool.length,attemptLimit),selected:enriched.length})
    try{
      const homeOverall=overallStandingMetrics(st,f.teams.home.id),awayOverall=overallStandingMetrics(st,f.teams.away.id),homeStanding=splitStandingMetrics(st,f.teams.home.id,'home'),awayStanding=splitStandingMetrics(st,f.teams.away.id,'away')
      if(Number(homeOverall.played||0)<MIN_LEAGUE_GAMES||Number(awayOverall.played||0)<MIN_LEAGUE_GAMES){teamGateSkipped++;continue}
      const apiOddsRaw=await getFixtureOdds(f.fixture.id,providerOpts).catch(e=>{console.warn('Primary odds unavailable for fixture',f.fixture?.id,e.message);return[]})
      let coherent=buildCoherentOdds({apiPayload:apiOddsRaw,statsPayload:null,fixture:f}),statsOdds=null
      if(!apiHasPublishableCoverage(coherent)&&statsOddsFallbacks<maxStatsFallbacks){statsOddsFallbacks++;statsOdds=await statsOddsFor(f,fresh?{bypassCache:true}:{});if(statsOdds?.payload)coherent=buildCoherentOdds({apiPayload:apiOddsRaw,statsPayload:statsOdds.payload,fixture:f})}
      else if(!apiHasPublishableCoverage(coherent)&&statsOddsFallbacks>=maxStatsFallbacks)statsFallbackCapSkipped++
      const odds=coherent.canonical;if(!hasEnginePrice(odds)){unpricedSkipped++;continue}
      const [homeRows,awayRows]=await Promise.all([recentSplit(f.teams.home.id,f.league.id,f.league.season,'home').catch(e=>{console.warn('Home split history unavailable',f.fixture?.id,e.message);return[]}),recentSplit(f.teams.away.id,f.league.id,f.league.season,'away').catch(e=>{console.warn('Away split history unavailable',f.fixture?.id,e.message);return[]})])
      if(homeRows.length<5||awayRows.length<5)shortSplitHistory++
      const hm={...deriveVenueRecentStats(homeRows,f.teams.home.id,'home'),...homeStanding,overall:homeOverall},am={...deriveVenueRecentStats(awayRows,f.teams.away.id,'away'),...awayStanding,overall:awayOverall}
      enriched.push({fixtureId:f.fixture.id,match:`${f.teams.home.name} vs ${f.teams.away.name}`,league:f.league.name,country:f.league.country||'',kickoff:f.fixture.date,kickoffLocal:new Date(f.fixture.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),leagueLogo:f.league.logo||null,countryFlag:f.league.flag||null,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalCompletedGames:leagueTotalGames,earlySeasonEligible:true,splitPolicy:SPLIT_ENGINE_POLICY,splitMode:'home-vs-away',home:{id:f.teams.home.id,name:f.teams.home.name,logo:f.teams.home.logo||null,...hm},away:{id:f.teams.away.id,name:f.teams.away.name,logo:f.teams.away.logo||null,...am},odds,marketOdds:coherent.marketOdds,oddsPolicy:coherent.policy})
      await sleep(20)
    }catch(e){enrichmentErrors++;console.warn('Skipping fixture during split enrichment',f.fixture?.id,e.message)}
  }
  emit(onProgress,{phase:'enrich',message:`Enrichment finished: ${enriched.length} priced mature fixtures ready.`,current:candidatesAttempted,total:Math.min(candidatePool.length,attemptLimit),selected:enriched.length})
  return{date,fixtures:enriched,rawFixtures:raw,rawCount:raw.length,upcomingCount:upcoming.length,maturityCandidates:preflight.selected.length,maturityScanned:preflight.scanned,candidatesAttempted,attemptLimit,candidatePoolExhausted:candidatesAttempted>=Math.min(candidatePool.length,attemptLimit),enrichmentTargetReached:enriched.length>=max,earlySeasonSkipped:preflight.earlySeasonSkipped+teamGateSkipped,standingsUnavailable:preflight.standingsUnavailable,statsOddsFallbacks,statsFallbackCapSkipped,unpricedSkipped,shortSplitHistory,enrichmentErrors,splitPolicy:SPLIT_ENGINE_POLICY,freshProviderReads:fresh}
}
