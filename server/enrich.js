import { getFixturesByDate, getStandings, getRecentLeagueVenue, getFixtureOdds } from './apiFootball.js'
import { deriveVenueRecentStats, splitStandingMetrics, overallStandingMetrics, leagueGamesPlayed, leagueTotalCompletedGames, leagueAverageTeamPlayed, hasMinimumLeagueGames, MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY } from './stats.js'
import { getStatsOddsForFixture, statsApiConfigured } from './statsApi.js'
import { getStatsOddsFallback } from './statsFallback.js'
import { buildCoherentOdds } from './oddsPolicy.js'
import { withDeadline } from './providerFetch.js'

const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const validOdd=v=>Number.isFinite(Number(v))&&Number(v)>1.001
const emit=(cb,data)=>{try{if(typeof cb==='function')cb(data)}catch{}}
export const PREKICKOFF_GRACE_MS=15*60*1000

function hasEnginePrice(odds){return['home','away','over15','under15','over25','under25','over35','under35'].some(k=>validOdd(odds?.[k]))}
export function isValidPreKickoffFixture(fixture,now=Date.now()){
  const short=String(fixture?.fixture?.status?.short||'').toUpperCase()
  if(!['NS','TBD'].includes(short))return false
  const kickoff=Date.parse(fixture?.fixture?.date||'')
  if(!Number.isFinite(kickoff))return true
  return Number(now)<=kickoff+PREKICKOFF_GRACE_MS
}

async function runPool(items,limit,worker){
  const rows=Array.isArray(items)?items:[]
  if(!rows.length)return[]
  const width=Math.max(1,Math.min(rows.length,Number(limit)||1))
  const out=new Array(rows.length)
  let cursor=0
  await Promise.all(Array.from({length:width},async()=>{
    while(true){
      const i=cursor++
      if(i>=rows.length)return
      out[i]=await worker(rows[i],i)
    }
  }))
  return out
}

async function statsOddsFor(fixture,opts={}){
  if(!statsApiConfigured())return null
  // Secondary odds are a fallback only. They must never hold the whole board for
  // tens of seconds per candidate when API-Football has no usable price.
  const totalBudget=Math.max(3000,Number(process.env.STATS_ODDS_MATCH_TIMEOUT_MS||9000))
  const started=Date.now()
  try{
    const primaryBudget=Math.max(2000,Math.min(6000,totalBudget-1500))
    const primary=await withDeadline(getStatsOddsForFixture(fixture,opts),primaryBudget,'TheStatsAPI odds match')
    if(primary?.payload)return primary
  }catch(e){console.warn('Primary additional odds match failed',fixture?.fixture?.id,e.message)}
  const remaining=Math.max(1200,totalBudget-(Date.now()-started))
  try{
    const fallback=await withDeadline(getStatsOddsFallback(fixture,opts),remaining,'TheStatsAPI fallback odds match')
    if(fallback?.payload)return fallback
  }catch(e){console.warn('Fallback additional odds match failed',fixture?.fixture?.id,e.message)}
  return null
}

export async function selectMatureCandidates(upcoming,standingsFor,max=Infinity,onProgress=null){
  const pool=Array.isArray(upcoming)?upcoming:[]
  const limit=Number.isFinite(Number(max))?Math.max(0,Number(max)):Infinity
  const concurrency=Math.max(1,Math.min(12,Number(process.env.MATURITY_CONCURRENCY||6)))
  let earlySeasonSkipped=0,standingsUnavailable=0,done=0
  const assessed=await runPool(pool,concurrency,async f=>{
    try{
      const st=await standingsFor(f.league.id,f.league.season)
      const leagueMinimumPlayed=leagueGamesPlayed(st),leagueAveragePlayed=leagueAverageTeamPlayed(st),leagueTotalGames=leagueTotalCompletedGames(st)
      if(!hasMinimumLeagueGames(st,MIN_LEAGUE_GAMES)){earlySeasonSkipped++;return null}
      return{f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames}
    }catch(e){
      standingsUnavailable++
      console.warn('Standings unavailable while pre-screening fixture',f.fixture?.id,e.message)
      return null
    }finally{
      done++
      if(done===1||done%10===0||done===pool.length)emit(onProgress,{phase:'maturity',message:`Checking league maturity: ${done}/${pool.length} fixtures`,current:done,total:pool.length})
    }
  })
  const selected=assessed.filter(Boolean).slice(0,limit)
  return{selected,earlySeasonSkipped,standingsUnavailable,scanned:pool.length}
}

