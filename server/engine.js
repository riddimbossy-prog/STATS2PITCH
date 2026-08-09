import { ENGINE_INTEGRITY_POLICY } from './stats.js'

const isNum=v=>typeof v==='number'&&Number.isFinite(v)
const isOdd=v=>isNum(v)&&v>1.001&&v<1000
const add=(arr,code,label,direction='positive',family='General',weight=1)=>arr.push({code,label,direction,family,weight})

export const FAMILY={TABLE:'Table Strength',FORM:'Form',ATTACK:'Attack',DEFENCE:'Defence',MARKET:'Market/Odds',OPP:'Opponent Weakness',GOALS:'Goal Pattern'}
const venueWord=team=>team?.venue==='away'?'away':'home'
const venueTitle=team=>team?.venue==='away'?'Away':'Home'
const isBottomThree=team=>isNum(team?.position)&&isNum(team?.leagueSize)&&team.leagueSize>=3&&team.position>team.leagueSize-3
const uniqueFamilies=signals=>[...new Set((signals||[]).map(x=>x.family).filter(Boolean))]

function familyStrength(signals){
  const by=new Map()
  for(const s of signals||[]){if(!by.has(s.family))by.set(s.family,[]);by.get(s.family).push(Number(s.weight||0))}
  let total=0
  for(const weights of by.values()){weights.sort((a,b)=>b-a);const first=weights[0]||0,second=weights[1]||0;total+=Math.min(1.8,first+Math.min(.35,second*.25))}
  return +total.toFixed(3)
}
function contradictionLevel(positive,negative){
  const pos=familyStrength(positive),neg=familyStrength(negative),negFamilies=uniqueFamilies(negative).length
  if(negFamilies>=3||neg>=3||(pos>0&&neg/pos>=.75))return'HIGH'
  if(negFamilies>=2||neg>=1.4||(pos>0&&neg/pos>=.35))return'MODERATE'
  return'LOW'
}
function contradictionRank(x){return x==='LOW'?0:x==='MODERATE'?1:2}
function priorityLabel(familyCount,contradiction){if(contradiction==='HIGH')return'WATCHLIST';if(familyCount>=5)return'ELITE';if(familyCount>=4)return'VERY HIGH';if(familyCount>=3)return'HIGH';if(familyCount>=2)return'MEDIUM';return'WATCHLIST'}
function engineRating({familyCount,positiveStrength,negativeStrength,contradiction,odds}){
  let r=48+Math.min(30,Number(familyCount||0)*7)+Math.min(12,Number(positiveStrength||0)*1.5)-Math.min(20,Number(negativeStrength||0)*2)
  if(contradiction==='MODERATE')r-=8;if(contradiction==='HIGH')r-=20;if(Number(odds)>1&&Number(odds)<=1.55)r+=3
  return Math.max(35,Math.min(95,Math.round(r)))
}

