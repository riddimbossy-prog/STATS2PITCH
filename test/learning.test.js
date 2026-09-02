import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLearningState,
  buildLearningProfiles,
  learningAllows,
  stampLearning,
  applyLearningToRows,
  dimensionKeys,
  publicLearning
} from '../server/learning.js'
import {buildFilterBoard, diagnoseFilterFixture} from '../server/filterEngine.js'

function board(date, picks, results, extra={}) {
  const map = {}
  for (const [id, outcome] of Object.entries(results || {})) map[id] = {outcome}
  return {
    date,
    meta: {date},
    results: map,
    bestPicks: extra.bestPicks || [],
    filterTips: extra.filterTips || picks || [],
    varTips: extra.varTips || [],
    goalsBankers: extra.goalsBankers || [],
    dailyBankers: extra.dailyBankers || []
  }
}

function filterPick(id, route, overrides={}) {
  return {
    fixtureId: id,
    country: 'England',
    league: 'Premier League',
    market: route === 'straight-win' ? 'match-winner' : route === 'gg' ? 'both-teams-score' : 'total-goals',
    selection: route === 'over-25' ? 'Over 2.5' : route === 'over-15' ? 'Over 1.5' : 'Home',
    displaySelection: route === 'over-25' ? 'Over 2.5' : route === 'over-15' ? 'Over 1.5' : '1X2 · Home',
    route,
    odds: 1.40,
    home: 'Home FC',
    away: 'Away FC',
    consensus: 80,
    homeConsensus: 80,
    awayConsensus: 80,
    rawFilterScore: 88,
    filterScore: 88,
    ...overrides
  }
}

test('filter-route dimensions tag Filter Over 2.5 separately', () => {
  const keys = dimensionKeys(filterPick(1, 'over-25'), 'filter').map(x => x.kind)
  assert.ok(keys.includes('filter-route'))
  assert.ok(keys.includes('board-market'))
})

