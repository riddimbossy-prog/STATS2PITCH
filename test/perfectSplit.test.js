import test from 'node:test'
import assert from 'node:assert/strict'
import {
  diagnoseFixture,
  profileOf,
  scanBoard,
  SPLIT_SAMPLE,
  ENGINE_ID
} from '../server/perfectSplit.js'

function games(spec){
  return spec.split(',').map((chunk, i) => {
    const [score, opp] = chunk.trim().split(' ')
    const [gf, ga] = score.split('-').map(Number)
    return {opponent: opp || `T${i}`, opponentShort: (opp || 'T').slice(0, 3), date: '2026-09-01', gf, ga}
  })
}

function fx(homeForm, awayForm, extra = {}){
  return {
    id: extra.id || 't',
    kickoff: extra.kickoff || '2026-09-05T15:00:00Z',
    league: extra.league || 'Premier League',
    country: extra.country || 'England',
    countryCode: extra.countryCode || 'ENG',
    home: {
      id: 'H', name: 'Home FC', short: 'HOM',
      form: typeof homeForm === 'string' ? games(homeForm) : homeForm
    },
    away: {
      id: 'A', name: 'Away FC', short: 'AWY',
      form: typeof awayForm === 'string' ? games(awayForm) : awayForm
    },
    status: extra.status || 'upcoming',
    score: extra.score,
    ...extra
  }
}

const W5 = '2-0 A,1-0 B,3-1 C,2-1 D,1-0 E'
const L5 = '0-2 A,1-3 B,0-1 C,0-4 D,1-2 E'

test('profileOf counts a perfect home win split', () => {
  const p = profileOf(games(W5))
  assert.equal(p.sample, SPLIT_SAMPLE)
  assert.equal(p.wins, 5)
  assert.equal(p.losses, 0)
  assert.equal(p.unbeaten, 5)
  assert.equal(p.form, 'WWWWW')
  assert.equal(p.ready, true)
})

test('profileOf counts unbeaten with draws as winless-complement', () => {
  const p = profileOf(games('1-1 A,2-0 B,0-0 C,1-0 D,2-1 E'))
  assert.equal(p.wins, 3)
  assert.equal(p.draws, 2)
  assert.equal(p.unbeaten, 5)
  assert.equal(p.winless, 2)
  assert.equal(p.form, 'DWDWW')
})

test('publishes Home Win when home is 5/5 wins and away is 5/5 losses', () => {
  const d = diagnoseFixture(fx(W5, L5))
  assert.equal(d.pick?.marketId, 'home-win')
  assert.equal(d.pick?.display, 'Home Win')
  assert.equal(d.pick?.engine, ENGINE_ID)
  assert.equal(d.skip, null)
})

test('publishes Away Win when the split is reversed', () => {
  const d = diagnoseFixture(fx(L5, W5))
  assert.equal(d.pick?.marketId, 'away-win')
})

test('does not publish Home Win when the opponent is only 4/5 losses', () => {
  const d = diagnoseFixture(fx(W5, '0-2 A,1-3 B,2-0 C,0-1 D,1-4 E'))
  assert.notEqual(d.pick?.marketId, 'home-win')
  assert.equal(d.skip, 'near-miss-no-consent')
})

test('publishes 1X when home is undefeated and away is winless, including draws', () => {
  const d = diagnoseFixture(fx('1-1 A,2-0 B,0-0 C,1-0 D,2-1 E', '0-0 A,1-1 B,0-1 C,0-2 D,1-1 E'))
  assert.equal(d.pick?.marketId, 'dc-1x')
  assert.equal(d.pick?.display, 'Double Chance 1X')
})

test('prefers Home Win over 1X when both would consent', () => {
  const d = diagnoseFixture(fx(W5, L5))
  assert.equal(d.pick?.marketId, 'home-win')
  const oneX = d.consents.find(c => c.id === 'dc-1x')
  assert.equal(oneX?.consented, true)
})

