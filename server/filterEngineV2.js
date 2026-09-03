import {ENGINE_VERSION,FINISHED,FORM_SAMPLE} from './config.js'
import {venueMetrics} from './awayFavEngine.js'
import {attachWhy,last5Form,last5Overall,fixtureHasStats} from './pickWhy.js'
import {learningAllows, stampLearning} from './learning.js'
import {isSrlMatch} from './redFlags.js'

export const ENGINE_ID='sporty-filter-v2'
export const RULES=Object.freeze({
  winMin:1.20,
  winMax:1.55,
  over15Max:1.30,
  over15Under35Min:1.39,
  under35Max:1.30,
  under35Over15Min:1.39,
  over25Max:1.50,
  over25Under35Min:1.60,
  under25Max:1.52,
  under25Over15Min:1.60,
  ggYesMax:1.50,
  gg2NoMin:1.30,
  directionMin:60,
  candidateMinScore:70,
  marketSeparationMin:8,
  topN:5,
  bottomN:3,
  minVenueMatches:5,
  baselineVenueSample:10,
  recentWeight:0.60,
  baselineWeight:0.40,
  similarPpg:0.35,
  similarGf:0.40,
  similarGa:0.40,
  noH2hPpgGap:0.30,
  h2hMinMatches:3,
  drawResistanceMax:3.60,
  drawClearMin:4.00,
  drawExtremeMin:4.50,
  streakMin:1.10,
  streakMax:1.50,
  ggOppGoalLiveMax:1.58,
  ggOppGoalColdMin:1.70,
  teamGoalLiveMax:1.55,
  teamGoalColdMin:1.70,
  favTwoGoalStrongMax:1.45,
  favTwoGoalSupportMax:1.60
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0))
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const done=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
const atVenue=(f,id,venue)=>venue==='home'?String(f?.teams?.home?.id)===String(id):String(f?.teams?.away?.id)===String(id)
const DOMESTIC_CUP=/\b(cup|copa|coppa|pokal|fa cup|league cup|knockout|play[- ]?offs?|qualification|qualifier|trophy|super cup|community shield|elimination)\b/i
const EUROPE_COMP=/\b(champions league|europa league|conference league)\b/i
const KNOCKOUT_STAGE=/\b(qualif(?:ication|ier|ying)?|play[- ]?offs?|round of|last 16|last 32|1 8|1 16|quarter(?:final)?|semi(?:final)?|final|knockout|elimination)\b/i

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

function gg2NoOdd(markets){
  const direct=oddOf(markets,'both-teams-score-2',['No'])
  if(direct)return direct
  return scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return (/gg.?ng.?2|gg 2|btts 2|both teams.*2/.test(blob)||key==='both-teams-score-2'||key==='60000')&&/\bno\b/.test(name)
  })
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

function streakYesOdd(markets){
  const direct=oddOf(markets,'goals-streak-2',['Yes'])
  if(direct)return direct
  return scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return (key==='goals-streak-2'||/goal(?:s)? streak|2 or more goals in a row|consecutive goals/.test(blob))&&/\byes\b/.test(name)
  })
}

export function extractFilterOdds(fixture){
  const markets=fixture?.marketOdds||[]
  const homeName=fixture?.home?.name||''
  const awayName=fixture?.away?.name||''
  return{
    homeWin:oddOf(markets,'match-winner',['Home','1']),
    drawWin:oddOf(markets,'match-winner',['Draw','X']),
    awayWin:oddOf(markets,'match-winner',['Away','2']),
    over15:oddOf(markets,'total-goals',['Over 1.5','O 1.5']),
    under35:oddOf(markets,'total-goals',['Under 3.5','U 3.5']),
    over25:oddOf(markets,'total-goals',['Over 2.5','O 2.5']),
    under25:oddOf(markets,'total-goals',['Under 2.5','U 2.5']),
    ggYes:oddOf(markets,'both-teams-score',['Yes']),
    gg2No:gg2NoOdd(markets),
    homeO05:teamGoalOdd(markets,'home',0.5,homeName),
    awayO05:teamGoalOdd(markets,'away',0.5,awayName),
    homeO15:teamGoalOdd(markets,'home',1.5,homeName),
    awayO15:teamGoalOdd(markets,'away',1.5,awayName),
    streakYes:streakYesOdd(markets)
  }
}

