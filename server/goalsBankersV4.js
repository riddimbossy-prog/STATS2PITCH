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
export const MARKET_LABEL = {
  ...V3_LABEL,
  DRAW_OR_OVER_25: 'Draw or Over 2.5',
  DRAW_OR_UNDER_25: 'Draw or Under 2.5',
  DRAW_OR_GG: 'Draw or GG'
}
export {classifyMatchType, classifyResultProfile, classifyFavGoalProfile, classifyOppGoalProfile, classifyMatchShape}
export {statsFromFixture} from './goalsBankersCapability.js'
export const publishedOdds = publishedOddsV3
export const buildAcca = buildAccaV3

const MARKETS = ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG']
const TIE = {
  FAV_DOMINATION: ['FAV_2PLUS', 'FAV_WIN', 'OVER_2.5', 'GG'],
  HIGH_EVENT_BOTH_SIDES: ['OVER_2.5', 'FAV_2PLUS', 'GG', 'FAV_WIN'],
  BTTS_SHAPE: ['GG', 'OVER_2.5', 'FAV_2PLUS', 'GG', 'FAV_WIN'],
  CONTROLLED_FAVORITE: ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG'],
  CONFLICT_ZONE: ['FAV_WIN', 'FAV_2PLUS', 'OVER_2.5', 'GG']
}
