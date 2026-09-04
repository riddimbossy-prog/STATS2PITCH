/** Perfect Split v1
 *
 * Replaces Filter Tips. Scans last-5 venue form (home team at home, away team
 * away). A market publishes only when BOTH sides post a perfect 5/5 on that
 * market — the opponent must consent.
 *
 * Result markets are complementary:
 *   Home Win  = home 5/5 wins   AND away 5/5 losses
 *   1X        = home 5/5 unbeaten AND away 5/5 winless
 */

export const ENGINE_ID = 'perfect-split-v1'
export const ENGINE_LABEL = 'Perfect Split'
export const SPLIT_SAMPLE = 5

export const MARKETS = Object.freeze([
  {
    id: 'home-win', family: 'Result', marketKey: 'match-winner', selection: 'Home',
    display: 'Home Win', route: 'straight-win', favourite: 'home', priority: 10,
    homeStat: p => p.wins, awayStat: p => p.losses,
    homeLabel: 'Wins at home', awayLabel: 'Losses away', need: SPLIT_SAMPLE
  },
  {
    id: 'away-win', family: 'Result', marketKey: 'match-winner', selection: 'Away',
    display: 'Away Win', route: 'straight-win', favourite: 'away', priority: 20,
    homeStat: p => p.losses, awayStat: p => p.wins,
    homeLabel: 'Losses at home', awayLabel: 'Wins away', need: SPLIT_SAMPLE
  },
  {
    id: 'over-25', family: 'Goals', marketKey: 'total-goals', selection: 'Over 2.5',
    display: 'Over 2.5', route: 'over-25', favourite: null, priority: 30,
    homeStat: p => p.over25, awayStat: p => p.over25,
    homeLabel: 'Over 2.5 at home', awayLabel: 'Over 2.5 away', need: SPLIT_SAMPLE
  },
  {
    id: 'under-25', family: 'Goals', marketKey: 'total-goals', selection: 'Under 2.5',
    display: 'Under 2.5', route: 'under-25', favourite: null, priority: 40,
    homeStat: p => p.under25, awayStat: p => p.under25,
    homeLabel: 'Under 2.5 at home', awayLabel: 'Under 2.5 away', need: SPLIT_SAMPLE
  },
  {
    id: 'btts-yes', family: 'BTTS', marketKey: 'both-teams-score', selection: 'Yes',
    display: 'BTTS Yes', route: 'gg', favourite: null, priority: 50,
    homeStat: p => p.btts, awayStat: p => p.btts,
    homeLabel: 'BTTS at home', awayLabel: 'BTTS away', need: SPLIT_SAMPLE
  },
  {
    id: 'btts-no', family: 'BTTS', marketKey: 'both-teams-score', selection: 'No',
    display: 'BTTS No', route: 'btts-no', favourite: null, priority: 60,
    homeStat: p => p.noBtts, awayStat: p => p.noBtts,
    homeLabel: 'BTTS No at home', awayLabel: 'BTTS No away', need: SPLIT_SAMPLE
  },
  {
    id: 'home-over-15', family: 'Team', marketKey: 'home-team-goals', selection: 'Over 1.5',
    display: 'Home Over 1.5', route: 'home-over-15', favourite: null, priority: 70,
    homeStat: p => p.scored2, awayStat: p => p.conceded2,
    homeLabel: 'Scored 2+ at home', awayLabel: 'Conceded 2+ away', need: SPLIT_SAMPLE
  },
  {
    id: 'away-over-15', family: 'Team', marketKey: 'away-team-goals', selection: 'Over 1.5',
    display: 'Away Over 1.5', route: 'away-over-15', favourite: null, priority: 80,
    homeStat: p => p.conceded2, awayStat: p => p.scored2,
    homeLabel: 'Conceded 2+ at home', awayLabel: 'Scored 2+ away', need: SPLIT_SAMPLE
  },
  {
    id: 'over-15', family: 'Goals', marketKey: 'total-goals', selection: 'Over 1.5',
    display: 'Over 1.5', route: 'over-15', favourite: null, priority: 90,
    homeStat: p => p.over15, awayStat: p => p.over15,
    homeLabel: 'Over 1.5 at home', awayLabel: 'Over 1.5 away', need: SPLIT_SAMPLE
  },
  {
    id: 'under-35', family: 'Goals', marketKey: 'total-goals', selection: 'Under 3.5',
    display: 'Under 3.5', route: 'under-35', favourite: null, priority: 100,
    homeStat: p => p.under35, awayStat: p => p.under35,
    homeLabel: 'Under 3.5 at home', awayLabel: 'Under 3.5 away', need: SPLIT_SAMPLE
  },
  {
    id: 'dc-1x', family: 'Result', marketKey: 'double-chance', selection: '1X',
    display: 'Double Chance 1X', route: 'double-chance', favourite: null, priority: 85,
    homeStat: p => p.unbeaten, awayStat: p => p.winless,
    homeLabel: 'Unbeaten at home', awayLabel: 'Winless away', need: SPLIT_SAMPLE
  },
  {
    id: 'dc-x2', family: 'Result', marketKey: 'double-chance', selection: 'X2',
    display: 'Double Chance X2', route: 'double-chance', favourite: null, priority: 86,
    homeStat: p => p.winless, awayStat: p => p.unbeaten,
    homeLabel: 'Winless at home', awayLabel: 'Unbeaten away', need: SPLIT_SAMPLE
  },
  {
    id: 'home-score', family: 'Team', marketKey: 'home-team-goals', selection: 'Over 0.5',
    display: 'Home to Score', route: 'home-score', favourite: null, priority: 130,
    homeStat: p => p.scored, awayStat: p => p.conceded,
    homeLabel: 'Scored at home', awayLabel: 'Conceded away', need: SPLIT_SAMPLE
  },
  {
    id: 'away-score', family: 'Team', marketKey: 'away-team-goals', selection: 'Over 0.5',
    display: 'Away to Score', route: 'away-score', favourite: null, priority: 140,
    homeStat: p => p.conceded, awayStat: p => p.scored,
    homeLabel: 'Conceded at home', awayLabel: 'Scored away', need: SPLIT_SAMPLE
  }
])

