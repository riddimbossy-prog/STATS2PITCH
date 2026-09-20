import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture, buildFilterBoard, ENGINE_ID} from '../server/filterEngine.js'

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