export function isCupCompetition(name){
  const value=norm(name)
  return DOMESTIC_CUP.test(value)||EUROPE_COMP.test(value)
}

function shouldSkipCupFixture(fixture){
  const league=norm(fixture?.league)
  if(EUROPE_COMP.test(league)){
    const stage=norm(fixture?.round||fixture?.stage||fixture?.leagueRound||fixture?.fixture?.round||'')
    return KNOCKOUT_STAGE.test(`${league} ${stage}`)
  }
  return DOMESTIC_CUP.test(league)
}

function tierFromSplit(split){
  const position=num(split?.position),size=num(split?.size)
  if(!position||!size||position<1||size<2||position>size||split?.sampleReady===false)return null
  const band=Math.max(1,Math.min(4,Math.ceil((position*4)/size)))
  return ['A','B','C','D'][band-1]
}

function isBottomThree(split){
  const position=num(split?.position),size=num(split?.size)
  return !!position&&!!size&&position>size-RULES.bottomN
}

function tableGate(homeSplit,awaySplit){
  const hp=num(homeSplit?.position),ap=num(awaySplit?.position)
  const hs=num(homeSplit?.size),as=num(awaySplit?.size)
  if(!hp||!ap||!hs||!as)return{ok:true,skip:null,verified:false,homeTier:null,awayTier:null}
  const homeTier=tierFromSplit(homeSplit),awayTier=tierFromSplit(awaySplit)
  if(hp<=RULES.topN&&ap<=RULES.topN)return{ok:false,skip:'both-top-five',verified:true,homeTier,awayTier}
  if(hp>hs-RULES.bottomN&&ap>as-RULES.bottomN)return{ok:false,skip:'both-bottom-three',verified:true,homeTier,awayTier}
  if(homeTier&&awayTier&&homeTier===awayTier)return{ok:false,skip:'same-tier',verified:true,homeTier,awayTier}
  return{ok:true,skip:null,verified:true,homeTier,awayTier}
}

function similarForm(home,away){
  if(home.ppg===null||away.ppg===null||home.gf===null||away.gf===null||home.ga===null||away.ga===null)return false
  return Math.abs(away.ppg-home.ppg)<RULES.similarPpg
    &&Math.abs(away.gf-home.gf)<RULES.similarGf
    &&Math.abs(away.ga-home.ga)<RULES.similarGa
}

function pricedFavourite(odds){
  if(!odds.homeWin||!odds.awayWin)return null
  if(odds.homeWin<odds.awayWin)return{side:'home',odd:odds.homeWin,selection:'Home',displaySelection:'1X2 · Home'}
  if(odds.awayWin<odds.homeWin)return{side:'away',odd:odds.awayWin,selection:'Away',displaySelection:'1X2 · Away'}
  return null
}

function sameTeam(a,b){
  const x=norm(a),y=norm(b)
  return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))
}

function h2hAgainstFav(h2h,side,homeName,awayName){
  const favName=side==='home'?homeName:awayName
  let n=0,against=0
  for(const row of h2h||[]){
    if(!finite(row?.hs)||!finite(row?.as))continue
    const favHome=sameTeam(row.home,favName)
    const favAway=sameTeam(row.away,favName)
    if(!favHome&&!favAway)continue
    n++
    const favScore=favHome?Number(row.hs):Number(row.as)
    const oppScore=favHome?Number(row.as):Number(row.hs)
    if(favScore<=oppScore)against++
  }
  return{ready:n>=RULES.h2hMinMatches,majority:n?against>n/2:false,n,against}
}

function favConflict(fixture,home,away,side){
  const fav=side==='home'?home:away
  const opp=side==='home'?away:home
  const h2h=h2hAgainstFav(fixture?.h2h,side,fixture?.home?.name,fixture?.away?.name)
  const statsWorse=fav.ppg!==null&&opp.ppg!==null&&fav.ppg<opp.ppg
  if(h2h.ready)return h2h.majority&&statsWorse
  if(fav.ppg===null||opp.ppg===null)return false
  return fav.ppg+RULES.noH2hPpgGap<opp.ppg
}

function venueRows(fixtures,teamId,venue,limit=FORM_SAMPLE){
  return (fixtures||[]).filter(f=>done(f)&&atVenue(f,teamId,venue))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,limit)
}

