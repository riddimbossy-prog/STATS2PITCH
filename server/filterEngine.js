import {ENGINE_VERSION, FINISHED, FORM_SAMPLE} from './config.js'
import {learningAllows, stampLearning} from './learning.js'
import {attachWhy, last5Form, last5Overall, fixtureHasStats, teamStats} from './pickWhy.js'
import {isSrlMatch, isEarlySeason} from './redFlags.js'
import {extractFilterOdds, isCupCompetition} from './filterEngineV2.js'
import {MARKETS, settleMarket, profileOf as splitProfile} from './perfectSplit.js'

export {extractFilterOdds, isCupCompetition}
export const ENGINE_ID = 'adaptive-match-v1'
export const FILTER_VERSION = ENGINE_ID
export const FILTER_RULE_VERSION = FILTER_VERSION
export const FILTER_MIN_ODD = Math.max(1.20, Number(process.env.ENGINE_MIN_ODD || 1.20))

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
const num = v => finite(v) ? Number(v) : null
const done = f => FINISHED.has(String(f?.fixture?.status?.short || '').toUpperCase())
const atVenue = (f, id, venue) => venue === 'home'
  ? String(f?.teams?.home?.id) === String(id)
  : String(f?.teams?.away?.id) === String(id)
const cap = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round = v => Math.round(v * 100) / 100
const pct = (v, n) => n ? Math.round(100 * v / n) : null
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()
const domesticCup = /\b(cup|copa|coppa|pokal|knockout|play[- ]?offs?|qualification|qualifier|trophy|super cup|elimination)\b/i
const europeanCup = /\b(champions league|europa league|conference league)\b/i
const knockout = /\b(qualif|play[- ]?offs?|round of|last 16|last 32|quarter|semi|final|knockout)\b/i

function shouldSkipCup(f) {
  const league = norm(f?.league)
  if (europeanCup.test(league)) return knockout.test(norm(f?.round || f?.stage || f?.leagueRound || f?.fixture?.round))
  return domesticCup.test(league)
}

function venueGames(fixtures, id, venue) {
  return (fixtures || []).filter(f => done(f) && atVenue(f, id, venue))
    .sort((a, b) => Date.parse(b?.fixture?.date || 0) - Date.parse(a?.fixture?.date || 0))
    .slice(0, FORM_SAMPLE)
    .map(f => {
      const own = num(venue === 'home' ? f?.goals?.home : f?.goals?.away)
      const opp = num(venue === 'home' ? f?.goals?.away : f?.goals?.home)
      return own === null || opp === null ? null : {gf: own, ga: opp}
    }).filter(Boolean)
}

export function profileOf(games) {
  const n = games.length
  const count = fn => games.filter(fn).length
  const gf = games.reduce((s, g) => s + g.gf, 0)
  const ga = games.reduce((s, g) => s + g.ga, 0)
  const wins = count(g => g.gf > g.ga)
  const points = games.reduce((s, g) => s + (g.gf > g.ga ? 3 : g.gf === g.ga ? 1 : 0), 0)
  return {
    sample: n, ready: n >= FORM_SAMPLE, gf: round(gf / n), ga: round(ga / n),
    ppg: round(points / n), winPct: pct(wins, n),
    over15: pct(count(g => g.gf + g.ga >= 2), n),
    over25: pct(count(g => g.gf + g.ga >= 3), n),
    btts: pct(count(g => g.gf > 0 && g.ga > 0), n),
    scored: pct(count(g => g.gf > 0), n),
    scored2: pct(count(g => g.gf >= 2), n),
    blank: pct(count(g => g.gf === 0), n),
    conceded: pct(count(g => g.ga > 0), n),
    games
  }
}

function oddOf(markets, key, names) {
  for (const market of markets || []) {
    if (market?.marketKey !== key) continue
    for (const name of names) {
      const hit = (market.outcomes || []).find(o => norm(o?.name) === norm(name))
      const price = num(hit?.odd)
      if (price) return price
    }
  }
  return null
}

