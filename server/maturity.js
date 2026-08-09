import { MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY } from './stats.js'

export const EARLY_SEASON_POLICY = 'every-team-minimum-4'

const n = v => Number(v)

/**
 * Four-game maturity is an OVERALL sample rule. Venue performance is evaluated
 * separately by the split engine, so a team is not required to have four home
 * or four away matches merely to pass the early-season gate.
 */
export function isMatureFixture(fixture, minimum=MIN_LEAGUE_GAMES) {
  const required = Number(minimum || MIN_LEAGUE_GAMES)
  return fixture?.earlySeasonEligible === true &&
    Number.isFinite(n(fixture?.leagueMinimumPlayed)) && n(fixture.leagueMinimumPlayed) >= required &&
    Number.isFinite(n(fixture?.home?.overallPlayed)) && n(fixture.home.overallPlayed) >= required &&
    Number.isFinite(n(fixture?.away?.overallPlayed)) && n(fixture.away.overallPlayed) >= required
}

export function filterMatureFixtures(fixtures, minimum=MIN_LEAGUE_GAMES) {
  return (Array.isArray(fixtures) ? fixtures : []).filter(f => isMatureFixture(f, minimum))
}

export function snapshotHasStrictMaturityPolicy(board) {
  return board?.meta?.earlySeasonPolicy === EARLY_SEASON_POLICY &&
    Number(board?.meta?.minimumLeagueGames) >= MIN_LEAGUE_GAMES
}

export function snapshotHasStrictSplitPolicy(board){
  return board?.meta?.splitPolicy===SPLIT_ENGINE_POLICY && board?.meta?.splitPrimaryOnly===true
}

export function emptyMatureBoard(meta={}) {
  return {
    meta:{...meta,qualified:0,earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES,splitPolicy:SPLIT_ENGINE_POLICY,splitPrimaryOnly:true,requiresFreshRefresh:true},
    groups:{single:[],two:[],threePlus:[]},
    priority:[],
    oddsByFixture:{},
    availableMarkets:[]
  }
}