function full(f,id){
  const h=num(f?.goals?.home),a=num(f?.goals?.away)
  if(h===null||a===null)return null
  return String(f?.teams?.home?.id)===String(id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}

function venueRate(fixtures,teamId,venue,test,limit=FORM_SAMPLE){
  let t=0,h=0
  for(const row of venueRows(fixtures,teamId,venue,limit)){
    const g=full(row,teamId)
    if(!g)continue
    t++
    if(test(g))h++
  }
  return{rate:t?Math.round(h*100/t):null,sample:t}
}

function directionTest(route,side){
  if(route==='straight-win'){
    if(side==='home')return{home:g=>g.own>g.opp,away:g=>g.own<g.opp}
    return{home:g=>g.own<g.opp,away:g=>g.own>g.opp}
  }
  if(route==='over-15')return{home:g=>g.total>1.5,away:g=>g.total>1.5}
  if(route==='under-35')return{home:g=>g.total<3.5,away:g=>g.total<3.5}
  if(route==='over-25')return{home:g=>g.total>2.5,away:g=>g.total>2.5}
  if(route==='under-25')return{home:g=>g.total<2.5,away:g=>g.total<2.5}
  if(route==='gg')return{home:g=>g.own>0&&g.opp>0,away:g=>g.own>0&&g.opp>0}
  return null
}

function blendedRate(recent,baseline){
  if(recent?.rate===null||recent?.rate===undefined)return null
  const base=baseline?.rate===null||baseline?.rate===undefined?recent.rate:baseline.rate
  return Math.round(Number(recent.rate)*RULES.recentWeight+Number(base)*RULES.baselineWeight)
}

function directionAgree(fixture,route,side){
  const tests=directionTest(route,side)
  if(!tests)return{ok:false,home:null,away:null,consensus:null}
  const recentHome=venueRate(fixture?.home?.fixtures,fixture?.home?.id,'home',tests.home,FORM_SAMPLE)
  const recentAway=venueRate(fixture?.away?.fixtures,fixture?.away?.id,'away',tests.away,FORM_SAMPLE)
  const baselineHome=venueRate(fixture?.home?.fixtures,fixture?.home?.id,'home',tests.home,RULES.baselineVenueSample)
  const baselineAway=venueRate(fixture?.away?.fixtures,fixture?.away?.id,'away',tests.away,RULES.baselineVenueSample)
  const home=blendedRate(recentHome,baselineHome)
  const away=blendedRate(recentAway,baselineAway)
  const consensus=home!=null&&away!=null?Math.min(home,away):null
  const recentConsensus=recentHome.rate!=null&&recentAway.rate!=null?Math.min(recentHome.rate,recentAway.rate):null
  const baselineConsensus=baselineHome.rate!=null&&baselineAway.rate!=null?Math.min(baselineHome.rate,baselineAway.rate):null
  const recentOk=recentHome.rate!=null&&recentAway.rate!=null&&recentHome.rate>=RULES.directionMin&&recentAway.rate>=RULES.directionMin
  return{
    ok:recentOk&&consensus!=null&&consensus>=RULES.directionMin,
    home,away,consensus,
    recentHome:recentHome.rate,recentAway:recentAway.rate,recentConsensus,
    baselineHome:baselineHome.rate,baselineAway:baselineAway.rate,baselineConsensus,
    recentSamples:{home:recentHome.sample,away:recentAway.sample},
    baselineSamples:{home:baselineHome.sample,away:baselineAway.sample}
  }
}

function gates(odds){
  const out=[]
  const fav=pricedFavourite(odds)
  if(fav&&fav.odd>=RULES.winMin&&fav.odd<=RULES.winMax){
    out.push({route:'straight-win',market:'match-winner',selection:fav.selection,displaySelection:fav.displaySelection,odds:fav.odd,favourite:fav.side,family:'1X2'})
  }
  if(finite(odds.over15)&&odds.over15<RULES.over15Max&&finite(odds.under35)&&odds.under35>RULES.over15Under35Min){
    out.push({route:'over-15',market:'total-goals',selection:'Over 1.5',displaySelection:'Over 1.5',odds:odds.over15,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.under35)&&odds.under35<RULES.under35Max&&finite(odds.over15)&&odds.over15>RULES.under35Over15Min){
    out.push({route:'under-35',market:'total-goals',selection:'Under 3.5',displaySelection:'Under 3.5',odds:odds.under35,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.over25)&&odds.over25<RULES.over25Max&&finite(odds.under35)&&odds.under35>RULES.over25Under35Min){
    out.push({route:'over-25',market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:odds.over25,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.under25)&&odds.under25<RULES.under25Max&&finite(odds.over15)&&odds.over15>RULES.under25Over15Min){
    out.push({route:'under-25',market:'total-goals',selection:'Under 2.5',displaySelection:'Under 2.5',odds:odds.under25,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.ggYes)&&odds.ggYes<RULES.ggYesMax&&finite(odds.gg2No)&&odds.gg2No>RULES.gg2NoMin){
    out.push({route:'gg',market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',odds:odds.ggYes,favourite:fav?.side||null,family:'BTTS'})
  }
  return out
}

function averageMatchGoals(home,away){
  const h=finite(home?.gf)&&finite(home?.ga)?Number(home.gf)+Number(home.ga):null
  const a=finite(away?.gf)&&finite(away?.ga)?Number(away.gf)+Number(away.ga):null
  return h!==null&&a!==null?(h+a)/2:null
}

function addScore(state,points,reason){
  state.rawScore+=points
  if(reason)state.reasons.push(reason)
}

function teamTotalContext(row,odds){
  const favourite=row.favourite
  if(!favourite)return{favO05:null,favO15:null,oppO05:null,oppO15:null}
  if(favourite==='home')return{favO05:odds.homeO05,favO15:odds.homeO15,oppO05:odds.awayO05,oppO15:odds.awayO15}
  return{favO05:odds.awayO05,favO15:odds.awayO15,oppO05:odds.homeO05,oppO15:odds.homeO15}
}

function scoreCandidate(row,direction,home,away,odds){
  const state={rawScore:Number(direction.consensus)||0,reasons:[],flags:[]}
  const totalAvg=averageMatchGoals(home,away)
  const streakHot=finite(odds.streakYes)&&odds.streakYes>=RULES.streakMin&&odds.streakYes<=RULES.streakMax
  const totals=teamTotalContext(row,odds)

  if(direction.baselineConsensus!=null&&direction.recentConsensus!=null){
    if(direction.baselineConsensus>=80)addScore(state,6,'The longer venue baseline strongly confirms the recent direction.')
    else if(direction.baselineConsensus>=60)addScore(state,3,'The longer venue baseline confirms the recent direction.')
    else{addScore(state,-8,'The longer venue baseline is weaker than the recent streak.');state.flags.push('BASELINE_WEAK')}
  }

  if(row.route==='straight-win'){
    if(row.odds<=1.30)addScore(state,7,'Favourite price is in the strongest part of the win band.')
    else if(row.odds<=1.40)addScore(state,5,'Favourite price is firmly inside the approved win band.')
    else addScore(state,2,'Favourite price is inside the approved win band.')

    const fav=row.favourite==='home'?home:away
    const opp=row.favourite==='home'?away:home
    const gap=finite(fav?.ppg)&&finite(opp?.ppg)?Number(fav.ppg)-Number(opp.ppg):null
    if(gap!==null&&gap>=1.00)addScore(state,10,'Venue PPG strongly separates the favourite from the opponent.')
    else if(gap!==null&&gap>=0.60)addScore(state,7,'Venue PPG clearly favours the priced favourite.')
    else if(gap!==null&&gap>=0.30)addScore(state,4,'Venue PPG supports the priced favourite.')
    else if(gap!==null&&gap<0){addScore(state,-12,'Venue PPG does not support the priced favourite.');state.flags.push('WIN_PPG_CONFLICT')}

    if(finite(odds.drawWin)&&odds.drawWin>=RULES.drawExtremeMin)addScore(state,7,'The draw price shows strong result separation.')
    else if(finite(odds.drawWin)&&odds.drawWin>=RULES.drawClearMin)addScore(state,4,'The draw price supports result separation.')
    else if(finite(odds.drawWin)&&odds.drawWin<=RULES.drawResistanceMax&&row.odds>1.40){addScore(state,-10,'The draw is priced strongly enough to resist the favourite.');state.flags.push('DRAW_RESISTANCE')}

    const oppWin=row.favourite==='home'?odds.awayWin:odds.homeWin
    if(finite(oppWin)&&oppWin>=5.50)addScore(state,4,'The opponent is priced as a clear result outsider.')
    if(finite(totals.oppO05)){
      if(totals.oppO05>=RULES.teamGoalColdMin)addScore(state,6,'The opponent team-total Over 0.5 price is cold, supporting favourite control.')
      else if(totals.oppO05<=RULES.teamGoalLiveMax){addScore(state,-8,'The opponent is strongly priced to score, making the straight win less clean.');state.flags.push('OPP_GOAL_LIVE')}
    }
    if(finite(totals.favO15)&&totals.favO15<=RULES.favTwoGoalStrongMax)addScore(state,4,'The favourite is strongly priced to score at least two goals.')
  }

  if(row.route==='over-15'){
    addScore(state,row.odds<=1.25?6:3,'Over 1.5 is short enough to clear the primary price gate.')
    addScore(state,odds.under35>=1.50?4:2,'Under 3.5 is loose enough to confirm the goal range.')
    if(totalAvg!==null&&totalAvg>=3.00)addScore(state,6,'Recent venue games carry a high combined goal environment.')
    else if(totalAvg!==null&&totalAvg>=2.60)addScore(state,3,'Recent venue games support a positive goal environment.')
    if(finite(totals.favO15)&&totals.favO15<=RULES.favTwoGoalStrongMax)addScore(state,4,'Favourite team-total Over 1.5 strongly supports two-plus match goals.')
    else if(finite(totals.favO15)&&totals.favO15<=RULES.favTwoGoalSupportMax)addScore(state,2,'Favourite team-total Over 1.5 supports the goal floor.')
    if(finite(odds.homeO05)&&finite(odds.awayO05)&&Math.max(odds.homeO05,odds.awayO05)<=RULES.ggOppGoalLiveMax)addScore(state,2,'Both teams remain live to contribute at least one goal.')
    if(streakHot)addScore(state,3,'Goals Streak 2+ sits inside the 1.10–1.50 confirmation band.')
  }

  if(row.route==='under-35'){
    addScore(state,row.odds<=1.25?6:3,'Under 3.5 is short enough to clear the primary price gate.')
    addScore(state,odds.over15>=1.50?4:2,'Over 1.5 is loose enough to confirm the low-total structure.')
    if(totalAvg!==null&&totalAvg<=2.20)addScore(state,6,'Recent venue games strongly support controlled totals.')
    else if(totalAvg!==null&&totalAvg<=2.60)addScore(state,3,'Recent venue games support controlled totals.')
    if(finite(odds.homeO15)&&finite(odds.awayO15)&&Math.max(odds.homeO15,odds.awayO15)<=2.10){addScore(state,-5,'Both teams are priced aggressively for two goals, creating pressure against Under 3.5.');state.flags.push('TEAM_TOTAL_UNDER35_PRESSURE')}
    if(streakHot)addScore(state,-3,'Goals Streak 2+ creates some pressure against a low-total route.')
  }

  if(row.route==='over-25'){
    addScore(state,row.odds<=1.45?6:3,'Over 2.5 is short enough to clear the primary price gate.')
    addScore(state,odds.under35>=1.70?4:2,'Under 3.5 is expensive enough to confirm a high-total structure.')
    if(totalAvg!==null&&totalAvg>=3.00)addScore(state,8,'Recent venue games strongly support three-plus goals.')
    else if(totalAvg!==null&&totalAvg>=2.70)addScore(state,4,'Recent venue games support three-plus goals.')
    if(finite(totals.favO15)&&totals.favO15<=RULES.favTwoGoalStrongMax)addScore(state,6,'Favourite team-total Over 1.5 provides a strong source for three-plus match goals.')
    else if(finite(totals.favO15)&&totals.favO15<=RULES.favTwoGoalSupportMax)addScore(state,3,'Favourite team-total Over 1.5 supports the high-total route.')
    if(finite(totals.oppO05)&&totals.oppO05<=RULES.teamGoalLiveMax)addScore(state,3,'The opponent is live to contribute a goal to the total.')
    else if(finite(totals.oppO05)&&totals.oppO05>=RULES.teamGoalColdMin&&(!finite(totals.favO15)||totals.favO15>RULES.favTwoGoalSupportMax)){
      addScore(state,-6,'The opponent goal price is cold and the favourite two-goal price does not compensate.');state.flags.push('OVER_GOAL_SOURCE_WEAK')
    }
    if(streakHot)addScore(state,5,'Goals Streak 2+ confirms the high-event direction.')
  }

  if(row.route==='under-25'){
    addScore(state,row.odds<=1.47?6:3,'Under 2.5 is short enough to clear the primary price gate.')
    addScore(state,odds.over15>=1.70?4:2,'Over 1.5 is expensive enough to confirm a low-total structure.')
    if(totalAvg!==null&&totalAvg<=2.30)addScore(state,8,'Recent venue games strongly support a low total.')
    else if(totalAvg!==null&&totalAvg<=2.70)addScore(state,4,'Recent venue games support a low total.')
    if(finite(odds.homeO05)&&finite(odds.awayO05)&&Math.max(odds.homeO05,odds.awayO05)<=1.40){addScore(state,-6,'Both teams are strongly priced to score, creating pressure against Under 2.5.');state.flags.push('TEAM_TOTAL_UNDER25_PRESSURE')}
    if(streakHot){addScore(state,-6,'Goals Streak 2+ conflicts with a strict Under 2.5 route.');state.flags.push('STREAK_UNDER_CONFLICT')}
  }

  if(row.route==='gg'){
    addScore(state,row.odds<=1.45?6:3,'BTTS Yes is short enough to clear the primary price gate.')
    addScore(state,odds.gg2No>=1.40?4:2,'GG 2+ No is loose enough to confirm the BTTS route.')
    if(finite(odds.homeO05)&&finite(odds.awayO05)){
      const worst=Math.max(odds.homeO05,odds.awayO05)
      if(worst<=1.35)addScore(state,8,'Both team-total Over 0.5 prices strongly support each side scoring.')
      else if(worst<=RULES.ggOppGoalLiveMax)addScore(state,4,'Both team-total Over 0.5 prices keep both sides live to score.')
      else if(worst>=RULES.ggOppGoalColdMin){addScore(state,-10,'At least one team-total Over 0.5 price is cold for BTTS.');state.flags.push('GG_TEAM_GOAL_CONFLICT')}
    }
    if(streakHot)addScore(state,3,'Goals Streak 2+ confirms an active scoring environment.')
  }

  const rawScore=Math.round(state.rawScore)
  return{
    score:rawScore,
    rawScore,
    displayScore:Math.round(clamp(rawScore)),
    reasons:state.reasons,
    flags:state.flags,
    capability:direction.consensus,
    totalGoalEnvironment:totalAvg===null?null:+totalAvg.toFixed(2)
  }
}

function publicReasons(pick,home,away,direction,odds){
  const homeName=pick?.home||'Home',awayName=pick?.away||'Away'
  const label=pick?.displaySelection||pick?.selection||'this pick'
  const lines=[]
  if(pick.route==='straight-win'&&pick.favourite==='home')lines.push(`${homeName} is the priced favourite at ${Number(pick.odds).toFixed(2)}.`)
  else if(pick.route==='straight-win'&&pick.favourite==='away')lines.push(`${awayName} is the priced favourite at ${Number(pick.odds).toFixed(2)}.`)
  else lines.push(`${label} cleared the SportyBet odds filter at ${Number(pick.odds).toFixed(2)}.`)
  for(const reason of pick?.filterReasons||[])if(!lines.includes(reason))lines.push(reason)
  if(direction?.recentHome!=null&&direction?.recentAway!=null)lines.push(`Last-5 venue support for ${label}: ${direction.recentHome}% home, ${direction.recentAway}% away.`)
  if(direction?.baselineHome!=null&&direction?.baselineAway!=null)lines.push(`Longer venue baseline: ${direction.baselineHome}% home, ${direction.baselineAway}% away.`)
  if(direction?.home!=null&&direction?.away!=null)lines.push(`Blended 60/40 venue capability: ${direction.home}% home, ${direction.away}% away.`)
  if(home?.ppg!=null)lines.push(`${homeName} average ${home.ppg} PPG at home (${home.gf} scored, ${home.ga} conceded).`)
  if(away?.ppg!=null)lines.push(`${awayName} average ${away.ppg} PPG away (${away.gf} scored, ${away.ga} conceded).`)
  if(finite(pick?.scoreSeparation)&&pick.runnerUpRoute)lines.push(`${label} beat the next eligible route by ${pick.scoreSeparation} raw evidence points.`)
  return lines
}

function packPick(fixture,odds,home,away,routed,direction,runnerUp=null){
  const lastMatchesHome=last5Overall(fixture?.home?.lastMatches||fixture?.home?.fixtures,fixture?.home?.id)
  const lastMatchesAway=last5Overall(fixture?.away?.lastMatches||fixture?.away?.fixtures,fixture?.away?.id)
  const last5Home=last5Form(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const last5Away=last5Form(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const separation=runnerUp?Math.round(routed.filterScore-runnerUp.filterScore):null
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
    market:routed.market,
    marketName:routed.displaySelection,
    selection:routed.selection,
    displaySelection:routed.displaySelection,
    pick:routed.displaySelection,
    odds:+Number(routed.odds).toFixed(2),
    engine:ENGINE_ID,
    engineVersion:ENGINE_VERSION,
    route:routed.route,
    favourite:routed.favourite||null,
    homeConsensus:direction.home,
    awayConsensus:direction.away,
    consensus:direction.consensus,
    recentConsensus:direction.recentConsensus??null,
    baselineConsensus:direction.baselineConsensus??null,
    capabilityBlend:{recentWeight:RULES.recentWeight,baselineWeight:RULES.baselineWeight,baselineSample:RULES.baselineVenueSample},
    filterScore:routed.filterScore,
    rawFilterScore:routed.rawFilterScore??routed.filterScore,
    displayScore:routed.displayScore??Math.round(clamp(routed.filterScore)),
    capability:routed.capability,
    runnerUpRoute:runnerUp?.route||null,
    runnerUpScore:runnerUp?.filterScore??null,
    runnerUpDisplayScore:runnerUp?.displayScore??null,
    scoreSeparation:separation,
    filterFlags:routed.filterFlags||[],
    filterReasons:routed.filterReasons||[],
    oddsBook:odds,
    homeSplit:fixture.homeSplit||null,
    awaySplit:fixture.awaySplit||null,
    metrics:{home,away},
    earlySeason:fixture.earlySeason===true,
    sportyEventId:fixture.sportyEventId||null
  }
  const reasons=publicReasons(pick,home,away,direction,odds)
  const packed=attachWhy(pick,fixture,{reasons,last5Home,last5Away,lastMatchesHome,lastMatchesAway,homeAvg:home,awayAvg:away,h2h:fixture.h2h||[]})
  return routed.learning ? stampLearning(packed, routed.learning) : packed
}

export function diagnoseFilterFixture(fixture, learningState=null){
  if(isSrlMatch(fixture))return{pick:null,skip:'srl'}
  if(!fixtureHasStats(fixture))return{pick:null,skip:'no-stats'}
  if(fixture?.earlySeason===true)return{pick:null,skip:'early-season'}
  if(shouldSkipCupFixture(fixture))return{pick:null,skip:'cup'}
  const table=tableGate(fixture?.homeSplit,fixture?.awaySplit)
  if(!table.ok)return{pick:null,skip:table.skip,tableVerified:table.verified,homeTier:table.homeTier,awayTier:table.awayTier}

  const home=venueMetrics(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const away=venueMetrics(fixture?.away?.fixtures,fixture?.away?.id,'away')
  if(!home.ready||!away.ready)return{pick:null,skip:'insufficient-venue-sample',home,away}

  const odds=extractFilterOdds(fixture)
  const routed=gates(odds)
  if(!routed.length)return{pick:null,skip:'no-route',odds,home,away}

  const candidates=[]
  const rejected=[]
  for(const row of routed){
    if(row.route==='straight-win'){
      const favouriteSplit=row.favourite==='home'?fixture?.homeSplit:fixture?.awaySplit
      if(isBottomThree(favouriteSplit)){
        rejected.push({route:row.route,reason:'bottom-three-favourite'})
        continue
      }
    }
    if(row.route==='straight-win'&&similarForm(home,away)){
      rejected.push({route:row.route,reason:'similar-form-win'})
      continue
    }
    if(row.route==='straight-win'&&favConflict(fixture,home,away,row.favourite)){
      rejected.push({route:row.route,reason:'fav-conflict'})
      continue
    }
    const direction=directionAgree(fixture,row.route,row.favourite)
    if(!direction.ok){
      rejected.push({route:row.route,reason:'direction-disagree',direction})
      continue
    }
    const scored=scoreCandidate(row,direction,home,away,odds)
    const stub={
      country:fixture.country,
      league:fixture.league,
      market:row.market,
      route:row.route,
      selection:row.selection,
      homeConsensus:direction.home,
      awayConsensus:direction.away,
      consensus:direction.consensus,
      rawFilterScore:scored.rawScore,
      filterScore:scored.rawScore
    }
    const learned=learningAllows(stub,learningState,{board:'filter',tightenMinScore:82})
    if(!learned.allowed){
      rejected.push({route:row.route,reason:learned.action==='drop'?'learning-drop':'learning-tighten',score:scored.rawScore,learning:learned})
      continue
    }
    if(scored.rawScore<RULES.candidateMinScore){
      rejected.push({route:row.route,reason:'low-evidence-score',score:scored.rawScore,displayScore:scored.displayScore,direction})
      continue
    }
    candidates.push({
      ...row,
      direction,
      filterScore:scored.rawScore,
      rawFilterScore:scored.rawScore,
      displayScore:scored.displayScore,
      capability:scored.capability,
      filterReasons:scored.reasons,
      filterFlags:scored.flags,
      totalGoalEnvironment:scored.totalGoalEnvironment,
      learning:learned
    })
  }

  if(!candidates.length){
    const reasons=new Set(rejected.map(x=>x.reason))
    let skip='direction-disagree'
    if(reasons.size===1)skip=rejected[0]?.reason||skip
    else if(reasons.has('low-evidence-score'))skip='low-evidence-score'
    else if(reasons.has('bottom-three-favourite')&&!reasons.has('direction-disagree'))skip='bottom-three-favourite'
    else if(reasons.has('fav-conflict')&&!reasons.has('direction-disagree'))skip='fav-conflict'
    return{pick:null,skip,odds,home,away,rejected,tableVerified:table.verified,homeTier:table.homeTier,awayTier:table.awayTier}
  }

  candidates.sort((a,b)=>b.rawFilterScore-a.rawFilterScore||Number(b.capability)-Number(a.capability)||Number(a.odds)-Number(b.odds)||String(a.route).localeCompare(String(b.route)))
  const top=candidates[0],runnerUp=candidates[1]||null
  const separation=runnerUp?top.rawFilterScore-runnerUp.rawFilterScore:null
  if(runnerUp&&separation<RULES.marketSeparationMin){
    return{pick:null,skip:'low-market-separation',odds,home,away,candidates,rejected,separation,tableVerified:table.verified,homeTier:table.homeTier,awayTier:table.awayTier}
  }

  return{
    pick:packPick(fixture,odds,home,away,top,top.direction,runnerUp),
    skip:null,
    odds,
    home,
    away,
    direction:top.direction,
    favourite:top.favourite,
    candidates,
    rejected,
    separation,
    tableVerified:table.verified,
    homeTier:table.homeTier,
    awayTier:table.awayTier
  }
}

export function evaluateFilterFixture(fixture, learningState=null){
  return diagnoseFilterFixture(fixture, learningState).pick
}

export function buildFilterBoard(fixtures,meta={},learningState=null){
  const diagnosed=(fixtures||[]).map(fixture=>({fixture,result:diagnoseFilterFixture(fixture,learningState)}))
  const qualified=diagnosed.map(row=>row.result.pick).filter(Boolean)
    .sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(b.rawFilterScore||b.filterScore||0)-Number(a.rawFilterScore||a.filterScore||0)||Number(a.odds)-Number(b.odds))
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
      filterVersion:'v2',
      capabilityRevision:'v2.1',
      formSample:FORM_SAMPLE,
      baselineVenueSample:RULES.baselineVenueSample,
      capabilityWeights:{recent:RULES.recentWeight,baseline:RULES.baselineWeight},
      candidateMinScore:RULES.candidateMinScore,
      marketSeparationMin:RULES.marketSeparationMin,
      qualified:qualified.length,
      bestPicks:qualified.length,
      skipped
    },
    priority:qualified,
    bestPicks:qualified,
    availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()
  }
}