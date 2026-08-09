const isNum = v => typeof v === 'number' && Number.isFinite(v)
const add = (arr, code, label, direction='positive', group='general', weight=1) => arr.push({code,label,direction,group,weight})

function teamSignals(team, opponent, odds, drawOdds) {
  const s=[]
  if (isNum(team.position) && team.position <= 3) add(s,'TOP3','Top 3','positive','position',1.2)
  if (isNum(team.position) && isNum(team.leagueSize) && team.position > team.leagueSize - 3) add(s,'BOTTOM3','Bottom 3','negative','position',1.2)
  if (isNum(team.ppg) && team.ppg >= 2) add(s,'PPG_HIGH','PPG ≥ 2.0','positive','ppg',1.2)
  if (isNum(team.ppg) && team.ppg < 1) add(s,'PPG_LOW','PPG < 1.0','negative','ppg',1.2)
  if (isNum(team.goalsScored)) {
    if (team.goalsScored >= 2.3) add(s,'GS_23','Goals scored ≥ 2.3','positive','goalsScored',1.3)
    else if (team.goalsScored >= 2.0) add(s,'GS_20','Goals scored ≥ 2.0','positive','goalsScored',1.1)
    else if (team.goalsScored < 1.0) add(s,'GS_LOW','Goals scored < 1.0','negative','goalsScored',1.1)
  }
  if (isNum(team.goalsConceded)) {
    if (team.goalsConceded > 2.3) add(s,'GC_23','Goals conceded > 2.3','negative','goalsConceded',1.3)
    else if (team.goalsConceded >= 2.0) add(s,'GC_20','Goals conceded ≥ 2.0','negative','goalsConceded',1.1)
    else if (team.goalsConceded < 1.0) add(s,'GC_LOW','Goals conceded < 1.0','positive','goalsConceded',1.1)
  }
  if (isNum(team.winRate)) {
    if (team.winRate >= 80) add(s,'WIN80','Last 5 win rate ≥ 80%','positive','form',1.4)
    else if (team.winRate >= 60) add(s,'WIN60','Last 5 win rate ≥ 60%','positive','form',1.1)
    else if (team.winRate < 40) add(s,'WIN_LT40','Last 5 win rate < 40%','negative','form',1.0)
    else if (team.winRate < 60) add(s,'WIN_LT60','Last 5 win rate < 60%','negative','form',.6)
  }
  if (isNum(team.lossRate)) {
    if (team.lossRate >= 80) add(s,'LOSS80','Last 5 loss rate ≥ 80%','negative','loss',1.4)
    else if (team.lossRate >= 60) add(s,'LOSS60','Last 5 loss rate ≥ 60%','negative','loss',1.1)
  }
  if (isNum(odds)) {
    if (odds < 1.20) add(s,'ODDS_120','Odds < 1.20','positive','odds',1.5)
    else if (odds <= 1.55) add(s,'ODDS_155','Odds ≤ 1.55','positive','odds',1.25)
    else if (odds <= 2.0) add(s,'ODDS_200','Odds ≤ 2.00','positive','odds',.8)
    else if (odds > 5) add(s,'ODDS_500','Odds > 5.00','negative','odds',1.4)
  }
  if (isNum(drawOdds)) {
    if (drawOdds < 3) add(s,'DRAW_LT3','Draw odds < 3.00','negative','drawOdds',.8)
    else if (drawOdds > 5) add(s,'DRAW_GT5','Draw odds > 5.00','positive','drawOdds',1.1)
    else if (drawOdds > 4) add(s,'DRAW_GT4','Draw odds > 4.00','positive','drawOdds',.8)
  }

  // Opponent weaknesses become supporting matchup evidence.
  if (isNum(opponent.position) && opponent.position <= 3) add(s,'OPP_TOP3','Opponent top 3','negative','oppPosition',1.2)
  if (isNum(opponent.position) && isNum(opponent.leagueSize) && opponent.position > opponent.leagueSize - 3) add(s,'OPP_BOTTOM3','Opponent bottom 3','positive','oppPosition',1.2)
  if (isNum(opponent.ppg) && opponent.ppg < 1) add(s,'OPP_PPG_LOW','Opponent PPG < 1.0','positive','oppPpg',1.2)
  if (isNum(opponent.goalsScored) && opponent.goalsScored < 1) add(s,'OPP_GS_LOW','Opponent goals scored < 1.0','positive','oppGoalsScored',1.1)
  if (isNum(opponent.goalsConceded)) {
    if (opponent.goalsConceded > 2.3) add(s,'OPP_GC_23','Opponent goals conceded > 2.3','positive','oppGoalsConceded',1.3)
    else if (opponent.goalsConceded >= 2.0) add(s,'OPP_GC_20','Opponent goals conceded ≥ 2.0','positive','oppGoalsConceded',1.1)
    else if (opponent.goalsConceded < 1.0) add(s,'OPP_GC_LOW','Opponent goals conceded < 1.0','negative','oppGoalsConceded',1.1)
  }
  if (isNum(opponent.lossRate)) {
    if (opponent.lossRate >= 80) add(s,'OPP_LOSS80','Opponent last 5 loss rate ≥ 80%','positive','oppLoss',1.4)
    else if (opponent.lossRate >= 60) add(s,'OPP_LOSS60','Opponent last 5 loss rate ≥ 60%','positive','oppLoss',1.1)
  }
  return s
}

