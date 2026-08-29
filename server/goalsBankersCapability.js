// V4 team-capability layer. Bookmaker scoring must not revive a failed market.
export const CAP_ELITE = 85
export const CAP_STRONG = 75
export const CAP_ACCEPTABLE = 65
export const CAP_BORDERLINE = 55

const FINISHED = new Set(['FT', 'AET', 'PEN'])
const pct = (part, total) => (total > 0 ? part / total : 0)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const band = (value, rows) => {
  for (const [min, pts] of rows) if (value >= min) return pts
  return 0
}

export function capabilityStatus(score, forced) {
  if (forced) return forced
  if (score >= 85) return 'ELITE'
  if (score >= 75) return 'STRONG'
  if (score >= 65) return 'ACCEPTABLE'
  if (score >= 55) return 'BORDERLINE'
  return 'INELIGIBLE'
}

export function emptyTeamMetrics() {
  return {
    matches: 0, winRate: 0, lossRate: 0, ppg: 0, avgGf: 0, avgGa: 0,
    scoringRate: 0, cleanSheetRate: 0, score2Rate: 0, concede2Rate: 0,
    over25Rate: 0, bttsRate: 0
  }
}

export function metricsFromCounts(c = {}) {
  const m = Number(c.matches || 0)
  const wins = Number(c.wins || 0)
  const draws = Number(c.draws || 0)
  return {
    matches: m,
    winRate: pct(wins, m),
    lossRate: pct(Number(c.losses || 0), m),
    ppg: m ? ((wins * 3) + draws) / m : 0,
    avgGf: m ? Number(c.gf || 0) / m : 0,
    avgGa: m ? Number(c.ga || 0) / m : 0,
    scoringRate: pct(Number(c.scoredMatches || 0), m),
    cleanSheetRate: pct(Number(c.cleanSheets || 0), m),
    score2Rate: pct(Number(c.scored2 || 0), m),
    concede2Rate: pct(Number(c.conceded2 || 0), m),
    over25Rate: pct(Number(c.over25 || 0), m),
    bttsRate: pct(Number(c.btts || 0), m)
  }
}

export function blendMetrics(recent, base) {
  if (!recent || recent.matches < 1) return base
  if (!base || base.matches < 1) return recent
  const keys = ['winRate','lossRate','ppg','avgGf','avgGa','scoringRate','cleanSheetRate','score2Rate','concede2Rate','over25Rate','bttsRate']
  const out = { ...base, matches: base.matches }
  for (const key of keys) out[key] = recent[key] * 0.6 + base[key] * 0.4
  return out
}

export function countVenueSplit(fixtures, teamId, venue, limit = 10) {
  const rows = (fixtures || [])
    .filter(f => {
      if (!FINISHED.has(String(f?.fixture?.status?.short || '').toUpperCase())) return false
      const hid = String(f?.teams?.home?.id ?? '')
      const aid = String(f?.teams?.away?.id ?? '')
      return venue === 'home' ? hid === String(teamId) : aid === String(teamId)
    })
    .sort((a, b) => Date.parse(b?.fixture?.date || 0) - Date.parse(a?.fixture?.date || 0))
    .slice(0, limit)
  const counts = { matches:0,wins:0,draws:0,losses:0,gf:0,ga:0,scoredMatches:0,cleanSheets:0,scored2:0,conceded2:0,over25:0,btts:0 }
  for (const f of rows) {
    const h = Number(f?.goals?.home), a = Number(f?.goals?.away)
    if (!Number.isFinite(h) || !Number.isFinite(a)) continue
    const own = venue === 'home' ? h : a
    const opp = venue === 'home' ? a : h
    counts.matches++
    counts.gf += own
    counts.ga += opp
    if (own > opp) counts.wins++
    else if (own < opp) counts.losses++
    else counts.draws++
    if (own > 0) counts.scoredMatches++
    if (opp === 0) counts.cleanSheets++
    if (own >= 2) counts.scored2++
    if (opp >= 2) counts.conceded2++
    if (own + opp > 2.5) counts.over25++
    if (own > 0 && opp > 0) counts.btts++
  }
  return counts
}

