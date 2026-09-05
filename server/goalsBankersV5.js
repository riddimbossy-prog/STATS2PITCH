// Goals Bankers V5 — strict side-entry ladder with table and goals overrides.
import {
  MARKET_LABEL as V4_LABEL,
  classifyMatchType,
  classifyResultProfile,
  classifyFavGoalProfile,
  classifyOppGoalProfile,
  classifyMatchShape,
  evaluateTwoInARowMarket as evaluateV4,
  statsFromFixture
} from './goalsBankersV4.js'

export const ENGINE_ID='goals-bankers-v5.4'
export const ENGINE_LABEL='Goals Bankers V5'
export const MARKET_LABEL={...V4_LABEL,FAV_WIN:'Qualified team win',FAV_DNB:'Qualified team draw no bet',FAV_2PLUS:'Qualified team 2+'}
export const V5_RULES=Object.freeze({
  homeEntryOver25Max:2.10,
  awayEntryOver25Max:2.10,
  winOddsExclusiveMax:1.58,
  winPpgMin:2.00,
  opponentOver05WinMin:1.60,
  homeOver25OpponentOver05Max:1.50,
  awayOver25OpponentOver05Max:1.30,
  topN:5,
  bottomN:3,
  straightWinTopN:3,
  ggTeamOver05Max:1.30,
  ggTeamOver05MaxGap:0.10,
  ggDrawMin:3.60
})

export {classifyMatchType,classifyResultProfile,classifyFavGoalProfile,classifyOppGoalProfile,classifyMatchShape,statsFromFixture}

const ROUTES=['FAV_WIN','FAV_DNB','FAV_2PLUS','OVER_2.5','GG']
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const fmt=v=>finite(v)?Number(v).toFixed(2):'missing'
const atMost=(v,n)=>finite(v)&&Number(v)<=n

function tableRow(fixture,side){
  const overall=fixture?.[`${side}Standing`]||{}
  const fallback=fixture?.[`${side}Split`]||{}
  return{
    position:num(overall.position??fallback.position),
    size:num(overall.size??fallback.size)
  }
}
function sidePpg(fixture,side){return num(fixture?.[`${side}Split`]?.ppg)}
function top(row,n=V5_RULES.topN){return finite(row?.position)&&Number(row.position)<=n}
function bottom(row){return finite(row?.position)&&finite(row?.size)&&Number(row.position)>Number(row.size)-V5_RULES.bottomN}
function mid(row){return finite(row?.position)&&finite(row?.size)&&Number(row.position)>V5_RULES.topN&&Number(row.position)<=Number(row.size)-V5_RULES.bottomN}

function skip(reasonCode,extra={}){
  return finish('SKIP',reasonCode,{...extra,reason:extra.reason||'No V5 route cleared every hard rule.'})
}
function finish(route,reasonCode,extra={}){
  const scores=Object.fromEntries(ROUTES.map(id=>[id,id===route?100:null]))
  return{
    engine:ENGINE_ID,
    eligible:route!=='SKIP',
    finalPick:route,
    provisionalPick:route,
    reasonCode,
    reason:extra.reason||reasonCode,
    userWhy:extra.userWhy||extra.reason||reasonCode,
    matchType:extra.matchType||null,
    matchShape:extra.matchShape||null,
    scores,
    eligibleMarkets:route==='SKIP'?[]:[route],
    topMarket:route==='SKIP'?null:route,
    runnerUp:null,
    separation:route==='SKIP'?null:100,
    capabilitySeparation:null,
    borderline:false,
    highBorderline:false,
    bankerClass:route==='SKIP'?'SKIP':'V5_STRICT',
    capabilities:extra.capabilities||null,
    veto:null,
    ...extra
  }
}

export function ggV5Gate(raw,legacy){
  const home=num(raw?.homeO05),away=num(raw?.awayO05),draw=num(raw?.draw_odds)
  const bothShort=atMost(home,V5_RULES.ggTeamOver05Max)&&atMost(away,V5_RULES.ggTeamOver05Max)
  const gap=finite(home)&&finite(away)?Math.abs(home-away):null
  const balanced=gap!==null&&gap<=V5_RULES.ggTeamOver05MaxGap+1e-9
  const drawSafe=finite(draw)&&draw>=V5_RULES.ggDrawMin
  const oldRule=legacy?.finalPick==='GG'
  return{
    ok:oldRule&&bothShort&&balanced&&drawSafe&&finite(raw?.btts_yes),
    oldRule,bothShort,balanced,drawSafe,gap,
    reason:`Old GG ${oldRule?'passed':'failed'}; team Over 0.5 prices are ${fmt(home)} and ${fmt(away)}; gap ${gap===null?'missing':gap.toFixed(2)}; Draw ${fmt(draw)}.`
  }
}

function candidate(raw,fixture,side){
  const home=side==='home'
  const entryPrice=num(home?raw?.homeO25:raw?.awayO25)
  const qualifies=home?atMost(entryPrice,V5_RULES.homeEntryOver25Max):atMost(entryPrice,V5_RULES.awayEntryOver25Max)
  if(!qualifies)return null
  const standing=tableRow(fixture,side)
  return{
    side,
    entryMarket:home?'Home Team Over 2.5':'Away Team Over 2.5',
    entryPrice,
    winOdds:num(home?raw?.homeWin:raw?.awayWin),
    dnbOdds:num(home?raw?.homeDnb:raw?.awayDnb),
    twoPlusOdds:num(home?raw?.homeO15:raw?.awayO15),
    opponentOver05:num(home?raw?.awayO05:raw?.homeO05),
    ppg:sidePpg(fixture,side),
    standing
  }
}

