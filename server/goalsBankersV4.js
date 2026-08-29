// Goals Bankers V4 — capability first, then the V3 bookmaker router.
import {
  classifyMatchType,
  classifyResultProfile,
  classifyFavGoalProfile,
  classifyOppGoalProfile,
  classifyMatchShape,
  MARKET_LABEL as V3_LABEL,
  evaluateTwoInARowMarket as evaluateV3,
  publishedOdds as publishedOddsV3,
  buildAcca as buildAccaV3
} from './goalsBankersV3.js'
import {
  statsFromFixture as deriveStats,
  evaluateCapabilities,
  capabilityBonus,
  capOf
} from './goalsBankersCapability.js'

export const ENGINE_ID = 'goals-bankers-v4'
export const ENGINE_LABEL = 'Goals Bankers V4'
export const MARKET_LABEL = V3_LABEL
export {classifyMatchType, classifyResultProfile, classifyFavGoalProfile, classifyOppGoalProfile, classifyMatchShape}
export {statsFromFixture} from './goalsBankersCapability.js'
export const publishedOdds = publishedOddsV3
export const buildAcca = buildAccaV3

const MARKETS = ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG']
const TIE = {
  FAV_DOMINATION: ['FAV_2PLUS', 'FAV_WIN', 'OVER_2.5', 'GG'],
  HIGH_EVENT_BOTH_SIDES: ['OVER_2.5', 'FAV_2PLUS', 'GG', 'FAV_WIN'],
  BTTS_SHAPE: ['GG', 'OVER_2.5', 'FAV_2PLUS', 'FAV_WIN'],
  CONTROLLED_FAVORITE: ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG'],
  CONFLICT_ZONE: ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG']
}

function asV4(row, extra = {}) {
  const pick = extra.finalPick ?? row.finalPick
  const code = extra.reasonCode ?? row.reasonCode
  return {
    ...row,
    ...extra,
    engine: ENGINE_ID,
    finalPick: pick,
    reasonCode: code,
    userWhy: publicWhy(pick, code, {
      matchShape: extra.matchShape ?? row.matchShape,
      scores: extra.scores ?? row.scores,
      topMarket: extra.topMarket ?? row.topMarket,
      runnerUp: extra.runnerUp ?? row.runnerUp,
      separation: extra.separation ?? row.separation
    })
  }
}

export function publicWhy(pick, reasonCode, ctx) {
  if (pick === 'SKIP') {
    if (reasonCode === 'INSUFFICIENT_SPLIT_SAMPLE') return 'Skip is the V4 result. The venue split sample is too small to prove capability.'
    if (reasonCode === 'LOW_MARKET_SEPARATION' || reasonCode === 'LOW_CAPABILITY_SEPARATION') {
      const a = ctx?.topMarket ? MARKET_LABEL[ctx.topMarket] : 'the top market'
      const b = ctx?.runnerUp ? MARKET_LABEL[ctx.runnerUp] : 'the runner-up'
      return `Skip is the V4 result. ${a} and ${b} are too close. Competing markets must separate before a banker is published.`
    }
    if (reasonCode === 'STREAK_GATE') return 'Skip is the V4 result. 2-in-a-row Yes is outside 1.10–1.50, so the fixture never enters the market router.'
    if (reasonCode === 'INSUFFICIENT_MARKET_DATA') return 'Skip is the V4 result. A required price is missing, and the engine never invents odds.'
    if (String(reasonCode || '').startsWith('VETO_')) return 'Skip is the V4 result. A veto killed the provisional pick — a weak confirmation is not published as a banker.'
    return 'Skip is the V4 result. No eligible market cleared capability and confirmation together.'
  }
  const thesis = pick === 'FAV_WIN'
    ? 'The favourite has a clear result advantage while the opponent scoring expectation is relatively weak. Winning the match is better supported than requiring extra goals.'
    : pick === 'FAV_2PLUS'
      ? 'The strongest signal is the favourite scoring expectation. They are supported to score at least twice even if the final result is less predictable.'
      : pick === 'OVER_2.5'
        ? 'The match has several strong routes to three or more goals. The favourite can produce a large share of the total.'
        : 'Both teams have credible individual scoring signals, making both teams scoring the cleaner market.'
  const beat = ctx?.scores
    ? MARKETS.filter(m => m !== pick).map(m => {
      const s = ctx.scores[m]
      if (s === null || s === undefined) return `${MARKET_LABEL[m]} was structurally ineligible.`
      if (m === ctx.runnerUp && ctx.separation != null) return `${MARKET_LABEL[m]} scored ${s} — ${ctx.separation} behind.`
      return `${MARKET_LABEL[m]} scored ${s}.`
    }).join(' ')
    : ''
  const shape = ctx?.matchShape ? ` Match shape: ${ctx.matchShape}.` : ''
  return `${MARKET_LABEL[pick]} is the V4 banker.${shape} ${thesis}${beat ? ` ${beat}` : ''}`
}

