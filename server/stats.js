function pct(n,d){ return d ? Math.round((n/d)*100) : null }

export const MIN_LEAGUE_GAMES = 4

function playedValues(standings) {
  if (!Array.isArray(standings) || !standings.length) return []
  return standings.map(row => {
    const played = Number(row?.all?.played)
    return Number.isFinite(played) && played >= 0 ? played : 0
  })
}

/**
 * Strict early-season maturity value.
 *
 * This is intentionally NOT the number of fixtures completed by the whole
 * competition. In a large league, a few total competition fixtures can be
 * reached before every club has a useful sample.
 *
 * Stats2Pitch therefore uses the least-played team in the current standings.
 * A league reaches "4 games" only when EVERY team represented in that
 * standings table has played at least 4 overall league matches.
 */
export function leagueGamesPlayed(standings) {
  const values = playedValues(standings)
  return values.length ? Math.min(...values) : 0
}

export function leagueMinimumTeamPlayed(standings) {
  return leagueGamesPlayed(standings)
}

export function leagueTotalCompletedGames(standings) {
  const values = playedValues(standings)
  return values.length ? Math.floor(values.reduce((a,b)=>a+b,0) / 2) : 0
}

export function leagueAverageTeamPlayed(standings) {
  const values = playedValues(standings)
  return values.length ? +(values.reduce((a,b)=>a+b,0) / values.length).toFixed(2) : 0
}

export function hasMinimumLeagueGames(standings, minimum=MIN_LEAGUE_GAMES) {
  const required = Number(minimum || MIN_LEAGUE_GAMES)
  return playedValues(standings).length > 0 && leagueMinimumTeamPlayed(standings) >= required
}

export function deriveRecentStats(fixtures, teamId) {
  const allRows = fixtures
    .filter(f => f?.fixture?.status?.short === 'FT' || f?.fixture?.status?.long === 'Match Finished')
    .sort((a,b)=>new Date(b.fixture.date)-new Date(a.fixture.date))
    .slice(0,10)
  const formRows = allRows.slice(0,5)
  let wins=0, losses=0
  for (const f of formRows) {
    const home = f.teams.home.id === teamId
    const own = Number(home ? f.goals.home : f.goals.away)
    const opp = Number(home ? f.goals.away : f.goals.home)
    if (own > opp) wins++
    if (own < opp) losses++
  }
  let o15=0,o25=0,o35=0
  for (const f of allRows) {
    const total = Number(f.goals.home) + Number(f.goals.away)
    if (total > 1.5) o15++
    if (total > 2.5) o25++
    if (total > 3.5) o35++
  }
  const nForm=formRows.length, nGoals=allRows.length
  const over15=pct(o15,nGoals), over25=pct(o25,nGoals), over35=pct(o35,nGoals)
  return {
    formSample:nForm, goalsSample:nGoals,
    winRate:pct(wins,nForm), lossRate:pct(losses,nForm),
    over15, under15:nGoals ? 100-over15 : null,
    over25, under25:nGoals ? 100-over25 : null,
    over35, under35:nGoals ? 100-over35 : null
  }
}

export function standingMetrics(standings, teamId) {
  const row = standings.find(x => x.team.id === teamId)
  if (!row) return { position:null, played:null, ppg:null, goalsScored:null, goalsConceded:null }
  const played = Number(row.all?.played || 0)
  const gf = Number(row.all?.goals?.for)
  const ga = Number(row.all?.goals?.against)
  return {
    position:row.rank ?? null,
    played,
    ppg:played ? +(Number(row.points || 0)/played).toFixed(2) : null,
    goalsScored:played && Number.isFinite(gf) ? +(gf/played).toFixed(2) : null,
    goalsConceded:played && Number.isFinite(ga) ? +(ga/played).toFixed(2) : null
  }
}

export function parse1x2Odds(payload) {
  for (const item of payload || []) for (const book of item.bookmakers || []) {
    const bet = (book.bets || []).find(b => /match winner|winner/i.test(b.name))
    if (!bet) continue
    const vals = Object.fromEntries((bet.values || []).map(v => [String(v.value).toLowerCase(), Number(v.odd)]))
    const home = vals.home, draw = vals.draw, away = vals.away
    if (home && draw && away) return { home, draw, away, bookmaker: book.name }
  }
  return null
}