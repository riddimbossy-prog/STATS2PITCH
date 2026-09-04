import {ENGINE_VERSION} from './config.js'
import {attachWhy,last5Form,last5Overall,fixtureHasStats} from './pickWhy.js'
import {isSrlMatch,isCupCompetition,isEarlySeason} from './redFlags.js'
import {last5VenueRates,goalsFormGate,weakFavouriteGate} from './goalsFormGate.js'
import {
  ENGINE_ID,
  MARKET_LABEL,
  V5_RULES,
  classifyMatchType,
  evaluateTwoInARowMarket,
  statsFromFixture
} from './goalsBankersV5.js'
import {isComboRoute} from './goalsCombo.js'
import {applyLearningToRows} from './learning.js'
export {last5VenueRates,goalsFormGate,weakFavouriteGate} from './goalsFormGate.js'
export {ENGINE_ID}

export const STREAK_MIN=1.10
export const STREAK_MAX=1.50
export const ROUTES=Object.freeze(['FAV_WIN','FAV_DNB','FAV_2PLUS','OVER_2.5','GG','SKIP'])
const SINGLE_ROUTES=['FAV_WIN','FAV_DNB','FAV_2PLUS','OVER_2.5','GG']
const WHY_ROUTES=[...SINGLE_ROUTES]

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const lte=(v,n)=>finite(v)&&Number(v)<=n
const whyPx=v=>finite(v)?Number(v).toFixed(2):null

function oddOf(markets,key,names){
  for(const market of markets||[]){
    if(market?.marketKey!==key)continue
    for(const name of names){
      const hit=(market.outcomes||[]).find(o=>norm(o?.name)===norm(name))
      const price=num(hit?.odd)
      if(price)return price
    }
  }
  return null
}

function scanOdd(markets,test){
  for(const market of markets||[]){
    for(const outcome of market.outcomes||[]){
      const price=num(outcome?.odd)
      if(!price)continue
      if(test(norm(market.marketKey),norm(market.market),norm(outcome.name)))return price
    }
  }
  return null
}

function isStreakName(key,market,name){
  const blob=`${key} ${market} ${name}`
  return /goal(?:s)? streak/.test(blob)
    ||/streak 2/.test(blob)
    ||/2 (?:goal )?streak/.test(blob)
    ||/consecutive goals/.test(blob)
    ||/goals? in a row/.test(blob)
    ||/2\+ goals in a row/.test(blob)
    ||/score 2 or more goals in a row/.test(blob)
    ||key==='goals-streak-2'
    ||key==='goals streak 2'
    ||key==='60010'
}

function teamGoalOdd(markets,side,line,teamName){
  const key=side==='home'?'home-team-goals':'away-team-goals'
  const direct=oddOf(markets,key,[`Over ${line}`,`O ${line}`])
  if(direct)return direct
  const wanted=norm(teamName)
  return scanOdd(markets,(marketKey,market,name)=>{
    if(!/over/.test(name)||!name.includes(String(line)))return false
    if(marketKey===key)return true
    if(marketKey!=='team-goals'&&!/team goals/.test(market)&&!/team total/.test(market))return false
    if(side==='home'&&(/home/.test(name)||(wanted&&name.includes(wanted))))return true
    if(side==='away'&&(/away/.test(name)||(wanted&&name.includes(wanted))))return true
    return false
  })
}

