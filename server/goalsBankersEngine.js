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
  if(type==='BALANCED'){
    if(lte(odds.over25,1.60)&&gt(odds.btts_yes,1.80))return'OVER_2.5'
    if(lte(odds.btts_yes,1.72)&&gt(odds.over25,1.70))return'GG'
    if(lte(odds.over25,1.65)&&lte(odds.btts_yes,1.75))return lte(odds.over25,odds.btts_yes)?'OVER_2.5':'GG'
    return'SKIP'
  }
  if(type==='LEAN'){
    if(lte(odds.over25,1.58))return'OVER_2.5'
    if(lte(odds.btts_yes,1.68))return'GG'
    return'SKIP'
  }
  if(type==='MISMATCH'){
    if(lte(odds.fav_2plus,1.38))return'FAV_2PLUS'
    if(lte(odds.fav_2plus,1.48)&&lte(odds.fav_odds,1.32))return'FAV_2PLUS'
    if(lte(odds.fav_odds,1.35)&&gte(odds.over25,1.75))return'FAV_WIN'
    if(lte(odds.fav_odds,1.40)&&gte(odds.fav_2plus,1.55))return'FAV_WIN'
    if(lte(odds.over25,1.50)&&lte(odds.fav_2plus,1.45))return'OVER_2.5'
    return'FAV_WIN'
  }
  if(type==='STRONG'){
    if(lte(odds.fav_2plus,1.42))return'FAV_2PLUS'
    if(lte(odds.over25,1.52)&&lte(odds.btts_yes,1.75))return'OVER_2.5'
    if(lte(odds.fav_odds,1.50)&&gte(odds.fav_2plus,1.55))return'FAV_WIN'
    if(lte(odds.fav_odds,1.48))return'FAV_WIN'
    return'SKIP'
  }
  return'SKIP'
}

export function applyVetoes(pick,type,odds){
  let next=pick
  if(next==='FAV_WIN'&&(type==='BALANCED'||type==='LEAN'))next='SKIP'
  if(next==='FAV_WIN'&&lte(odds.btts_yes,1.62)&&lte(odds.over25,1.60))next='OVER_2.5'
  if(next==='FAV_2PLUS'&&gte(odds.fav_2plus,1.55)){
    next=type==='MISMATCH'&&lte(odds.fav_odds,1.33)?'FAV_WIN':'SKIP'
  }
  if(next==='GG'&&type==='MISMATCH')next='SKIP'
  if(next==='GG'&&gte(odds.opp_odds,5.50))next='SKIP'
  if(next==='OVER_2.5'&&gte(odds.over25,1.80))next='SKIP'
  if(next==='FAV_WIN'&&gt(odds.fav_odds,1.55))next='SKIP'
  return next
}

export function decideGoalsBanker(odds){
  const streak=num(odds?.streak_yes)
  if(!finite(streak)||lt(streak,STREAK_MIN)||gt(streak,STREAK_MAX)){
    return{route:'SKIP',type:null,skip:'streak-gate',odds}
  }
  if(!finite(odds?.fav_odds)||!odds?.favourite){
    return{route:'SKIP',type:null,skip:'fav-unclear',odds}
  }
  const type=classifyMatch(odds)
  if(!type)return{route:'SKIP',type:null,skip:'unclassified',odds}
  const raw=pickMarket(type,odds)
  const route=applyVetoes(raw,type,odds)
  return{route,type,raw,skip:route==='SKIP'?'veto-or-no-route':null,odds}
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
  const fav=pick.favourite==='home'?pick.home:pick.away
  const price=Number(pick.odds).toFixed(2)
  if(pick.route==='FAV_WIN')return[`${fav} is the priced favourite at ${price}.`]
  if(pick.route==='FAV_2PLUS')return[`${fav} 2+ is the published Goals Banker at ${price}.`]
  if(pick.route==='OVER_2.5')return[`Over 2.5 at ${price} is the Goals Banker for this match.`]
  if(pick.route==='GG')return[`Both teams to score at ${price} is the Goals Banker.`]
  return['No Goals Banker for this match.']
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