function goalSignals(home, away) {
  const out=[]
  const markets=[
    ['O1.5','over15'],['U1.5','under15'],
    ['O2.5','over25'],['U2.5','under25'],
    ['O3.5','over35'],['U3.5','under35']
  ]
  for (const [market,key] of markets) {
    const evidence=[]
    for (const [side,team] of [['Home',home],['Away',away]]) {
      const rate=team[key]
      if (!isNum(rate)) continue
      if (rate >= 80) evidence.push(`${side} ${market} hit rate ≥ 80% (${rate}%)`)
      else if (rate >= 60) evidence.push(`${side} ${market} hit rate ≥ 60% (${rate}%)`)
    }
    if (evidence.length) {
      const vals=[home[key],away[key]].filter(isNum)
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0
      out.push({market,filterCount:evidence.length,score:avg+evidence.length*10,reasons:evidence,reason:evidence.join(' • ')})
    }
  }
  return out
}

function contradictionLevel(signals){
  const pos=signals.filter(x=>x.direction==='positive').reduce((a,x)=>a+x.weight,0)
  const neg=signals.filter(x=>x.direction==='negative').reduce((a,x)=>a+x.weight,0)
  if (neg >= 3 || (pos>0 && neg/pos >= .75)) return 'HIGH'
  if (neg >= 1.4 || (pos>0 && neg/pos >= .35)) return 'MODERATE'
  return 'LOW'
}

function priorityLabel(count, contradiction){
  if (contradiction==='HIGH') return 'WATCHLIST'
  if (count>=7) return 'ELITE'
  if (count>=5) return 'VERY HIGH'
  if (count>=3) return 'HIGH'
  if (count>=2) return 'MEDIUM'
  return 'WATCHLIST'
}

function makeTeamPick(fixture, selected, opponent, odds, drawOdds) {
  const signals = teamSignals(selected, opponent, odds, drawOdds)
  const positives = signals.filter(x=>x.direction==='positive')
  if (!positives.length) return null
  const contradiction = contradictionLevel(signals)
  const filterCount = positives.length
  const score = positives.reduce((a,x)=>a+x.weight,0) - signals.filter(x=>x.direction==='negative').reduce((a,x)=>a+x.weight,0) + (odds ? Math.max(0,2.5-odds)*.35 : 0)
  return {
    fixtureId: fixture.fixtureId, match: fixture.match, league: fixture.league, country: fixture.country, leagueLogo:fixture.leagueLogo||null, countryFlag:fixture.countryFlag||null, kickoff: fixture.kickoff, kickoffLocal: fixture.kickoffLocal,
    selectedTeamId:selected.id, selectedTeamLogo:selected.logo||null, selectedTeam:selected.name, selectedPosition:selected.position,
    opponentTeamId:opponent.id, opponentTeam:opponent.name, opponentTeamLogo:opponent.logo||null, opponentPosition:opponent.position,
    odds, drawOdds, market:'1X2', filterCount, contradiction, score:+score.toFixed(3), priorityLabel:priorityLabel(filterCount, contradiction),
    filters:positives.map(x=>x.label), negativeSignals:signals.filter(x=>x.direction==='negative').map(x=>x.label),
    shortReason: positives.slice(0,4).map(x=>x.label).join(' • ') + (positives.length>4 ? ` • +${positives.length-4} more` : '')
  }
}

export function analyzeFixture(fixture){
  const picks=[]
  const hp=makeTeamPick(fixture, fixture.home, fixture.away, fixture.odds?.home, fixture.odds?.draw)
  const ap=makeTeamPick(fixture, fixture.away, fixture.home, fixture.odds?.away, fixture.odds?.draw)
  if (hp) picks.push(hp); if (ap) picks.push(ap)

  // Avoid selecting both sides as primary 1X2 unless one clearly outranks the other.
  const oneXtwo = picks.filter(p=>p.market==='1X2').sort((a,b)=>b.score-a.score)
  const resolved=[]
  if (oneXtwo[0]) resolved.push(oneXtwo[0])
  if (oneXtwo[1] && oneXtwo[0].score - oneXtwo[1].score < .4) {
    oneXtwo[0].contradiction='HIGH'; oneXtwo[0].priorityLabel='WATCHLIST'
  }

  for (const g of goalSignals(fixture.home, fixture.away)) resolved.push({
    fixtureId:fixture.fixtureId, match:fixture.match, league:fixture.league, country:fixture.country, leagueLogo:fixture.leagueLogo||null, countryFlag:fixture.countryFlag||null, kickoff:fixture.kickoff, kickoffLocal:fixture.kickoffLocal,
    selectedTeamId:0, selectedTeam:g.market, selectedPosition:null, opponentTeam:'Goals market', opponentPosition:null,
    odds:null, drawOdds:fixture.odds?.draw ?? null, market:g.market, filterCount:g.filterCount, contradiction:'LOW', score:g.score/100,
    priorityLabel:priorityLabel(g.filterCount,'LOW'), filters:g.reasons, negativeSignals:[], shortReason:g.reason
  })
  return resolved
}

export function buildBoard(fixtures, meta={}){
  const all = fixtures.flatMap(analyzeFixture)
  const qualified = all.filter(x=>x.filterCount>=1)
  const groups = {
    single: qualified.filter(x=>x.filterCount===1).sort(sortPicks),
    two: qualified.filter(x=>x.filterCount===2).sort(sortPicks),
    threePlus: qualified.filter(x=>x.filterCount>=3).sort(sortPicks)
  }
  return { meta:{...meta, qualified:qualified.length}, groups, priority:[...qualified].sort(sortPicks) }
}
function sortPicks(a,b){ return b.filterCount-a.filterCount || rankContradiction(a.contradiction)-rankContradiction(b.contradiction) || b.score-a.score || (a.odds??99)-(b.odds??99) }
function rankContradiction(x){ return x==='LOW'?0:x==='MODERATE'?1:2 }
