import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture, buildFilterBoard, ENGINE_ID} from '../server/filterEngine.js'
import {publicBoard} from '../server/publicBoard.js'

function rows(id, venue, scores) {
  return scores.map(([gf, ga], index) => ({
    fixture: {id: index + 1, date: '2026-09-' + String(index + 1).padStart(2, '0') + 'T12:00:00Z', status: {short: 'FT'}},
    teams: venue === 'home' ? {home: {id}, away: {id: 900 + index}} : {home: {id: 900 + index}, away: {id}},
    goals: venue === 'home' ? {home: gf, away: ga} : {home: ga, away: gf}
  }))
}

function fixture({homeScores, awayScores, price = 1.75, markets, id = 1} = {}) {
  const home = homeScores || [[1, 1], [1, 0], [2, 1], [1, 2], [1, 1]]
  const away = awayScores || [[2, 1], [3, 1], [1, 1], [2, 0], [2, 1]]
  return {
    fixtureId: id, league: 'Test League', country: 'England', kickoff: id === 1 ? '2026-09-22T12:00:00Z' : '2026-09-22T13:00:00Z',
    home: {id: 1, name: 'Stal', fixtures: rows(1, 'home', home)},
    away: {id: 2, name: 'Legia', fixtures: rows(2, 'away', away)},
    statsReady: true,
    marketOdds: markets ?? [{marketKey: 'total-goals', outcomes: [{name: 'Over 1.5', odd: price}]}]
  }
}

test('adaptive filter can publish a supported matchup without a perfect 5/5 split', () => {
  const result = diagnoseFilterFixture(fixture())
  assert.equal(result.skip, null)
  assert.equal(result.pick.marketId, 'over-15')
  assert.equal(result.pick.engine, ENGINE_ID)
  assert.match(result.pick.reasons.join(' '), /attack-versus-defence/)
  assert.match(result.pick.reasons.join(' '), /stronger side blanking/)
  assert.match(result.pick.reasons.join(' '), /failure path/)
  assert.ok(result.pick.why.homeStats)
  assert.ok(result.pick.why.awayStats)
})

test('the engine skips when no market has a supported edge over its price', () => {
  const result = diagnoseFilterFixture(fixture({price: 1.21}))
  assert.equal(result.pick, null)
  assert.equal(result.skip, 'no-robust-edge')
})

test('incomplete venue evidence and unpriced fixtures are skipped', () => {
  assert.equal(diagnoseFilterFixture(fixture({homeScores: [[1, 0]]})).skip, 'insufficient-venue-sample')
  assert.equal(diagnoseFilterFixture(fixture({markets: []})).skip, 'no-priced-market')
})

test('the existing board contract publishes the adaptive engine identifier', () => {
  const board = buildFilterBoard([fixture({id: 2}), fixture({id: 1})])
  assert.equal(board.meta.engine, ENGINE_ID)
  assert.equal(board.meta.filterVersion, ENGINE_ID)
  assert.equal(board.bestPicks.length, 2)
  assert.equal(board.bestPicks[0].fixtureId, 1)
})

test('longshot underdog wins are not published as Filter Tips', () => {
  const result = diagnoseFilterFixture(fixture({
    markets: [
      {marketKey: 'match-winner', outcomes: [{name: 'Home', odd: 2.05}, {name: 'Away', odd: 8.70}]},
      {marketKey: 'total-goals', outcomes: [{name: 'Over 1.5', odd: 1.75}]}
    ]
  }))
  assert.equal(result.skip, null)
  assert.notEqual(result.pick.marketId, 'away-win')
  assert.ok(Number(result.pick.odds) <= 2.20)
})

test('a lone 11.00 away win is skipped instead of becoming the Filter pick', () => {
  const result = diagnoseFilterFixture(fixture({
    markets: [{marketKey: 'match-winner', outcomes: [{name: 'Away', odd: 11}]}]
  }))
  assert.equal(result.pick, null)
  assert.ok(result.skip === 'no-priced-market' || result.skip === 'no-robust-edge')
})