export function profileOf(games){
  const rows = (games || []).slice(0, SPLIT_SAMPLE)
  const sample = rows.length
  const count = test => rows.filter(test).length
  const wins = count(g => g.gf > g.ga)
  const draws = count(g => g.gf === g.ga)
  const losses = count(g => g.gf < g.ga)
  const form = rows.map(g => g.gf > g.ga ? 'W' : g.gf < g.ga ? 'L' : 'D').join('')
  return {
    sample,
    ready: sample >= SPLIT_SAMPLE,
    wins,
    draws,
    losses,
    unbeaten: wins + draws,
    winless: draws + losses,
    over15: count(g => g.gf + g.ga > 1.5),
    over25: count(g => g.gf + g.ga > 2.5),
    under25: count(g => g.gf + g.ga < 2.5),
    under35: count(g => g.gf + g.ga < 3.5),
    btts: count(g => g.gf > 0 && g.ga > 0),
    noBtts: count(g => g.gf === 0 || g.ga === 0),
    scored: count(g => g.gf > 0),
    blank: count(g => g.gf === 0),
    scored2: count(g => g.gf >= 2),
    conceded: count(g => g.ga > 0),
    cleanSheets: count(g => g.ga === 0),
    conceded2: count(g => g.ga >= 2),
    gf: rows.reduce((s, g) => s + g.gf, 0),
    ga: rows.reduce((s, g) => s + g.ga, 0),
    form,
    games: rows
  }
}

export function consentRows(home, away){
  return MARKETS.map(m => {
    const homeHits = m.homeStat(home)
    const awayHits = m.awayStat(away)
    const homeOk = home.ready && homeHits >= m.need
    const awayOk = away.ready && awayHits >= m.need
    const consented = homeOk && awayOk
    const nearMiss = !consented
      && home.ready && away.ready
      && ((homeHits >= m.need - 1 && awayHits >= m.need - 1)
        || (homeOk && awayHits === m.need - 1)
        || (awayOk && homeHits === m.need - 1))
    return {
      id: m.id,
      display: m.display,
      family: m.family,
      homeHits,
      awayHits,
      need: m.need,
      homeOk,
      awayOk,
      consented,
      nearMiss,
      homeLabel: m.homeLabel,
      awayLabel: m.awayLabel
    }
  })
}

export function settleMarket(marketId, score){
  const tot = score.home + score.away
  switch (marketId) {
    case 'home-win': return score.home > score.away ? 'won' : 'lost'
    case 'away-win': return score.away > score.home ? 'won' : 'lost'
    case 'dc-1x': return score.home >= score.away ? 'won' : 'lost'
    case 'dc-x2': return score.away >= score.home ? 'won' : 'lost'
    case 'over-25': return tot > 2.5 ? 'won' : 'lost'
    case 'under-25': return tot < 2.5 ? 'won' : 'lost'
    case 'over-15': return tot > 1.5 ? 'won' : 'lost'
    case 'under-35': return tot < 3.5 ? 'won' : 'lost'
    case 'btts-yes': return score.home > 0 && score.away > 0 ? 'won' : 'lost'
    case 'btts-no': return score.home === 0 || score.away === 0 ? 'won' : 'lost'
    case 'home-over-15': return score.home > 1.5 ? 'won' : 'lost'
    case 'away-over-15': return score.away > 1.5 ? 'won' : 'lost'
    case 'home-score': return score.home > 0 ? 'won' : 'lost'
    case 'away-score': return score.away > 0 ? 'won' : 'lost'
    default: return 'lost'
  }
}

