// Goals combo route — used only when V4 has no clear single-market path.
// Win if either leg lands: Draw OR Over 2.5 / Under 2.5 / GG.

export const COMBO_ROUTES = Object.freeze(['DRAW_OR_OVER_25', 'DRAW_OR_UNDER_25', 'DRAW_OR_GG'])

export const COMBO_LABEL = Object.freeze({
  DRAW_OR_OVER_25: 'Draw or Over 2.5',
  DRAW_OR_UNDER_25: 'Draw or Under 2.5',
  DRAW_OR_GG: 'Draw or GG'
})

export const COMBO_META = Object.freeze({
  DRAW_OR_OVER_25: {
    market: 'draw-or-over-25',
    selection: 'Draw or Over 2.5',
    displaySelection: 'Draw or Over 2.5',
    family: 'Combo',
    secondKey: 'over25',
    overlap: 0.22
  },
  DRAW_OR_UNDER_25: {
    market: 'draw-or-under-25',
    selection: 'Draw or Under 2.5',
    displaySelection: 'Draw or Under 2.5',
    family: 'Combo',
    secondKey: 'under25',
    overlap: 0.78
  },
  DRAW_OR_GG: {
    market: 'draw-or-gg',
    selection: 'Draw or GG',
    displaySelection: 'Draw or GG',
    family: 'Combo',
    secondKey: 'btts_yes',
    overlap: 0.68
  }
})

const COMBO_SKIP = new Set([
  'LOW_MARKET_SEPARATION',
  'LOW_CAPABILITY_SEPARATION',
  'BELOW_FLOOR',
  'CONFLICT_NO_CONFIRMATION'
])

const FLOOR = 52
const SEPARATION = 4

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
const num = v => finite(v) ? Number(v) : null

export function isComboRoute(route) {
  return COMBO_ROUTES.includes(String(route || ''))
}

export function comboSkipEligible(reasonCode) {
  const code = String(reasonCode || '')
  return COMBO_SKIP.has(code) || code.startsWith('VETO_')
}

export function comboDecimal(drawOdds, secondOdds, overlapShare) {
  const draw = num(drawOdds)
  const second = num(secondOdds)
  if (!draw || !second) return null
  const pDraw = 1 / draw
  const pSecond = 1 / second
  const overlap = Math.min(pDraw, pSecond) * Number(overlapShare || 0.3)
  const p = Math.min(0.88, Math.max(0.36, pDraw + pSecond - overlap))
  return +(1 / p).toFixed(2)
}

export function publishedCombo(route, odds) {
  const meta = COMBO_META[route]
  if (!meta) return null
  const listed = num(odds?.[meta.market]) || num(odds?.[route]) || null
  const second = meta.secondKey === 'under25'
    ? (num(odds?.under25) || invertLine(odds?.over25))
    : num(odds?.[meta.secondKey])
  const price = listed || comboDecimal(odds?.draw_odds, second, meta.overlap)
  if (!price) return null
  return {
    market: meta.market,
    selection: meta.selection,
    displaySelection: meta.displaySelection,
    odds: price,
    family: meta.family,
    listed: Boolean(listed)
  }
}

function invertLine(over) {
  const p = num(over)
  if (!p) return null
  const q = 1 - (1 / p)
  if (q <= 0.08 || q >= 0.92) return null
  return +(1 / q).toFixed(2)
}

function drawLive(draw) {
  if (!finite(draw)) return false
  return draw >= 2.70 && draw <= 5.40
}

function scoreDrawOrOver(odds, ctx) {
  const draw = num(odds.draw_odds)
  const over = num(odds.over25)
  const opp = num(odds.opp_tt_over05)
  const btts = num(odds.btts_yes)
  if (!drawLive(draw) || !finite(over)) return null
  if (over < 1.42 || over > 2.05) return null
  let s = 0
  if (draw >= 3.05 && draw <= 4.60) s += 22
  else if (draw >= 2.80 && draw <= 5.10) s += 14
  else s += 6
  if (over >= 1.52 && over <= 1.82) s += 22
  else if (over >= 1.45 && over <= 1.95) s += 14
  else s += 6
  if (ctx.shape === 'HIGH_EVENT_BOTH_SIDES' || ctx.shape === 'CONFLICT_ZONE') s += 12
  if (ctx.shape === 'CONTROLLED_FAVORITE') s -= 8
  if (ctx.oppProfile === 'CONFLICT') s += 12
  else if (ctx.oppProfile === 'LIVE' || ctx.oppProfile === 'VERY_LIVE') s += 6
  else if (ctx.oppProfile === 'VERY_COLD') s -= 10
  if (ctx.top === 'OVER_2.5' || ctx.runner === 'OVER_2.5') s += 8
  if (ctx.top === 'FAV_WIN' && ctx.runner === 'OVER_2.5') s += 6
  if (finite(opp) && opp >= 1.55 && opp <= 1.78) s += 8
  if (finite(btts) && btts >= 1.70) s += 4
  if (ctx.overCap >= 60) s += 6
  return s
}

function scoreDrawOrUnder(odds, ctx) {
  const draw = num(odds.draw_odds)
  const over = num(odds.over25)
  const favTt = num(odds.fav_tt_over25)
  const btts = num(odds.btts_yes)
  if (!drawLive(draw) || !finite(over)) return null
  if (over <= 1.58) return null
  if (ctx.shape === 'HIGH_EVENT_BOTH_SIDES') return null
  let s = 0
  if (draw >= 2.85 && draw <= 4.20) s += 22
  else if (draw >= 2.70 && draw <= 4.80) s += 14
  else s += 6
  if (over >= 1.80 && over <= 2.20) s += 22
  else if (over >= 1.68 && over <= 2.35) s += 14
  else s += 6
  if (ctx.shape === 'CONTROLLED_FAVORITE') s += 14
  if (ctx.shape === 'BTTS_SHAPE') s -= 6
  if (ctx.resultProfile === 'DRAW_RESISTANCE') s += 10
  if (finite(favTt) && favTt >= 2.20) s += 8
  if (finite(btts) && btts >= 1.75) s += 6
  if (ctx.oppProfile === 'COLD' || ctx.oppProfile === 'VERY_COLD') s += 8
  if (ctx.top === 'FAV_WIN' && ctx.runner === 'GG') s += 4
  return s
}

