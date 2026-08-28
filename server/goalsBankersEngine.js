import {ENGINE_VERSION} from './config.js'
import {attachWhy,last5Form,last5Overall,fixtureHasStats} from './pickWhy.js'
import {isSrlMatch} from './redFlags.js'

export const ENGINE_ID='goals-bankers-v1'
export const STREAK_MIN=1.10
export const STREAK_MAX=1.50
export const ROUTES=Object.freeze(['FAV_WIN','FAV_2PLUS','OVER_2.5','GG','SKIP'])

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const lte=(v,n)=>finite(v)&&Number(v)<=n
const gte=(v,n)=>finite(v)&&Number(v)>=n
const gt=(v,n)=>finite(v)&&Number(v)>n
const lt=(v,n)=>finite(v)&&Number(v)<n

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
  const draw=oddOf(markets,'match-winner',['Draw','X'])
  const over25=oddOf(markets,'total-goals',['Over 2.5','O 2.5'])
  const bttsYes=oddOf(markets,'both-teams-score',['Yes'])
  const homeO15=teamGoalOdd(markets,'home',1.5,homeName)
  const awayO15=teamGoalOdd(markets,'away',1.5,awayName)
  let streak=scanOdd(markets,(key,market,name)=>isStreakName(key,market,name)&&/yes/.test(name))
  if(!streak)streak=oddOf(markets,'goals-streak-2',['Yes'])
  let favourite=null
  if(homeWin&&awayWin){
    if(homeWin<awayWin)favourite='home'
    else if(awayWin<homeWin)favourite='away'
  }else if(homeWin&&!awayWin)favourite='home'
  else if(awayWin&&!homeWin)favourite='away'
  const fav_odds=favourite==='home'?homeWin:favourite==='away'?awayWin:null
  const opp_odds=favourite==='home'?awayWin:favourite==='away'?homeWin:null
  const fav_2plus=favourite==='home'?homeO15:favourite==='away'?awayO15:null
  return{
    favourite,
    homeWin,
    awayWin,
    fav_odds,
    opp_odds,
    draw_odds:draw,
    over25,
    btts_yes:bttsYes,
    fav_2plus,
    streak_yes:streak,
    homeO15,
    awayO15
  }
}

export function classifyMatch(odds){
  const fav=num(odds?.fav_odds),opp=num(odds?.opp_odds)
  if(!finite(fav))return null
  let type
  if(lte(fav,1.40)&&gte(opp,5.00))type='MISMATCH'
  else if(lte(fav,1.55)&&gte(opp,3.80))type='STRONG'
  else if(lte(fav,1.80))type='LEAN'
  else type='BALANCED'
  if(type!=='MISMATCH'&&lte(odds?.btts_yes,1.70)&&lte(odds?.over25,1.65))type='BALANCED'
  return type
}

export function pickMarket(type,odds){
  return pickMarketDecision(type,odds).route
}