test('publishes Over 2.5 only when both sides are 5/5 overs', () => {
  const d = diagnoseFixture(fx('3-2 A,2-2 B,4-1 C,3-1 D,2-1 E', '2-3 A,1-2 B,3-3 C,2-2 D,1-3 E'))
  assert.equal(d.pick?.marketId, 'over-25')
})

test('publishes Under 2.5 when both sides are 5/5 unders', () => {
  const d = diagnoseFixture(fx('1-0 A,0-0 B,1-1 C,2-0 D,0-1 E', '0-1 A,1-1 B,0-0 C,1-0 D,0-1 E'))
  assert.equal(d.pick?.marketId, 'under-25')
})

test('publishes BTTS Yes when both sides are 5/5 BTTS', () => {
  const d = diagnoseFixture(fx('2-1 A,1-2 B,3-2 C,2-2 D,1-1 E', '2-2 A,1-3 B,2-1 C,1-1 D,3-2 E'))
  assert.equal(d.pick?.marketId, 'btts-yes')
})

test('skips when sample is short', () => {
  const d = diagnoseFixture(fx(W5, W5, {
    away: {id: 'A', name: 'Away FC', short: 'AWY', form: games('2-0 A,1-0 B')}
  }))
  assert.equal(d.pick, null)
  assert.equal(d.skip, 'insufficient-sample')
})

test('skips mixed form with no perfect market', () => {
  const d = diagnoseFixture(fx('2-0 A,1-1 B,3-1 C,0-2 D,0-0 E', '2-1 A,1-1 B,0-1 C,3-0 D,1-2 E'))
  assert.equal(d.pick, null)
  assert.ok(d.skip === 'no-perfect-consent' || d.skip === 'near-miss-no-consent')
})

test('settles a finished Home Win', () => {
  const won = diagnoseFixture(fx(W5, L5, {status: 'ft', score: {home: 3, away: 0}}))
  assert.equal(won.pick?.outcome, 'won')
  const lost = diagnoseFixture(fx(W5, L5, {status: 'ft', score: {home: 1, away: 1}}))
  assert.equal(lost.pick?.outcome, 'lost')
})

test('scanBoard publishes only consented markets', () => {
  const board = scanBoard([
    fx(W5, L5, {id: 'ars-bur', kickoff: '2026-09-05T15:00:00Z'}),
    fx(L5, W5, {id: 'kot-med', kickoff: '2026-09-05T17:00:00Z'}),
    fx('1-1 A,2-0 B,0-0 C,1-0 D,2-1 E', '0-0 A,1-1 B,0-1 C,0-2 D,1-1 E', {id: 'hoo-acl', kickoff: '2026-09-05T19:00:00Z'}),
    fx(W5, '0-2 A,1-3 B,2-0 C,0-1 D,1-4 E', {id: 'mci-new', kickoff: '2026-09-05T12:00:00Z'}),
    fx('2-0 A,1-1 B,3-1 C,0-2 D,0-0 E', '2-1 A,1-1 B,0-1 C,3-0 D,1-2 E', {id: 'che-liv', kickoff: '2026-09-05T14:00:00Z'})
  ])
  assert.ok(board.published.length >= 3)
  assert.ok(board.skipped.length >= 2)
  const city = board.all.find(d => d.fixture.id === 'mci-new')
  assert.equal(city?.skip, 'near-miss-no-consent')
  const chelsea = board.all.find(d => d.fixture.id === 'che-liv')
  assert.equal(chelsea?.pick, null)
  assert.equal(board.published.find(p => p.fixtureId === 'ars-bur')?.marketId, 'home-win')
  assert.equal(board.published.find(p => p.fixtureId === 'kot-med')?.marketId, 'away-win')
  assert.equal(board.published.find(p => p.fixtureId === 'hoo-acl')?.marketId, 'dc-1x')
})

test('does not publish a market the opponent refused', () => {
  const board = scanBoard([fx(W5, L5), fx(L5, W5)])
  for (const pick of board.published) {
    const row = pick.consents.find(c => c.id === pick.marketId)
    assert.equal(row?.consented, true)
    assert.equal(row?.homeHits, SPLIT_SAMPLE)
    assert.equal(row?.awayHits, SPLIT_SAMPLE)
  }
})
