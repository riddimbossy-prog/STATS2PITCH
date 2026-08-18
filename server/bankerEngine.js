import {FINISHED,FORM_SAMPLE} from './config.js'

const finite=v=>Number.isFinite(Number(v))
const round2=v=>Math.round(Number(v)*100)/100
const pct=(hits,total)=>total?Math.round(hits*1000/total)/10:null
const finished=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())

export const BANKER_RULES=Object.freeze({
  homeRedFlagPPG:1.0,
  strongHomePPG:2.5,
  balancedPPG:1.5,
  strongAttack:2.0,
  strongHomeMaxGA:1.2,
  weakAwayMaxPPG:1.0,
  weakAwayMinGA:2.0,
  weakAwayMinLossRate:60,
  awayGoalsMinGA:1.0,
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
    engine:'banker-rules-v1'
  }
}

function candidate(rule,market,selection,displaySelection,priority,reasons){return{rule,market,selection,displaySelection,priority,reasons}}

export function evaluateBankerFixture(f){
  const home=profile(f?.home?.fixtures,f?.home?.id,'home'),away=profile(f?.away?.fixtures,f?.away?.id,'away'),leagueProfile=f?.bankerLeagueProfile||{class:'insufficient'}
  if(!home.ready||!away.ready)return{pick:null,skip:'incomplete-5+5'}
  if(f?.earlySeason===true)return{pick:null,skip:'early-season'}
  if(Number(home.ppg)<BANKER_RULES.homeRedFlagPPG)return{pick:null,skip:'home-under-1-ppg'}
  if(sameTopFive(f))return{pick:null,skip:'both-top-five'}

  const candidates=[]
  const weakAway=Number(away.ppg)<BANKER_RULES.weakAwayMaxPPG&&Number(away.avgGA)>=BANKER_RULES.weakAwayMinGA&&Number(away.lossRate)>=BANKER_RULES.weakAwayMinLossRate
  const strongHome=Number(home.ppg)>=BANKER_RULES.strongHomePPG&&Number(home.avgGF)>=BANKER_RULES.strongAttack&&Number(home.avgGA)<BANKER_RULES.strongHomeMaxGA

  if(strongHome&&weakAway)candidates.push(candidate(
    'HOME_STRAIGHT_WIN','match-winner','Home',`${f.home.name} Straight Win`,100,
    [`Home split PPG ${home.ppg} ≥ 2.50`,`Home scores ${home.avgGF} per match and concedes ${home.avgGA} < 1.20`,`Away split PPG ${away.ppg} < 1.00, concedes ${away.avgGA} and loses ${away.lossRate}%`]
  ))

  if(weakAway&&Number(home.ppg)>=BANKER_RULES.balancedPPG)candidates.push(candidate(
    'AWAY_TEAM_NOT_TO_WIN','double-chance','Home or Draw',`${f.away.name} Not to Win`,90,
    [`Away split PPG ${away.ppg} < 1.00`,`Away concedes ${away.avgGA} per match and loses ${away.lossRate}%`,`Home split PPG ${home.ppg} provides opposition strength`]
  ))

  const bothBalanced=Number(home.ppg)>=BANKER_RULES.balancedPPG&&Number(away.ppg)>=BANKER_RULES.balancedPPG
  const oneStrongAttack=Number(home.avgGF)>=BANKER_RULES.strongAttack||Number(away.avgGF)>=BANKER_RULES.strongAttack
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

  if(Number(away.ppg)>=BANKER_RULES.balancedPPG&&Number(away.avgGF)>=BANKER_RULES.strongAttack&&Number(away.avgGA)>=BANKER_RULES.awayGoalsMinGA)candidates.push(candidate(
    'AWAY_STRENGTH_OVER15','total-goals','Over 1.5','Over 1.5 Total Goals',70,
    [`Away split PPG ${away.ppg} ≥ 1.50`,`Away scores ${away.avgGF} per match ≥ 2.00`,`Away concedes ${away.avgGA} per match ≥ 1.00`]
  ))

  // The requested both-under-1-PPG Under rule is intentionally subordinate to the
  // global home-under-1-PPG red flag above, so it cannot publish while that hard skip exists.

  if(!candidates.length)return{pick:null,skip:'no-rule-qualified'}
  candidates.sort((a,b)=>b.priority-a.priority)
  const winner=candidates[0]
  return{pick:{...basePick(f,home,away,leagueProfile),...winner,alsoQualified:candidates.slice(1).map(x=>x.rule)},skip:null}
}

export function buildBankerRules(fixtures=[]){
  const picks=[],skipCounts={}
  for(const f of fixtures){
    const result=evaluateBankerFixture(f)
    if(result.pick)picks.push(result.pick)
    else skipCounts[result.skip]=(skipCounts[result.skip]||0)+1
  }
  picks.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)||b.priority-a.priority)
  return{picks,meta:{engine:'banker-rules-v1',count:picks.length,skips:skipCounts,rules:BANKER_RULES}}
}