function whyLines(market, fixture, home, away){
  const hn = fixture.home.name
  const an = fixture.away.name
  const lines = [
    `${hn} ${market.homeLabel.toLowerCase()}: ${market.homeStat(home)}/${home.sample} in their last home games.`,
    `${an} ${market.awayLabel.toLowerCase()}: ${market.awayStat(away)}/${away.sample} in their last away games.`,
    `Both sides consent at ${SPLIT_SAMPLE}/${SPLIT_SAMPLE}. Perfect Split publishes ${market.display}.`
  ]
  if (market.id === 'home-win') {
    lines.unshift(`${hn} are unbeaten-with-wins at home; ${an} have lost every recent away game.`)
  } else if (market.id === 'away-win') {
    lines.unshift(`${an} have won every recent away game; ${hn} have lost every recent home game.`)
  } else if (market.id === 'dc-1x') {
    lines.unshift(`${hn} are undefeated in their last ${SPLIT_SAMPLE} home games; ${an} are winless away.`)
  } else if (market.id === 'dc-x2') {
    lines.unshift(`${an} are undefeated in their last ${SPLIT_SAMPLE} away games; ${hn} are winless at home.`)
  }
  return lines
}

export function diagnoseFixture(fixture){
  const homeProfile = profileOf(fixture.home.form)
  const awayProfile = profileOf(fixture.away.form)
  const consents = consentRows(homeProfile, awayProfile)

  if (!homeProfile.ready || !awayProfile.ready) {
    return {fixture, homeProfile, awayProfile, consents, pick: null, skip: 'insufficient-sample'}
  }

  const hits = consents.filter(c => c.consented)
  if (!hits.length) {
    const near = consents.some(c => c.nearMiss)
    return {
      fixture, homeProfile, awayProfile, consents, pick: null,
      skip: near ? 'near-miss-no-consent' : 'no-perfect-consent'
    }
  }

  const chosen = [...hits].sort((a, b) => {
    const pa = MARKETS.find(m => m.id === a.id).priority
    const pb = MARKETS.find(m => m.id === b.id).priority
    return pa - pb
  })[0]
  const market = MARKETS.find(m => m.id === chosen.id)
  const odds = fixture.odds?.[market.id] ?? null
  const outcome = fixture.status === 'ft' && fixture.score
    ? settleMarket(market.id, fixture.score)
    : 'pending'

  const pick = {
    engine: ENGINE_ID,
    fixtureId: fixture.id,
    kickoff: fixture.kickoff,
    league: fixture.league,
    country: fixture.country,
    countryCode: fixture.countryCode,
    home: fixture.home,
    away: fixture.away,
    marketId: market.id,
    marketKey: market.marketKey,
    family: market.family,
    selection: market.selection,
    display: market.display,
    route: market.route,
    favourite: market.favourite,
    odds,
    status: fixture.status,
    score: fixture.score,
    minute: fixture.minute,
    homeProfile,
    awayProfile,
    consents,
    why: whyLines(market, fixture, homeProfile, awayProfile),
    outcome
  }

  return {fixture, homeProfile, awayProfile, consents, pick, skip: null}
}

export function scanBoard(fixtures){
  const all = (fixtures || []).map(diagnoseFixture)
  const published = all.map(d => d.pick).filter(Boolean)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.league.localeCompare(b.league))
  const skipped = all.filter(d => !d.pick)
  const skipCounts = skipped.reduce((map, row) => {
    const key = row.skip || 'unknown'
    map[key] = (map[key] || 0) + 1
    return map
  }, {})
  return {
    engine: ENGINE_ID,
    scanned: all.length,
    published,
    skipped,
    all,
    skipCounts,
    nearMisses: skipped.filter(s => s.skip === 'near-miss-no-consent').length
  }
}

export function fixtureDate(iso){
  return String(iso || '').slice(0, 10)
}

export function matchState(pick){
  if (pick.status === 'live') return 'live'
  if (pick.status === 'ft' || pick.outcome === 'won' || pick.outcome === 'lost') return 'settled'
  if (Date.parse(pick.kickoff) <= Date.now()) return 'pending'
  return 'upcoming'
}