function spreadAcrossLeagues(candidates){
  const buckets=new Map()
  for(const c of candidates||[]){const k=`${c.f?.league?.id}:${c.f?.league?.season}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c)}
  const out=[];let remaining=true
  while(remaining){remaining=false;for(const rows of buckets.values()){if(rows.length){out.push(rows.shift());remaining=true}}}
  return out
}

export async function enrichDate(requestedDate,options={}){
  const onProgress=options?.onProgress,fresh=options?.fresh===true,date=/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')?requestedDate:localDate(),providerOpts=fresh?{bypassCache:true}:{}
  emit(onProgress,{phase:'fixtures',message:`Loading fixtures for ${date}…`,current:0,total:null})
  const raw=await getFixturesByDate(date,providerOpts)
  const now=Date.now(),statusPreKickoff=raw.filter(f=>['NS','TBD'].includes(String(f?.fixture?.status?.short||'').toUpperCase())),upcoming=statusPreKickoff.filter(f=>isValidPreKickoffFixture(f,now)),stalePreKickoffSkipped=statusPreKickoff.length-upcoming.length
  const max=Math.max(1,Number(process.env.MAX_FIXTURES_PER_REFRESH||60)),maxStatsFallbacks=Math.max(0,Number(process.env.MAX_STATS_ODDS_FALLBACKS_PER_REFRESH||20)),standingCache=new Map(),recentCache=new Map()
  const enrichConcurrency=Math.max(1,Math.min(8,Number(process.env.ENRICHMENT_CONCURRENCY||4)))
  emit(onProgress,{phase:'fixtures',message:`Loaded ${raw.length} fixtures; ${upcoming.length} are valid pre-kickoff fixtures.`,current:raw.length,total:raw.length})

  async function standings(league,season){const k=`${league}:${season}`;if(!standingCache.has(k))standingCache.set(k,getStandings(league,season,providerOpts));return standingCache.get(k)}
  async function recentSplit(team,league,season,venue){const k=`${team}:${league}:${season}:${venue}`;if(!recentCache.has(k))recentCache.set(k,getRecentLeagueVenue(team,league,season,venue,10,providerOpts));return recentCache.get(k)}

  const preflight=await selectMatureCandidates(upcoming,standings,upcoming.length,onProgress),candidatePool=spreadAcrossLeagues(preflight.selected),configuredAttempts=Number(process.env.MAX_ENRICHMENT_ATTEMPTS_PER_REFRESH||0),attemptLimit=configuredAttempts>0?Math.min(candidatePool.length,configuredAttempts):candidatePool.length,enriched=[]
  let teamGateSkipped=0,statsOddsFallbacks=0,statsFallbackCapSkipped=0,unpricedSkipped=0,shortSplitHistory=0,enrichmentErrors=0,candidatesAttempted=0

  async function enrichCandidate(candidate){
    const {f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames}=candidate
    candidatesAttempted++
    try{
      const homeOverall=overallStandingMetrics(st,f.teams.home.id),awayOverall=overallStandingMetrics(st,f.teams.away.id),homeStanding=splitStandingMetrics(st,f.teams.home.id,'home'),awayStanding=splitStandingMetrics(st,f.teams.away.id,'away')
      if(Number(homeOverall.played||0)<MIN_LEAGUE_GAMES||Number(awayOverall.played||0)<MIN_LEAGUE_GAMES){teamGateSkipped++;return null}
      const apiOddsRaw=await getFixtureOdds(f.fixture.id,providerOpts).catch(e=>{console.warn('Primary odds unavailable for fixture',f.fixture?.id,e.message);return[]})
      let coherent=buildCoherentOdds({apiPayload:apiOddsRaw,statsPayload:null,fixture:f}),statsOdds=null

      // Only call the slower secondary provider when API-Football has no complete
      // engine-usable market at all. A coherent API-Football market is sufficient.
      if(!hasEnginePrice(coherent.canonical)){
        if(statsOddsFallbacks<maxStatsFallbacks){
          statsOddsFallbacks++
          statsOdds=await statsOddsFor(f,fresh?{bypassCache:true}:{})
          if(statsOdds?.payload)coherent=buildCoherentOdds({apiPayload:apiOddsRaw,statsPayload:statsOdds.payload,fixture:f})
        }else statsFallbackCapSkipped++
      }

      const odds=coherent.canonical
      if(!hasEnginePrice(odds)){unpricedSkipped++;return null}
      const [homeRows,awayRows]=await Promise.all([
        recentSplit(f.teams.home.id,f.league.id,f.league.season,'home').catch(e=>{console.warn('Home split history unavailable',f.fixture?.id,e.message);return[]}),
        recentSplit(f.teams.away.id,f.league.id,f.league.season,'away').catch(e=>{console.warn('Away split history unavailable',f.fixture?.id,e.message);return[]})
      ])
      if(homeRows.length<5||awayRows.length<5)shortSplitHistory++
      const hm={...deriveVenueRecentStats(homeRows,f.teams.home.id,'home'),...homeStanding,overall:homeOverall},am={...deriveVenueRecentStats(awayRows,f.teams.away.id,'away'),...awayStanding,overall:awayOverall}
      return{fixtureId:f.fixture.id,match:`${f.teams.home.name} vs ${f.teams.away.name}`,league:f.league.name,country:f.league.country||'',kickoff:f.fixture.date,kickoffLocal:new Date(f.fixture.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),leagueLogo:f.league.logo||null,countryFlag:f.league.flag||null,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalCompletedGames:leagueTotalGames,earlySeasonEligible:true,splitPolicy:SPLIT_ENGINE_POLICY,splitMode:'home-vs-away',home:{id:f.teams.home.id,name:f.teams.home.name,logo:f.teams.home.logo||null,...hm},away:{id:f.teams.away.id,name:f.teams.away.name,logo:f.teams.away.logo||null,...am},odds,marketOdds:coherent.marketOdds,oddsPolicy:coherent.policy}
    }catch(e){
      enrichmentErrors++
      console.warn('Skipping fixture during split enrichment',f.fixture?.id,e.message)
      return null
    }
  }

  for(let start=0;start<attemptLimit&&enriched.length<max;start+=enrichConcurrency){
    const remainingTarget=max-enriched.length
    const batch=candidatePool.slice(start,Math.min(attemptLimit,start+Math.min(enrichConcurrency,remainingTarget)))
    emit(onProgress,{phase:'enrich',message:`Finding priced split fixtures: ${enriched.length}/${max} ready`,current:Math.min(start+batch.length,attemptLimit),total:attemptLimit,selected:enriched.length})
    const results=await Promise.all(batch.map(enrichCandidate))
    for(const row of results)if(row&&enriched.length<max)enriched.push(row)
  }

  emit(onProgress,{phase:'enrich',message:`Enrichment finished: ${enriched.length} priced mature fixtures ready.`,current:candidatesAttempted,total:attemptLimit,selected:enriched.length})
  return{date,fixtures:enriched,rawFixtures:raw,rawCount:raw.length,upcomingCount:upcoming.length,stalePreKickoffSkipped,maturityCandidates:preflight.selected.length,maturityScanned:preflight.scanned,candidatesAttempted,attemptLimit,candidatePoolExhausted:candidatesAttempted>=Math.min(candidatePool.length,attemptLimit),enrichmentTargetReached:enriched.length>=max,earlySeasonSkipped:preflight.earlySeasonSkipped+teamGateSkipped,standingsUnavailable:preflight.standingsUnavailable,statsOddsFallbacks,statsFallbackCapSkipped,unpricedSkipped,shortSplitHistory,enrichmentErrors,splitPolicy:SPLIT_ENGINE_POLICY,freshProviderReads:fresh,refreshConcurrency:{maturity:Math.max(1,Math.min(12,Number(process.env.MATURITY_CONCURRENCY||6))),enrichment:enrichConcurrency}}
}
