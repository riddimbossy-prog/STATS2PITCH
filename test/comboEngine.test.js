import test from 'node:test'
import assert from 'node:assert/strict'
import {listedComboMarkets,analyzeComboFixture,comboThresholdGate,COMBO_MIN_ODD,COMBO_MIN_SCORE,COMBO_ENGINE_VERSION,COMBO_ODDS_THRESHOLDS} from '../server/comboEngine.js'
import {settlePick} from '../server/settlement.js'

const market=(name,yes)=>({name,outcomes:[{name:'Yes',odds:yes},{name:'No',odds:3.2}]})
const ft=(id,homeId,awayId,h,a,date)=>({fixture:{id,date,status:{short:'FT'}},teams:{home:{id:homeId,name:`T${homeId}`},away:{id:awayId,name:`T${awayId}`}},goals:{home:h,away:a},score:{fulltime:{home:h,away:a},halftime:{home:0,away:0}}})
function decisionOdds(overrides={}){
  const odds={draw:3.00,homeO05:1.20,awayO05:1.25,homeO15:1.49,awayO15:2.20,homeO25:2.10,awayO25:3.40,matchOver25:1.70,bttsYes:1.50,homeWin:1.55,awayWin:5.80,...overrides}
  const row=(marketKey,outcomes)=>({marketKey,source:'sportybet',outcomes:Object.entries(outcomes).filter(([,odd])=>odd!==null&&odd!==undefined).map(([name,odd])=>({name,odd}))})
  return[
    row('match-winner',{Home:odds.homeWin,Draw:odds.draw,Away:odds.awayWin}),
    row('total-goals',{'Over 2.5':odds.matchOver25}),
    row('both-teams-score',{Yes:odds.bttsYes}),
    row('home-team-goals',{'Over 0.5':odds.homeO05,'Over 1.5':odds.homeO15,'Over 2.5':odds.homeO25}),
    row('away-team-goals',{'Over 0.5':odds.awayO05,'Over 1.5':odds.awayO15,'Over 2.5':odds.awayO25})
  ]
}

function strongHomeFixture({price=1.44,h2h=[],markets=null}={}){
  const homeId=1,awayId=2
  const homeFixtures=[
    ft(1,homeId,9,2,0,'2026-08-30'),ft(2,homeId,8,3,1,'2026-08-24'),ft(3,homeId,7,2,1,'2026-08-18'),ft(4,homeId,6,1,0,'2026-08-12'),ft(5,homeId,5,3,0,'2026-08-06')
  ]
  const awayFixtures=[
    ft(11,9,awayId,2,0,'2026-08-29'),ft(12,8,awayId,3,1,'2026-08-23'),ft(13,7,awayId,1,0,'2026-08-17'),ft(14,6,awayId,2,1,'2026-08-11'),ft(15,5,awayId,3,0,'2026-08-05')
  ]
  return{
    fixtureId:99,league:'Test League',country:'Test',kickoff:'2026-09-06T15:00:00Z',statsReady:true,
    home:{id:homeId,name:'Home FC',fixtures:homeFixtures,lastMatches:homeFixtures},away:{id:awayId,name:'Away FC',fixtures:awayFixtures,lastMatches:awayFixtures},
    homeSplit:{sampleReady:true,position:1,size:10,ppg:2.6},awaySplit:{sampleReady:true,position:10,size:10,ppg:0.4},
    homeStats:{over25:60,btts:40,cs:60,fts:0},awayStats:{over25:60,btts:40,cs:20,fts:40},h2h,
    marketOdds:decisionOdds(),
    sportyMarkets:markets||[market('Home Team or Over 2.5',price),market('Home Team or GG',1.45),market('Draw or Over 2.5',1.29)]
  }
}

function balancedDrawOverFixture(price=1.29){
  const homeId=1,awayId=2
  const homeFixtures=[
    ft(21,homeId,9,1,1,'2026-08-30'),ft(22,homeId,8,2,2,'2026-08-24'),ft(23,homeId,7,2,1,'2026-08-18'),ft(24,homeId,6,3,1,'2026-08-12'),ft(25,homeId,5,1,2,'2026-08-06')
  ]
  const awayFixtures=[
    ft(31,9,awayId,1,1,'2026-08-29'),ft(32,8,awayId,2,2,'2026-08-23'),ft(33,7,awayId,2,1,'2026-08-17'),ft(34,6,awayId,1,2,'2026-08-11'),ft(35,5,awayId,3,1,'2026-08-05')
  ]
  return{
    fixtureId:199,league:'Balanced League',country:'Test',kickoff:'2026-09-07T18:00:00Z',statsReady:true,
    home:{id:homeId,name:'Home FC',fixtures:homeFixtures,lastMatches:homeFixtures},away:{id:awayId,name:'Away FC',fixtures:awayFixtures,lastMatches:awayFixtures},
    homeSplit:{sampleReady:true,position:4,size:10,ppg:1.6},awaySplit:{sampleReady:true,position:5,size:10,ppg:1.4},
    homeStats:{over25:80,btts:80,cs:20,fts:10},awayStats:{over25:80,btts:80,cs:20,fts:10},
    marketOdds:decisionOdds(),
    h2h:[{home:'Home FC',away:'Away FC',hs:2,as:2},{home:'Away FC',away:'Home FC',hs:1,as:1}],
    sportyMarkets:[market('Draw or Over 2.5',price)]
  }
}

