import { getFixturesByDate, getStandings, getRecentLeagueVenue, getFixtureOdds } from './apiFootball.js'
import { deriveVenueRecentStats, splitStandingMetrics, overallStandingMetrics, parse1x2Odds, leagueGamesPlayed, leagueTotalCompletedGames, leagueAverageTeamPlayed, hasMinimumLeagueGames, MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY } from './stats.js'
import { getStatsOddsForFixture, statsApiConfigured } from './statsApi.js'
import { getStatsOddsFallback } from './statsFallback.js'
import { buildVerifiedOdds } from './oddsV2.js'

const sleep = ms => new Promise(r=>setTimeout(r,ms))
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const validOdd=v=>Number.isFinite(Number(v))&&Number(v)>1.001
const emit=(cb,data)=>{try{if(typeof cb==='function')cb(data)}catch{}}

function withFallback(primary, fallback) {
  return {
    home: primary?.home ?? fallback?.home ?? null,
    draw: primary?.draw ?? fallback?.draw ?? null,
    away: primary?.away ?? fallback?.away ?? null,
    over15: primary?.over15 ?? fallback?.over15 ?? null,
    under15: primary?.under15 ?? fallback?.under15 ?? null,
    over25: primary?.over25 ?? fallback?.over25 ?? null,
    under25: primary?.under25 ?? fallback?.under25 ?? null,
    over35: primary?.over35 ?? fallback?.over35 ?? null,
    under35: primary?.under35 ?? fallback?.under35 ?? null,
    bttsYes: primary?.bttsYes ?? fallback?.bttsYes ?? null,
    bttsNo: primary?.bttsNo ?? fallback?.bttsNo ?? null
  }
}

function apiHasPublishableCoverage(verified){
  const c=verified?.canonical||{}
  const complete1x2=['home','draw','away'].every(k=>validOdd(c[k]))
  const completeGoalLine=[['over15','under15'],['over25','under25'],['over35','under35']].some(([a,b])=>validOdd(c[a])&&validOdd(c[b]))
  const completeBtts=validOdd(c.bttsYes)&&validOdd(c.bttsNo)
  return complete1x2||completeGoalLine||completeBtts
}
function hasEnginePrice(odds){
  return ['home','away','over15','under15','over25','under25','over35','under35'].some(k=>validOdd(odds?.[k]))
}

async function statsOddsFor(fixture){
  if(!statsApiConfigured())return null
  try{
    const primary=await getStatsOddsForFixture(fixture)
    if(primary?.payload)return primary
  }catch(e){console.warn('Primary additional odds match failed',fixture?.fixture?.id,e.message)}
  try{
    const fallback=await getStatsOddsFallback(fixture)
    if(fallback?.payload)return fallback
  }catch(e){console.warn('Fallback additional odds match failed',fixture?.fixture?.id,e.message)}
  return null
}

export async function selectMatureCandidates(upcoming, standingsFor, max=60, onProgress=null) {
  const selected=[]
  let earlySeasonSkipped=0
  let standingsUnavailable=0
  const pool=Array.isArray(upcoming)?upcoming:[]

  for (let i=0;i<pool.length;i++) {
    if (selected.length >= max) break
    const f=pool[i]
    try {
      const st=await standingsFor(f.league.id,f.league.season)
      const leagueMinimumPlayed=leagueGamesPlayed(st)
      const leagueAveragePlayed=leagueAverageTeamPlayed(st)
      const leagueTotalGames=leagueTotalCompletedGames(st)

      if (!hasMinimumLeagueGames(st, MIN_LEAGUE_GAMES)) {
        earlySeasonSkipped++
      } else {
        selected.push({f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames})
      }
    } catch (e) {
      standingsUnavailable++
      console.warn('Standings unavailable while pre-screening fixture',f.fixture?.id,e.message)
    }
    if(i===0||(i+1)%10===0||selected.length===max||i===pool.length-1){
      emit(onProgress,{phase:'maturity',message:`Checking league maturity: ${i+1}/${pool.length} fixtures`,current:i+1,total:pool.length,selected:selected.length})
    }
  }
  return {selected,earlySeasonSkipped,standingsUnavailable}
}