function scoreDrawOrGg(odds, ctx) {
  const draw = num(odds.draw_odds)
  const btts = num(odds.btts_yes)
  const opp = num(odds.opp_tt_over05)
  const over = num(odds.over25)
  if (!drawLive(draw) || !finite(btts)) return null
  if (btts < 1.48 || btts > 2.05) return null
  if (ctx.shape === 'FAV_DOMINATION' && finite(opp) && opp >= 1.70) return null
  if (ctx.oppProfile === 'VERY_COLD' && finite(opp) && opp >= 1.80) return null
  let s = 0
  if (draw >= 3.05 && draw <= 4.60) s += 20
  else if (draw >= 2.80 && draw <= 5.10) s += 12
  else s += 5
  if (btts >= 1.58 && btts <= 1.82) s += 22
  else if (btts >= 1.52 && btts <= 1.95) s += 14
  else s += 6
  if (ctx.shape === 'BTTS_SHAPE' || ctx.shape === 'CONFLICT_ZONE') s += 12
  if (ctx.oppProfile === 'CONFLICT') s += 14
  else if (ctx.oppProfile === 'LIVE') s += 8
  if (ctx.top === 'GG' || ctx.runner === 'GG') s += 8
  if (finite(opp) && opp >= 1.52 && opp <= 1.72) s += 10
  if (finite(over) && over >= 1.60 && over <= 1.90) s += 4
  if (ctx.ggCap >= 58 && ctx.ggCap < 82) s += 6
  return s
}

export function chooseGoalsCombo(odds, v4 = {}, caps = null) {
  if (v4?.finalPick && v4.finalPick !== 'SKIP') return null
  if (!comboSkipEligible(v4?.reasonCode)) return null

  const ctx = {
    shape: v4?.matchShape || null,
    resultProfile: v4?.resultProfile || null,
    oppProfile: v4?.opponentGoalProfile || null,
    top: v4?.topMarket || v4?.provisionalPick || null,
    runner: v4?.runnerUp || null,
    overCap: caps?.over25?.score ?? 0,
    ggCap: caps?.gg?.score ?? 0
  }

  const ranked = [
    {route: 'DRAW_OR_OVER_25', s: scoreDrawOrOver(odds, ctx)},
    {route: 'DRAW_OR_UNDER_25', s: scoreDrawOrUnder(odds, ctx)},
    {route: 'DRAW_OR_GG', s: scoreDrawOrGg(odds, ctx)}
  ].filter(row => row.s != null && row.s >= FLOOR)
    .sort((a, b) => b.s - a.s)

  if (!ranked.length) return null
  const top = ranked[0]
  const second = ranked[1] || null
  if (second && top.s - second.s < SEPARATION) return null

  const published = publishedCombo(top.route, odds)
  if (!published) return null

  return {
    route: top.route,
    score: top.s,
    runnerUp: second?.route || null,
    separation: second ? top.s - second.s : top.s,
    scores: Object.fromEntries(ranked.map(row => [row.route, row.s])),
    published,
    reasonCode: comboReason(top.route, ctx),
    userWhy: comboWhy(top.route, ctx, odds)
  }
}

function comboReason(route, ctx) {
  if (route === 'DRAW_OR_OVER_25') return 'COMBO_DRAW_OR_OVER'
  if (route === 'DRAW_OR_UNDER_25') return 'COMBO_DRAW_OR_UNDER'
  if (route === 'DRAW_OR_GG') return ctx.oppProfile === 'CONFLICT' ? 'COMBO_UNSURE_CONTRIBUTION' : 'COMBO_DRAW_OR_GG'
  return 'COMBO'
}

function comboWhy(route, ctx, odds) {
  const draw = finite(odds?.draw_odds) ? Number(odds.draw_odds).toFixed(2) : 'n/a'
  if (route === 'DRAW_OR_OVER_25') {
    return `No single Goals route separated cleanly, so Draw or Over 2.5 is the cover. Draw is live at ${draw}. The match either stays level or opens into three-plus goals. A 1-0 / 2-0 is the losing shape.`
  }
  if (route === 'DRAW_OR_UNDER_25') {
    return `No single Goals route separated cleanly, so Draw or Under 2.5 is the cover. Draw is live at ${draw}. The match is priced tight; the losing shape is a decisive 2-1 / 3-0.`
  }
  return `No single Goals route separated cleanly, so Draw or GG is the cover. Draw is live at ${draw}. If a team contributes a goal the GG leg lands; if nobody breaks through, the draw still wins. A clean-sheet win is the losing shape.`
}

export function comboWins(route, home, away) {
  const h = Number(home), a = Number(away)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  const draw = h === a
  const total = h + a
  if (route === 'DRAW_OR_OVER_25' || route === 'draw-or-over-25') return draw || total > 2.5
  if (route === 'DRAW_OR_UNDER_25' || route === 'draw-or-under-25') return draw || total < 2.5
  if (route === 'DRAW_OR_GG' || route === 'draw-or-gg') return draw || (h > 0 && a > 0)
  return null
}