test('recognizes all twelve Combo market families and enforces 1.20 minimum',()=>{
  const rows=[
    market('Home Team or Over 2.5',1.44),market('Home Team or Under 2.5',1.76),market('Draw or Over 2.5',1.29),market('Draw or Under 2.5',1.92),
    market('Away or Over 2.5',1.25),market('Away or Under 2.5',1.19),market('Home Team or GG',1.45),market('Draw or GG',1.52),market('Away Team or GG',1.22),
    market('Home Team or Any Clean Sheet',1.75),market('Draw or Any Clean Sheet',1.56),market('Away Team or Any Clean Sheet',1.33)
  ]
  const parsed=listedComboMarkets(rows)
  assert.equal(COMBO_MIN_ODD,1.20)
  assert.equal(COMBO_MIN_SCORE,80)
  assert.equal(COMBO_ENGINE_VERSION,'combo-v3-hard-odds-gates')
  assert.equal(parsed.length,11)
  assert.ok(parsed.every(x=>x.odds>=1.20))
  assert.ok(parsed.some(x=>x.market==='combo-home-over-25'))
  assert.ok(parsed.some(x=>x.market==='combo-draw-clean-sheet'))
})

test('publishes only strict qualified Combo picks and never more than two',()=>{
  const picks=analyzeComboFixture(strongHomeFixture())
  assert.ok(picks.length<=2)
  assert.ok(picks.length>=1)
  assert.equal(picks[0].rank,1)
  assert.ok(picks.every(x=>x.odds>=1.20&&x.comboScore>=80&&x.reasons.length>0&&x.why))
  assert.ok(picks.every(x=>x.homeConsensus>=80&&x.awayConsensus>=80))
  assert.ok(picks.every(x=>x.failureState.combinedFailures<=2))
  assert.ok(picks.every(x=>x.primaryRoute.rate>=70&&x.insuranceRoute.rate>=30))
})

test('draw-or-over can qualify when winner is unclear but the failure state is rare',()=>{
  const picks=analyzeComboFixture(balancedDrawOverFixture())
  assert.equal(picks.length,1)
  assert.equal(picks[0].route,'DRAW_OVER_25')
  assert.ok(picks[0].comboScore>=80)
  assert.equal(picks[0].archetype,'Balanced match + high event')
  assert.match(picks[0].failureState.text,/not a draw/)
})

test('hard Combo odds gates apply the exact inclusive and exclusive thresholds',()=>{
  const base={marketOdds:decisionOdds()}
  assert.equal(COMBO_ODDS_THRESHOLDS.ggTeamOver05ExclusiveMax,1.30)
  assert.equal(COMBO_ODDS_THRESHOLDS.drawMax,3.00)
  assert.equal(COMBO_ODDS_THRESHOLDS.over25TeamOver25Max,2.10)
  assert.equal(COMBO_ODDS_THRESHOLDS.cleanSheetTeamOver05Min,1.80)
  assert.equal(COMBO_ODDS_THRESHOLDS.sideTeamOver15ExclusiveMax,1.50)
  assert.equal(comboThresholdGate(base,{result:'draw',second:'over25'}).ok,true)
  assert.equal(comboThresholdGate(base,{result:'home',second:'gg'}).ok,true)

  assert.equal(comboThresholdGate({marketOdds:decisionOdds({awayO05:1.30})},{result:'home',second:'gg'}).ok,false,'GG 1.30 is not below 1.30')
  assert.equal(comboThresholdGate({marketOdds:decisionOdds({draw:3.01})},{result:'draw',second:'under25'}).ok,false,'Draw above 3.00 must fail')
  assert.equal(comboThresholdGate({marketOdds:decisionOdds({homeO25:2.11,awayO25:2.11})},{result:'draw',second:'over25'}).ok,false,'both team Over 2.5 prices above 2.10 must fail')
  assert.equal(comboThresholdGate({marketOdds:decisionOdds({homeO05:1.79,awayO05:1.79})},{result:'draw',second:'cleanSheet'}).ok,false,'clean-sheet route needs at least one 1.80+')
  assert.equal(comboThresholdGate({marketOdds:decisionOdds({homeO15:1.50,awayO15:1.50})},{result:'home',second:'under25'}).ok,false,'side route needs at least one price strictly below 1.50')
})

