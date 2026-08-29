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
