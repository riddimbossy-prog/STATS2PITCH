const SOURCES = Object.freeze([
  {board: 'all', fields: ['bestPicks']},
  {board: 'filter', fields: ['filterTips']},
  {board: 'var', fields: ['varTips']},
  {board: 'goals', fields: ['goalsBankers']},
  {board: 'bankers', fields: ['dailyBankers', 'safestBankers', 'valueBankers', 'bankers']}
])

const KIND_RANK = Object.freeze({
  'filter-route': 0,
  'board-market': 1,
  profile: 2,
  'country-market': 3,
  market: 4,
  board: 5,
  country: 6
})

const ACTION_GATE = Object.freeze({drop: 'skip', tighten: '100-only', keep: 'standard', boost: 'standard', watch: 'standard'})

const finite = v => Number.isFinite(Number(v))
const text = v => String(v ?? '').trim()
const norm = s => text(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.+]+/g, ' ').trim()
const round1 = v => Math.round(Number(v) * 10) / 10
const todayIso = (d = new Date()) => d.toISOString().slice(0, 10)
const dayDiff = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)

function boardDate(board, fallback = '') {
  return text(board?.meta?.date || board?.date || fallback).slice(0, 10)
}

export function profileKey(pick) {
  return `${norm(pick?.country)}|${norm(pick?.league)}|${norm(pick?.market)}`
}

function marketLabel(market) {
  return text(market).replaceAll('-', ' ') || 'this market'
}

function boardLabel(board) {
  return ({all: 'All Picks', filter: 'Filter Tips', var: 'VAR Tips', goals: 'Goals Bankers', bankers: 'Daily Bankers'})[board] || text(board)
}

export function routeLabel(route) {
  const key = text(route)
  return ({
    'straight-win': 'straight win',
    'over-15': 'Over 1.5',
    'under-35': 'Under 3.5',
    'over-25': 'Over 2.5',
    'under-25': 'Under 2.5',
    gg: 'BTTS Yes',
    FAV_WIN: 'favourite win',
    FAV_2PLUS: 'favourite 2+',
    'OVER_2.5': 'Over 2.5',
    GG: 'GG',
    DRAW_OR_OVER_25: 'Draw or Over 2.5',
    DRAW_OR_UNDER_25: 'Draw or Under 2.5',
    DRAW_OR_GG: 'Draw or GG'
  })[key] || marketLabel(key)
}

function pickRoute(pick) {
  return text(pick?.route || pick?.family || '')
}

export function dimensionKeys(pick, board) {
  const market = norm(pick?.market)
  const route = norm(pickRoute(pick))
  const country = text(pick?.country)
  const league = text(pick?.league)
  const keys = []
  if (board && route) {
    keys.push({
      kind: 'filter-route',
      key: `${board}|route|${route}`,
      label: `${boardLabel(board)} · ${routeLabel(pickRoute(pick))}`,
      board,
      route: pickRoute(pick),
      country: '',
      league: '',
      market: pick?.market || ''
    })
  }
  if (board && market) {
    keys.push({
      kind: 'board-market',
      key: `${board}|market|${market}`,
      label: `${boardLabel(board)} · ${marketLabel(pick?.market)}`,
      board,
      route: '',
      country: '',
      league: '',
      market: pick?.market || ''
    })
  }
  if (country && league && market) {
    keys.push({
      kind: 'profile',
      key: profileKey(pick),
      label: `${country} · ${league} · ${marketLabel(pick?.market)}`,
      board: board || '',
      route: '',
      country,
      league,
      market: pick?.market || ''
    })
  }
  if (country && market) {
    keys.push({
      kind: 'country-market',
      key: `${norm(country)}|${market}`,
      label: `${country} · ${marketLabel(pick?.market)}`,
      board: board || '',
      route: '',
      country,
      league: '',
      market: pick?.market || ''
    })
  }
  if (market) {
    keys.push({
      kind: 'market',
      key: `market|${market}`,
      label: marketLabel(pick?.market),
      board: board || '',
      route: '',
      country: '',
      league: '',
      market: pick?.market || ''
    })
  }
  if (board) {
    keys.push({
      kind: 'board',
      key: `board|${board}`,
      label: boardLabel(board),
      board,
      route: '',
      country: '',
      league: '',
      market: ''
    })
  }
  if (country) {
    keys.push({
      kind: 'country',
      key: `country|${norm(country)}`,
      label: country,
      board: board || '',
      route: '',
      country,
      league: '',
      market: ''
    })
  }
  return keys
}

