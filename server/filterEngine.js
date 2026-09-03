// Filter Tips V5 safety overlay.
// Keeps the proven V2 router intact, then applies stricter publication gates.
import * as V2 from './filterEngineV2.js'

export const ENGINE_ID=V2.ENGINE_ID
export const FILTER_RULE_VERSION='v5'
export const RULES=Object.freeze({
  ...V2.RULES,
  v5PublicationMinScore:78,
  v5RiskyPublicationMinScore:82,
  v5RiskySeparationMin:10,
  v5Over15Under35HardMin:1.45,
  v5Over15ConditionalUnder35Min:1.50,
  v5Over15StrongRecentMin:80,
  v5Over15ConditionalRecentMin:60,
  v5OneGoalExactOneMin:60,
  v5OneGoalOpponentBlankMin:60,
  v5OneGoalCarrierMin:40,
  v5WinMinPpgGap:0.50,
  v5WinStrongSideMin:80,
  v5WinHighPrice:1.40,
  v5WinHighPriceRecentMin:80,
  v5WinDrawHardMin:3.70,
  v5WinHighPriceDrawMin:4.00,
  v5WinOppGoalDangerMax:1.45,
  v5WinCarrierMin:60,
  v5Under35RecentMin:80,
  v5Under35Over15Min:1.45,
  v5Under35Over25ConflictMax:1.65,
  v5Over25RecentMin:80,
  v5Over25Under35HardMin:1.65,
  v5Over25Under35ConditionalMin:1.70,
  v5Over25CarrierMin:60,
  v5Over25ContributionMin:80,
  v5Under25RecentMin:80,
  v5Under25Over15HardMin:1.65,
  v5Under25TeamGoalPressureMax:1.45,
  v5Under25AvgTotalMax:2.40,
  v5GGRecentMin:80,
  v5GG2NoHardMin:1.35,
  v5GG2NoConditionalMin:1.40,
  v5GGTeamGoalMax:1.55,
  v5DeteriorationHardRatio:0.80
})

export const extractFilterOdds=V2.extractFilterOdds
export const isCupCompetition=V2.isCupCompetition

const FINISHED=new Set(['FT','AET','PEN'])
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const pct=(hits,total)=>total?Math.round((hits*100)/total):null
const avg=values=>values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null

function venueRows(fixtures,teamId,venue,limit=5){
  return (fixtures||[])
    .filter(row=>FINISHED.has(String(row?.fixture?.status?.short||'').toUpperCase()))
    .filter(row=>venue==='home'
      ?String(row?.teams?.home?.id)===String(teamId)
      :String(row?.teams?.away?.id)===String(teamId))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,limit)
}

function scoreFor(row,teamId){
  const h=num(row?.goals?.home),a=num(row?.goals?.away)
  if(h===null||a===null)return null
  if(String(row?.teams?.home?.id)===String(teamId))return{own:h,opp:a,total:h+a}
  if(String(row?.teams?.away?.id)===String(teamId))return{own:a,opp:h,total:h+a}
  return null
}

function goalProfile(fixtures,teamId,venue){
  const rows=venueRows(fixtures,teamId,venue,5)
  const scored=rows.map(row=>scoreFor(row,teamId)).filter(Boolean)
  const total=scored.length
  const count=test=>scored.filter(test).length
  const averageTotal=avg(scored.map(g=>g.total))
  return{
    sample:total,
    over15:pct(count(g=>g.total>=2),total),
    over25:pct(count(g=>g.total>=3),total),
    under25:pct(count(g=>g.total<=2),total),
    under35:pct(count(g=>g.total<=3),total),
    btts:pct(count(g=>g.own>0&&g.opp>0),total),
    wins:pct(count(g=>g.own>g.opp),total),
    draws:pct(count(g=>g.own===g.opp),total),
    losses:pct(count(g=>g.own<g.opp),total),
    scored2Plus:pct(count(g=>g.own>=2),total),
    conceded2Plus:pct(count(g=>g.opp>=2),total),
    scored:pct(count(g=>g.own>=1),total),
    blank:pct(count(g=>g.own===0),total),
    conceded:pct(count(g=>g.opp>=1),total),
    exactOneScored:pct(count(g=>g.own===1),total),
    oneGoalMatch:pct(count(g=>g.total===1),total),
    avgTotal:averageTotal===null?null:+averageTotal.toFixed(2)
  }
}