export function statsFromFixture(fixture, favourite) {
  const favVenue = favourite === 'away' ? 'away' : 'home'
  const oppVenue = favourite === 'away' ? 'home' : 'away'
  const favTeam = favourite === 'away' ? fixture?.away : fixture?.home
  const oppTeam = favourite === 'away' ? fixture?.home : fixture?.away
  const favFix = favTeam?.fixtures || favTeam?.lastMatches || []
  const oppFix = oppTeam?.fixtures || oppTeam?.lastMatches || []
  const favBase = countVenueSplit(favFix, favTeam?.id, favVenue, 10)
  const oppBase = countVenueSplit(oppFix, oppTeam?.id, oppVenue, 10)
  const favRecent = countVenueSplit(favFix, favTeam?.id, favVenue, 5)
  const oppRecent = countVenueSplit(oppFix, oppTeam?.id, oppVenue, 5)
  return {
    favBase, oppBase, favRecent, oppRecent,
    favMetrics: blendMetrics(metricsFromCounts(favRecent), metricsFromCounts(favBase)),
    oppMetrics: blendMetrics(metricsFromCounts(oppRecent), metricsFromCounts(oppBase)),
    favRecentMetrics: metricsFromCounts(favRecent),
    oppRecentMetrics: metricsFromCounts(oppRecent),
    sample: Math.min(favBase.matches, oppBase.matches),
    recentSample: Math.min(favRecent.matches, oppRecent.matches)
  }
}

export function scoreFavWinCapability(fav, opp) {
  let s = 0
  s += band(fav.winRate, [[0.8,25],[0.7,21],[0.6,16],[0.5,8]])
  s += band(fav.ppg, [[2.4,20],[2.1,17],[1.8,13],[1.5,6]])
  s += band(opp.lossRate, [[0.7,18],[0.6,15],[0.5,11],[0.4,7]])
  if (opp.ppg <= 0.7) s += 15
  else if (opp.ppg <= 0.9) s += 12
  else if (opp.ppg <= 1.2) s += 8
  else if (opp.ppg <= 1.4) s += 3
  s += band(fav.scoringRate, [[0.9,10],[0.8,8],[0.7,4]])
  if (opp.avgGf <= 0.8) s += 8
  else if (opp.avgGf <= 1) s += 6
  else if (opp.avgGf <= 1.2) s += 3
  if (opp.scoringRate <= 0.6) s += 4
  return s
}

export function scoreFav2PlusCapability(fav, opp) {
  let s = 0
  s += band(fav.score2Rate, [[0.8,30],[0.7,26],[0.6,21],[0.5,13],[0.4,5]])
  s += band(fav.avgGf, [[2.4,20],[2.0,17],[1.7,13],[1.4,6]])
  s += band(fav.scoringRate, [[0.9,12],[0.8,9],[0.7,5]])
  s += band(opp.concede2Rate, [[0.7,22],[0.6,18],[0.5,13],[0.4,8]])
  s += band(opp.avgGa, [[2.0,16],[1.7,13],[1.5,9],[1.2,4]])
  return s
}

export function scoreOver25Capability(fav, opp) {
  let s = 0
  s += band(fav.over25Rate, [[0.8,20],[0.7,17],[0.6,14],[0.5,8]])
  s += band(opp.over25Rate, [[0.8,20],[0.7,17],[0.6,14],[0.5,8]])
  const combined = (fav.avgGf + fav.avgGa + opp.avgGf + opp.avgGa) / 2
  s += band(combined, [[3.4,22],[3.0,18],[2.7,14],[2.4,7]])
  s += band(fav.avgGf, [[2.0,12],[1.7,9],[1.4,4]])
  s += band(opp.avgGf, [[1.5,10],[1.3,7],[1.1,4]])
  if (opp.avgGa >= 1.7) s += 8
  if (fav.avgGa >= 1.3) s += 5
  return s
}

export function scoreGgCapability(fav, opp) {
  let s = 0
  s += band(fav.scoringRate, [[0.9,18],[0.8,15],[0.7,10],[0.6,5]])
  s += band(opp.scoringRate, [[0.9,22],[0.8,19],[0.7,15],[0.6,8]])
  s += band(fav.bttsRate, [[0.8,15],[0.7,12],[0.6,9],[0.5,4]])
  s += band(opp.bttsRate, [[0.8,15],[0.7,12],[0.6,9],[0.5,4]])
  if (fav.avgGa >= 1.5) s += 10
  else if (fav.avgGa >= 1.2) s += 8
  else if (fav.avgGa >= 0.9) s += 4
  if (opp.avgGa >= 1.7) s += 10
  else if (opp.avgGa >= 1.4) s += 8
  else if (opp.avgGa >= 1.0) s += 4
  if (fav.cleanSheetRate <= 0.4) s += 5
  if (opp.cleanSheetRate <= 0.4) s += 5
  return s
}