export function pickMarketDecision(type,odds){
  if(type==='BALANCED'){
    if(lte(odds.over25,1.60)&&gt(odds.btts_yes,1.80))return{route:'OVER_2.5',rule:'balanced-over-not-gg'}
    if(lte(odds.btts_yes,1.72)&&gt(odds.over25,1.70))return{route:'GG',rule:'balanced-gg-not-over'}
    if(lte(odds.over25,1.65)&&lte(odds.btts_yes,1.75)){
      return lte(odds.over25,odds.btts_yes)
        ?{route:'OVER_2.5',rule:'balanced-both-on-cheaper-over'}
        :{route:'GG',rule:'balanced-both-on-cheaper-gg'}
    }
    return{route:'SKIP',rule:'balanced-no-goals'}
  }
  if(type==='LEAN'){
    if(lte(odds.over25,1.58))return{route:'OVER_2.5',rule:'lean-over'}
    if(lte(odds.btts_yes,1.68))return{route:'GG',rule:'lean-gg'}
    return{route:'SKIP',rule:'lean-no-goals'}
  }
  if(type==='MISMATCH'){
    if(lte(odds.fav_2plus,1.38))return{route:'FAV_2PLUS',rule:'mismatch-2plus-short'}
    if(lte(odds.fav_2plus,1.48)&&lte(odds.fav_odds,1.32))return{route:'FAV_2PLUS',rule:'mismatch-2plus-short-win'}
    if(lte(odds.fav_odds,1.35)&&gte(odds.over25,1.75))return{route:'FAV_WIN',rule:'mismatch-win-over-high'}
    if(lte(odds.fav_odds,1.40)&&gte(odds.fav_2plus,1.55))return{route:'FAV_WIN',rule:'mismatch-win-2plus-high'}
    if(lte(odds.over25,1.50)&&lte(odds.fav_2plus,1.45))return{route:'OVER_2.5',rule:'mismatch-over'}
    return{route:'FAV_WIN',rule:'mismatch-win-fallback'}
  }
  if(type==='STRONG'){
    if(lte(odds.fav_2plus,1.42))return{route:'FAV_2PLUS',rule:'strong-2plus'}
    if(lte(odds.over25,1.52)&&lte(odds.btts_yes,1.75))return{route:'OVER_2.5',rule:'strong-over'}
    if(lte(odds.fav_odds,1.50)&&gte(odds.fav_2plus,1.55))return{route:'FAV_WIN',rule:'strong-win-2plus-high'}
    if(lte(odds.fav_odds,1.48))return{route:'FAV_WIN',rule:'strong-win-short'}
    return{route:'SKIP',rule:'strong-no-route'}
  }
  return{route:'SKIP',rule:'unclassified'}
}

export function applyVetoes(pick,type,odds){
  return applyVetoesDecision(pick,type,odds).route
}

export function applyVetoesDecision(pick,type,odds){
  let next=pick
  const vetoes=[]
  if(next==='FAV_WIN'&&(type==='BALANCED'||type==='LEAN')){next='SKIP';vetoes.push('V1')}
  if(next==='FAV_WIN'&&lte(odds.btts_yes,1.62)&&lte(odds.over25,1.60)){next='OVER_2.5';vetoes.push('V2')}
  if(next==='FAV_2PLUS'&&gte(odds.fav_2plus,1.55)){
    next=type==='MISMATCH'&&lte(odds.fav_odds,1.33)?'FAV_WIN':'SKIP'
    vetoes.push('V3')
  }
  if(next==='GG'&&type==='MISMATCH'){next='SKIP';vetoes.push('V4')}
  if(next==='GG'&&gte(odds.opp_odds,5.50)){next='SKIP';vetoes.push('V5')}
  if(next==='OVER_2.5'&&gte(odds.over25,1.80)){next='SKIP';vetoes.push('V6')}
  if(next==='FAV_WIN'&&gt(odds.fav_odds,1.55)){next='SKIP';vetoes.push('V7')}
  return{route:next,vetoes}
}

export function decideGoalsBanker(odds){
  const streak=num(odds?.streak_yes)
  if(!finite(streak)||lt(streak,STREAK_MIN)||gt(streak,STREAK_MAX)){
    return{route:'SKIP',type:null,rule:null,raw:null,vetoes:[],skip:'streak-gate',odds}
  }
  if(!finite(odds?.fav_odds)||!odds?.favourite){
    return{route:'SKIP',type:null,rule:null,raw:null,vetoes:[],skip:'fav-unclear',odds}
  }
  const type=classifyMatch(odds)
  if(!type)return{route:'SKIP',type:null,rule:null,raw:null,vetoes:[],skip:'unclassified',odds}
  const picked=pickMarketDecision(type,odds)
  const vetoed=applyVetoesDecision(picked.route,type,odds)
  return{
    route:vetoed.route,
    type,
    raw:picked.route,
    rule:picked.rule,
    vetoes:vetoed.vetoes,
    skip:vetoed.route==='SKIP'?'veto-or-no-route':null,
    odds
  }
}