function directionOf(result){
  const pick=result?.pick
  return result?.direction||{
    recentHome:pick?.recentHome,
    recentAway:pick?.recentAway,
    recentConsensus:pick?.recentConsensus,
    baselineHome:pick?.baselineHome,
    baselineAway:pick?.baselineAway,
    baselineConsensus:pick?.baselineConsensus
  }
}

function deteriorationRatio(recent,baseline){
  if(!finite(recent)||!finite(baseline)||Number(baseline)<=0)return null
  return Number(recent)/Number(baseline)
}

function routeMinScore(route){
  if(route==='over-25'||route==='gg')return RULES.v5RiskyPublicationMinScore
  if(route==='straight-win'||route==='under-25')return 80
  return RULES.v5PublicationMinScore
}

function isRiskyRoute(route){
  return route==='straight-win'||route==='over-25'||route==='under-25'||route==='gg'
}

function commonSafety(fixture,result){
  const pick=result?.pick
  const direction=directionOf(result)
  const homeProfile=goalProfile(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const awayProfile=goalProfile(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const recentHome=num(direction?.recentHome)
  const recentAway=num(direction?.recentAway)
  const baselineHome=num(direction?.baselineHome)
  const baselineAway=num(direction?.baselineAway)
  const minRecent=recentHome!==null&&recentAway!==null?Math.min(recentHome,recentAway):null
  const maxRecent=recentHome!==null&&recentAway!==null?Math.max(recentHome,recentAway):null
  const homeTrend=deteriorationRatio(recentHome,baselineHome)
  const awayTrend=deteriorationRatio(recentAway,baselineAway)
  const severeDeterioration=(homeTrend!==null&&homeTrend<RULES.v5DeteriorationHardRatio)
    ||(awayTrend!==null&&awayTrend<RULES.v5DeteriorationHardRatio)
  const minScore=routeMinScore(pick?.route)
  const score=num(pick?.filterScore)
  const separation=num(pick?.scoreSeparation)
  const missingValidation=homeProfile.sample<5
    ||awayProfile.sample<5
    ||recentHome===null
    ||recentAway===null
    ||score===null
    ||!finite(pick?.consensus)

  const base={
    ok:true,
    rulesVersion:FILTER_RULE_VERSION,
    market:pick?.route||null,
    recent:{home:recentHome,away:recentAway,min:minRecent,max:maxRecent},
    baseline:{home:baselineHome,away:baselineAway},
    trendRatio:{home:homeTrend,away:awayTrend},
    profiles:{home:homeProfile,away:awayProfile},
    score,
    minScore,
    separation
  }

  if(missingValidation)return{...base,ok:false,skip:'v5-missing-validation',reason:'V5 blocked the pick because the full five-match venue validation set or publication score was not available.'}
  if(score<minScore)return{...base,ok:false,skip:'v5-low-publication-score',reason:`V5 requires a publication score of at least ${minScore} for this market.`}
  if(severeDeterioration)return{...base,ok:false,skip:'v5-recent-deterioration',reason:'V5 blocked the pick because recent venue support has fallen below 80% of its longer baseline.'}
  if(isRiskyRoute(pick?.route)&&pick?.runnerUpRoute&&separation!==null&&separation<RULES.v5RiskySeparationMin){
    return{...base,ok:false,skip:'v5-market-separation',reason:`V5 requires at least ${RULES.v5RiskySeparationMin} evidence points of separation for this higher-risk market.`}
  }
  return base
}

function oneGoalTrap(pick,homeProfile,awayProfile){
  const favourite=pick?.favourite
  if(!favourite)return false
  const fav=favourite==='home'?homeProfile:awayProfile
  const opp=favourite==='home'?awayProfile:homeProfile
  return finite(fav?.exactOneScored)
    &&finite(opp?.blank)
    &&finite(fav?.scored2Plus)
    &&fav.exactOneScored>=RULES.v5OneGoalExactOneMin
    &&opp.blank>=RULES.v5OneGoalOpponentBlankMin
    &&fav.scored2Plus<RULES.v5OneGoalCarrierMin
}

function validateOver15(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const homeProfile=common.profiles.home
  const awayProfile=common.profiles.away
  const under35=num(odds?.under35)
  const minRecent=common.recent.min
  const strongRecent=minRecent!==null&&minRecent>=RULES.v5Over15StrongRecentMin
  const conditionalRecent=minRecent!==null&&minRecent>=RULES.v5Over15ConditionalRecentMin
  const trap=oneGoalTrap(pick,homeProfile,awayProfile)
  const base={...common,market:'over-15',under35,strongRecent,conditionalRecent,oneGoalTrap:trap}

  if(under35===null||under35<RULES.v5Over15Under35HardMin)return{...base,ok:false,skip:'v5-over15-market-confirmation',reason:`V5 requires Under 3.5 at ${RULES.v5Over15Under35HardMin.toFixed(2)} or higher before Over 1.5 can publish.`}
  if(!conditionalRecent)return{...base,ok:false,skip:'v5-over15-venue-support',reason:`V5 requires at least ${RULES.v5Over15ConditionalRecentMin}% recent venue support on both sides.`}
  if(!strongRecent&&under35<RULES.v5Over15ConditionalUnder35Min)return{...base,ok:false,skip:'v5-over15-conditional-support',reason:`With a 60% venue side, V5 requires stronger market confirmation: Under 3.5 must be at least ${RULES.v5Over15ConditionalUnder35Min.toFixed(2)}.`}
  if(trap)return{...base,ok:false,skip:'v5-one-goal-trap',reason:'V5 detected a 1-0/0-1 danger shape: the favourite often stops at one while the opponent often blanks.'}
  return{...base,reason:strongRecent?'V5 strong Over 1.5 route: both recent venue supports are at least 80%.':'V5 conditional Over 1.5 route cleared with stronger market confirmation.'}
}

function validateStraightWin(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const favourite=pick?.favourite
  const favProfile=favourite==='home'?common.profiles.home:common.profiles.away
  const oppProfile=favourite==='home'?common.profiles.away:common.profiles.home
  const metrics=pick?.metrics||{}
  const favMetric=favourite==='home'?metrics.home:metrics.away
  const oppMetric=favourite==='home'?metrics.away:metrics.home
  const ppgGap=finite(favMetric?.ppg)&&finite(oppMetric?.ppg)?Number(favMetric.ppg)-Number(oppMetric.ppg):null
  const draw=num(odds?.drawWin)
  const oppO05=favourite==='home'?num(odds?.awayO05):num(odds?.homeO05)
  const favO15=favourite==='home'?num(odds?.homeO15):num(odds?.awayO15)
  const highPrice=Number(pick?.odds)>RULES.v5WinHighPrice
  const base={...common,market:'straight-win',ppgGap,draw,oppO05,favO15,highPrice}

  if(common.recent.max<RULES.v5WinStrongSideMin)return{...base,ok:false,skip:'v5-win-two-sided-support',reason:'V5 requires at least one side of a straight-win matchup to show 80% recent directional support.'}
  if(ppgGap===null||ppgGap<RULES.v5WinMinPpgGap)return{...base,ok:false,skip:'v5-win-ppg-gap',reason:`V5 requires at least a ${RULES.v5WinMinPpgGap.toFixed(2)} venue PPG gap for a straight win.`}
  if(draw!==null&&draw<RULES.v5WinDrawHardMin)return{...base,ok:false,skip:'v5-win-draw-resistance',reason:`V5 blocks straight wins when the draw is shorter than ${RULES.v5WinDrawHardMin.toFixed(2)}.`}
  if(highPrice&&(common.recent.min<RULES.v5WinHighPriceRecentMin||draw===null||draw<RULES.v5WinHighPriceDrawMin)){
    return{...base,ok:false,skip:'v5-win-high-price-risk',reason:`Favorites above ${RULES.v5WinHighPrice.toFixed(2)} require 80% support on both venue sides and draw odds of at least ${RULES.v5WinHighPriceDrawMin.toFixed(2)}.`}
  }
  if(oppO05!==null&&oppO05<=RULES.v5WinOppGoalDangerMax&&favProfile.scored2Plus<RULES.v5WinCarrierMin&&(favO15===null||favO15>1.55)){
    return{...base,ok:false,skip:'v5-win-opponent-goal-danger',reason:'V5 blocked the straight win because the opponent is strongly priced to score and the favourite lacks a reliable two-goal cushion.'}
  }
  if(oppProfile.losses!==null&&oppProfile.losses<60)return{...base,ok:false,skip:'v5-win-opponent-resistance',reason:'V5 requires the opponent to have lost at least 60% of its recent venue matches for a straight-win banker.'}
  return{...base,reason:'V5 straight-win safety cleared: directional support, venue PPG gap and draw resistance all agree.'}
}

function validateUnder35(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const over15=num(odds?.over15)
  const over25=num(odds?.over25)
  const streak=num(odds?.streakYes)
  const streakHot=streak!==null&&streak>=RULES.streakMin&&streak<=RULES.streakMax
  const base={...common,market:'under-35',over15,over25,streak,streakHot}

  if(common.recent.min<RULES.v5Under35RecentMin)return{...base,ok:false,skip:'v5-under35-venue-support',reason:`V5 requires at least ${RULES.v5Under35RecentMin}% recent Under 3.5 support on both venue sides.`}
  if(over15===null||over15<RULES.v5Under35Over15Min)return{...base,ok:false,skip:'v5-under35-market-confirmation',reason:`V5 requires Over 1.5 at ${RULES.v5Under35Over15Min.toFixed(2)} or higher before Under 3.5 can publish.`}
  if(streakHot&&over25!==null&&over25<=RULES.v5Under35Over25ConflictMax)return{...base,ok:false,skip:'v5-under35-high-event-conflict',reason:'V5 blocked Under 3.5 because both the streak market and Over 2.5 price point to a higher-event game.'}
  return{...base,reason:'V5 Under 3.5 safety cleared: both venue profiles show at least 80% control and the market confirms the low ceiling.'}
}

function validateOver25(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const under35=num(odds?.under35)
  const home=common.profiles.home
  const away=common.profiles.away
  const carrier=Math.max(Number(home.scored2Plus||0),Number(away.scored2Plus||0))>=RULES.v5Over25CarrierMin
  const mutualContribution=home.scored>=RULES.v5Over25ContributionMin
    &&away.scored>=RULES.v5Over25ContributionMin
    &&home.conceded>=60
    &&away.conceded>=60
  const base={...common,market:'over-25',under35,carrier,mutualContribution}

  if(common.recent.min<RULES.v5Over25RecentMin)return{...base,ok:false,skip:'v5-over25-venue-support',reason:`V5 requires at least ${RULES.v5Over25RecentMin}% recent Over 2.5 support on both venue sides.`}
  if(under35===null||under35<RULES.v5Over25Under35HardMin)return{...base,ok:false,skip:'v5-over25-market-confirmation',reason:`V5 requires Under 3.5 at ${RULES.v5Over25Under35HardMin.toFixed(2)} or higher for Over 2.5.`}
  if(common.recent.min<100&&under35<RULES.v5Over25Under35ConditionalMin)return{...base,ok:false,skip:'v5-over25-conditional-market',reason:`When either venue side is only 80%, V5 requires Under 3.5 at ${RULES.v5Over25Under35ConditionalMin.toFixed(2)} or higher.`}
  if(!carrier&&!mutualContribution)return{...base,ok:false,skip:'v5-over25-no-goal-source',reason:'V5 blocked Over 2.5 because there is no reliable two-goal carrier and no strong two-team contribution route.'}
  return{...base,reason:'V5 Over 2.5 safety cleared: 80%+ venue support plus a verified three-goal production route.'}
}

function validateUnder25(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const over15=num(odds?.over15)
  const streak=num(odds?.streakYes)
  const streakHot=streak!==null&&streak>=RULES.streakMin&&streak<=RULES.streakMax
  const homeO05=num(odds?.homeO05),awayO05=num(odds?.awayO05)
  const bothTeamsLive=homeO05!==null&&awayO05!==null&&Math.max(homeO05,awayO05)<=RULES.v5Under25TeamGoalPressureMax
  const totals=[common.profiles.home.avgTotal,common.profiles.away.avgTotal].filter(finite).map(Number)
  const avgTotal=avg(totals)
  const base={...common,market:'under-25',over15,streak,streakHot,homeO05,awayO05,bothTeamsLive,avgTotal:avgTotal===null?null:+avgTotal.toFixed(2)}

  if(common.recent.min<RULES.v5Under25RecentMin)return{...base,ok:false,skip:'v5-under25-venue-support',reason:`V5 requires at least ${RULES.v5Under25RecentMin}% recent Under 2.5 support on both venue sides.`}
  if(over15===null||over15<RULES.v5Under25Over15HardMin)return{...base,ok:false,skip:'v5-under25-market-confirmation',reason:`V5 requires Over 1.5 at ${RULES.v5Under25Over15HardMin.toFixed(2)} or higher before Under 2.5 can publish.`}
  if(streakHot)return{...base,ok:false,skip:'v5-under25-streak-conflict',reason:'V5 blocks Under 2.5 when the 2+ goals streak market is actively confirming goals.'}
  if(bothTeamsLive)return{...base,ok:false,skip:'v5-under25-two-team-pressure',reason:'V5 blocks Under 2.5 when both teams are strongly priced to score.'}
  if(avgTotal!==null&&avgTotal>RULES.v5Under25AvgTotalMax)return{...base,ok:false,skip:'v5-under25-goal-environment',reason:`V5 requires the combined recent venue goal environment to stay at ${RULES.v5Under25AvgTotalMax.toFixed(2)} or lower.`}
  return{...base,reason:'V5 Under 2.5 safety cleared: 80%+ venue control with no streak or two-team scoring conflict.'}
}

function validateGG(fixture,result){
  const pick=result?.pick
  const common=commonSafety(fixture,result)
  if(!common.ok)return common
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const gg2No=num(odds?.gg2No)
  const homeO05=num(odds?.homeO05),awayO05=num(odds?.awayO05)
  const worstTeamGoal=homeO05!==null&&awayO05!==null?Math.max(homeO05,awayO05):null
  const home=common.profiles.home,away=common.profiles.away
  const fullContribution=home.scored>=RULES.v5GGRecentMin
    &&home.conceded>=RULES.v5GGRecentMin
    &&away.scored>=RULES.v5GGRecentMin
    &&away.conceded>=RULES.v5GGRecentMin
  const base={...common,market:'gg',gg2No,homeO05,awayO05,worstTeamGoal,fullContribution}

  if(common.recent.min<RULES.v5GGRecentMin)return{...base,ok:false,skip:'v5-gg-venue-support',reason:`V5 requires at least ${RULES.v5GGRecentMin}% recent BTTS support on both venue sides.`}
  if(gg2No===null||gg2No<RULES.v5GG2NoHardMin)return{...base,ok:false,skip:'v5-gg-market-confirmation',reason:`V5 requires GG 2+ No at ${RULES.v5GG2NoHardMin.toFixed(2)} or higher before BTTS Yes can publish.`}
  if(common.recent.min<100&&gg2No<RULES.v5GG2NoConditionalMin)return{...base,ok:false,skip:'v5-gg-conditional-market',reason:`When either BTTS venue rate is only 80%, V5 requires GG 2+ No at ${RULES.v5GG2NoConditionalMin.toFixed(2)} or higher.`}
  if(worstTeamGoal===null||worstTeamGoal>RULES.v5GGTeamGoalMax)return{...base,ok:false,skip:'v5-gg-team-goal-confirmation',reason:`V5 requires both team-total Over 0.5 prices to be available and no higher than ${RULES.v5GGTeamGoalMax.toFixed(2)}.`}
  if(!fullContribution)return{...base,ok:false,skip:'v5-gg-contribution',reason:'V5 blocked BTTS because both teams do not independently show 80%+ scoring and conceding support.'}
  return{...base,reason:'V5 BTTS safety cleared: both sides show 80%+ scoring/conceding support and both team-goal prices confirm.'}
}

function validateRoute(fixture,result){
  const route=result?.pick?.route
  if(route==='over-15')return validateOver15(fixture,result)
  if(route==='straight-win')return validateStraightWin(fixture,result)
  if(route==='under-35')return validateUnder35(fixture,result)
  if(route==='over-25')return validateOver25(fixture,result)
  if(route==='under-25')return validateUnder25(fixture,result)
  if(route==='gg')return validateGG(fixture,result)
  return{ok:true,rulesVersion:FILTER_RULE_VERSION,market:route||null,reason:'V5 version stamp only.'}
}

function applyV5(fixture,result){
  if(!result?.pick)return{...result,rulesVersion:FILTER_RULE_VERSION}
  const safety=validateRoute(fixture,result)
  if(!safety.ok){
    return{
      ...result,
      pick:null,
      skip:safety.skip,
      rulesVersion:FILTER_RULE_VERSION,
      v5Safety:safety,
      rejected:[...(result.rejected||[]),{route:result.pick.route,reason:safety.skip,v5Safety:safety}]
    }
  }
  const reason=safety.reason
  const pick={
    ...result.pick,
    rulesVersion:FILTER_RULE_VERSION,
    filterRulesVersion:FILTER_RULE_VERSION,
    v5Safety:safety,
    filterFlags:[...(result.pick.filterFlags||[]),'V5_MARKET_SAFETY'],
    filterReasons:[...(result.pick.filterReasons||[]),reason]
  }
  if(Array.isArray(pick.why?.reasons)&&reason&&!pick.why.reasons.includes(reason)){
    pick.why={...pick.why,reasons:[...pick.why.reasons,reason]}
  }
  return{...result,pick,rulesVersion:FILTER_RULE_VERSION,v5Safety:safety}
}

export function diagnoseFilterFixture(fixture,learningState=null){
  return applyV5(fixture,V2.diagnoseFilterFixture(fixture,learningState))
}

export function evaluateFilterFixture(fixture,learningState=null){
  return diagnoseFilterFixture(fixture,learningState).pick
}

export function buildFilterBoard(fixtures,meta={},learningState=null){
  const diagnosed=(fixtures||[]).map(fixture=>({fixture,result:diagnoseFilterFixture(fixture,learningState)}))
  const qualified=diagnosed.map(row=>row.result.pick).filter(Boolean)
    .sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)
      ||Number(b.rawFilterScore||b.filterScore||0)-Number(a.rawFilterScore||a.filterScore||0)
      ||Number(a.odds)-Number(b.odds))
  const skipped=diagnosed.filter(row=>!row.result.pick).reduce((map,row)=>{
    const key=row.result.skip||'unknown'
    map[key]=(map[key]||0)+1
    return map
  },{})
  const legacyMeta=V2.buildFilterBoard([],meta,learningState).meta
  return{
    meta:{
      ...legacyMeta,
      ...meta,
      rulesVersion:FILTER_RULE_VERSION,
      safetyRevision:'v5.1-all-market-safety',
      qualified:qualified.length,
      bestPicks:qualified.length,
      skipped
    },
    priority:qualified,
    bestPicks:qualified,
    availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()
  }
}