function packStats(opts) {
  if (opts.stats?.favMetrics && opts.stats?.oppMetrics) return opts.stats
  if (opts.fixture && opts.favourite) return deriveStats(opts.fixture, opts.favourite)
  return null
}

export function evaluateTwoInARowMarket(raw, opts = {}) {
  const early = opts.earlySeason === true
  const packed = packStats(opts)
  if (!packed) {
    if (!early && !opts.oddsOnly) {
      const skipped = evaluateV3(raw, opts)
      return asV4(skipped, {
        finalPick: 'SKIP',
        reasonCode: 'INSUFFICIENT_SPLIT_SAMPLE',
        reason: 'INSUFFICIENT_SPLIT_SAMPLE',
        capabilities: null
      })
    }
  } else if (packed.sample < 3 && !early) {
    const skipped = evaluateV3(raw, opts)
    return asV4(skipped, {
      finalPick: 'SKIP',
      reasonCode: 'INSUFFICIENT_SPLIT_SAMPLE',
      reason: 'INSUFFICIENT_SPLIT_SAMPLE',
      capabilities: null
    })
  } else if (packed.sample < 1 && early) {
    const skipped = evaluateV3(raw, opts)
    return asV4(skipped, {
      finalPick: 'SKIP',
      reasonCode: 'INSUFFICIENT_SPLIT_SAMPLE',
      reason: 'INSUFFICIENT_SPLIT_SAMPLE',
      capabilities: null
    })
  }

  const caps = packed
    ? evaluateCapabilities(packed.favMetrics, packed.oppMetrics, packed.favRecentMetrics, packed.oppRecentMetrics)
    : null

  const base = evaluateV3(raw, opts)
  if (base.finalPick === 'SKIP' && ['STREAK_GATE', 'INSUFFICIENT_MARKET_DATA'].includes(base.reasonCode)) {
    return asV4(base, {capabilities: caps})
  }

  const scores = {...base.scores}
  const eligible = new Set(base.eligibleMarkets || [])
  if (caps) {
    for (const market of MARKETS) {
      const cap = capOf(caps, market)
      if (cap < 65) {
        eligible.delete(market)
        scores[market] = null
      } else if (scores[market] != null) {
        scores[market] += capabilityBonus(cap) || 0
      }
    }
    if (caps.favWin.score >= 80 && scores.FAV_WIN != null && raw.fav_odds <= 1.40 && raw.fav_2plus >= 1.50) scores.FAV_WIN += 10
    if (caps.fav2Plus.score >= 80 && scores.FAV_2PLUS != null && raw.fav_2plus <= 1.40 && raw.fav_odds >= 1.45) scores.FAV_2PLUS += 10
    if (caps.over25.score >= 80 && scores['OVER_2.5'] != null && raw.over25 <= 1.55 && raw.btts_yes >= 1.70) scores['OVER_2.5'] += 10
    if (caps.gg.score >= 80 && scores.GG != null && raw.btts_yes <= 1.60 && raw.over25 >= 1.70) scores.GG += 10
    if (caps.favWin.score >= 80 && scores.FAV_WIN != null && base.resultProfile === 'DRAW_RESISTANCE') scores.FAV_WIN -= 10
    if (caps.fav2Plus.score >= 80 && Number(raw.fav_2plus) >= 1.55) { eligible.delete('FAV_2PLUS'); scores.FAV_2PLUS = null }
    if (caps.over25.score >= 80 && Number(raw.over25) >= 1.80) { eligible.delete('OVER_2.5'); scores['OVER_2.5'] = null }
    if (caps.gg.score >= 80 && Number(raw.opp_tt_over05) >= 1.80) { eligible.delete('GG'); scores.GG = null }
  }

  const floor = base.matchShape === 'CONFLICT_ZONE' ? 78 : 70
  const ranked = MARKETS
    .filter(m => scores[m] != null && scores[m] >= floor)
    .map(m => ({m, s: scores[m], cap: caps ? capOf(caps, m) : 70}))
    .sort((a, b) => b.s - a.s || (TIE[base.matchShape] || TIE.CONFLICT_ZONE).indexOf(a.m) - (TIE[base.matchShape] || TIE.CONFLICT_ZONE).indexOf(b.m))

  if (!ranked.length) {
    return asV4(base, {
      scores,
      capabilities: caps,
      eligibleMarkets: [...eligible],
      finalPick: 'SKIP',
      provisionalPick: 'SKIP',
      reasonCode: base.matchShape === 'CONFLICT_ZONE' ? 'CONFLICT_NO_CONFIRMATION' : 'BELOW_FLOOR',
      reason: 'Signals do not satisfy the minimum confirmation rules.',
      topMarket: null,
      runnerUp: null,
      separation: null
    })
  }

  const top = ranked[0]
  const second = ranked[1] || null
  const separation = second ? top.s - second.s : top.s
  const capSep = second && caps ? top.cap - second.cap : (caps ? top.cap : null)
  if (second && (separation <= 5 || (separation <= 7 && capSep != null && capSep <= 5))) {
    return asV4(base, {
      scores,
      capabilities: caps,
      eligibleMarkets: [...eligible],
      finalPick: 'SKIP',
      provisionalPick: top.m,
      reasonCode: separation <= 5 ? 'LOW_MARKET_SEPARATION' : 'LOW_CAPABILITY_SEPARATION',
      reason: 'LOW_MARKET_SEPARATION',
      topMarket: top.m,
      runnerUp: second.m,
      separation
    })
  }

  let final = top.m
  let veto = null
  if (caps && capOf(caps, final) < 65) { veto = 'V7'; final = 'SKIP' }
  const highBorderline = Boolean(second && separation >= 6 && separation <= 7)
  const borderline = Boolean(highBorderline || (second && separation >= 8 && separation <= 11) || (caps && capOf(caps, top.m) >= 65 && capOf(caps, top.m) <= 69))
  const capScore = caps ? capOf(caps, top.m) : 0
  const bankerClass = final === 'SKIP' ? 'SKIP'
    : (capScore >= 85 && top.s >= 90 && separation >= 12) ? 'ELITE'
      : (capScore >= 75 && top.s >= 82 && separation >= 10) ? 'STRONG'
        : (capScore >= 65 && top.s >= 70 && separation >= 8) ? 'STANDARD'
          : 'BORDERLINE'

  const reasonCode = final === 'SKIP' && veto ? `VETO_${veto}`
    : final === 'FAV_2PLUS' ? 'FAVORITE_SCORING_DOMINANCE'
      : final === 'FAV_WIN' ? 'RESULT_DOMINANCE'
        : final === 'OVER_2.5' ? 'HIGH_EVENT_OVER'
          : final === 'GG' ? 'BTTS_SHAPE_GG'
            : 'SKIP'

  return asV4(base, {
    scores,
    capabilities: caps,
    eligibleMarkets: [...eligible],
    topMarket: top.m,
    runnerUp: second?.m || null,
    separation,
    capabilitySeparation: capSep,
    borderline,
    highBorderline,
    bankerClass,
    provisionalPick: top.m,
    veto,
    finalPick: final,
    reasonCode,
    reason: base.reason
  })
}