function teamSignals(team,opponent,odds,drawOdds){
  const s=[],venue=venueWord(team),oppVenue=venueWord(opponent),teamName=team.name||'Team',oppName=opponent.name||'Opponent'
  if(team?.positionSampleReady===true&&isNum(team.position)&&team.position<=3)add(s,'TOP3',`${teamName} are top 3 by ${venue} points-per-game strength`,'positive',FAMILY.TABLE,1.2)
  if(team?.positionSampleReady===true&&isBottomThree(team))add(s,'BOTTOM3',`${teamName} are bottom 3 by ${venue} points-per-game strength`,'negative',FAMILY.TABLE,1.5)
  if(isNum(team.ppg)&&team.ppg>=2)add(s,'PPG_HIGH',`${teamName} average at least 2 points per ${venue} league match`,'positive',FAMILY.TABLE,1.2)
  if(isNum(team.ppg)&&team.ppg<1)add(s,'PPG_LOW',`${teamName} average under 1 point per ${venue} league match`,'negative',FAMILY.TABLE,1.2)

  if(isNum(team.goalsScored)){
    if(team.goalsScored>=2.3)add(s,'GS_23',`${teamName} score at least 2.3 goals per ${venue} league match`,'positive',FAMILY.ATTACK,1.3)
    else if(team.goalsScored>=2)add(s,'GS_20',`${teamName} score at least 2 goals per ${venue} league match`,'positive',FAMILY.ATTACK,1.1)
    else if(team.goalsScored<1)add(s,'GS_LOW',`${teamName} score under 1 goal per ${venue} league match`,'negative',FAMILY.ATTACK,1.1)
  }
  if(isNum(team.failedToScoreRate)&&team.failedToScoreRate>=40)add(s,'FTS_SPLIT_40',`${teamName} failed to score in at least 40% of their recent ${venue} league matches`,'negative',FAMILY.ATTACK,1)

  if(isNum(team.goalsConceded)){
    if(team.goalsConceded>2.3)add(s,'GC_23',`${teamName} concede more than 2.3 goals per ${venue} league match`,'negative',FAMILY.DEFENCE,1.3)
    else if(team.goalsConceded>=2)add(s,'GC_20',`${teamName} concede at least 2 goals per ${venue} league match`,'negative',FAMILY.DEFENCE,1.1)
    else if(team.goalsConceded<1)add(s,'GC_LOW',`${teamName} concede under 1 goal per ${venue} league match`,'positive',FAMILY.DEFENCE,1.1)
  }
  if(isNum(team.cleanSheetRate)&&team.cleanSheetRate>=60)add(s,'CS_SPLIT_60',`${teamName} kept a clean sheet in at least 60% of their recent ${venue} league matches`,'positive',FAMILY.DEFENCE,.8)

  if(isNum(team.winRate)){
    if(team.winRate>=80)add(s,'WIN80',`${teamName} won at least 4 of their last 5 ${venue} league matches`,'positive',FAMILY.FORM,1.4)
    else if(team.winRate>=60)add(s,'WIN60',`${teamName} won at least 3 of their last 5 ${venue} league matches`,'positive',FAMILY.FORM,1.1)
    else if(team.winRate<40)add(s,'WIN_LT40',`${teamName} won fewer than 2 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1)
    else if(team.winRate<60)add(s,'WIN_LT60',`${teamName} won fewer than 3 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,.6)
  }
  if(isNum(team.lossRate)){
    if(team.lossRate>=80)add(s,'LOSS80',`${teamName} lost at least 4 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1.4)
    else if(team.lossRate>=60)add(s,'LOSS60',`${teamName} lost at least 3 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1.1)
  }
  if(team.formAgreement==='WIN_STRONG')add(s,'FORM_5_10_WIN_AGREE',`${teamName}'s strong ${venue} form is confirmed across both their last 5 and last 10 ${venue} league matches`,'positive',FAMILY.FORM,.7)
  if(team.formAgreement==='LOSS_STRONG')add(s,'FORM_5_10_LOSS_AGREE',`${teamName}'s poor ${venue} form is confirmed across both their last 5 and last 10 ${venue} league matches`,'negative',FAMILY.FORM,.7)
  if(team.formAgreement==='CONFLICT')add(s,'FORM_5_10_CONFLICT',`${teamName}'s last 5 ${venue} matches disagree sharply with their last 10 ${venue} matches`,'negative',FAMILY.FORM,1.2)

  if(isOdd(odds)){
    if(odds<1.2)add(s,'ODDS_120',`${teamName}'s win price is below 1.20`,'positive',FAMILY.MARKET,1.5)
    else if(odds<=1.55)add(s,'ODDS_155',`${teamName}'s win price is 1.55 or lower`,'positive',FAMILY.MARKET,1.25)
    else if(odds<=2)add(s,'ODDS_200',`${teamName}'s win price is 2.00 or lower`,'positive',FAMILY.MARKET,.8)
    else if(odds>5)add(s,'ODDS_500',`${teamName}'s win price is above 5.00`,'negative',FAMILY.MARKET,1.4)
  }
  if(isOdd(drawOdds)){
    if(drawOdds<3)add(s,'DRAW_LT3','The draw price is below 3.00','negative',FAMILY.MARKET,.8)
    else if(drawOdds>5)add(s,'DRAW_GT5','The draw price is above 5.00','positive',FAMILY.MARKET,1.1)
    else if(drawOdds>4)add(s,'DRAW_GT4','The draw price is above 4.00','positive',FAMILY.MARKET,.8)
  }

  if(opponent?.positionSampleReady===true&&isNum(opponent.position)&&opponent.position<=3)add(s,'OPP_TOP3',`${oppName} are top 3 by ${oppVenue} points-per-game strength`,'negative',FAMILY.OPP,1.2)
  if(opponent?.positionSampleReady===true&&isBottomThree(opponent))add(s,'OPP_BOTTOM3',`${oppName} are bottom 3 by ${oppVenue} points-per-game strength`,'positive',FAMILY.OPP,1.2)
  if(isNum(opponent.ppg)&&opponent.ppg<1)add(s,'OPP_PPG_LOW',`${oppName} average under 1 point per ${oppVenue} league match`,'positive',FAMILY.OPP,1.2)
  if(isNum(opponent.goalsScored)&&opponent.goalsScored<1)add(s,'OPP_GS_LOW',`${oppName} score under 1 goal per ${oppVenue} league match`,'positive',FAMILY.OPP,1.1)
  if(isNum(opponent.goalsConceded)){
    if(opponent.goalsConceded>2.3)add(s,'OPP_GC_23',`${oppName} concede more than 2.3 goals per ${oppVenue} league match`,'positive',FAMILY.OPP,1.3)
    else if(opponent.goalsConceded>=2)add(s,'OPP_GC_20',`${oppName} concede at least 2 goals per ${oppVenue} league match`,'positive',FAMILY.OPP,1.1)
    else if(opponent.goalsConceded<1)add(s,'OPP_GC_LOW',`${oppName} concede under 1 goal per ${oppVenue} league match`,'negative',FAMILY.OPP,1.1)
  }
  if(isNum(opponent.lossRate)){
    if(opponent.lossRate>=80)add(s,'OPP_LOSS80',`${oppName} lost at least 4 of their last 5 ${oppVenue} league matches`,'positive',FAMILY.OPP,1.4)
    else if(opponent.lossRate>=60)add(s,'OPP_LOSS60',`${oppName} lost at least 3 of their last 5 ${oppVenue} league matches`,'positive',FAMILY.OPP,1.1)
  }
  if(isNum(opponent.failedToScoreRate)&&opponent.failedToScoreRate>=40)add(s,'OPP_FTS_SPLIT_40',`${oppName} failed to score in at least 40% of their recent ${oppVenue} league matches`,'positive',FAMILY.OPP,.8)
  if(isNum(opponent.cleanSheetRate)&&opponent.cleanSheetRate>=60)add(s,'OPP_CS_SPLIT_60',`${oppName} kept a clean sheet in at least 60% of their recent ${oppVenue} league matches`,'negative',FAMILY.OPP,.8)
  return s
}

