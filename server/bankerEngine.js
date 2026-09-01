import {FINISHED} from './config.js'
import {isSrlMatch} from './redFlags.js'

export const BANKER_ENGINE='banker-totals-v1'
export const BANKER_RULES=Object.freeze({
  boardTeamOver25Max:2.05,
  oppOver05FavWinMin:1.70,
  oppTeamTotalOver25Max:1.50,
  under35Fav2PlusMin:1.60,
  bothTeamTotalMax:1.30,
  drawOrOver25MatchMax:1.50,
  drawOrOver25TypicalMax:1.35,
  streakNoMin:1.20,
  streakNoMax:1.40,
  over15Max:1.30,
  streakUnder35Min:1.40,
  minPublishOdds:1.20,
  ggYesMax:1.50,
  gg2NoMin:1.30,
  topFive:5,
  bottomFour:4,
  formSample:5,
  formAvgSample:15,
  formMinPct:60,
  formAvgMinPct:60
})
