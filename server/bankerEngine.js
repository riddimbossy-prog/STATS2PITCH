import {FINISHED,FORM_SAMPLE} from './config.js'
import {buildTransitionProfile,evaluateTransitionSafety} from './transitionSafety.js'

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const round2=v=>Math.round(Number(v)*100)/100
const pct=(hits,total)=>total?Math.round(hits*1000/total)/10:null
const finished=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())

export const BANKER_RULES=Object.freeze({
  homeRedFlagPPG:1.0,
  straightHomeMinPPG:2.5,
  straightHomeMinGF:2.5,
  straightHomeMaxGA:1.2,
  straightHomeMinFactors:2,
  straightAwayMaxPPG:1.0,
  straightAwayMinGA:2.0,
  straightAwayMinLossRate:60,
  notWinHomeMinPPG:1.5,
  notWinAwayMaxPPG:1.0,
  notWinAwayMinGA:2.5,
  notWinAwayMinLossRate:80,
  notWinAwayMinFactors:1,
  awayStrengthMinPPG:1.5,
  awayStrengthMinGF:2.0,
  awayStrengthMinGA:1.0,
  balancedPPG:1.5,
  balancedAttack:2.0,
  topFive:5,
  leagueMinMatches:20,
  highLeagueOver25:56,
  highLeagueAvgGoals:2.8,
  lowLeagueMaxOver25:50,
  lowLeagueMaxAvgGoals:2.6,
  drawHeavyMinRate:30
})

function profile(fixtures,teamId,venue){
  const rows=(fixtures||[]).filter(f=>finished(f)).slice(0,FORM_SAMPLE)
  let points=0,gf=0,ga=0,wins=0,draws=0,losses=0
  for(const f of rows){
    const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
    if(!finite(h)||!finite(a))continue
    const own=venue==='home'?h:a,opp=venue==='home'?a:h
    gf+=own;ga+=opp
    if(own>opp){wins++;points+=3}else if(own===opp){draws++;points+=1}else losses++
  }
  const played=wins+draws+losses
  return{
    played,
    ready:played>=FORM_SAMPLE,
    ppg:played?round2(points/played):null,
    avgGF:played?round2(gf/played):null,
    avgGA:played?round2(ga/played):null,
    winRate:played?pct(wins,played):null,
    drawRate:played?pct(draws,played):null,
    lossRate:played?pct(losses,played):null,
    record:`${wins}W ${draws}D ${losses}L`
  }
}

export function buildLeagueScoringProfile(history=[]){
  const rows=(history||[]).filter(f=>finished(f)&&finite(f?.goals?.home)&&finite(f?.goals?.away))
  let goals=0,draws=0,over25=0
  for(const f of rows){
    const h=Number(f.goals.home),a=Number(f.goals.away),t=h+a
    goals+=t;if(h===a)draws++;if(t>2.5)over25++
  }
  const matches=rows.length,avgGoals=matches?round2(goals/matches):null,drawRate=matches?pct(draws,matches):null,over25Rate=matches?pct(over25,matches):null
  let className='insufficient'
  if(matches>=BANKER_RULES.leagueMinMatches){
    if(Number(over25Rate)>=BANKER_RULES.highLeagueOver25||Number(avgGoals)>=BANKER_RULES.highLeagueAvgGoals)className='high-scoring'
    else if(Number(over25Rate)<BANKER_RULES.lowLeagueMaxOver25&&Number(avgGoals)<=BANKER_RULES.lowLeagueMaxAvgGoals&&Number(drawRate)>=BANKER_RULES.drawHeavyMinRate)className='low-scoring-draw-heavy'
    else className='neutral'
  }
  return{class:className,matches,avgGoals,drawRate,over25Rate}
}

function sameTopFive(f){
  const hp=Number(f?.homeSplit?.position),ap=Number(f?.awaySplit?.position)
  return finite(hp)&&finite(ap)&&hp<=BANKER_RULES.topFive&&ap<=BANKER_RULES.topFive
}

function basePick(f,home,away,leagueProfile){
  return{
    fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
    home:f.home.name,away:f.away.name,homeLogo:f.home.logo||null,awayLogo:f.away.logo||null,
    homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,
    metrics:{home,away,league:leagueProfile},
    engine:'banker-rules-v3-transition-safe'
  }
}

function candidate(rule,market,selection,displaySelection,priority,reasons,ruleMeta={}){
  return{rule,market,selection,displaySelection,priority,reasons,ruleMeta}
}

function countPassed(checks){return checks.filter(x=>x.ok).length}
function passedLabels(checks){return checks.filter(x=>x.ok).map(x=>x.label)}
function isRedirectGoal(c){return c.market==='total-goals'&&(c.selection==='Over 1.5'||c.selection==='Over 2.5')}