function applySpike(score, recent, base, supports) {
  if (recent == null || base == null || !supports) return score
  if (recent >= base + 0.3 && base < 0.6) return score - 5
  if (recent <= base - 0.3) return score - 8
  return score
}

export function evaluateCapabilities(fav, opp, recentFav, recentOpp) {
  let win = scoreFavWinCapability(fav, opp)
  let two = scoreFav2PlusCapability(fav, opp)
  let over = scoreOver25Capability(fav, opp)
  let gg = scoreGgCapability(fav, opp)
  const flags = { spike: false, collapse: false }
  const note = (r, b) => {
    if (r == null || b == null) return
    if (r >= b + 0.3) flags.spike = true
    if (r <= b - 0.3) flags.collapse = true
  }
  if (recentFav) {
    note(recentFav.winRate, fav.winRate)
    note(recentFav.score2Rate, fav.score2Rate)
    note(recentFav.over25Rate, fav.over25Rate)
    note(recentFav.bttsRate, fav.bttsRate)
    note(recentFav.scoringRate, fav.scoringRate)
    win = applySpike(win, recentFav.winRate, fav.winRate, true)
    two = applySpike(two, recentFav.score2Rate, fav.score2Rate, true)
    over = applySpike(over, recentFav.over25Rate, fav.over25Rate, true)
    gg = applySpike(gg, recentFav.bttsRate, fav.bttsRate, true)
  }
  if (recentOpp) {
    note(recentOpp.over25Rate, opp.over25Rate)
    note(recentOpp.bttsRate, opp.bttsRate)
    note(recentOpp.scoringRate, opp.scoringRate)
  }
  let winStatus = null
  if (fav.winRate < 0.6) {
    if (fav.ppg >= 2.2 && opp.lossRate >= 0.7 && opp.ppg <= 0.8) {
      win = Math.min(win, 64)
      winStatus = 'BORDERLINE'
    } else {
      win = Math.min(win, 54)
      winStatus = 'INELIGIBLE'
    }
  }
  if (fav.score2Rate < 0.5 && opp.concede2Rate < 0.5) two = Math.min(two, 54)
  if (fav.avgGf < 1.4) two = Math.min(two, 54)
  if (fav.over25Rate < 0.5 && opp.over25Rate < 0.5 && fav.avgGf < 2.0) over = Math.min(over, 54)
  if (fav.scoringRate < 0.6 || opp.scoringRate < 0.6) gg = Math.min(gg, 54)
  if (fav.avgGf < 1.0 || opp.avgGf < 0.8) gg = Math.min(gg, 54)
  win = clamp(Math.round(win), 0, 100)
  two = clamp(Math.round(two), 0, 100)
  over = clamp(Math.round(over), 0, 100)
  gg = clamp(Math.round(gg), 0, 100)
  const bothSide = fav.scoringRate >= 0.7 && opp.scoringRate >= 0.7 && fav.over25Rate >= 0.6 && opp.over25Rate >= 0.6
  return {
    favWin: { score: win, status: capabilityStatus(win, winStatus) },
    fav2Plus: { score: two, status: capabilityStatus(two, two <= 54 ? 'INELIGIBLE' : null) },
    over25: { score: over, status: capabilityStatus(over, over <= 54 ? 'INELIGIBLE' : null) },
    gg: { score: gg, status: capabilityStatus(gg, gg <= 54 ? 'INELIGIBLE' : null) },
    overShapeStat: fav.avgGf >= 2.2 && fav.score2Rate >= 0.7 ? 'FAVORITE_DRIVEN_OVER' : bothSide ? 'BOTH_SIDE_OVER' : 'MIXED_OVER',
    recentSpike: flags.spike,
    recentCollapse: flags.collapse
  }
}

export function capabilityBonus(cap) {
  if (cap >= 85) return 20
  if (cap >= 75) return 14
  if (cap >= 65) return 7
  return null
}

export function capOf(caps, market) {
  if (market === 'FAV_WIN') return caps.favWin.score
  if (market === 'FAV_2PLUS') return caps.fav2Plus.score
  if (market === 'OVER_2.5') return caps.over25.score
  return caps.gg.score
}