export async function enrichDate(requestedDate,options={}){
  const onProgress=options?.onProgress
  const date=/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')?requestedDate:localDate()
  emit(onProgress,{phase:'fixtures',message:`Loading fixtures for ${date}…`,current:0,total:null})
  const raw=await getFixturesByDate(date)
  const max=Math.max(1,Number(process.env.MAX_FIXTURES_PER_REFRESH||60))
  const upcoming=raw.filter(f=>f.fixture?.status?.short==='NS' || f.fixture?.status?.short==='TBD')
  const defaultPreflight=Math.max(max,Math.min(upcoming.length,max*4))
  const preflightLimit=Math.max(max,Math.min(upcoming.length,Number(process.env.MAX_MATURE_PREFLIGHT||defaultPreflight)))
  const maxStatsFallbacks=Math.max(0,Number(process.env.MAX_STATS_ODDS_FALLBACKS_PER_REFRESH||20))
  const standingCache=new Map(), recentCache=new Map()
  emit(onProgress,{phase:'fixtures',message:`Loaded ${raw.length} fixtures; ${upcoming.length} are pre-kickoff.`,current:raw.length,total:raw.length})

  async function standings(league,season){
    const k=`${league}:${season}`
    if(!standingCache.has(k)) standingCache.set(k, await getStandings(league,season))
    return standingCache.get(k)
  }
  async function recentSplit(team,league,season,venue){
    const k=`${team}:${league}:${season}:${venue}`
    if(!recentCache.has(k))recentCache.set(k,getRecentLeagueVenue(team,league,season,venue,10))
    return recentCache.get(k)
  }

  // v1.9.1 stopped after the first 60 mature fixtures even if all 60 were
  // unpriced. On a large fixture day that could still produce a zero board while
  // later mature fixtures had usable prices. Preflight a broader mature pool and
  // only spend the final 60-slot budget on priced, enrichable fixtures.
  const preflight=await selectMatureCandidates(upcoming,standings,preflightLimit,onProgress)
  const enriched=[]
  let teamGateSkipped=0
  let statsOddsFallbacks=0
  let statsFallbackCapSkipped=0
  let unpricedSkipped=0
  let shortSplitHistory=0
  let enrichmentErrors=0
  let candidatesAttempted=0

  for (let i=0;i<preflight.selected.length&&enriched.length<max;i++) {
    const candidate=preflight.selected[i]
    const {f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames}=candidate
    candidatesAttempted++
    emit(onProgress,{phase:'enrich',message:`Finding priced split fixtures: ${enriched.length}/${max} ready (${i+1}/${preflight.selected.length} candidates checked)`,current:i+1,total:preflight.selected.length,selected:enriched.length})
    try {
      const leagueSize=st.length || null
      const homeOverall=overallStandingMetrics(st,f.teams.home.id)
      const awayOverall=overallStandingMetrics(st,f.teams.away.id)
      const homeStanding=splitStandingMetrics(st,f.teams.home.id,'home')
      const awayStanding=splitStandingMetrics(st,f.teams.away.id,'away')

      if (Number(homeOverall.played||0) < MIN_LEAGUE_GAMES || Number(awayOverall.played||0) < MIN_LEAGUE_GAMES) {
        teamGateSkipped++
        continue
      }

      // Price first. There is no reason to spend two split-history requests on a
      // fixture the engine cannot publish because no verified market price exists.
      const apiOddsRaw=await getFixtureOdds(f.fixture.id).catch(e => {
        console.warn('Primary odds unavailable for fixture',f.fixture?.id,e.message)
        return []
      })
      const apiVerified=buildVerifiedOdds({apiPayload:apiOddsRaw,statsPayload:null,fixture:f})
      let statsOdds=null
      if(!apiHasPublishableCoverage(apiVerified)&&statsOddsFallbacks<maxStatsFallbacks){
        statsOddsFallbacks++
        statsOdds=await statsOddsFor(f)
      }else if(!apiHasPublishableCoverage(apiVerified)&&statsOddsFallbacks>=maxStatsFallbacks){
        statsFallbackCapSkipped++
      }
      const verified=statsOdds?.payload?buildVerifiedOdds({apiPayload:apiOddsRaw,statsPayload:statsOdds.payload,fixture:f}):apiVerified
      const api1x2=parse1x2Odds(apiOddsRaw) || {}
      const odds=withFallback(verified.canonical,api1x2)
      if(!hasEnginePrice(odds)){
        unpricedSkipped++
        continue
      }

      // Split history is fail-soft. If the chronological provider route is
      // unavailable, strict season HOME/AWAY standings remain usable and recent
      // form/goal-hit-rate filters simply stay null.
      const [homeVenueRows,awayVenueRows] = await Promise.all([
        recentSplit(f.teams.home.id,f.league.id,f.league.season,'home').catch(e=>{console.warn('Home split history unavailable',f.fixture?.id,e.message);return[]}),
        recentSplit(f.teams.away.id,f.league.id,f.league.season,'away').catch(e=>{console.warn('Away split history unavailable',f.fixture?.id,e.message);return[]})
      ])
      if(homeVenueRows.length<5||awayVenueRows.length<5)shortSplitHistory++

      const hm={
        ...deriveVenueRecentStats(homeVenueRows,f.teams.home.id,'home'),
        ...homeStanding,
        overall:homeOverall
      }
      const am={
        ...deriveVenueRecentStats(awayVenueRows,f.teams.away.id,'away'),
        ...awayStanding,
        overall:awayOverall
      }

      enriched.push({
        fixtureId:f.fixture.id,
        match:`${f.teams.home.name} vs ${f.teams.away.name}`,
        league:f.league.name,
        country:f.league.country || '',
        kickoff:f.fixture.date,
        kickoffLocal:new Date(f.fixture.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),
        leagueLogo:f.league.logo||null,
        countryFlag:f.league.flag||null,
        leagueMinimumPlayed,
        leagueAveragePlayed,
        leagueTotalCompletedGames:leagueTotalGames,
        earlySeasonEligible:true,
        splitPolicy:SPLIT_ENGINE_POLICY,
        splitMode:'home-vs-away',
        home:{id:f.teams.home.id,name:f.teams.home.name,logo:f.teams.home.logo||null,leagueSize,...hm},
        away:{id:f.teams.away.id,name:f.teams.away.name,logo:f.teams.away.logo||null,leagueSize,...am},
        odds,
        marketOdds:verified.marketOdds
      })
      await sleep(20)
    } catch (e) {
      enrichmentErrors++
      console.warn('Skipping fixture during split enrichment',f.fixture?.id,e.message)
    }
  }

  emit(onProgress,{phase:'enrich',message:`Enrichment finished: ${enriched.length} priced mature fixtures ready.`,current:candidatesAttempted,total:preflight.selected.length,selected:enriched.length})
  return {
    date,
    fixtures:enriched,
    rawFixtures:raw,
    rawCount:raw.length,
    upcomingCount:upcoming.length,
    preflightLimit,
    maturityCandidates:preflight.selected.length,
    candidatesAttempted,
    earlySeasonSkipped:preflight.earlySeasonSkipped+teamGateSkipped,
    standingsUnavailable:preflight.standingsUnavailable,
    statsOddsFallbacks,
    statsFallbackCapSkipped,
    unpricedSkipped,
    shortSplitHistory,
    enrichmentErrors,
    splitPolicy:SPLIT_ENGINE_POLICY
  }
}