function chooseCandidate(raw,fixture){
  const rows=[candidate(raw,fixture,'home'),candidate(raw,fixture,'away')].filter(Boolean)
  rows.sort((a,b)=>{
    const af=raw?.favourite===a.side?1:0,bf=raw?.favourite===b.side?1:0
    if(af!==bf)return bf-af
    const aw=finite(a.winOdds)?a.winOdds:999,bw=finite(b.winOdds)?b.winOdds:999
    return aw-bw||a.entryPrice-b.entryPrice
  })
  return rows[0]||null
}

function goalDecision(raw,row,reasonCode,extra={}){
  if(!finite(row?.opponentOver05))return skip('MISSING_OPPONENT_OVER_05',{...extra,side:row?.side,reason:'The opponent Over 0.5 price is missing, so V5 cannot resolve the 2+ versus Over 2.5 path.'})
  const overThreshold=row.side==='home'?V5_RULES.homeOver25OpponentOver05Max:V5_RULES.awayOver25OpponentOver05Max
  if(row.opponentOver05<=overThreshold){
    if(!finite(raw?.over25))return skip('MISSING_OVER_25_ODDS',{...extra,side:row.side,reason:'V5 requires Over 2.5 here, but the match Over 2.5 price is missing.'})
    return finish('OVER_2.5',reasonCode,{
      ...extra,side:row.side,entryMarket:row.entryMarket,entryPrice:row.entryPrice,ppg:row.ppg,standing:row.standing,
      goalPath:'OVER_2.5',
      userWhy:`Over 2.5 is the V5 banker. ${row.entryMarket} is ${fmt(row.entryPrice)} and the weaker ${row.side==='home'?'away':'home'} team Over 0.5 is ${fmt(row.opponentOver05)}, at or below the ${overThreshold.toFixed(2)} goals override.`
    })
  }
  if(!finite(row.twoPlusOdds))return skip('MISSING_TEAM_2PLUS_ODDS',{...extra,side:row.side,reason:'The qualified team 2+ price is missing, so V5 skips instead of inventing a market.'})
  return finish('FAV_2PLUS',reasonCode,{
    ...extra,side:row.side,entryMarket:row.entryMarket,entryPrice:row.entryPrice,ppg:row.ppg,standing:row.standing,
    goalPath:'TEAM_2PLUS',
    userWhy:`${row.side==='home'?'Home':'Away'} Team 2+ is the V5 banker. ${row.entryMarket} qualified at ${fmt(row.entryPrice)}, while the straight-win conditions did not all clear and the opponent Over 0.5 price ${fmt(row.opponentOver05)} did not trigger Over 2.5.`
  })
}

export function evaluateTwoInARowMarket(raw,opts={}){
  const fixture=opts.fixture||{}
  const homeTable=tableRow(fixture,'home'),awayTable=tableRow(fixture,'away')
  if(!finite(homeTable.position)||!finite(homeTable.size)||!finite(awayTable.position)||!finite(awayTable.size)){
    return skip('MISSING_TABLE_STANDINGS',{reason:'V5 requires verified overall league positions for both teams.'})
  }
  if(bottom(homeTable)&&bottom(awayTable))return skip('BOTH_BOTTOM_THREE',{reason:'V5 skips every Bottom 3 versus Bottom 3 match.'})
  if(!top(homeTable)&&!top(awayTable))return skip('NEITHER_TOP_FIVE',{reason:'V5 requires at least one team to sit in the overall Top 5.'})

  const legacy=opts.legacyDecision||evaluateV4(raw,{fixtureId:opts.fixtureId,stats:opts.stats,earlySeason:opts.earlySeason,oddsOnly:!opts.stats})
  const gg=ggV5Gate(raw,legacy)
  if(gg.ok){
    return finish('GG','V5_BALANCED_GG',{
      side:raw?.favourite||null,matchType:legacy?.matchType||'BALANCED_GOALS',matchShape:'BALANCED_GG',capabilities:legacy?.capabilities||null,legacyV4:legacy,ggGate:gg,
      userWhy:`GG is the V5 banker. It passed the old GG rules, both team Over 0.5 prices are ${fmt(raw.homeO05)} and ${fmt(raw.awayO05)} (gap ${gg.gap.toFixed(2)}), neither is above 1.30, and Draw odds ${fmt(raw.draw_odds)} are not below 3.60.`
    })
  }

  const row=chooseCandidate(raw,fixture)
  if(!row)return skip('ENTRY_FILTER',{legacyV4:legacy,ggGate:gg,reason:'Neither Home Team Over 2.5 at 2.10 or below nor Away Team Over 2.5 at 2.10 or below qualified.'})
  const bothMid=mid(homeTable)&&mid(awayTable)
  if(bothMid){
    return goalDecision(raw,row,'V5_MID_TABLE_GOALS',{
      matchType:'MID_TABLE_GOALS',matchShape:'MID_TABLE_GOALS',midTableOverride:true,legacyV4:legacy,ggGate:gg,
      reason:'Both teams are mid-table, so V5 ignores the result odds and publishes a goals route.'
    })
  }

  return goalDecision(raw,row,'V5_GOALS_ROUTE',{
    matchType:'V5_GOALS',matchShape:'GOALS',legacyV4:legacy,ggGate:gg,
    reason:`${row.entryMarket} qualified at ${fmt(row.entryPrice)}. Goals Bankers publishes Over 2.5, team 2+ or GG only.`
  })
}