const goalNames={'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}
const goalKeys={'O1.5':'over15','U1.5':'under15','O2.5':'over25','U2.5':'under25','O3.5':'over35','U3.5':'under35'}
const goalPrice=(odds,market)=>{const v=odds?.[goalKeys[market]];return isOdd(v)?v:null}
const sum2=(a,b)=>isNum(a)&&isNum(b)?a+b:null
function goalProfileConfirmation(home,away,market){
  const line=Number(market.slice(1)),isOver=market.startsWith('O'),attack=sum2(home.goalsScored,away.goalsScored),concede=sum2(home.goalsConceded,away.goalsConceded),recentAttack=sum2(home.recentGoalsScored,away.recentGoalsScored),recentConcede=sum2(home.recentGoalsConceded,away.recentGoalsConceded),pools=[attack,concede,recentAttack,recentConcede].filter(isNum)
  if(pools.length<2)return null
  if(isOver){const supportive=pools.filter(v=>v>line).length;if(supportive<2)return null;return{code:`GOAL_PROFILE_${String(line).replace('.','')}_OVER`,label:`The home-attack/away-attack and concession profile also supports ${goalNames[market]}`,family:FAMILY.GOALS,weight:1.2}}
  const supportive=pools.filter(v=>v<line).length;if(supportive<Math.min(3,pools.length))return null
  return{code:`GOAL_PROFILE_${String(line).replace('.','')}_UNDER`,label:`The home-attack/away-attack and defensive profile also supports ${goalNames[market]}`,family:FAMILY.GOALS,weight:1.2}
}
function goalSignals(home,away){
  const out=[]
  for(const market of Object.keys(goalKeys)){
    const key=goalKeys[market],hr=home?.[key],ar=away?.[key]
    if(!isNum(hr)||!isNum(ar)||hr<60||ar<60)continue
    const confirm=goalProfileConfirmation(home,away,market);if(!confirm)continue
    const evidence=[{code:`GOAL_${market.replace('.','')}_${hr>=80?'80':'60'}_HOME`,label:`${goalNames[market]} landed in at least ${hr>=80?'80':'60'}% of ${home.name}'s recent home league matches`,family:FAMILY.GOALS,weight:hr>=80?1.35:1.05},{code:`GOAL_${market.replace('.','')}_${ar>=80?'80':'60'}_AWAY`,label:`${goalNames[market]} landed in at least ${ar>=80?'80':'60'}% of ${away.name}'s recent away league matches`,family:FAMILY.GOALS,weight:ar>=80?1.35:1.05},confirm]
    const avg=(hr+ar)/2,positiveStrength=familyStrength(evidence)
    out.push({market,filterCount:evidence.length,familyCount:1,familyStrength:positiveStrength,score:+(2.5+positiveStrength+avg/100).toFixed(3),reasons:evidence,reason:evidence.map(x=>x.label).join(' • ')})
  }
  return out
}

function makeTeamPick(fixture,selected,opponent,odds,drawOdds){
  if(!isOdd(odds))return null
  if(selected?.positionSampleReady!==true||opponent?.positionSampleReady!==true||!isNum(selected.position)||!isNum(selected.leagueSize))return null
  if(isBottomThree(selected))return null
  const signals=teamSignals(selected,opponent,odds,drawOdds),positives=signals.filter(x=>x.direction==='positive'),negatives=signals.filter(x=>x.direction==='negative')
  if(!positives.length)return null
  const families=uniqueFamilies(positives),familyCount=families.length,positiveStrength=familyStrength(positives),negativeStrength=familyStrength(negatives),contradiction=contradictionLevel(positives,negatives),filterCount=positives.length,score=familyCount*2.5+positiveStrength-negativeStrength*1.2+Math.max(0,2.5-odds)*.25
  return{fixtureId:fixture.fixtureId,match:fixture.match,league:fixture.league,country:fixture.country,leagueLogo:fixture.leagueLogo||null,countryFlag:fixture.countryFlag||null,kickoff:fixture.kickoff,kickoffLocal:fixture.kickoffLocal,selectedTeamId:selected.id,selectedTeamLogo:selected.logo||null,selectedTeam:selected.name,selectedPosition:selected.position,selectedPointsPosition:selected.pointsPosition??null,opponentTeamId:opponent.id,opponentTeam:opponent.name,opponentTeamLogo:opponent.logo||null,opponentPosition:opponent.position,opponentPointsPosition:opponent.pointsPosition??null,venue:venueWord(selected),venueLabel:venueTitle(selected),overallSelectedPosition:selected.overallPosition??selected?.overall?.position??null,overallOpponentPosition:opponent.overallPosition??opponent?.overall?.position??null,odds,drawOdds:isOdd(drawOdds)?drawOdds:null,market:'1X2',filterCount,familyCount,filterFamilies:families,familyStrength:positiveStrength,negativeFamilyStrength:negativeStrength,contradiction,score:+score.toFixed(3),priorityLabel:priorityLabel(familyCount,contradiction),engineRating:engineRating({familyCount,positiveStrength,negativeStrength,contradiction,odds}),filters:positives.map(x=>x.label),filterCodes:positives.map(x=>x.code),negativeSignals:negatives.map(x=>x.label),negativeSignalCodes:negatives.map(x=>x.code),shortReason:positives.slice(0,4).map(x=>x.label).join(' • ')+(positives.length>4?` • +${positives.length-4} more`:'')}
}

export function comparePicks(a,b){return Number(b.familyCount||0)-Number(a.familyCount||0)||contradictionRank(a.contradiction)-contradictionRank(b.contradiction)||Number(b.familyStrength||0)-Number(a.familyStrength||0)||Number(b.score||0)-Number(a.score||0)||(Number(a.odds)||99)-(Number(b.odds)||99)||Number(b.filterCount||0)-Number(a.filterCount||0)}
export function oneBestPerFixture(rows){const best=new Map();for(const row of rows||[]){const k=String(row?.fixtureId??'');if(!k)continue;const prev=best.get(k);if(!prev||comparePicks(row,prev)<0)best.set(k,row)}return[...best.values()].sort(comparePicks)}

export function analyzeFixture(fixture){
  const teamPicks=[],hp=makeTeamPick(fixture,fixture.home,fixture.away,fixture.odds?.home,fixture.odds?.draw),ap=makeTeamPick(fixture,fixture.away,fixture.home,fixture.odds?.away,fixture.odds?.draw)
  if(hp)teamPicks.push(hp);if(ap)teamPicks.push(ap);teamPicks.sort(comparePicks)
  const resolved=[]
  if(teamPicks[0]){if(teamPicks[1]&&Math.abs(Number(teamPicks[0].score)-Number(teamPicks[1].score))<.75){teamPicks[0].contradiction='HIGH';teamPicks[0].priorityLabel='WATCHLIST';teamPicks[0].engineRating=Math.min(teamPicks[0].engineRating,45);teamPicks[0].negativeSignals=[...(teamPicks[0].negativeSignals||[]),'Both sides produce similarly strong team-result routes.'];teamPicks[0].negativeSignalCodes=[...(teamPicks[0].negativeSignalCodes||[]),'OPPOSING_TEAM_ROUTES']}resolved.push(teamPicks[0])}
  for(const g of goalSignals(fixture.home,fixture.away)){
    const price=goalPrice(fixture.odds,g.market);if(!isOdd(price))continue
    const rating=engineRating({familyCount:1,positiveStrength:g.familyStrength,negativeStrength:0,contradiction:'LOW',odds:price})
    resolved.push({fixtureId:fixture.fixtureId,match:fixture.match,league:fixture.league,country:fixture.country,leagueLogo:fixture.leagueLogo||null,countryFlag:fixture.countryFlag||null,kickoff:fixture.kickoff,kickoffLocal:fixture.kickoffLocal,selectedTeamId:0,selectedTeam:goalNames[g.market],selectedPosition:null,opponentTeam:'Whole match',opponentPosition:null,odds:price,drawOdds:isOdd(fixture.odds?.draw)?fixture.odds.draw:null,market:g.market,filterCount:g.filterCount,familyCount:1,filterFamilies:[FAMILY.GOALS],familyStrength:g.familyStrength,negativeFamilyStrength:0,contradiction:'LOW',score:g.score,priorityLabel:'WATCHLIST',engineRating:rating,filters:g.reasons.map(x=>x.label),filterCodes:g.reasons.map(x=>x.code),negativeSignals:[],negativeSignalCodes:[],shortReason:g.reason})
  }
  return resolved
}

export function buildBoard(fixtures,meta={}){
  const all=(fixtures||[]).flatMap(analyzeFixture),qualified=all.filter(x=>Number(x.filterCount)>=1&&isOdd(x.odds)).sort(comparePicks)
  const groups={single:qualified.filter(x=>Number(x.filterCount)===1),two:qualified.filter(x=>Number(x.filterCount)===2),threePlus:qualified.filter(x=>Number(x.filterCount)>=3)}
  const oddsByFixture=Object.fromEntries((fixtures||[]).map(f=>[String(f.fixtureId),Array.isArray(f.marketOdds)?f.marketOdds:[]])),availableMarkets=[...new Set((fixtures||[]).flatMap(f=>(f.marketOdds||[]).map(m=>m.market)).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
  return{meta:{...meta,qualified:qualified.length,pricingPolicy:'single-bookmaker-coherent-v1',engineIntegrityPolicy:ENGINE_INTEGRITY_POLICY,rankingPolicy:'family-diversity-first-v1'},groups,priority:qualified,bestPicks:oneBestPerFixture(qualified),oddsByFixture,availableMarkets}
}
