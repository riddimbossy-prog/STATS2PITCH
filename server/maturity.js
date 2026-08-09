import { MIN_LEAGUE_GAMES } from './stats.js'

export const EARLY_SEASON_POLICY = 'every-team-minimum-4'

const n = v => Number(v)

/**
 * Fail-closed fixture maturity check.
 * A fixture is eligible only when:
 *  - enrichment explicitly marked it eligible,
 *  - the least-played team in the league has 4+ matches,
 *  - both teams in this fixture individually have 4+ matches.
 */
export function isMatureFixture(fixture, minimum=MIN_LEAGUE_GAMES) {
  const required = Number(minimum || MIN_LEAGUE_GAMES)
  return fixture?.earlySeasonEligible === true &&
    Number.isFinite(n(fixture?.leagueMinimumPlayed)) && n(fixture.leagueMinimumPlayed) >= required &&
    Number.isFinite(n(fixture?.home?.played)) && n(fixture.home.played) >= required &&
    Number.isFinite(n(fixture?.away?.played)) && n(fixture.away.played) >= required
}

export function filterMatureFixtures(fixtures, minimum=MIN_LEAGUE_GAMES) {
  return (Array.isArray(fixtures) ? fixtures : []).filter(f => isMatureFixture(f, minimum))
}

/**
 * Saved snapshots must have been produced under the current four-game policy.
 * Older policy snapshots fail closed until a fresh refresh is generated.
 */
export function snapshotHasStrictMaturityPolicy(board) {
  return board?.meta?.earlySeasonPolicy === EARLY_SEASON_POLICY &&
    Number(board?.meta?.minimumLeagueGames) >= MIN_LEAGUE_GAMES
}

export function emptyMatureBoard(meta={}) {
  return {
    meta:{...meta,qualified:0,earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES,requiresFreshRefresh:true},
    groups:{single:[],two:[],threePlus:[]},
    priority:[],
    oddsByFixture:{},
    availableMarkets:[]
  }
}