function publishedFor(route,odds){
  const side=odds.favourite
  if(route==='FAV_WIN'){
    const price=num(odds.fav_odds)
    if(!price)return null
    return side==='home'
      ?{market:'match-winner',selection:'Home',displaySelection:'1X2 · Home',odds:price,family:'1X2'}
      :{market:'match-winner',selection:'Away',displaySelection:'1X2 · Away',odds:price,family:'1X2'}
  }
  if(route==='FAV_2PLUS'){
    const price=num(odds.fav_2plus)
    if(!price)return null
    return side==='home'
      ?{market:'home-team-goals',selection:'Over 1.5',displaySelection:'Home Team · 2+',odds:price,family:'Team Goals'}
      :{market:'away-team-goals',selection:'Over 1.5',displaySelection:'Away Team · 2+',odds:price,family:'Team Goals'}
  }
  if(route==='OVER_2.5'){
    const price=num(odds.over25)
    if(!price)return null
    return{market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:price,family:'Goals'}
  }
  if(route==='GG'){
    const price=num(odds.btts_yes)
    if(!price)return null
    return{market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',odds:price,family:'BTTS'}
  }
  return null
}

function publicReasons(pick){
  const why=pick?.marketWhy||explainGoalsDecision({
    type:pick.classification,
    route:pick.route,
    raw:pick.route,
    rule:null,
    vetoes:[],
    odds:pick.oddsBook||{},
    home:pick.home,
    away:pick.away,
    favourite:pick.favourite
  })
  if(!why)return['No Goals Banker for this match.']
  return[why.headline,...why.passed.map(row=>`${row.label} was passed over: ${row.reason}`)]
}

const WHY_LABELS={FAV_WIN:'Favourite win',FAV_2PLUS:'Favourite 2+','OVER_2.5':'Over 2.5',GG:'GG'}
const WHY_ROUTES=['FAV_WIN','FAV_2PLUS','OVER_2.5','GG']
const whyPx=v=>finite(v)?Number(v).toFixed(2):null
const whyAt=p=>p?` at ${p}`:''
const whyShape=type=>type==='MISMATCH'?'a one-sided favourite':type==='STRONG'?'a clear favourite':type==='LEAN'?'a slight favourite':type==='BALANCED'?'an even match':'this matchup'

function whyHeadline({type,rule,route,vetoes,fav,prices}){
  const p=prices[route]
  if((vetoes||[]).includes('V2')&&route==='OVER_2.5'){
    return`Over 2.5${whyAt(p)} is the published Goals Banker. ${fav} to win was the favourite-side call, but both the total and both-teams prices were on, so Over 2.5 replaced the win.`
  }
  if((vetoes||[]).includes('V3')&&route==='FAV_WIN'){
    return`${fav} to win${whyAt(p)} is the published Goals Banker. Favourite 2+ was in front, but 2+ is too high, so the win is published instead.`
  }
  if(rule==='balanced-over-not-gg')return`Over 2.5${whyAt(p)} is the published Goals Banker. This is an even match: the total is on and GG is not, so Over 2.5 is taken. Favourite win and favourite 2+ are not used.`
  if(rule==='balanced-gg-not-over')return`Both teams to score${whyAt(p)} is the published Goals Banker. This is an even match: GG is on and Over 2.5 is not, so GG is taken. Favourite win and favourite 2+ are not used.`
  if(rule==='balanced-both-on-cheaper-over')return`Over 2.5${whyAt(p)} is the published Goals Banker. This is an even match and both goals markets are on — Over 2.5 is the shorter price, so it beats GG. Favourite win and favourite 2+ are not used.`
  if(rule==='balanced-both-on-cheaper-gg')return`Both teams to score${whyAt(p)} is the published Goals Banker. This is an even match and both goals markets are on — GG is the shorter price, so it beats Over 2.5. Favourite win and favourite 2+ are not used.`
  if(rule==='lean-over')return`Over 2.5${whyAt(p)} is the published Goals Banker. This is a slight favourite, so only a goals market is used. The total qualified; GG did not.`
  if(rule==='lean-gg')return`Both teams to score${whyAt(p)} is the published Goals Banker. This is a slight favourite, so only a goals market is used. GG qualified; Over 2.5 did not.`
  if(rule==='mismatch-2plus-short'||rule==='mismatch-2plus-short-win')return`${fav} 2+${whyAt(p)} is the published Goals Banker. This is a one-sided favourite and 2+ is priced tightly enough, so 2+ is taken ahead of the win, Over 2.5 and GG.`
  if(rule==='mismatch-win-over-high')return`${fav} to win${whyAt(p)} is the published Goals Banker. The win is short and Over 2.5 is not, so the win is taken instead of 2+ or a goals market.`
  if(rule==='mismatch-win-2plus-high')return`${fav} to win${whyAt(p)} is the published Goals Banker. Favourite 2+ is too high, so the win is published instead of 2+.`
  if(rule==='mismatch-over')return`Over 2.5${whyAt(p)} is the published Goals Banker. 2+ did not qualify and the total is short enough, so Over 2.5 is taken even in a one-sided game.`
  if(rule==='mismatch-win-fallback')return`${fav} to win${whyAt(p)} is the published Goals Banker. 2+ and Over 2.5 did not qualify, so the win is the published market.`
  if(rule==='strong-2plus')return`${fav} 2+${whyAt(p)} is the published Goals Banker. This is a clear favourite and 2+ is priced tightly enough, so 2+ is taken ahead of Over 2.5, the win and GG.`
  if(rule==='strong-over')return`Over 2.5${whyAt(p)} is the published Goals Banker. 2+ did not qualify; the total and both-teams prices are on, so Over 2.5 is taken instead of the win.`
  if(rule==='strong-win-2plus-high')return`${fav} to win${whyAt(p)} is the published Goals Banker. 2+ is too high and Over 2.5 did not qualify, so the win is published.`
  if(rule==='strong-win-short')return`${fav} to win${whyAt(p)} is the published Goals Banker. 2+ and Over 2.5 did not qualify, and the win is still short enough to publish.`
  const shape=whyShape(type)
  if(route==='FAV_2PLUS')return`${fav} 2+${whyAt(p)} is the published Goals Banker. This is ${shape}, and the favourite is priced to score at least twice.`
  if(route==='FAV_WIN')return`${fav} to win${whyAt(p)} is the published Goals Banker. This is ${shape}.`
  if(route==='OVER_2.5')return`Over 2.5${whyAt(p)} is the published Goals Banker. This is ${shape}.`
  if(route==='GG')return`Both teams to score${whyAt(p)} is the published Goals Banker. This is ${shape}.`
  return''
}

function whyPassed({type,rule,route,vetoes,other,fav,prices}){
  const b=prices[other]
  const even=type==='BALANCED'||type==='LEAN'
  const v2=(vetoes||[]).includes('V2')&&route==='OVER_2.5'
  if(other==='FAV_WIN'){
    if(v2)return`${fav} to win was the favourite-side call, then Over 2.5 replaced it because both the total and both-teams prices were on${b?` (win ${b})`:''}.`
    if(even)return`Favourite win is not used in ${whyShape(type)}. This pick is a goals market.`
    if(route==='FAV_2PLUS')return`2+ qualified ahead of the straight win — ${fav} is priced to score twice${b?` (win ${b})`:''}.`
    if(route==='OVER_2.5')return`Over 2.5 qualified instead of the win.`
    return`Favourite win is not the published market.`
  }
  if(other==='FAV_2PLUS'){
    if(even)return`Favourite 2+ is not used in ${whyShape(type)}. This pick is a shared goals market.`
    if(route==='FAV_WIN')return`${fav} 2+ did not qualify — the extra goal is not priced tightly enough${b?` (${b})`:''}.`
    if(route==='OVER_2.5')return`Favourite 2+ did not qualify ahead of the total${b?` (${b})`:''}.`
    if(route==='GG')return`This is not ${fav} running up 2+${b?` at ${b}`:''}. GG is the published both-teams market.`
    return`Favourite 2+ is not the published market${b?` (${b})`:''}.`
  }
  if(other==='OVER_2.5'){
    if(!b)return`Over 2.5 was not clearly priced, so it could not beat the published market.`
    if(route==='GG'){
      if(rule==='balanced-both-on-cheaper-gg')return`Both goals markets are on; GG is the shorter price, so Over 2.5 is not taken (${b}).`
      return`GG qualified as the both-teams market. Over 2.5 was not taken (${b}).`
    }
    if(route==='FAV_WIN')return`Over 2.5 is not short enough to replace the win (${b}).`
    if(route==='FAV_2PLUS')return`A shared total is not the call — 2+ qualified first, not Over 2.5 at ${b}.`
    return`Over 2.5 is not the published market (${b}).`
  }
  if(!b)return`GG was not clearly priced, so it could not beat the published market.`
  if(type==='MISMATCH'||type==='STRONG')return`GG is not used in ${whyShape(type)} — the opponent is not the scoring side this pick is built on (${b}).`
  if(route==='OVER_2.5'){
    if(rule==='balanced-both-on-cheaper-over'||v2)return`Both goals markets are on; Over 2.5 is the published total, so GG is not taken (${b}).`
    return`Over 2.5 qualified as the goals market. GG was not taken (${b}).`
  }
  return`GG is not the published market (${b}).`
}

export function explainGoalsDecision({type,rule,raw,route,vetoes,odds,home,away,favourite}){
  if(!WHY_ROUTES.includes(route))return null
  const fav=favourite==='home'?home:favourite==='away'?away:(home||'the favourite')
  const prices={FAV_WIN:whyPx(odds?.fav_odds),FAV_2PLUS:whyPx(odds?.fav_2plus),'OVER_2.5':whyPx(odds?.over25),GG:whyPx(odds?.btts_yes)}
  const ctx={type,rule,raw,route,vetoes:vetoes||[],fav,prices}
  return{
    route,
    chosen:WHY_LABELS[route],
    price:prices[route],
    headline:whyHeadline(ctx),
    passed:WHY_ROUTES.filter(id=>id!==route).map(id=>({id,label:WHY_LABELS[id],price:prices[id],reason:whyPassed({...ctx,other:id})}))
  }
}

function packPick(fixture,odds,decision,published){
  const lastMatchesHome=last5Overall(fixture?.home?.lastMatches||fixture?.home?.fixtures,fixture?.home?.id)
  const lastMatchesAway=last5Overall(fixture?.away?.lastMatches||fixture?.away?.fixtures,fixture?.away?.id)
  const last5Home=last5Form(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const last5Away=last5Form(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const pick={
    fixtureId:fixture.fixtureId,
    league:fixture.league,
    country:fixture.country,
    kickoff:fixture.kickoff,
    home:fixture.home?.name,
    away:fixture.away?.name,
    homeId:fixture.home?.id??null,
    awayId:fixture.away?.id??null,
    homeLogo:fixture.home?.logo||null,
    awayLogo:fixture.away?.logo||null,
    market:published.market,
    marketName:published.displaySelection,
    selection:published.selection,
    displaySelection:published.displaySelection,
    pick:published.displaySelection,
    odds:+Number(published.odds).toFixed(2),
    engine:ENGINE_ID,
    engineVersion:ENGINE_VERSION,
    route:decision.route,
    classification:decision.type,
    borderline:decision.type==='LEAN',
    favourite:odds.favourite,
    family:published.family,
    oddsBook:{
      fav_odds:odds.fav_odds,
      opp_odds:odds.opp_odds,
      draw_odds:odds.draw_odds,
      over25:odds.over25,
      btts_yes:odds.btts_yes,
      fav_2plus:odds.fav_2plus
    },
    homeSplit:fixture.homeSplit||null,
    awaySplit:fixture.awaySplit||null,
    earlySeason:fixture.earlySeason===true,
    sportyEventId:fixture.sportyEventId||null
  }
  const marketWhy=explainGoalsDecision({
    type:decision.type,
    rule:decision.rule,
    raw:decision.raw,
    route:decision.route,
    vetoes:decision.vetoes,
    odds,
    home:pick.home,
    away:pick.away,
    favourite:odds.favourite
  })
  if(marketWhy)pick.marketWhy=marketWhy
  return attachWhy(pick,fixture,{reasons:publicReasons(pick),last5Home,last5Away,lastMatchesHome,lastMatchesAway})
}

export function diagnoseGoalsBankerFixture(fixture){
  if(isSrlMatch(fixture))return{pick:null,skip:'srl'}
  if(!fixtureHasStats(fixture))return{pick:null,skip:'no-stats'}
  const odds=extractGoalsBankerOdds(fixture)
  const decision=decideGoalsBanker(odds)
  if(decision.route==='SKIP')return{pick:null,skip:decision.skip||'skip',odds,type:decision.type}
  const published=publishedFor(decision.route,odds)
  if(!published)return{pick:null,skip:'missing-published-odds',odds,type:decision.type,route:decision.route}
  return{pick:packPick(fixture,odds,decision,published),skip:null,odds,type:decision.type,route:decision.route}
}

export function evaluateGoalsBankerFixture(fixture){
  return diagnoseGoalsBankerFixture(fixture).pick
}

export function canAddAccaLeg(slip,pick){
  const legs=Array.isArray(slip)?slip:[]
  if(!pick||pick.route==='SKIP')return{ok:false,reason:'no-pick'}
  if(String(pick.market||'')==='goals-streak-2'||pick.route==='STREAK')return{ok:false,reason:'streak-not-on-slip'}
  if(legs.length>=3)return{ok:false,reason:'max-3'}
  if(legs.some(row=>String(row.fixtureId)===String(pick.fixtureId)))return{ok:false,reason:'same-match'}
  const next=[...legs,pick]
  if(next.filter(row=>row.route==='FAV_WIN').length>1)return{ok:false,reason:'max-1-fav-win'}
  if(next.length===3&&!next.some(row=>row.route==='OVER_2.5'||row.route==='GG'))return{ok:false,reason:'need-goals-leg'}
  const hasLean=legs.some(row=>row.classification==='LEAN'||row.borderline===true)
  if(hasLean&&(pick.classification==='LEAN'||pick.borderline===true||pick.classification==='STRONG')){
    return{ok:false,reason:'borderline-lean'}
  }
  return{ok:true,reason:null,legs:next}
}

export function buildGoalsBankerBoard(fixtures,meta={}){
  const diagnosed=(fixtures||[]).map(fixture=>({fixture,result:diagnoseGoalsBankerFixture(fixture)}))
  const qualified=diagnosed.map(row=>row.result.pick).filter(Boolean)
    .sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(a.odds)-Number(b.odds))
  const skipped=diagnosed.filter(row=>!row.result.pick).reduce((map,row)=>{
    const key=row.result.skip||'unknown'
    map[key]=(map[key]||0)+1
    return map
  },{})
  return{
    meta:{
      ...meta,
      engineVersion:ENGINE_VERSION,
      engine:ENGINE_ID,
      qualified:qualified.length,
      bestPicks:qualified.length,
      skipped,
      publishedRoutes:['FAV_WIN','FAV_2PLUS','OVER_2.5','GG']
    },
    priority:qualified,
    bestPicks:qualified,
    availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()
  }
}