export function extractGoalsBankerOdds(fixture){
  const markets=fixture?.marketOdds||[]
  const homeName=fixture?.home?.name||''
  const awayName=fixture?.away?.name||''
  const homeWin=oddOf(markets,'match-winner',['Home','1'])
  const awayWin=oddOf(markets,'match-winner',['Away','2'])
  const homeDnb=oddOf(markets,'draw-no-bet',['Home','1'])
  const awayDnb=oddOf(markets,'draw-no-bet',['Away','2'])
  const draw=oddOf(markets,'match-winner',['Draw','X'])
  const over25=oddOf(markets,'total-goals',['Over 2.5','O 2.5'])
  const under25=oddOf(markets,'total-goals',['Under 2.5','U 2.5'])
  const bttsYes=oddOf(markets,'both-teams-score',['Yes'])
  const drawOrOver=scanOdd(markets,(key,market,name)=>/draw or over 2\.5/.test(`${key} ${market} ${name}`))
  const drawOrUnder=scanOdd(markets,(key,market,name)=>/draw or under 2\.5/.test(`${key} ${market} ${name}`))
  const drawOrGg=scanOdd(markets,(key,market,name)=>/draw or (gg|btts|both teams)/.test(`${key} ${market} ${name}`))
  const homeO15=teamGoalOdd(markets,'home',1.5,homeName)
  const awayO15=teamGoalOdd(markets,'away',1.5,awayName)
  const homeO25=teamGoalOdd(markets,'home',2.5,homeName)
  const awayO25=teamGoalOdd(markets,'away',2.5,awayName)
  const homeO05=teamGoalOdd(markets,'home',0.5,homeName)
  const awayO05=teamGoalOdd(markets,'away',0.5,awayName)
  let streak=scanOdd(markets,(key,market,name)=>isStreakName(key,market,name)&&/yes/.test(name))
  if(!streak)streak=oddOf(markets,'goals-streak-2',['Yes'])
  let favourite=null
  if(homeWin&&awayWin){
    if(homeWin<awayWin)favourite='home'
    else if(awayWin<homeWin)favourite='away'
  }else if(homeWin&&!awayWin)favourite='home'
  else if(awayWin&&!homeWin)favourite='away'
  const fav_odds=favourite==='home'?homeWin:favourite==='away'?awayWin:null
  const fav_dnb=favourite==='home'?homeDnb:favourite==='away'?awayDnb:null
  const opp_odds=favourite==='home'?awayWin:favourite==='away'?homeWin:null
  const fav_2plus=favourite==='home'?homeO15:favourite==='away'?awayO15:null
  const fav_tt_over25=favourite==='home'?homeO25:favourite==='away'?awayO25:null
  const opp_tt_over05=favourite==='home'?awayO05:favourite==='away'?homeO05:null
  return{favourite,homeWin,awayWin,homeDnb,awayDnb,fav_odds,fav_dnb,opp_odds,draw_odds:draw,over25,under25,btts_yes:bttsYes,fav_2plus,fav_tt_over25,opp_tt_over05,streak_yes:streak,homeO15,awayO15,homeO25,awayO25,homeO05,awayO05,'draw-or-over-25':drawOrOver,'draw-or-under-25':drawOrUnder,'draw-or-gg':drawOrGg}
}

export function classifyMatch(odds){
  const fav=num(odds?.fav_odds),opp=num(odds?.opp_odds)
  if(!finite(fav)||!finite(opp))return null
  let type=classifyMatchType(fav,opp)
  if(type!=='MISMATCH'&&lte(odds?.btts_yes,1.70)&&lte(odds?.over25,1.65))type='BALANCED_GOALS'
  return type
}

function skipCode(v3){
  if(v3.finalPick!=='SKIP')return null
  if(v3.reasonCode==='STREAK_GATE')return 'streak-gate'
  if(v3.reasonCode==='INSUFFICIENT_MARKET_DATA')return 'missing-odds'
  if(v3.reasonCode==='INSUFFICIENT_SPLIT_SAMPLE')return 'split-sample'
  if(v3.reasonCode==='LOW_MARKET_SEPARATION'||v3.reasonCode==='LOW_CAPABILITY_SEPARATION')return 'low-separation'
  if(v3.reasonCode==='BELOW_FLOOR'||v3.reasonCode==='CONFLICT_NO_CONFIRMATION')return 'no-confirmation'
  if(String(v3.reasonCode).startsWith('VETO_'))return 'veto'
  return String(v3.reasonCode||'skip').toLowerCase().replaceAll('_','-')
}

export function decideGoalsBanker(odds,ctx={}){
  const v5=evaluateTwoInARowMarket({
    fav_odds:odds.fav_odds,
    fav_dnb:odds.fav_dnb,
    draw_odds:odds.draw_odds,
    opp_odds:odds.opp_odds,
    fav_2plus:odds.fav_2plus,
    fav_tt_over25:odds.fav_tt_over25,
    opp_tt_over05:odds.opp_tt_over05,
    over25:odds.over25,
    btts_yes:odds.btts_yes,
    streak_yes:odds.streak_yes,
    favourite:odds.favourite,
    homeWin:odds.homeWin,awayWin:odds.awayWin,homeDnb:odds.homeDnb,awayDnb:odds.awayDnb,
    homeO05:odds.homeO05,awayO05:odds.awayO05,homeO15:odds.homeO15,awayO15:odds.awayO15,homeO25:odds.homeO25,awayO25:odds.awayO25
  },{fixture:ctx.fixture||odds.fixture||null,fixtureId:odds.fixtureId||ctx.fixtureId||null,stats:ctx.stats||odds.stats||null,earlySeason:ctx.earlySeason===true,legacyDecision:ctx.legacyDecision||null})
  if(v5.finalPick!=='SKIP'){
    return{
      route:v5.finalPick,
      side:v5.side||odds.favourite,
      type:v5.matchType,
      rule:v5.reasonCode,
      raw:v5.provisionalPick,
      vetoes:[],
      skip:null,
      odds,
      combo:null,
      v5,
      v4:v5.legacyV4||null,
      v3:v5
    }
  }
  return{
    route:'SKIP',
    side:v5.side||odds.favourite,
    type:v5.matchType,
    rule:v5.reasonCode,
    raw:v5.provisionalPick,
    vetoes:[],
    skip:skipCode(v5),
    odds,
    combo:null,
    v5,
    v4:v5.legacyV4||null,
    v3:v5
  }
}