function recencyWeight(daysAgo) {
  if (!Number.isFinite(daysAgo) || daysAgo < 0) return 0
  if (daysAgo <= 2) return 2.2
  if (daysAgo <= 6) return 1.6
  if (daysAgo <= 13) return 1.2
  if (daysAgo <= 30) return 1
  if (daysAgo <= 60) return 0.55
  return 0
}

function emptyGroup(meta) {
  return {
    ...meta,
    wins: 0,
    losses: 0,
    sample: 0,
    last7Wins: 0,
    last7Losses: 0,
    last7: 0,
    weightedWins: 0,
    weightedSample: 0,
    results: []
  }
}

function recordResult(group, outcome, date, asOf) {
  const won = outcome === 'won'
  group.sample++
  if (won) group.wins++
  else group.losses++
  const ago = date && asOf ? dayDiff(date, asOf) : 99
  const weight = recencyWeight(ago)
  group.weightedSample += weight
  if (won) group.weightedWins += weight
  if (Number.isFinite(ago) && ago <= 6) {
    group.last7++
    if (won) group.last7Wins++
    else group.last7Losses++
  }
  group.results.push({date, outcome, ago})
}

function streakOf(results, want) {
  let n = 0
  const ordered = [...results].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (a.ago ?? 0) - (b.ago ?? 0))
  for (const row of ordered) {
    if (row.outcome !== want) break
    n++
  }
  return n
}

function decideAction(g) {
  const n = g.sample
  const wr = g.recencyWinRate
  const last7 = g.last7Rate
  const n7 = g.last7
  const lossStreak = g.lossStreak
  const kind = g.kind
  const canDrop = kind === 'filter-route' || kind === 'profile' || kind === 'country-market' || kind === 'country'
  if (kind === 'board' || kind === 'market' || kind === 'board-market') {
    if (n >= 12 && wr < 55) return 'tighten'
    if (n >= 10 && wr >= 74) return 'boost'
    return n >= 6 ? 'keep' : 'watch'
  }
  if (kind === 'country') {
    if (canDrop && n >= 18 && wr < 46) return 'drop'
    if (n >= 10 && wr < 56) return 'tighten'
    if (n >= 10 && wr >= 74) return 'boost'
    return n >= 8 ? 'keep' : 'watch'
  }
  if (canDrop && ((lossStreak >= 4 && n >= 4) || (n7 >= 4 && last7 < 40) || (n >= 8 && wr < 48) || (n >= 18 && wr < 52))) return 'drop'
  if (lossStreak >= 3 || (n7 >= 3 && last7 < 50) || (n >= 6 && wr < 58) || (n >= 16 && wr < 62)) return 'tighten'
  if (n >= 8 && wr >= 74 && (n7 < 3 || last7 >= 65)) return 'boost'
  if (n >= 5 && wr >= 62) return 'keep'
  return 'watch'
}

function actionNote(g) {
  const rec = `${g.wins}W / ${g.losses}L`
  const rate = `${g.winRate}%`
  const recent = g.last7 ? ` Last 7 days: ${g.last7Wins}W / ${g.last7Losses}L.` : ''
  if (g.action === 'drop') {
    if (g.lossStreak >= 4) return `Overnight: ${g.label} was taken off after ${g.lossStreak} straight losses (${rec}, ${rate}).`
    return `Overnight: ${g.label} was dropped after ${rec} (${rate}). Recent misses are too heavy.${recent}`
  }
  if (g.action === 'tighten') {
    if (g.lossStreak >= 3) return `Overnight: ${g.label} was tightened after ${g.lossStreak} straight misses (${rec}, ${rate}). Only higher-evidence copies stay.`
    return `Overnight: ${g.label} was tightened after ${rec} (${rate}). The bar is raised until it recovers.${recent}`
  }
  if (g.action === 'boost') return `Kept and boosted: ${g.label} is the in-form route — ${rec} (${rate}).`
  if (g.action === 'keep') return `Kept: ${g.label} is still working — ${rec} (${rate}).`
  return `${g.label} is still sampling — ${rec} so far.`
}

function finalizeGroup(g) {
  const decided = g.wins + g.losses
  const rawRate = decided ? round1(g.wins * 100 / decided) : 0
  const recencyWinRate = g.weightedSample ? round1(g.weightedWins * 100 / g.weightedSample) : rawRate
  const last7Rate = g.last7 ? round1(g.last7Wins * 100 / g.last7) : recencyWinRate
  const lossStreak = streakOf(g.results, 'lost')
  const winStreak = streakOf(g.results, 'won')
  const next = {
    ...g,
    results: undefined,
    winRate: recencyWinRate,
    rawWinRate: rawRate,
    recencyWinRate,
    last7Rate,
    lossStreak,
    winStreak,
    ready: g.sample >= 6
  }
  next.action = decideAction(next)
  next.gate = ACTION_GATE[next.action] || 'standard'
  next.note = actionNote(next)
  return next
}