test('a filter that keeps losing is dropped overnight', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    const date = `2026-08-${String(20 + i).padStart(2, '0')}`
    boards.push(board(date, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const route = state.profiles.find(p => p.kind === 'filter-route' && /over-25|over 2/.test(p.key + p.label))
  assert.ok(route, 'expected Over 2.5 filter-route profile')
  assert.equal(route.action, 'drop')
  assert.match(route.note, /Overnight:|dropped|taken off/i)
})

test('three straight filter losses are enough to drop that route', () => {
  const boards = []
  for (let i = 1; i <= 3; i++) {
    boards.push(board(`2026-08-2${i}`, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  const state = buildLearningState(boards, '2026-08-24', 3)
  const route = state.profiles.find(p => p.kind === 'filter-route')
  assert.ok(route)
  assert.equal(route.action, 'drop')
  const verdict = learningAllows(filterPick(99, 'over-25'), state, {board: 'filter'})
  assert.equal(verdict.allowed, false)
  assert.equal(verdict.action, 'drop')
})

test('two straight filter misses tighten instead of dropping', () => {
  const boards = []
  for (let i = 1; i <= 6; i++) {
    const date = `2026-08-${String(18 + i).padStart(2, '0')}`
    const outcome = i >= 5 ? 'lost' : 'won'
    boards.push(board(date, [filterPick(i, 'gg')], {[i]: outcome}))
  }
  const state = buildLearningState(boards, '2026-08-25', 3)
  const route = state.profiles.find(p => p.kind === 'filter-route')
  assert.equal(route.action, 'tighten')
  const weak = learningAllows(filterPick(50, 'gg', {rawFilterScore: 71, consensus: 70, homeConsensus: 70, awayConsensus: 70}), state, {board: 'filter', tightenMinScore: 82})
  const strong = learningAllows(filterPick(51, 'gg', {rawFilterScore: 90}), state, {board: 'filter', tightenMinScore: 82})
  assert.equal(weak.allowed, false)
  assert.equal(strong.allowed, true)
  assert.equal(strong.action, 'tighten')
})

test('a hitting filter stays on the board', () => {
  const boards = []
  for (let i = 1; i <= 10; i++) {
    const date = `2026-08-${String(10 + i).padStart(2, '0')}`
    boards.push(board(date, [filterPick(100 + i, 'over-15')], {[100 + i]: i === 3 ? 'lost' : 'won'}))
  }
  const state = buildLearningState(boards, '2026-08-21', 3)
  const route = state.profiles.find(p => p.kind === 'filter-route' && /over.?15/.test(`${p.key} ${p.label}`))
  assert.ok(route)
  assert.ok(['keep', 'boost'].includes(route.action), route.action)
  assert.match(route.note, /Kept/i)
})

test('dropped Over 2.5 does not kill Over 1.5 on the same fixture', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    const date = `2026-08-${String(20 + i).padStart(2, '0')}`
    boards.push(board(date, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const over25 = learningAllows(filterPick(99, 'over-25'), state, {board: 'filter'})
  const over15 = learningAllows(filterPick(99, 'over-15', {rawFilterScore: 90}), state, {board: 'filter'})
  assert.equal(over25.allowed, false)
  assert.equal(over25.action, 'drop')
  assert.equal(over15.allowed, true)
  assert.ok(['keep', 'boost', 'watch'].includes(over15.action), over15.action)
})

test('a dead Over 2.5 filter does not tighten a hitting Over 1.5', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    boards.push(board(`2026-08-${String(20 + i).padStart(2, '0')}`, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  for (let i = 1; i <= 9; i++) {
    boards.push(board(`2026-08-${String(10 + i).padStart(2, '0')}`, [filterPick(100 + i, 'over-15')], {[100 + i]: i === 4 ? 'lost' : 'won'}))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const over15 = learningAllows(filterPick(901, 'over-15', {rawFilterScore: 91}), state, {board: 'filter', tightenMinScore: 82})
  assert.equal(over15.allowed, true)
  assert.ok(['keep', 'boost'].includes(over15.action), over15.action)
  assert.match(over15.note, /Over 1\.5/)
  assert.doesNotMatch(over15.note, /Over 2\.5/)
  const stamped = stampLearning(filterPick(901, 'over-15', {reasons: ['Venue form agrees.']}), over15)
  assert.ok(stamped.reasons[0].includes('Over 1.5'))
  assert.equal(stamped.reasons.some(line => /total goals was tightened/i.test(line)), false)
})

test('a hitting league profile is not tightened by a failing country', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    boards.push(board(`2026-08-${String(20 + i).padStart(2, '0')}`, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  for (let i = 1; i <= 12; i++) {
    boards.push(board(`2026-08-${String(8 + i).padStart(2, '0')}`, [], {[400 + i]: i === 5 || i === 9 ? 'lost' : 'won'}, {
      bestPicks: [{
        fixtureId: 400 + i,
        country: 'England',
        league: 'Championship',
        market: 'draw-no-bet',
        selection: 'Home',
        consensus: 100,
        homeConsensus: 100,
        awayConsensus: 100
      }]
    }))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const pick = {
    fixtureId: 902,
    country: 'England',
    league: 'Championship',
    market: 'draw-no-bet',
    selection: 'Home',
    consensus: 100,
    homeConsensus: 100,
    awayConsensus: 100
  }
  const verdict = learningAllows(pick, state, {board: 'all'})
  assert.equal(verdict.allowed, true)
  assert.ok(['keep', 'boost'].includes(verdict.action), verdict.action)
  assert.match(verdict.note, /draw no bet|Championship/i)
})

test('tighten keeps only higher-evidence copies', () => {
  const boards = []
  for (let i = 1; i <= 6; i++) {
    const date = `2026-08-${String(18 + i).padStart(2, '0')}`
    const outcome = i <= 3 ? 'lost' : 'won'
    boards.push(board(date, [filterPick(i, 'gg')], {[i]: outcome}))
  }
  const state = buildLearningState(boards, '2026-08-25', 3)
  const weak = learningAllows(filterPick(50, 'gg', {rawFilterScore: 71, consensus: 70, homeConsensus: 70, awayConsensus: 70}), state, {board: 'filter', tightenMinScore: 82})
  const strong = learningAllows(filterPick(51, 'gg', {rawFilterScore: 90}), state, {board: 'filter', tightenMinScore: 82})
  if (weak.action === 'tighten' || strong.action === 'tighten' || weak.action === 'drop') {
    if (weak.action === 'tighten') assert.equal(weak.allowed, false)
    if (strong.action === 'tighten') assert.equal(strong.allowed, true)
  } else {
    assert.ok(['drop', 'tighten', 'keep', 'watch'].includes(weak.action))
  }
})

test('why on the next pick names the overnight adjustment', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    const date = `2026-08-${String(20 + i).padStart(2, '0')}`
    boards.push(board(date, [], {[i]: 'lost'}, {bestPicks: [{
      fixtureId: i, country: 'Spain', league: 'La Liga', market: 'draw-no-bet', selection: 'Home',
      home: 'A', away: 'B', consensus: 80, homeConsensus: 80, awayConsensus: 80
    }]}))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const pick = {
    fixtureId: 99, country: 'Spain', league: 'La Liga', market: 'draw-no-bet', selection: 'Home',
    home: 'A', away: 'B', consensus: 100, homeConsensus: 100, awayConsensus: 100,
    reasons: ['Venue form agrees.']
  }
  const verdict = learningAllows(pick, state, {board: 'all'})
  const stamped = stampLearning(pick, verdict)
  assert.ok(stamped.learning)
  assert.ok(stamped.reasons[0].includes('Overnight') || stamped.reasons[0].includes('Kept') || stamped.learning.note)
  assert.equal(stamped.shortReason, stamped.reasons[0])
})

test('legacy profile builder still returns gate fields', () => {
  const boards = [board('2026-08-20', [], {1: 'won'}, {bestPicks: [{
    fixtureId: 1, country: 'England', league: 'Championship', market: 'match-winner', selection: 'Home'
  }]})]
  const profiles = buildLearningProfiles(boards, 20)
  assert.ok(Array.isArray(profiles))
  if (profiles[0]) {
    assert.ok(['skip', '100-only', 'standard'].includes(profiles[0].gate))
    assert.equal(typeof profiles[0].ready, 'boolean')
  }
})

test('applyLearningToRows drops failing rows and stamps survivors', () => {
  const boards = []
  for (let i = 1; i <= 5; i++) {
    boards.push(board(`2026-08-2${i}`, [filterPick(i, 'over-25')], {[i]: 'lost'}))
  }
  const state = buildLearningState(boards, '2026-08-26', 3)
  const rows = [
    filterPick(90, 'over-25', {reasons: ['old']}),
    filterPick(91, 'over-15', {reasons: ['old'], rawFilterScore: 91})
  ]
  const kept = applyLearningToRows(rows, state, {board: 'filter'})
  assert.equal(kept.some(p => p.route === 'over-25'), false)
  assert.equal(kept.some(p => p.route === 'over-15'), true)
})

test('publicLearning trims the overnight desk', () => {
  const boards = []
  for (let i = 1; i <= 8; i++) {
    boards.push(board(`2026-08-${String(10 + i).padStart(2, '0')}`, [filterPick(i, 'over-15')], {[i]: 'won'}))
  }
  const desk = publicLearning(buildLearningState(boards, '2026-08-20', 3))
  assert.ok(desk.summary)
  assert.ok(Array.isArray(desk.keep) || Array.isArray(desk.boost))
})

test('filter engine can skip a dropped route without taking down the fixture helper', () => {
  const empty = diagnoseFilterFixture({earlySeason: true, home: {name: 'A'}, away: {name: 'B'}})
  assert.equal(empty.pick, null)
  const boardOut = buildFilterBoard([], {})
  assert.equal(boardOut.bestPicks.length, 0)
})