function oddsFor(f, market, book) {
  const mapped = {
    'home-win': book.homeWin, 'away-win': book.awayWin,
    'over-25': book.over25, 'under-25': book.under25,
    'btts-yes': book.ggYes, 'over-15': book.over15,
    'under-35': book.under35, 'home-over-15': book.homeO15,
    'away-over-15': book.awayO15, 'home-score': book.homeO05,
    'away-score': book.awayO05
  }
  if (mapped[market.id] != null) return mapped[market.id]
  if (market.id === 'btts-no') return oddOf(f?.marketOdds, 'both-teams-score', ['No'])
  if (market.id === 'dc-1x') return oddOf(f?.marketOdds, 'double-chance', ['1X', 'Home or Draw', '1 or X'])
  if (market.id === 'dc-x2') return oddOf(f?.marketOdds, 'double-chance', ['X2', 'Draw or Away', 'X or 2'])
  return oddOf(f?.marketOdds, market.marketKey, [market.selection, market.display])
}

function poisson(lambda) {
  const values = [Math.exp(-lambda)]
  for (let i = 1; i < 9; i++) values.push(values[i - 1] * lambda / i)
  return values
}

function marketChance(id, homeGoals, awayGoals) {
  const hp = poisson(homeGoals), ap = poisson(awayGoals)
  let chance = 0
  for (let h = 0; h < hp.length; h++) for (let a = 0; a < ap.length; a++) {
    if (settleMarket(id, {home: h, away: a}) === 'won') chance += hp[h] * ap[a]
  }
  return chance
}

function matchWorlds(home, away) {
  // Each fixture starts from its own attack-versus-defence interaction.
  const h = cap((home.gf + away.ga) / 2, 0.12, 4.2)
  const a = cap((away.gf + home.ga) / 2, 0.12, 4.2)
  const homeStronger = (home.ppg - away.ppg) + (h - a) * 0.35 >= 0
  const fav = homeStronger ? 'home' : 'away'
  const favGoals = homeStronger ? h : a
  const dogGoals = homeStronger ? a : h
  const favBlank = homeStronger ? {h: 0.08, a} : {h, a: 0.08}
  const dogSurge = homeStronger ? {h, a: cap(dogGoals + 1.1, 0.12, 4.5)} : {h: cap(dogGoals + 1.1, 0.12, 4.5), a}
  const carrier = homeStronger ? {h: cap(favGoals + 0.65, 0.12, 4.5), a: cap(dogGoals * 0.55, 0.08, 4.5)}
    : {h: cap(dogGoals * 0.55, 0.08, 4.5), a: cap(favGoals + 0.65, 0.12, 4.5)}
  // The weights respond to the profiles; shocks remain possible even when recent rates are quiet.
  const openSignal = ((home.over25 + away.over25) / 200 + (home.btts + away.btts) / 200) / 2
  const blankSignal = (home.blank + away.blank) / 200
  const raw = [
    {name: 'main matchup', h, a, weight: 0.50},
    {name: 'quiet game', h: h * 0.67, a: a * 0.67, weight: 0.10 + blankSignal * 0.08},
    {name: 'open game', h: cap(h * 1.35, 0.12, 4.5), a: cap(a * 1.35, 0.12, 4.5), weight: 0.09 + openSignal * 0.09},
    {name: 'stronger side fails to score', ...favBlank, weight: 0.08 + (homeStronger ? home.blank : away.blank) / 1000},
    {name: 'underdog outperforms', ...dogSurge, weight: 0.09 + (homeStronger ? home.ga : away.ga) * 0.025},
    {name: 'one team carries the goals', ...carrier, weight: 0.09}
  ]
  const total = raw.reduce((s, w) => s + w.weight, 0)
  return {h: round(h), a: round(a), favourite: fav, worlds: raw.map(w => ({...w, weight: w.weight / total}))}
}

function evaluateMarket(m, odds, shape) {
  const chances = shape.worlds.map(w => ({name: w.name, chance: marketChance(m.id, w.h, w.a), weight: w.weight}))
  const probability = chances.reduce((s, w) => s + w.weight * w.chance, 0)
  const normal = chances[0].chance
  const worst = chances.slice(1).reduce((a, b) => a.chance < b.chance ? a : b)
  const implied = 1 / odds
  const margin = probability - implied
  // A pick must be supported in the main read, clear the price, and retain a useful path if one assumption fails.
  const robust = 0.75 * probability + 0.25 * Math.min(normal, worst.chance)
  const score = robust - implied
  return {market: m, odds, probability, normal, worst, implied, margin, robust, score, chances}
}

