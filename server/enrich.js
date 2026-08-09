import { getFixturesByDate, getStandings, getRecent, getFixtureOdds } from './apiFootball.js'
import { deriveRecentStats, standingMetrics, parse1x2Odds, leagueGamesPlayed, leagueTotalCompletedGames, leagueAverageTeamPlayed, hasMinimumLeagueGames, MIN_LEAGUE_GAMES } from './stats.js'
import { getStatsOddsForFixture, statsApiConfigured } from './statsApi.js'
import { getStatsOddsFallback } from './statsFallback.js'
import { buildVerifiedOdds } from './oddsV2.js'

const sleep = ms => new Promise(r=>setTimeout(r,ms))
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

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

export async function enrichDate(requestedDate){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')?requestedDate:localDate()
  const raw=await getFixturesByDate(date)
  const max=Number(process.env.MAX_FIXTURES_PER_REFRESH||60)
  const fixtures=raw.filter(f=>f.fixture?.status?.short==='NS' || f.fixture?.status?.short==='TBD').slice(0,max)
  const standingCache=new Map(), recentCache=new Map()

  async function standings(league,season){
    const k=`${league}:${season}`
    if(!standingCache.has(k)) standingCache.set(k, await getStandings(league,season))
    return standingCache.get(k)
  }
  async function recent(team){
    if(!recentCache.has(team)) recentCache.set(team, await getRecent(team))
    return recentCache.get(team)
  }

  const enriched=[]
  let earlySeasonSkipped=0
  for (const f of fixtures) {
    try {
      const st=await standings(f.league.id,f.league.season)
      const leagueMinimumPlayed=leagueGamesPlayed(st)
      const leagueAveragePlayed=leagueAverageTeamPlayed(st)
      const leagueTotalGames=leagueTotalCompletedGames(st)

      // STRICT EARLY-SEASON SAFETY GATE:
      // The previous implementation counted total fixtures across the whole
      // competition. That could reach 10 after only 1-2 rounds in a large league.
      // Now the least-played team in the standings must have 10+ matches.
      // Missing/empty standings fail closed.
      if (!hasMinimumLeagueGames(st, MIN_LEAGUE_GAMES)) {
        earlySeasonSkipped++
        console.log(`Skipping early-season fixture ${f.fixture?.id}: ${f.league?.name||'league'} least-played team has ${leagueMinimumPlayed}/${MIN_LEAGUE_GAMES} matches (league average ${leagueAveragePlayed}, total competition fixtures ${leagueTotalGames}).`)
        continue
      }

      const leagueSize=st.length || null
      const [hr,ar,apiOddsRaw,statsOdds] = await Promise.all([
        recent(f.teams.home.id),
        recent(f.teams.away.id),
        getFixtureOdds(f.fixture.id).catch(e => {
          console.warn('Primary odds unavailable for fixture',f.fixture?.id,e.message)
          return []
        }),
        statsOddsFor(f)
      ])

      const hm={...deriveRecentStats(hr,f.teams.home.id),...standingMetrics(st,f.teams.home.id)}
      const am={...deriveRecentStats(ar,f.teams.away.id),...standingMetrics(st,f.teams.away.id)}

      // Extra fail-closed check for the two teams actually playing.
      if (Number(hm.played||0) < MIN_LEAGUE_GAMES || Number(am.played||0) < MIN_LEAGUE_GAMES) {
        earlySeasonSkipped++
        console.log(`Skipping fixture ${f.fixture?.id}: ${f.teams.home.name} played ${hm.played||0}, ${f.teams.away.name} played ${am.played||0}; both need ${MIN_LEAGUE_GAMES}+.`)
        continue
      }

      const verified=buildVerifiedOdds({apiPayload:apiOddsRaw,statsPayload:statsOdds?.payload,fixture:f})
      const api1x2=parse1x2Odds(apiOddsRaw) || {}
      const odds=withFallback(verified.canonical,api1x2)
      const marketOdds=verified.marketOdds

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
        home:{id:f.teams.home.id,name:f.teams.home.name,logo:f.teams.home.logo||null,leagueSize,...hm},
        away:{id:f.teams.away.id,name:f.teams.away.name,logo:f.teams.away.logo||null,leagueSize,...am},
        odds,
        marketOdds
      })
      await sleep(35)
    } catch (e) {
      console.warn('Skipping fixture',f.fixture?.id,e.message)
    }
  }
  return {date, fixtures:enriched, rawCount:raw.length, earlySeasonSkipped}
}