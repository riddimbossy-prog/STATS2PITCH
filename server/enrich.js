import { getFixturesByDate, getStandings, getRecent, getFixtureOdds } from './apiFootball.js'
import { deriveRecentStats, standingMetrics, parse1x2Odds } from './stats.js'

const sleep = ms => new Promise(r=>setTimeout(r,ms))
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

export async function enrichDate(requestedDate){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')?requestedDate:localDate()
  const raw=await getFixturesByDate(date)
  const max=Number(process.env.MAX_FIXTURES_PER_REFRESH||60)
  const fixtures=raw.filter(f=>f.fixture?.status?.short==='NS' || f.fixture?.status?.short==='TBD').slice(0,max)
  const standingCache=new Map(), recentCache=new Map()

  async function standings(league,season){ const k=`${league}:${season}`; if(!standingCache.has(k)) standingCache.set(k, await getStandings(league,season)); return standingCache.get(k) }
  async function recent(team){ if(!recentCache.has(team)) recentCache.set(team, await getRecent(team)); return recentCache.get(team) }

  const enriched=[]
  for (const f of fixtures) {
    try {
      const st=await standings(f.league.id,f.league.season)
      const leagueSize=st.length || null
      const [hr,ar,oraw]=await Promise.all([recent(f.teams.home.id),recent(f.teams.away.id),getFixtureOdds(f.fixture.id)])
      const hm={...deriveRecentStats(hr,f.teams.home.id),...standingMetrics(st,f.teams.home.id)}
      const am={...deriveRecentStats(ar,f.teams.away.id),...standingMetrics(st,f.teams.away.id)}
      const odds=parse1x2Odds(oraw)
      enriched.push({
        fixtureId:f.fixture.id, match:`${f.teams.home.name} vs ${f.teams.away.name}`, league:f.league.name, country:f.league.country || '', kickoff:f.fixture.date,
        kickoffLocal:new Date(f.fixture.date).toLocaleString('en-GB',{timeZone:process.env.APP_TIMEZONE||'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),
        leagueLogo:f.league.logo||null, countryFlag:f.league.flag||null,
        home:{id:f.teams.home.id,name:f.teams.home.name,logo:f.teams.home.logo||null,leagueSize,...hm}, away:{id:f.teams.away.id,name:f.teams.away.name,logo:f.teams.away.logo||null,leagueSize,...am}, odds
      })
      await sleep(35)
    } catch (e) {
      console.warn('Skipping fixture',f.fixture?.id,e.message)
    }
  }
  return {date, fixtures:enriched, rawCount:raw.length}
}