function whyLines(f, home, away, shape, winner, runner) {
  const hn = f?.home?.name || 'Home', an = f?.away?.name || 'Away'
  const m = winner.market
  const labels = {
    'home-win': 'a home win', 'away-win': 'an away win',
    'over-25': 'three or more goals', 'under-25': 'no more than two goals',
    'over-15': 'at least two goals', 'under-35': 'no more than three goals',
    'btts-yes': 'both teams scoring', 'btts-no': 'at least one team blanking',
    'home-over-15': hn + ' scoring twice', 'away-over-15': an + ' scoring twice',
    'home-score': hn + ' scoring', 'away-score': an + ' scoring',
    'dc-1x': hn + ' avoiding defeat', 'dc-x2': an + ' avoiding defeat'
  }
  const h = labels[m.id] || m.display
  const lines = [
    hn + ' have averaged ' + home.gf.toFixed(1) + ' scored and ' + home.ga.toFixed(1) + ' conceded at home; ' + an + ' have averaged ' + away.gf.toFixed(1) + ' scored and ' + away.ga.toFixed(1) + ' conceded away.',
    'That attack-versus-defence pairing points to roughly ' + shape.h.toFixed(1) + ' ' + hn + ' goals and ' + shape.a.toFixed(1) + ' ' + an + ' goals. The form gap is ' + home.ppg.toFixed(1) + ' versus ' + away.ppg.toFixed(1) + ' points per game.',
    'Recent goal patterns add context: both teams scored in ' + home.btts + '% of ' + hn + ' home games and ' + away.btts + '% of ' + an + ' away games; three or more goals occurred in ' + home.over25 + '% and ' + away.over25 + '%.',
    'The main matchup supports ' + h + '. I also tested a quiet game, an open game, the stronger side blanking, an underdog surge, and one side carrying the goals.',
    'The most difficult of those scenarios for ' + m.display + ' is ' + winner.worst.name + '. Its estimated chance there is ' + Math.round(winner.worst.chance * 100) + '%, so the pick still has a clear failure path.',
    m.display + ' was selected at ' + winner.odds.toFixed(2) + ' because its matchup and scenario support was strongest relative to its price' +
      (runner ? '; ' + runner.market.display + ' was the closest alternative but had a lower scenario-adjusted edge at its price.' : '.')
  ]
  return lines
}

function packPick(f, home, away, shape, winner, runner, book) {
  const market = winner.market
  const last5Home = last5Form(f?.home?.fixtures, f?.home?.id, 'home')
  const last5Away = last5Form(f?.away?.fixtures, f?.away?.id, 'away')
  const lastMatchesHome = last5Overall(f?.home?.lastMatches || f?.home?.fixtures, f?.home?.id)
  const lastMatchesAway = last5Overall(f?.away?.lastMatches || f?.away?.fixtures, f?.away?.id)
  const reasons = whyLines(f, home, away, shape, winner, runner)
  const homeHits = market.homeStat(splitProfile(venueGames(f?.home?.fixtures, f?.home?.id, 'home')))
  const awayHits = market.awayStat(splitProfile(venueGames(f?.away?.fixtures, f?.away?.id, 'away')))
  const pick = {
    fixtureId: f.fixtureId, league: f.league, country: f.country, kickoff: f.kickoff,
    home: f?.home?.name, away: f?.away?.name, homeId: f?.home?.id ?? null, awayId: f?.away?.id ?? null,
    homeLogo: f?.home?.logo || null, awayLogo: f?.away?.logo || null,
    market: market.marketKey, marketName: market.display, selection: market.selection,
    displaySelection: market.display, pick: market.display, odds: round(winner.odds),
    engine: ENGINE_ID, engineVersion: ENGINE_VERSION, route: market.route, marketId: market.id,
    favourite: shape.favourite, family: market.family,
    homeConsensus: pct(homeHits, home.sample), awayConsensus: pct(awayHits, away.sample),
    consensus: Math.round(winner.probability * 100),
    filterScore: Math.round(winner.robust * 100), rawFilterScore: round(winner.score * 100),
    displayScore: Math.round(winner.robust * 100), capability: Math.round(winner.normal * 100),
    runnerUpRoute: runner?.market.route || null, scoreSeparation: runner ? round((winner.score - runner.score) * 100) : null,
    metrics: {home, away}, matchup: shape, oddsBook: book,
    filterFlags: ['MATCHUP_SCENARIOS'], filterReasons: reasons,
    homeSplit: f.homeSplit || null, awaySplit: f.awaySplit || null,
    earlySeason: f.earlySeason === true, sportyEventId: f.sportyEventId || null
  }
  return attachWhy(pick, f, {reasons, last5Home, last5Away, lastMatchesHome, lastMatchesAway, homeAvg: home, awayAvg: away})
}

