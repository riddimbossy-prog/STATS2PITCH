// Filter Tips V5 safety overlay.
// Keeps the proven V2 router intact, then applies stricter publication gates.
import * as V2 from './filterEngineV2.js'

export const ENGINE_ID=V2.ENGINE_ID
export const FILTER_RULE_VERSION='v5'
export const RULES=Object.freeze({
  ...V2.RULES,
  v5Over15Under35HardMin:1.45,
  v5Over15ConditionalUnder35Min:1.50,
  v5Over15StrongRecentMin:80,
  v5Over15ConditionalRecentMin:60,
  v5OneGoalExactOneMin:60,
  v5OneGoalOpponentBlankMin:60,
  v5OneGoalCarrierMin:40,
  v5DeteriorationHardRatio:0.80
})

export const extractFilterOdds=V2.extractFilterOdds
export const isCupCompetition=V2.isCupCompetition

const FINISHED=new Set(['FT','AET','PEN'])
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const pct=(hits,total)=>total?Math.round((hits*100)/total):null

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
  return{
    sample:total,
    over15:pct(count(g=>g.total>=2),total),
    scored2Plus:pct(count(g=>g.own>=2),total),
    scored:pct(count(g=>g.own>=1),total),
    blank:pct(count(g=>g.own===0),total),
    conceded:pct(count(g=>g.opp>=1),total),
    exactOneScored:pct(count(g=>g.own===1),total),
    oneGoalMatch:pct(count(g=>g.total===1),total)
  }
}

function deteriorationRatio(recent,baseline){
  if(!finite(recent)||!finite(baseline)||Number(baseline)<=0)return null
  return Number(recent)/Number(baseline)
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
  const odds=result?.odds||pick?.oddsBook||extractFilterOdds(fixture)
  const direction=result?.direction||{
    recentHome:pick?.recentHome,
    recentAway:pick?.recentAway,
    recentConsensus:pick?.recentConsensus,
    baselineHome:pick?.baselineHome,
    baselineAway:pick?.baselineAway,
    baselineConsensus:pick?.baselineConsensus
  }
  const homeProfile=goalProfile(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const awayProfile=goalProfile(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const under35=num(odds?.under35)
  const recentHome=num(direction?.recentHome)
  const recentAway=num(direction?.recentAway)
  const baselineHome=num(direction?.baselineHome)
  const baselineAway=num(direction?.baselineAway)
  const minRecent=recentHome!==null&&recentAway!==null?Math.min(recentHome,recentAway):null
  const strongRecent=minRecent!==null&&minRecent>=RULES.v5Over15StrongRecentMin
  const conditionalRecent=minRecent!==null&&minRecent>=RULES.v5Over15ConditionalRecentMin
  const homeTrend=deteriorationRatio(recentHome,baselineHome)
  const awayTrend=deteriorationRatio(recentAway,baselineAway)
  const severeDeterioration=(homeTrend!==null&&homeTrend<RULES.v5DeteriorationHardRatio)
    ||(awayTrend!==null&&awayTrend<RULES.v5DeteriorationHardRatio)
  const trap=oneGoalTrap(pick,homeProfile,awayProfile)
  const missingValidation=homeProfile.sample<5
    ||awayProfile.sample<5
    ||recentHome===null
    ||recentAway===null
    ||!finite(pick?.filterScore)
    ||!finite(pick?.consensus)

  const base={
    ok:true,
    rulesVersion:FILTER_RULE_VERSION,
    market:'over-15',
    under35,
    recent:{home:recentHome,away:recentAway,min:minRecent},
    baseline:{home:baselineHome,away:baselineAway},
    trendRatio:{home:homeTrend,away:awayTrend},
    profiles:{home:homeProfile,away:awayProfile},
    strongRecent,
    conditionalRecent,
    oneGoalTrap:trap
  }

  if(missingValidation)return{...base,ok:false,skip:'v5-missing-validation',reason:'V5 blocked Over 1.5 because the full venue validation set was not available.'}
  if(under35===null||under35<RULES.v5Over15Under35HardMin)return{...base,ok:false,skip:'v5-over15-market-confirmation',reason:`V5 requires Under 3.5 at ${RULES.v5Over15Under35HardMin.toFixed(2)} or higher before Over 1.5 can publish.`}
  if(!conditionalRecent)return{...base,ok:false,skip:'v5-over15-venue-support',reason:`V5 requires at least ${RULES.v5Over15ConditionalRecentMin}% recent venue support on both sides.`}
  if(!strongRecent&&under35<RULES.v5Over15ConditionalUnder35Min)return{...base,ok:false,skip:'v5-over15-conditional-support',reason:`With a 60% venue side, V5 requires stronger market confirmation: Under 3.5 must be at least ${RULES.v5Over15ConditionalUnder35Min.toFixed(2)}.`}
  if(severeDeterioration)return{...base,ok:false,skip:'v5-over15-deterioration',reason:'V5 blocked Over 1.5 because recent venue support has fallen below 80% of its baseline.'}
  if(trap)return{...base,ok:false,skip:'v5-one-goal-trap',reason:'V5 detected a 1-0/0-1 danger shape: the favourite often stops at one while the opponent often blanks.'}
  return{...base,reason:strongRecent?'V5 strong route: both recent venue supports are at least 80%.':'V5 conditional route cleared: weaker venue support is rescued by stronger market confirmation.'}
}

function applyV5(fixture,result){
  if(!result?.pick)return{...result,rulesVersion:FILTER_RULE_VERSION}
  if(result.pick.route!=='over-15'){
    return{
      ...result,
      rulesVersion:FILTER_RULE_VERSION,
      pick:{...result.pick,rulesVersion:FILTER_RULE_VERSION,filterRulesVersion:FILTER_RULE_VERSION}
    }
  }
  const safety=validateOver15(fixture,result)
  if(!safety.ok){
    return{
      ...result,
      pick:null,
      skip:safety.skip,
      rulesVersion:FILTER_RULE_VERSION,
      v5Safety:safety,
      rejected:[...(result.rejected||[]),{route:'over-15',reason:safety.skip,v5Safety:safety}]
    }
  }
  const reason=safety.reason
  const pick={
    ...result.pick,
    rulesVersion:FILTER_RULE_VERSION,
    filterRulesVersion:FILTER_RULE_VERSION,
    v5Safety:safety,
    filterFlags:[...(result.pick.filterFlags||[]),'V5_GOAL_SAFETY'],
    filterReasons:[...(result.pick.filterReasons||[]),reason]
  }
  if(Array.isArray(pick.why?.reasons)&&!pick.why.reasons.includes(reason)){
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
      safetyRevision:'v5.0-one-goal-trap',
      qualified:qualified.length,
      bestPicks:qualified.length,
      skipped
    },
    priority:qualified,
    bestPicks:qualified,
    availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()
  }
}