export function pickMarket(_type,odds){return decideGoalsBanker(odds).route}
export function applyVetoes(_pick,_type,odds){return decideGoalsBanker(odds).route}

function passedReason(v3,id){
  const score=v3.scores?.[id]
  if(score===null||score===undefined)return `${MARKET_LABEL[id]} was structurally ineligible for this match shape.`
  if(id===v3.runnerUp&&v3.separation!=null)return `Scored ${score} — ${v3.separation} behind the published market.`
  const top=v3.topMarket?v3.scores[v3.topMarket]:null
  return `Scored ${score}${top!=null?` vs ${top} on the published market`:''}.`
}

export function explainGoalsDecision({type,rule,raw,route,vetoes,odds,home,away,favourite,v3,combo}){
  if(!WHY_ROUTES.includes(route))return null
  const side=v3?.side||favourite
  const sideDnb=side==='home'?odds?.homeDnb:odds?.awayDnb
  const prices={FAV_WIN:whyPx(side==='home'?odds?.homeWin:side==='away'?odds?.awayWin:odds?.fav_odds),FAV_DNB:whyPx(sideDnb),FAV_2PLUS:whyPx(side==='home'?odds?.homeO15:side==='away'?odds?.awayO15:odds?.fav_2plus),'OVER_2.5':whyPx(odds?.over25),GG:whyPx(odds?.btts_yes)}
  if(v3){
    return{
      route,
      chosen:MARKET_LABEL[route],
      price:prices[route],
      headline:v3.userWhy,
      matchShape:v3.matchShape,
      scores:v3.scores,
      separation:v3.separation,
      passed:SINGLE_ROUTES.filter(id=>id!==route).map(id=>({id,label:MARKET_LABEL[id],price:prices[id],reason:passedReason(v3,id)}))
    }
  }
  const fav=favourite==='home'?home:favourite==='away'?away:(home||'the favourite')
  return{
    route,
    chosen:MARKET_LABEL[route],
    price:prices[route],
    headline:`${MARKET_LABEL[route]} is the V5 banker for ${fav}.`,
    passed:SINGLE_ROUTES.filter(id=>id!==route).map(id=>({id,label:MARKET_LABEL[id],price:prices[id],reason:`${MARKET_LABEL[id]} was passed over.`}))
  }
}

function publicReasons(pick){
  const why=pick?.marketWhy||explainGoalsDecision({type:pick.classification,route:pick.route,raw:pick.route,rule:null,vetoes:[],odds:pick.oddsBook||{},home:pick.home,away:pick.away,favourite:pick.favourite,v3:pick.v3||null,combo:pick.combo||null})
  if(!why)return['No Goals Banker for this match.']
  return[why.headline,...why.passed.map(row=>`${row.label} was passed over: ${row.reason}`)]
}

