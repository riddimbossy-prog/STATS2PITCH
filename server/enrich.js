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
        console.log(`Skipping early-season fixture ${f.fixture?.id}: ${f.league?.name||'league'} least-played team has ${leagueMinimumPlayed}/${MIN_LEAGUE_GAMES} overall matches.`)
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

  const preflight=await selectMatureCandidates(upcoming,standings,max,onProgress)
  const enriched=[]
  let teamGateSkipped=0
  let statsOddsFallbacks=0

  for (let i=0;i<preflight.selected.length;i++) {
    const candidate=preflight.selected[i]
    const {f,st,leagueMinimumPlayed,leagueAveragePlayed,leagueTotalGames}=candidate
    emit(onProgress,{phase:'enrich',message:`Enriching mature fixtures: ${i+1}/${preflight.selected.length}`,current:i+1,total:preflight.selected.length,selected:enriched.length})
    try {
      const leagueSize=st.length || null
      const [homeVenueRows,awayVenueRows,apiOddsRaw] = await Promise.all([
        recentSplit(f.teams.home.id,f.league.id,f.league.season,'home'),
        recentSplit(f.teams.away.id,f.league.id,f.league.season,'away'),
        getFixtureOdds(f.fixture.id).catch(e => {
          console.warn('Primary odds unavailable for fixture',f.fixture?.id,e.message)
          return []
        })
      ])

      const homeOverall=overallStandingMetrics(st,f.teams.home.id)
      const awayOverall=overallStandingMetrics(st,f.teams.away.id)
      const hm={
        ...deriveVenueRecentStats(homeVenueRows,f.teams.home.id,'home'),
        ...splitStandingMetrics(st,f.teams.home.id,'home'),
        overall:homeOverall
      }
      const am={
        ...deriveVenueRecentStats(awayVenueRows,f.teams.away.id,'away'),
        ...splitStandingMetrics(st,f.teams.away.id,'away'),
        overall:awayOverall
      }

      if (Number(hm.overallPlayed||0) < MIN_LEAGUE_GAMES || Number(am.overallPlayed||0) < MIN_LEAGUE_GAMES) {
        teamGateSkipped++
        console.log(`Skipping fixture ${f.fixture?.id}: overall games are ${hm.overallPlayed||0}/${am.overallPlayed||0}; both need ${MIN_LEAGUE_GAMES}+.`)
        continue
      }

      // API-Football is the fast primary odds source. TheStatsAPI is now a true
      // fallback only when the primary feed has no complete publishable market.
      // This avoids the 40-requests/minute secondary-feed queue making an
      // interactive refresh take many minutes on a 60-fixture board.
      const apiVerified=buildVerifiedOdds({apiPayload:apiOddsRaw,statsPayload:null,fixture:f})
      let statsOdds=null
      if(!apiHasPublishableCoverage(apiVerified)){
        statsOddsFallbacks++
        statsOdds=await statsOddsFor(f)
      }
      const verified=statsOdds?.payload?buildVerifiedOdds({apiPayload:apiOddsRaw,statsPayload:statsOdds.payload,fixture:f}):apiVerified
      const api1x2=parse1x2Odds(apiOddsRaw) || {}
      const odds=withFallback(verified.canonical,api1x2)

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
      await sleep(35)
    } catch (e) {
      console.warn('Skipping fixture during split enrichment',f.fixture?.id,e.message)
    }
  }

  emit(onProgress,{phase:'enrich',message:`Enrichment finished: ${enriched.length} mature fixtures ready.`,current:preflight.selected.length,total:preflight.selected.length,selected:enriched.length})
  return {
    date,
    fixtures:enriched,
    rawFixtures:raw,
    rawCount:raw.length,
    upcomingCount:upcoming.length,
    maturityCandidates:preflight.selected.length,
    earlySeasonSkipped:preflight.earlySeasonSkipped+teamGateSkipped,
    standingsUnavailable:preflight.standingsUnavailable,
    statsOddsFallbacks,
    splitPolicy:SPLIT_ENGINE_POLICY
  }
}