test('Filter why stats use the same last-5 venue sample as the reason copy', () => {
  const homeVenue = [[2, 1], [2, 0], [1, 0], [1, 1], [0, 0]]
  const awayVenue = [[3, 0], [3, 1], [2, 1], [1, 2], [0, 1]]
  const homeOverall = [
    {gf: 0, ga: 2, venue: 'away'},
    {gf: 0, ga: 0, venue: 'home'},
    {gf: 1, ga: 0, venue: 'home'},
    {gf: 2, ga: 1, venue: 'home'},
    {gf: 1, ga: 2, venue: 'away'}
  ]
  const awayOverall = [
    {gf: 2, ga: 2, venue: 'home'},
    {gf: 3, ga: 1, venue: 'away'},
    {gf: 1, ga: 3, venue: 'home'},
    {gf: 1, ga: 1, venue: 'away'},
    {gf: 1, ga: 1, venue: 'home'}
  ]
  const overallRows = (id, sample) => sample.map((row, index) => ({
    fixture: {id: 200 + index, date: '2026-08-' + String(index + 1).padStart(2, '0') + 'T12:00:00Z', status: {short: 'FT'}},
    teams: row.venue === 'home' ? {home: {id}, away: {id: 700 + index}} : {home: {id: 700 + index}, away: {id}},
    goals: row.venue === 'home' ? {home: row.gf, away: row.ga} : {home: row.ga, away: row.gf}
  }))
  const result = diagnoseFilterFixture({
    ...fixture({
      homeScores: homeVenue,
      awayScores: awayVenue,
      markets: [{marketKey: 'both-teams-score', outcomes: [{name: 'No', odd: 1.97}, {name: 'Yes', odd: 1.72}]}]
    }),
    home: {
      id: 1, name: 'Lochin',
      fixtures: rows(1, 'home', homeVenue),
      lastMatches: overallRows(1, homeOverall)
    },
    away: {
      id: 2, name: 'Respublika Football Academy',
      fixtures: rows(2, 'away', awayVenue),
      lastMatches: overallRows(2, awayOverall)
    }
  })
  assert.equal(result.skip, null)
  const pick = result.pick
  const why = pick.why
  const text = pick.reasons.join(' ')
  assert.match(text, /1\.2 scored and 0\.4 conceded at home/)
  assert.match(text, /1\.8 scored and 1\.0 conceded away/)
  assert.match(text, /form gap is 2\.2 versus 1\.8/)
  assert.match(text, /both teams scored in 40% of Lochin home games and 60% of Respublika Football Academy away games/)
  assert.equal(why.homeStats.gf, 1.2)
  assert.equal(why.homeStats.ga, 0.4)
  assert.equal(why.homeStats.ppg, 2.2)
  assert.equal(why.homeStats.btts, 40)
  assert.equal(why.homeStats.over25, 20)
  assert.equal(why.awayStats.gf, 1.8)
  assert.equal(why.awayStats.ga, 1)
  assert.equal(why.awayStats.ppg, 1.8)
  assert.equal(why.awayStats.btts, 60)
  assert.equal(why.awayStats.over25, 80)
  assert.ok(why.lastMatchesHome.every(row => row.venue === 'H'))
  assert.ok(why.lastMatchesAway.every(row => row.venue === 'A'))
  assert.notEqual(why.homeStats.gf, 0.8)
  assert.notEqual(why.awayStats.btts, 80)
  assert.equal(pick.homeConsensus, 60)
  assert.equal(pick.awayConsensus, 40)
  const published = publicBoard({filterTips: [pick], meta: {filterTipsEngine: ENGINE_ID}}, 'filter').filterTips[0]
  assert.equal(published.why.homeStats.gf, 1.2)
  assert.equal(published.why.awayStats.btts, 60)
  assert.ok(published.why.lastMatchesHome.every(row => row.venue === 'H'))
  assert.ok(published.why.lastMatchesAway.every(row => row.venue === 'A'))
})