export function evaluateBankerFixture(f,{ignoreTransition=false}={}){
  const home=profile(f?.home?.fixtures,f?.home?.id,'home'),away=profile(f?.away?.fixtures,f?.away?.id,'away'),leagueProfile=f?.bankerLeagueProfile||{class:'insufficient'}
  if(!home.ready||!away.ready)return{pick:null,skip:'incomplete-5+5'}
  if(f?.earlySeason===true)return{pick:null,skip:'early-season'}
  if(Number(home.ppg)<BANKER_RULES.homeRedFlagPPG)return{pick:null,skip:'home-under-1-ppg'}
  if(sameTopFive(f))return{pick:null,skip:'both-top-five'}

  const transitionProfiles={
    home:buildTransitionProfile(f?.home?.fixtures,f?.home?.id),
    away:buildTransitionProfile(f?.away?.fixtures,f?.away?.id)
  }
  const winTransition=ignoreTransition?null:evaluateTransitionSafety({stronger:transitionProfiles.home,weaker:transitionProfiles.away,mode:'win',strongerName:f.home.name,weakerName:f.away.name})
  const notLoseTransition=ignoreTransition?null:evaluateTransitionSafety({stronger:transitionProfiles.home,weaker:transitionProfiles.away,mode:'not-lose',strongerName:f.home.name,weakerName:f.away.name})
  let leakRedirect=false
  const candidates=[]

  const straightHomeChecks=[
    {key:'home-ppg',ok:Number(home.ppg)>=BANKER_RULES.straightHomeMinPPG,label:`PPG ${home.ppg} ≥ 2.50`},
    {key:'home-gf',ok:Number(home.avgGF)>=BANKER_RULES.straightHomeMinGF,label:`GF avg ${home.avgGF} ≥ 2.50`},
    {key:'home-ga',ok:Number(home.avgGA)<BANKER_RULES.straightHomeMaxGA,label:`GA avg ${home.avgGA} < 1.20`}
  ]
  const straightAwayChecks=[
    {key:'away-ppg',ok:Number(away.ppg)<BANKER_RULES.straightAwayMaxPPG,label:`Away PPG ${away.ppg} < 1.00`},
    {key:'away-ga',ok:Number(away.avgGA)>=BANKER_RULES.straightAwayMinGA,label:`Away GA avg ${away.avgGA} ≥ 2.00`},
    {key:'away-loss',ok:Number(away.lossRate)>=BANKER_RULES.straightAwayMinLossRate,label:`Away loss rate ${away.lossRate}% ≥ 60%`}
  ]
  const straightHomeFactorCount=countPassed(straightHomeChecks)
  const straightAwayAllPass=straightAwayChecks.every(x=>x.ok)
  if(!ignoreTransition&&straightHomeFactorCount>=BANKER_RULES.straightHomeMinFactors&&straightAwayAllPass&&winTransition?.redirectGoals)leakRedirect=true

  if(straightHomeFactorCount>=BANKER_RULES.straightHomeMinFactors&&straightAwayAllPass&&(ignoreTransition||winTransition?.allowed))candidates.push(candidate(
    'HOME_STRAIGHT_WIN','match-winner','Home',`${f.home.name} Straight Win`,100,
    [
      `Home qualifies on ${straightHomeFactorCount}/3 strength factors: ${passedLabels(straightHomeChecks).join(' · ')}`,
      `Away weakness is non-negotiable and all 3 factors pass: ${passedLabels(straightAwayChecks).join(' · ')}`,
      ...(winTransition?.allowed?[`Transition safety passed: score-first, lead-hold, opponent concede-first/stay-down and comeback checks.`]:[])
    ],
    {homeFactorsPassed:straightHomeFactorCount,homeFactorsRequired:BANKER_RULES.straightHomeMinFactors,awayFactorsPassed:3,awayFactorsRequired:3,transitionSafety:winTransition}
  ))

  const notWinAwayChecks=[
    {key:'away-ppg',ok:Number(away.ppg)<BANKER_RULES.notWinAwayMaxPPG,label:`Away PPG ${away.ppg} < 1.00`},
    {key:'away-ga',ok:Number(away.avgGA)>=BANKER_RULES.notWinAwayMinGA,label:`Away GA avg ${away.avgGA} ≥ 2.50`},
    {key:'away-loss',ok:Number(away.lossRate)>=BANKER_RULES.notWinAwayMinLossRate,label:`Away loss rate ${away.lossRate}% ≥ 80%`}
  ]
  const notWinAwayFactorCount=countPassed(notWinAwayChecks)
  const notWinHomePass=Number(home.ppg)>=BANKER_RULES.notWinHomeMinPPG
  if(!ignoreTransition&&notWinHomePass&&notWinAwayFactorCount>=BANKER_RULES.notWinAwayMinFactors&&notLoseTransition?.redirectGoals)leakRedirect=true

  if(notWinHomePass&&notWinAwayFactorCount>=BANKER_RULES.notWinAwayMinFactors&&(ignoreTransition||notLoseTransition?.allowed))candidates.push(candidate(
    'AWAY_TEAM_NOT_TO_WIN','double-chance','Home or Draw',`${f.away.name} Not to Win`,90,
    [
      `Home PPG ${home.ppg} ≥ 1.50 is the mandatory constant`,
      `Away qualifies on ${notWinAwayFactorCount}/3 weakness factors: ${passedLabels(notWinAwayChecks).join(' · ')}`,
      ...(notLoseTransition?.allowed?[`Transition safety passed before the not-to-lose decision.`]:[])
    ],
    {homePPGMandatory:true,awayFactorsPassed:notWinAwayFactorCount,awayFactorsRequired:BANKER_RULES.notWinAwayMinFactors,transitionSafety:notLoseTransition}
  ))

  const bothBalanced=Number(home.ppg)>=BANKER_RULES.balancedPPG&&Number(away.ppg)>=BANKER_RULES.balancedPPG
  const oneStrongAttack=Number(home.avgGF)>=BANKER_RULES.balancedAttack||Number(away.avgGF)>=BANKER_RULES.balancedAttack
  if(bothBalanced&&oneStrongAttack){
    if(leagueProfile.class==='high-scoring')candidates.push(candidate(
      'BALANCED_HIGH_SCORING_OVER25','total-goals','Over 2.5','Over 2.5 Total Goals',80,
      [`Both teams have at least 1.50 split PPG (${home.ppg} / ${away.ppg})`,`At least one attack averages 2.00+ goals (${home.avgGF} / ${away.avgGF})`,`League is high-scoring: O2.5 ${leagueProfile.over25Rate}%, avg goals ${leagueProfile.avgGoals}`]
    ))
    else if(leagueProfile.class==='low-scoring-draw-heavy')candidates.push(candidate(
      'BALANCED_LOW_SCORING_OVER15','total-goals','Over 1.5','Over 1.5 Total Goals',75,
      [`Both teams have at least 1.50 split PPG (${home.ppg} / ${away.ppg})`,`At least one attack averages 2.00+ goals (${home.avgGF} / ${away.avgGF})`,`League is low-scoring/draw-heavy, so the line is reduced to Over 1.5`]
    ))
  }

  if(Number(away.ppg)>=BANKER_RULES.awayStrengthMinPPG&&Number(away.avgGF)>=BANKER_RULES.awayStrengthMinGF&&Number(away.avgGA)>=BANKER_RULES.awayStrengthMinGA)candidates.push(candidate(
    'AWAY_STRENGTH_OVER15','total-goals','Over 1.5','Over 1.5 Total Goals',70,
    [`Away split PPG ${away.ppg} ≥ 1.50`,`Away scores ${away.avgGF} per match ≥ 2.00`,`Away concedes ${away.avgGA} per match ≥ 1.00`]
  ))

  let pool=candidates
  if(!ignoreTransition&&leakRedirect){
    pool=candidates.filter(isRedirectGoal).map(c=>({...c,ruleMeta:{...c.ruleMeta,transitionRedirect:{reason:'stronger-team-leaks-over-80',stronger:transitionProfiles.home,weaker:transitionProfiles.away}}}))
    if(!pool.length)return{pick:null,skip:'transition-goal-redirect-unqualified'}
  }
  if(!pool.length){
    const transitionFailed=!ignoreTransition&&(
      (straightHomeFactorCount>=BANKER_RULES.straightHomeMinFactors&&straightAwayAllPass&&!winTransition?.allowed)||
      (notWinHomePass&&notWinAwayFactorCount>=BANKER_RULES.notWinAwayMinFactors&&!notLoseTransition?.allowed)
    )
    return{pick:null,skip:transitionFailed?'transition-safety-failed':'no-rule-qualified'}
  }

  pool.sort((a,b)=>b.priority-a.priority)
  const winner=pool[0]
  return{pick:{...basePick(f,home,away,leagueProfile),...winner,alsoQualified:pool.slice(1).map(x=>x.rule)},skip:null}
}

export function buildBankerRules(fixtures=[]){
  const picks=[],skipCounts={}
  for(const f of fixtures){
    const result=evaluateBankerFixture(f)
    if(result.pick)picks.push(result.pick)
    else skipCounts[result.skip]=(skipCounts[result.skip]||0)+1
  }
  picks.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)||b.priority-a.priority)
  return{picks,meta:{engine:'banker-rules-v3-transition-safe',count:picks.length,skips:skipCounts,rules:BANKER_RULES}}
}
