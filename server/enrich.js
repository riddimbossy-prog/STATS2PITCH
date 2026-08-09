import { getFixturesByDate, getStandings, getRecent, getFixtureOdds } from './apiFootball.js'
import { deriveRecentStats, standingMetrics, parse1x2Odds } from './stats.js'
import { getStatsOddsForFixture, parseStatsApiMarkets, parseApiFootballMarkets, mergeMarkets, canonicalOddsFromMarkets, statsApiConfigured } from './statsApi.js'
import { getStatsOddsFallback } from './statsFallback.js'
import { recoverApiFootballMarkets, recoverGenericMarkets, mergeRecoveredMarkets } from './oddsEnhancer.js'

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
  for (const f of fixtures) {
    try {
      const st=await standings(f.league.id,f.league.season)
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

      const apiMarkets=parseApiFootballMarkets(apiOddsRaw)
      const statsMarkets=parseStatsApiMarkets(statsOdds?.payload)
      const recoveredApi=recoverApiFootballMarkets(apiOddsRaw,f)
      const recoveredStats=recoverGenericMarkets(statsOdds?.payload,f)
      const marketOdds=mergeRecoveredMarkets(
        mergeMarkets(apiMarkets,statsMarkets),
        recoveredApi,
        recoveredStats
      )

      const mergedCanonical=canonicalOddsFromMarkets(marketOdds)
      const api1x2=parse1x2Odds(apiOddsRaw) || {}
      const odds=withFallback(mergedCanonical,api1x2)

      enriched.push({
        fixtureId:f.fixture.id,
        match:`${f.teams.home.name} vs ${f.teams.away.name}`,
        league:f.league.name,
        country:f.league.country || '',
        kickoff:f.fixture.date,
        kickoffLocal:new Date(f.fixture.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),
        leagueLogo:f.league.logo||null,
        countryFlag:f.league.flag||null,
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
  return {date, fixtures:enriched, rawCount:raw.length}
}
