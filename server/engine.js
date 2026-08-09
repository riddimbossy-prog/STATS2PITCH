const isNum = v => typeof v === 'number' && Number.isFinite(v)
const isOdd = v => isNum(v) && v > 1.001 && v < 1000
const add = (arr, code, label, direction='positive', family='General', weight=1) => arr.push({code,label,direction,family,weight})

const FAMILY={
  TABLE:'Table Strength',FORM:'Form',ATTACK:'Attack',DEFENCE:'Defence',MARKET:'Market/Odds',OPP:'Opponent Weakness',GOALS:'Goal Pattern'
}
const venueWord=team=>team?.venue==='away'?'away':'home'
const venueTitle=team=>team?.venue==='away'?'Away':'Home'
const isBottomThree=team=>isNum(team?.position)&&isNum(team?.leagueSize)&&team.leagueSize>=3&&team.position>team.leagueSize-3
const uniqueFamilies=signals=>[...new Set((signals||[]).map(x=>x.family).filter(Boolean))]

function teamSignals(team, opponent, odds, drawOdds) {
  const s=[]
  const venue=venueWord(team), opponentVenue=venueWord(opponent)
  const teamName=team.name||'Team', oppName=opponent.name||'Opponent'

  // TABLE STRENGTH — split table only.
  if (isNum(team.position) && team.position <= 3) add(s,'TOP3',`${teamName} are top 3 in the ${venue} table`,'positive',FAMILY.TABLE,1.2)
  if (isBottomThree(team)) add(s,'BOTTOM3',`${teamName} are bottom 3 in the ${venue} table`,'negative',FAMILY.TABLE,1.5)
  if (isNum(team.ppg) && team.ppg >= 2) add(s,'PPG_HIGH',`${teamName} average at least 2 points per ${venue} league match`,'positive',FAMILY.TABLE,1.2)
  if (isNum(team.ppg) && team.ppg < 1) add(s,'PPG_LOW',`${teamName} average under 1 point per ${venue} league match`,'negative',FAMILY.TABLE,1.2)

  // ATTACK — season split only.
  if (isNum(team.goalsScored)) {
    if (team.goalsScored >= 2.3) add(s,'GS_23',`${teamName} score at least 2.3 goals per ${venue} league match`,'positive',FAMILY.ATTACK,1.3)
    else if (team.goalsScored >= 2.0) add(s,'GS_20',`${teamName} score at least 2 goals per ${venue} league match`,'positive',FAMILY.ATTACK,1.1)
    else if (team.goalsScored < 1.0) add(s,'GS_LOW',`${teamName} score under 1 goal per ${venue} league match`,'negative',FAMILY.ATTACK,1.1)
  }
  if (isNum(team.failedToScoreRate) && team.failedToScoreRate >= 40) add(s,'FTS_SPLIT_40',`${teamName} failed to score in at least 40% of their recent ${venue} league matches`,'negative',FAMILY.ATTACK,1.0)

  // DEFENCE — season split plus split clean-sheet support.
  if (isNum(team.goalsConceded)) {
    if (team.goalsConceded > 2.3) add(s,'GC_23',`${teamName} concede more than 2.3 goals per ${venue} league match`,'negative',FAMILY.DEFENCE,1.3)
    else if (team.goalsConceded >= 2.0) add(s,'GC_20',`${teamName} concede at least 2 goals per ${venue} league match`,'negative',FAMILY.DEFENCE,1.1)
    else if (team.goalsConceded < 1.0) add(s,'GC_LOW',`${teamName} concede under 1 goal per ${venue} league match`,'positive',FAMILY.DEFENCE,1.1)
  }
  if (isNum(team.cleanSheetRate) && team.cleanSheetRate >= 60) add(s,'CS_SPLIT_60',`${teamName} kept a clean sheet in at least 60% of their recent ${venue} league matches`,'positive',FAMILY.DEFENCE,.8)

  // FORM — last five at the actual venue only. deriveVenueRecentStats withholds
  // these rates until a full five-match venue sample exists.
  if (isNum(team.winRate)) {
    if (team.winRate >= 80) add(s,'WIN80',`${teamName} won at least 4 of their last 5 ${venue} league matches`,'positive',FAMILY.FORM,1.4)
    else if (team.winRate >= 60) add(s,'WIN60',`${teamName} won at least 3 of their last 5 ${venue} league matches`,'positive',FAMILY.FORM,1.1)
    else if (team.winRate < 40) add(s,'WIN_LT40',`${teamName} won fewer than 2 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1.0)
    else if (team.winRate < 60) add(s,'WIN_LT60',`${teamName} won fewer than 3 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,.6)
  }
  if (isNum(team.lossRate)) {
    if (team.lossRate >= 80) add(s,'LOSS80',`${teamName} lost at least 4 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1.4)
    else if (team.lossRate >= 60) add(s,'LOSS60',`${teamName} lost at least 3 of their last 5 ${venue} league matches`,'negative',FAMILY.FORM,1.1)
  }
  if(team.formAgreement==='WIN_STRONG')add(s,'FORM_5_10_WIN_AGREE',`${teamName}'s strong ${venue} form is confirmed across both their last 5 and last 10 ${venue} league matches`,'positive',FAMILY.FORM,.7)
  if(team.formAgreement==='LOSS_STRONG')add(s,'FORM_5_10_LOSS_AGREE',`${teamName}'s poor ${venue} form is confirmed across both their last 5 and last 10 ${venue} league matches`,'negative',FAMILY.FORM,.7)
  if(team.formAgreement==='CONFLICT')add(s,'FORM_5_10_CONFLICT',`${teamName}'s last 5 ${venue} matches disagree sharply with their last 10 ${venue} matches`,'negative',FAMILY.FORM,1.2)

  // MARKET — fixture-level odds are already specific to this match, so this is
  // the only family that is not a historical venue split.
  if (isOdd(odds)) {
    if (odds < 1.20) add(s,'ODDS_120',`${teamName}'s win price is below 1.20`,'positive',FAMILY.MARKET,1.5)
    else if (odds <= 1.55) add(s,'ODDS_155',`${teamName}'s win price is 1.55 or lower`,'positive',FAMILY.MARKET,1.25)
    else if (odds <= 2.0) add(s,'ODDS_200',`${teamName}'s win price is 2.00 or lower`,'positive',FAMILY.MARKET,.8)
    else if (odds > 5) add(s,'ODDS_500',`${teamName}'s win price is above 5.00`,'negative',FAMILY.MARKET,1.4)
  }
  if (isOdd(drawOdds)) {
    if (drawOdds < 3) add(s,'DRAW_LT3','The draw price is below 3.00','negative',FAMILY.MARKET,.8)
    else if (drawOdds > 5) add(s,'DRAW_GT5','The draw price is above 5.00','positive',FAMILY.MARKET,1.1)
    else if (drawOdds > 4) add(s,'DRAW_GT4','The draw price is above 4.00','positive',FAMILY.MARKET,.8)
  }

  // OPPONENT WEAKNESS — always uses the opponent's correct venue split.
  if (isNum(opponent.position) && opponent.position <= 3) add(s,'OPP_TOP3',`${oppName} are top 3 in the ${opponentVenue} table`,'negative',FAMILY.OPP,1.2)
  if (isBottomThree(opponent)) add(s,'OPP_BOTTOM3',`${oppName} are bottom 3 in the ${opponentVenue} table`,'positive',FAMILY.OPP,1.2)
  if (isNum(opponent.ppg) && opponent.ppg < 1) add(s,'OPP_PPG_LOW',`${oppName} average under 1 point per ${opponentVenue} league match`,'positive',FAMILY.OPP,1.2)
  if (isNum(opponent.goalsScored) && opponent.goalsScored < 1) add(s,'OPP_GS_LOW',`${oppName} score under 1 goal per ${opponentVenue} league match`,'positive',FAMILY.OPP,1.1)
  if (isNum(opponent.goalsConceded)) {
    if (opponent.goalsConceded > 2.3) add(s,'OPP_GC_23',`${oppName} concede more than 2.3 goals per ${opponentVenue} league match`,'positive',FAMILY.OPP,1.3)
    else if (opponent.goalsConceded >= 2.0) add(s,'OPP_GC_20',`${oppName} concede at least 2 goals per ${opponentVenue} league match`,'positive',FAMILY.OPP,1.1)
    else if (opponent.goalsConceded < 1.0) add(s,'OPP_GC_LOW',`${oppName} concede under 1 goal per ${opponentVenue} league match`,'negative',FAMILY.OPP,1.1)
  }
  if (isNum(opponent.lossRate)) {
    if (opponent.lossRate >= 80) add(s,'OPP_LOSS80',`${oppName} lost at least 4 of their last 5 ${opponentVenue} league matches`,'positive',FAMILY.OPP,1.4)
    else if (opponent.lossRate >= 60) add(s,'OPP_LOSS60',`${oppName} lost at least 3 of their last 5 ${opponentVenue} league matches`,'positive',FAMILY.OPP,1.1)
  }
  if(isNum(opponent.failedToScoreRate)&&opponent.failedToScoreRate>=40)add(s,'OPP_FTS_SPLIT_40',`${oppName} failed to score in at least 40% of their recent ${opponentVenue} league matches`,'positive',FAMILY.OPP,.8)
  if(isNum(opponent.cleanSheetRate)&&opponent.cleanSheetRate>=60)add(s,'OPP_CS_SPLIT_60',`${oppName} kept a clean sheet in at least 60% of their recent ${opponentVenue} league matches`,'negative',FAMILY.OPP,.8)

  return s
}

const goalNames = {
  'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals',
  'O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals',
  'O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'
}
const goalCode = market => market.replace('.','').replace(/^O/,'O').replace(/^U/,'U')

function goalPrice(odds, market) {
  const key={ 'O1.5':'over15','U1.5':'under15','O2.5':'over25','U2.5':'under25','O3.5':'over35','U3.5':'under35' }[market]
  const v=key ? odds?.[key] : null
  return isOdd(v) ? v : null
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
    for (const team of [home,away]) {
      const rate=team[key]
      if (!isNum(rate)) continue
      const venue=venueWord(team)
      if (rate >= 80) evidence.push({code:`GOAL_${goalCode(market)}_80`,label:`${goalNames[market]} landed in at least 80% of ${team.name}'s recent ${venue} league matches`,family:FAMILY.GOALS})
      else if (rate >= 60) evidence.push({code:`GOAL_${goalCode(market)}_60`,label:`${goalNames[market]} landed in at least 60% of ${team.name}'s recent ${venue} league matches`,family:FAMILY.GOALS})
    }
    if (evidence.length) {
      const vals=[home[key],away[key]].filter(isNum)
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0
      out.push({market,filterCount:evidence.length,familyCount:1,score:avg+evidence.length*10,reasons:evidence,reason:evidence.map(x=>x.label).join(' • ')})
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
  if (!isOdd(odds)) return null

  // Fail closed for team-result markets if a split rank is unavailable. This is
  // required so the hard bottom-three veto can never be bypassed by missing data.
  if(!isNum(selected?.position)||!isNum(selected?.leagueSize))return null

  // Absolute split bottom-three veto at the engine entrance. winSafety.js repeats
  // this check later as defence-in-depth.
  if(isBottomThree(selected))return null

  const signals = teamSignals(selected, opponent, odds, drawOdds)
  const positives = signals.filter(x=>x.direction==='positive')
  if (!positives.length) return null
  const negatives = signals.filter(x=>x.direction==='negative')
  const contradiction = contradictionLevel(signals)
  const filterCount = positives.length
  const families=uniqueFamilies(positives)
  const familyCount=families.length
  const score = positives.reduce((a,x)=>a+x.weight,0) - negatives.reduce((a,x)=>a+x.weight,0) + Math.max(0,2.5-odds)*.35
  return {
    fixtureId: fixture.fixtureId, match: fixture.match, league: fixture.league, country: fixture.country, leagueLogo:fixture.leagueLogo||null, countryFlag:fixture.countryFlag||null, kickoff: fixture.kickoff, kickoffLocal: fixture.kickoffLocal,
    selectedTeamId:selected.id, selectedTeamLogo:selected.logo||null, selectedTeam:selected.name, selectedPosition:selected.position,
    opponentTeamId:opponent.id, opponentTeam:opponent.name, opponentTeamLogo:opponent.logo||null, opponentPosition:opponent.position,
    venue:venueWord(selected), venueLabel:venueTitle(selected), overallSelectedPosition:selected.overallPosition??selected?.overall?.position??null, overallOpponentPosition:opponent.overallPosition??opponent?.overall?.position??null,
    odds, drawOdds:isOdd(drawOdds)?drawOdds:null, market:'1X2', filterCount, familyCount, filterFamilies:families, contradiction, score:+score.toFixed(3), priorityLabel:priorityLabel(filterCount, contradiction),
    filters:positives.map(x=>x.label), filterCodes:positives.map(x=>x.code),
    negativeSignals:negatives.map(x=>x.label), negativeSignalCodes:negatives.map(x=>x.code),
    shortReason: positives.slice(0,4).map(x=>x.label).join(' • ') + (positives.length>4 ? ` • +${positives.length-4} more` : '')
  }
}

export function analyzeFixture(fixture){
  const picks=[]
  const hp=makeTeamPick(fixture, fixture.home, fixture.away, fixture.odds?.home, fixture.odds?.draw)
  const ap=makeTeamPick(fixture, fixture.away, fixture.home, fixture.odds?.away, fixture.odds?.draw)
  if (hp) picks.push(hp); if (ap) picks.push(ap)

  const oneXtwo = picks.filter(p=>p.market==='1X2').sort((a,b)=>b.score-a.score)
  const resolved=[]
  if (oneXtwo[0]) resolved.push(oneXtwo[0])
  if (oneXtwo[1] && oneXtwo[0].score - oneXtwo[1].score < .4) {
    oneXtwo[0].contradiction='HIGH'; oneXtwo[0].priorityLabel='WATCHLIST'
  }

  for (const g of goalSignals(fixture.home, fixture.away)) {
    const price=goalPrice(fixture.odds,g.market)
    if (!isOdd(price)) continue
    resolved.push({
      fixtureId:fixture.fixtureId, match:fixture.match, league:fixture.league, country:fixture.country, leagueLogo:fixture.leagueLogo||null, countryFlag:fixture.countryFlag||null, kickoff:fixture.kickoff, kickoffLocal:fixture.kickoffLocal,
      selectedTeamId:0, selectedTeam:goalNames[g.market], selectedPosition:null, opponentTeam:'Whole match', opponentPosition:null,
      odds:price, drawOdds:isOdd(fixture.odds?.draw)?fixture.odds.draw:null, market:g.market, filterCount:g.filterCount, familyCount:g.familyCount, filterFamilies:[FAMILY.GOALS], contradiction:'LOW', score:g.score/100,
      priorityLabel:priorityLabel(g.filterCount,'LOW'), filters:g.reasons.map(x=>x.label), filterCodes:g.reasons.map(x=>x.code), negativeSignals:[], negativeSignalCodes:[], shortReason:g.reason
    })
  }
  return resolved
}

export function buildBoard(fixtures, meta={}){
  const all = fixtures.flatMap(analyzeFixture)
  const qualified = all.filter(x=>x.filterCount>=1 && isOdd(x.odds))
  const groups = {
    single: qualified.filter(x=>x.filterCount===1).sort(sortPicks),
    two: qualified.filter(x=>x.filterCount===2).sort(sortPicks),
    threePlus: qualified.filter(x=>x.filterCount>=3).sort(sortPicks)
  }
  const oddsByFixture=Object.fromEntries(fixtures.map(f=>[String(f.fixtureId), Array.isArray(f.marketOdds)?f.marketOdds:[]]))
  const availableMarkets=[...new Set(fixtures.flatMap(f=>(f.marketOdds||[]).map(m=>m.market)).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
  return { meta:{...meta, qualified:qualified.length, pricingPolicy:'verified-odds-only'}, groups, priority:[...qualified].sort(sortPicks), oddsByFixture, availableMarkets }
}
function sortPicks(a,b){ return b.filterCount-a.filterCount || Number(b.familyCount||0)-Number(a.familyCount||0) || rankContradiction(a.contradiction)-rankContradiction(b.contradiction) || b.score-a.score || (a.odds??99)-(b.odds??99) }
function rankContradiction(x){ return x==='LOW'?0:x==='MODERATE'?1:2 }