test('missing team-goal prices do not veto Combo; match-level odds are used instead',()=>{
  const empty={marketOdds:[]}
  assert.equal(comboThresholdGate(empty,{result:'home',second:'gg'}).ok,true)
  assert.equal(comboThresholdGate(empty,{result:'draw',second:'over25'}).ok,true)
  assert.equal(comboThresholdGate(empty,{result:'away',second:'cleanSheet'}).ok,true)

  const noTeamTotals={marketOdds:decisionOdds({homeO05:null,awayO05:null,homeO15:null,awayO15:null,homeO25:null,awayO25:null,matchOver25:1.70,bttsYes:1.50,homeWin:1.55})}
  assert.equal(comboThresholdGate(noTeamTotals,{result:'home',second:'over25'}).ok,true)
  assert.equal(comboThresholdGate(noTeamTotals,{result:'home',second:'gg'}).ok,true)
  assert.equal(comboThresholdGate({marketOdds:decisionOdds({homeO05:null,awayO05:null,homeO25:null,awayO25:null,matchOver25:1.90,bttsYes:1.80})},{result:'draw',second:'over25'}).ok,false)
})

test('qualified Combo why includes the new threshold evidence',()=>{
  const f=strongHomeFixture({markets:[market('Home Team or Over 2.5',1.44)]})
  const picks=analyzeComboFixture(f)
  assert.equal(picks.length,1)
  assert.match(picks[0].reasons.join(' '),/Over 2\.5 gate:/)
  assert.match(picks[0].reasons.join(' '),/Side gate:/)
  assert.equal(picks[0].oddsThresholdEvidence.homeOver25,2.10)
})

test('a statistically strong Combo is still rejected when its hard odds path conflicts',()=>{
  const f=strongHomeFixture({markets:[market('Home Team or GG',1.45)]})
  f.marketOdds=decisionOdds({awayO05:1.30})
  assert.equal(analyzeComboFixture(f).length,0)
})

test('clean-sheet Combo accepts the 1.80 boundary and rejects 1.79',()=>{
  const f=strongHomeFixture({markets:[market('Home Team or Any Clean Sheet',1.44)]})
  f.marketOdds=decisionOdds({homeO05:1.20,awayO05:1.80})
  assert.equal(analyzeComboFixture(f).length,1)
  f.marketOdds=decisionOdds({homeO05:1.79,awayO05:1.79})
  assert.equal(analyzeComboFixture(f).length,0)
})

test('Home or Over 2.5 still qualifies when only match Over 2.5 is on the board',()=>{
  const f=strongHomeFixture({markets:[market('Home Team or Over 2.5',1.44)]})
  f.marketOdds=decisionOdds({homeO25:null,awayO25:null,matchOver25:1.72,homeO15:1.40})
  const picks=analyzeComboFixture(f)
  assert.equal(picks.length,1)
  assert.match(picks[0].reasons.join(' '),/match Over 2\.5/)
})

test('rejects a Combo when either venue split hits below 80 percent',()=>{
  const f=strongHomeFixture({markets:[market('Home Team or Over 2.5',1.44)]})
  f.away.fixtures=[
    ft(41,9,2,1,0,'2026-08-29'),
    ft(42,8,2,1,1,'2026-08-23'),
    ft(43,7,2,2,0,'2026-08-17'),
    ft(44,6,2,2,1,'2026-08-11'),
    ft(45,5,2,0,1,'2026-08-05')
  ]
  f.away.lastMatches=f.away.fixtures
  assert.equal(analyzeComboFixture(f).length,0)
})

test('high odds require elite evidence rather than being rescued by a generic score',()=>{
  const f=balancedDrawOverFixture(1.75)
  f.home.fixtures[0]=ft(21,1,9,1,0,'2026-08-30')
  f.home.lastMatches=f.home.fixtures
  const picks=analyzeComboFixture(f)
  assert.equal(picks.length,0)
})

test('repeated H2H failure shape vetoes an otherwise strong Combo',()=>{
  const h2h=[
    {home:'Home FC',away:'Away FC',hs:0,as:1},
    {home:'Away FC',away:'Home FC',hs:1,as:0},
    {home:'Home FC',away:'Away FC',hs:1,as:1}
  ]
  const f=strongHomeFixture({h2h,markets:[market('Home Team or Over 2.5',1.44)]})
  assert.equal(analyzeComboFixture(f).length,0)
})

test('settles Combo OR logic correctly',()=>{
  const fixture={fixture:{id:7,status:{short:'FT'}},goals:{home:1,away:1},score:{fulltime:{home:1,away:1},halftime:{home:0,away:0}},teams:{home:{name:'A'},away:{name:'B'}}}
  assert.equal(settlePick({market:'combo-draw-over-25',selection:'Draw or Over 2.5'},fixture).outcome,'won')
  assert.equal(settlePick({market:'combo-home-over-25',selection:'Home Team or Over 2.5'},fixture).outcome,'lost')
  assert.equal(settlePick({market:'combo-away-gg',selection:'Away Team or GG'},fixture).outcome,'won')
  assert.equal(settlePick({market:'combo-draw-clean-sheet',selection:'Draw or Any Clean Sheet'},fixture).outcome,'won')
})