function publishedRows(board) {
  const seen = new Set()
  const out = []
  const date = boardDate(board)
  for (const source of SOURCES) {
    for (const field of source.fields) {
      for (const pick of board?.[field] || []) {
        const id = `${source.board}|${pick?.fixtureId}|${norm(pick?.market)}|${norm(pick?.selection)}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push({pick, board: source.board, date})
      }
    }
  }
  return out
}

function pickOutcome(board, pick) {
  const result = board?.results?.[String(pick?.fixtureId)]
  const outcome = result?.outcome
  return outcome === 'won' || outcome === 'lost' ? outcome : null
}

export function emptyLearningState(asOf = todayIso()) {
  return {
    asOf,
    generatedAt: new Date().toISOString(),
    profiles: [],
    adjustments: {drop: [], tighten: [], keep: [], boost: [], watch: []},
    summary: {dropped: 0, tightened: 0, kept: 0, boosted: 0, watching: 0}
  }
}

export function buildLearningState(boards = [], asOf = todayIso(), minSample = 6) {
  const groups = new Map()
  for (const board of boards || []) {
    const date = boardDate(board)
    for (const row of publishedRows(board)) {
      const outcome = pickOutcome(board, row.pick)
      if (!outcome) continue
      for (const dim of dimensionKeys(row.pick, row.board)) {
        const g = groups.get(dim.key) || emptyGroup(dim)
        recordResult(g, outcome, date, asOf)
        groups.set(dim.key, g)
      }
    }
  }
  const profiles = [...groups.values()]
    .map(finalizeGroup)
    .filter(g => g.sample >= Math.min(3, minSample))
    .sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) || b.sample - a.sample || a.winRate - b.winRate)
  const bucket = action => profiles.filter(p => p.action === action)
  const drop = bucket('drop')
  const tighten = bucket('tighten')
  const keep = bucket('keep')
  const boost = bucket('boost')
  const watch = bucket('watch')
  return {
    asOf,
    generatedAt: new Date().toISOString(),
    profiles,
    adjustments: {drop, tighten, keep, boost, watch},
    summary: {dropped: drop.length, tightened: tighten.length, kept: keep.length, boosted: boost.length, watching: watch.length}
  }
}

export function buildLearningProfiles(boards = [], minSample = 20) {
  const state = buildLearningState(boards, todayIso(), 3)
  return state.profiles
    .filter(p => p.kind === 'profile')
    .map(p => {
      const gate = p.sample >= 30 && p.winRate < 50 ? 'skip' : p.sample >= minSample && p.winRate < 58 ? '100-only' : 'standard'
      const action = gate === 'skip' ? 'drop' : gate === '100-only' ? 'tighten' : 'keep'
      return {
        key: p.key,
        country: p.country,
        league: p.league,
        market: p.market,
        wins: p.wins,
        losses: p.losses,
        sample: p.sample,
        winRate: p.winRate,
        gate,
        action,
        note: p.note,
        ready: p.sample >= minSample
      }
    })
    .sort((a, b) => b.sample - a.sample || b.winRate - a.winRate)
}

function asState(input) {
  if (!input) return emptyLearningState()
  if (Array.isArray(input)) {
    const profiles = input.map(p => ({
      ...p,
      kind: p.kind || 'profile',
      action: p.action || (p.gate === 'skip' ? 'drop' : p.gate === '100-only' ? 'tighten' : 'keep'),
      label: p.label || `${p.country || ''} · ${p.league || ''} · ${marketLabel(p.market)}`.replace(/^ · | · $/g, ''),
      note: p.note || ''
    }))
    return {asOf: todayIso(), generatedAt: new Date().toISOString(), profiles, adjustments: {drop: [], tighten: [], keep: [], boost: [], watch: []}, summary: {}}
  }
  if (Array.isArray(input.profiles)) return input
  return emptyLearningState()
}

function matchingDimensions(pick, state, board) {
  const wanted = new Set(dimensionKeys(pick, board).map(d => d.key))
  return (state.profiles || [])
    .filter(p => wanted.has(p.key))
    .sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) || b.sample - a.sample)
}

export function meetsTighten(pick, opts = {}) {
  const minScore = Number(opts.tightenMinScore || 82)
  const score = Number(pick?.rawFilterScore ?? pick?.filterScore ?? pick?.engineRating ?? pick?.marketScore ?? pick?.rawScore)
  if (finite(score) && score >= minScore) return true
  if (Number(pick?.homeConsensus) === 100 && Number(pick?.awayConsensus) === 100) return true
  if (Number(pick?.consensus) >= 92) return true
  if (Number(pick?.capabilityScore) >= 80) return true
  return false
}

export function learningAllows(pick, profiles = [], opts = {}) {
  const state = asState(profiles)
  const board = opts.board || null
  const matches = matchingDimensions(pick, state, board)
  const hasRoute = !!norm(pickRoute(pick))
  const drops = matches.filter(m => m.action === 'drop')
  for (const drop of drops) {
    if (hasRoute && drop.kind !== 'filter-route') continue
    if (drop.kind === 'filter-route') {
      const droppedRoute = norm(drop.route || String(drop.key).split('|').pop())
      if (norm(pickRoute(pick)) && droppedRoute && droppedRoute !== norm(pickRoute(pick))) continue
    }
    return {allowed: false, action: 'drop', gate: 'skip', profile: drop, note: drop.note, matches}
  }
  const tighten = matches.find(m => m.action === 'tighten')
  if (tighten) {
    if (opts.enforceTighten !== false && !meetsTighten(pick, opts)) {
      return {allowed: false, action: 'tighten', gate: '100-only', profile: tighten, note: tighten.note, matches}
    }
    return {allowed: true, action: 'tighten', gate: '100-only', profile: tighten, note: tighten.note, matches}
  }
  const boost = matches.find(m => m.action === 'boost')
  const keep = matches.find(m => m.action === 'keep')
  const primary = boost || keep || matches[0] || null
  return {
    allowed: true,
    action: primary?.action || 'watch',
    gate: primary?.gate || 'standard',
    profile: primary,
    note: primary?.note || '',
    matches
  }
}

function slimMatch(row) {
  if (!row) return null
  return {
    key: row.key,
    kind: row.kind,
    label: row.label,
    action: row.action,
    gate: row.gate,
    sample: row.sample,
    wins: row.wins,
    losses: row.losses,
    winRate: row.winRate,
    lossStreak: row.lossStreak,
    note: row.note
  }
}

export function stampLearning(pick, verdict) {
  if (!pick) return pick
  if (!verdict?.profile && !verdict?.note) return pick
  const note = text(verdict.note)
  const reasons = Array.isArray(pick.reasons) ? [...pick.reasons] : []
  if (note && !reasons.includes(note)) reasons.unshift(note)
  const extras = (verdict.matches || [])
    .filter(m => m && m !== verdict.profile && (m.action === 'keep' || m.action === 'boost' || m.action === 'tighten'))
    .slice(0, 2)
  for (const extra of extras) {
    if (extra.note && !reasons.includes(extra.note)) reasons.push(extra.note)
  }
  const learning = {
    action: verdict.action || 'watch',
    gate: verdict.gate || ACTION_GATE[verdict.action] || 'standard',
    note,
    sample: verdict.profile?.sample || 0,
    wins: verdict.profile?.wins || 0,
    losses: verdict.profile?.losses || 0,
    winRate: verdict.profile?.winRate ?? null,
    label: verdict.profile?.label || '',
    lossStreak: verdict.profile?.lossStreak || 0,
    matches: [verdict.profile, ...extras].filter(Boolean).map(slimMatch)
  }
  return {
    ...pick,
    reasons,
    shortReason: reasons[0] || pick.shortReason || null,
    reason: reasons.join(' • '),
    learning,
    learningProfile: {
      sample: learning.sample,
      winRate: learning.winRate,
      gate: learning.gate,
      action: learning.action
    }
  }
}

export function applyLearningToRows(rows = [], profiles = [], opts = {}) {
  const out = []
  for (const pick of rows || []) {
    const verdict = learningAllows(pick, profiles, opts)
    if (!verdict.allowed) continue
    out.push(stampLearning(pick, verdict))
  }
  return out
}

export function publicLearning(state) {
  const s = asState(state)
  const take = (rows, n = 8) => (rows || []).slice(0, n).map(slimMatch)
  return {
    asOf: s.asOf,
    generatedAt: s.generatedAt,
    summary: s.summary || {},
    drop: take(s.adjustments?.drop, 10),
    tighten: take(s.adjustments?.tighten, 10),
    keep: take(s.adjustments?.keep, 8),
    boost: take(s.adjustments?.boost, 8)
  }
}