export function diagnoseFilterFixture(fixture, learningState = null) {
  if (isSrlMatch(fixture)) return {pick: null, skip: 'srl'}
  if (!fixtureHasStats(fixture)) return {pick: null, skip: 'no-stats'}
  if (fixture?.earlySeason === true || isEarlySeason(fixture)) return {pick: null, skip: 'early-season'}
  if (shouldSkipCup(fixture)) return {pick: null, skip: 'cup'}
  const home = profileOf(venueGames(fixture?.home?.fixtures, fixture?.home?.id, 'home'))
  const away = profileOf(venueGames(fixture?.away?.fixtures, fixture?.away?.id, 'away'))
  if (!home.ready || !away.ready) return {pick: null, skip: 'insufficient-venue-sample', home, away}
  const shape = matchWorlds(home, away)
  const book = extractFilterOdds(fixture)
  const candidates = MARKETS.map(m => {
    const odds = oddsFor(fixture, m, book)
    return odds && odds >= FILTER_MIN_ODD ? evaluateMarket(m, odds, shape) : null
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.margin - a.margin || a.market.priority - b.market.priority)
  if (!candidates.length) return {pick: null, skip: 'no-priced-market', home, away}
  const winner = candidates[0], runner = candidates[1] || null
  if (winner.margin < 0.04 || winner.normal < winner.implied || winner.score < 0.01 ||
      (runner && winner.score - runner.score < 0.015)) {
    return {pick: null, skip: 'no-robust-edge', home, away, shape, candidates}
  }
  const packed = packPick(fixture, home, away, shape, winner, runner, book)
  const learned = learningAllows(packed, learningState, {board: 'filter'})
  if (!learned.allowed) return {pick: null, skip: learned.action === 'drop' ? 'learning-drop' : 'learning-tighten', home, away, learning: learned}
  return {pick: stampLearning(packed, learned), skip: null, home, away, shape, candidates, learning: learned}
}

export function evaluateFilterFixture(fixture, learningState = null) {
  return diagnoseFilterFixture(fixture, learningState).pick
}

export function buildFilterBoard(fixtures, meta = {}, learningState = null) {
  const diagnosed = (fixtures || []).map(fixture => diagnoseFilterFixture(fixture, learningState))
  const qualified = diagnosed.map(row => row.pick).filter(Boolean)
    .sort((a, b) => Date.parse(a.kickoff || 0) - Date.parse(b.kickoff || 0) || String(a.league).localeCompare(String(b.league)))
  const skipped = diagnosed.filter(row => !row.pick).reduce((map, row) => {
    map[row.skip || 'unknown'] = (map[row.skip || 'unknown'] || 0) + 1
    return map
  }, {})
  return {
    meta: {...meta, engineVersion: ENGINE_VERSION, engine: ENGINE_ID, filterVersion: FILTER_VERSION,
      formSample: FORM_SAMPLE, qualified: qualified.length, bestPicks: qualified.length, skipped},
    priority: qualified, bestPicks: qualified,
    availableMarkets: [...new Set(qualified.map(row => row.market))].sort()
  }
}