function publishedFor(route,odds,decisionSide=null){
  const side=decisionSide||odds.favourite
  if(route==='FAV_WIN'){const price=num(side==='home'?odds.homeWin:odds.awayWin);if(!price)return null;return side==='home'?{market:'match-winner',selection:'Home',displaySelection:'1X2 · Home',odds:price,family:'1X2'}:{market:'match-winner',selection:'Away',displaySelection:'1X2 · Away',odds:price,family:'1X2'}}
  if(route==='FAV_DNB'){const price=num(side==='home'?odds.homeDnb:odds.awayDnb);if(!price)return null;return side==='home'?{market:'draw-no-bet',selection:'Home',displaySelection:'DNB · Home',odds:price,family:'DNB'}:{market:'draw-no-bet',selection:'Away',displaySelection:'DNB · Away',odds:price,family:'DNB'}}
  if(route==='FAV_2PLUS'){const price=num(side==='home'?odds.homeO15:odds.awayO15);if(!price)return null;return side==='home'?{market:'home-team-goals',selection:'Over 1.5',displaySelection:'Home Team · 2+',odds:price,family:'Team Goals'}:{market:'away-team-goals',selection:'Over 1.5',displaySelection:'Away Team · 2+',odds:price,family:'Team Goals'}}
  if(route==='OVER_2.5'){const price=num(odds.over25);if(!price)return null;return{market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:price,family:'Goals'}}
  if(route==='GG'){const price=num(odds.btts_yes);if(!price)return null;return{market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',odds:price,family:'BTTS'}}
  return null
}

function packPick(fixture,odds,decision,published){
  const lastMatchesHome=last5Overall(fixture?.home?.lastMatches||fixture?.home?.fixtures,fixture?.home?.id)
  const lastMatchesAway=last5Overall(fixture?.away?.lastMatches||fixture?.away?.fixtures,fixture?.away?.id)
  const last5Home=last5Form(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const last5Away=last5Form(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const pick={
    fixtureId:fixture.fixtureId,league:fixture.league,country:fixture.country,kickoff:fixture.kickoff,
    home:fixture.home?.name,away:fixture.away?.name,homeId:fixture.home?.id??null,awayId:fixture.away?.id??null,
    homeLogo:fixture.home?.logo||null,awayLogo:fixture.away?.logo||null,
    market:published.market,marketName:published.displaySelection,selection:published.selection,
    displaySelection:published.displaySelection,pick:published.displaySelection,
    odds:+Number(published.odds).toFixed(2),engine:ENGINE_ID,engineVersion:ENGINE_VERSION,
    route:decision.route,classification:decision.type,
    borderline:decision.v3?.borderline===true,
    highBorderline:decision.v3?.highBorderline===true,
    matchShape:decision.v3?.matchShape||null,
    bankerClass:decision.v3?.bankerClass||null,
    capabilityScore:decision.v3?.finalPick&&decision.v3.capabilities
      ?(['FAV_WIN','FAV_DNB'].includes(decision.v3.finalPick)?decision.v3.capabilities.favWin.score
        :decision.v3.finalPick==='FAV_2PLUS'?decision.v3.capabilities.fav2Plus.score
        :decision.v3.finalPick==='OVER_2.5'?decision.v3.capabilities.over25.score
        :decision.v3.capabilities.gg.score)
      :null,
    marketScore:isComboRoute(decision.route)?decision.combo?.score??null:decision.v3?.finalPick?decision.v3.scores?.[decision.v3.finalPick]??null:null,
    separation:isComboRoute(decision.route)?decision.combo?.separation??null:decision.v3?.separation??null,
    favourite:decision.side||odds.favourite,family:published.family,
    combo:isComboRoute(decision.route),
    comboScores:decision.combo?.scores||null,
    oddsBook:{
      fav_odds:odds.fav_odds,opp_odds:odds.opp_odds,draw_odds:odds.draw_odds,
      over25:odds.over25,under25:odds.under25,btts_yes:odds.btts_yes,fav_2plus:odds.fav_2plus,
      fav_tt_over25:odds.fav_tt_over25,opp_tt_over05:odds.opp_tt_over05,
      homeWin:odds.homeWin,awayWin:odds.awayWin,homeDnb:odds.homeDnb,awayDnb:odds.awayDnb,
      homeO05:odds.homeO05,awayO05:odds.awayO05,homeO15:odds.homeO15,awayO15:odds.awayO15,homeO25:odds.homeO25,awayO25:odds.awayO25
    },
    homeSplit:fixture.homeSplit||null,awaySplit:fixture.awaySplit||null,
    earlySeason:fixture.earlySeason===true,sportyEventId:fixture.sportyEventId||null
  }
  const marketWhy=explainGoalsDecision({
    type:decision.type,rule:decision.rule,raw:decision.raw,route:decision.route,
    vetoes:decision.vetoes,odds,home:pick.home,away:pick.away,favourite:odds.favourite,v3:decision.v3,combo:decision.combo
  })
  if(marketWhy)pick.marketWhy=marketWhy
  return attachWhy(pick,fixture,{reasons:publicReasons(pick),last5Home,last5Away,lastMatchesHome,lastMatchesAway})
}

export function diagnoseGoalsBankerFixture(fixture){
  if(isSrlMatch(fixture))return{pick:null,skip:'srl'}
  if(!fixtureHasStats(fixture))return{pick:null,skip:'no-stats'}
  if(isCupCompetition(fixture?.league))return{pick:null,skip:'cup'}
  const odds=extractGoalsBankerOdds(fixture)
  const stats=odds.favourite?statsFromFixture(fixture,odds.favourite):null
  const decision=decideGoalsBanker(odds,{fixture,stats,earlySeason:isEarlySeason(fixture),fixtureId:fixture.fixtureId})
  if(decision.route==='SKIP')return{pick:null,skip:decision.skip||'skip',odds,type:decision.type,v3:decision.v3}
  const homeForm=last5VenueRates(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const awayForm=last5VenueRates(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const form=decision.route==='GG'?goalsFormGate('GG',decision.side||odds.favourite,homeForm,awayForm,{waive:isEarlySeason(fixture)}):{ok:true,skip:null,v5:true}
  if(!form.ok)return{pick:null,skip:form.skip,odds,type:decision.type,route:decision.route,homeForm,awayForm}
  const published=publishedFor(decision.route,odds,decision.side)
  if(!published)return{pick:null,skip:'missing-published-odds',odds,type:decision.type,route:decision.route}
  const pick=packPick(fixture,odds,decision,published)
  pick.formGate={home:homeForm,away:awayForm,route:decision.route,v5:true}
  return{pick,skip:null,odds,type:decision.type,route:decision.route,homeForm,awayForm,v3:decision.v3}
}

export function evaluateGoalsBankerFixture(fixture){return diagnoseGoalsBankerFixture(fixture).pick}

export function canAddAccaLeg(slip,pick){
  const legs=Array.isArray(slip)?slip:[]
  if(!pick||pick.route==='SKIP')return{ok:false,reason:'no-pick'}
  if(isComboRoute(pick.route)||String(pick.family||'')==='Combo')return{ok:false,reason:'combo-not-on-slip'}
  if(String(pick.market||'')==='goals-streak-2'||pick.route==='STREAK')return{ok:false,reason:'streak-not-on-slip'}
  if(pick.highBorderline===true)return{ok:false,reason:'high-borderline'}
  if(Number.isFinite(pick.capabilityScore)&&pick.capabilityScore<75)return{ok:false,reason:'capability'}
  if(Number.isFinite(pick.marketScore)&&pick.marketScore<82)return{ok:false,reason:'score-floor'}
  if(Number.isFinite(pick.separation)&&pick.separation<8)return{ok:false,reason:'separation'}
  if(legs.length>=3)return{ok:false,reason:'max-3'}
  if(legs.some(row=>String(row.fixtureId)===String(pick.fixtureId)))return{ok:false,reason:'same-match'}
  const next=[...legs,pick]
  if(next.filter(row=>['FAV_WIN','FAV_DNB'].includes(row.route)).length>1)return{ok:false,reason:'max-1-result'}
  if(next.length===3&&!next.some(row=>row.route==='OVER_2.5'||row.route==='GG'))return{ok:false,reason:'need-goals-leg'}
  const hasLean=legs.some(row=>row.classification==='LEAN'||row.borderline===true)
  if(hasLean&&(pick.classification==='LEAN'||pick.borderline===true||pick.classification==='STRONG'))return{ok:false,reason:'borderline-lean'}
  return{ok:true,reason:null,legs:next}
}

export function buildGoalsBankerBoard(fixtures,meta={},learningState=null){
  const diagnosed=(fixtures||[]).map(fixture=>({fixture,result:diagnoseGoalsBankerFixture(fixture)}))
  const qualified=applyLearningToRows(
    diagnosed.map(row=>row.result.pick).filter(Boolean),
    learningState,
    {board:'goals',tightenMinScore:86}
  ).sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(a.odds)-Number(b.odds))
  const skipped=diagnosed.filter(row=>!row.result.pick).reduce((map,row)=>{const key=row.result.skip||'unknown';map[key]=(map[key]||0)+1;return map},{})
  return{meta:{...meta,engineVersion:ENGINE_VERSION,engine:ENGINE_ID,rules:V5_RULES,qualified:qualified.length,bestPicks:qualified.length,skipped,publishedRoutes:['FAV_WIN','FAV_DNB','FAV_2PLUS','OVER_2.5','GG']},priority:qualified,bestPicks:qualified,availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()}
}
