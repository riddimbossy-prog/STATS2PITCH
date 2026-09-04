import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture,buildFilterBoard,extractFilterOdds,isCupCompetition,ENGINE_ID} from '../server/filterEngine.js'
import {diagnoseFilterFixture as diagnoseFilterFixtureV2} from '../server/filterEngineV2.js'
import {buildBoard} from '../server/engine.js'
import {parseSportyBet} from '../server/odds.js'

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-03-${String((id%27)+1).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}

function venueRows(teamId,venue,scores){
  return scores.map((pair,index)=>venue==='home'
    ?finished(index+1,teamId,800+index,pair[0],pair[1])
    :finished(index+1,800+index,teamId,pair[1],pair[0]))
}

const strongHome=[[2,0],[3,1],[2,1],[2,0],[3,0]]
const weakAway=[[0,2],[1,2],[0,1],[0,2],[1,3]]
const homeOver=[[3,2],[2,2],[4,1],[3,1],[2,1]]
const awayOver=[[2,3],[1,2],[3,3],[2,2],[1,3]]
const homeUnder=[[1,0],[0,0],[1,1],[2,0],[0,1]]
const awayUnder=[[0,1],[1,1],[0,0],[1,0],[0,1]]

function markets(odds={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let found=rows.find(row=>row.marketKey===marketKey)
    if(!found){found={marketKey,market,outcomes:[]};rows.push(found)}
    found.outcomes.push({name,odd:Number(odd)})
  }
  add('match-winner','Match winner','Home',odds.homeWin)
  add('match-winner','Match winner','Draw',odds.drawWin)
  add('match-winner','Match winner','Away',odds.awayWin)
  add('total-goals','Total goals','Over 1.5',odds.over15)
  add('total-goals','Total goals','Under 3.5',odds.under35)
  add('total-goals','Total goals','Over 2.5',odds.over25)
  add('total-goals','Total goals','Under 2.5',odds.under25)
  add('both-teams-score','Both teams to score','Yes',odds.ggYes)
  add('both-teams-score','Both teams to score','No',odds.ggNo)
  add('both-teams-score-2','GG/NG 2+','No',odds.gg2No)
  add('home-team-goals','Home team goals','Over 0.5',odds.homeO05)
  add('home-team-goals','Home team goals','Over 1.5',odds.homeO15)
  add('away-team-goals','Away team goals','Over 0.5',odds.awayO05)
  add('away-team-goals','Away team goals','Over 1.5',odds.awayO15)
  add('double-chance','Double chance','1X',odds.dc1x)
  add('double-chance','Double chance','X2',odds.dcX2)
  return rows
}

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||201,
    league:overrides.league||'Test League',
    country:'England',
    kickoff:overrides.kickoff||'2026-08-27T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:overrides.homeFixtures||venueRows(1,'home',strongHome)},
    away:{id:2,name:'Away FC',logo:null,fixtures:overrides.awayFixtures||venueRows(2,'away',weakAway)},
    homeSplit:overrides.homeSplit||{position:8,size:20,sampleReady:true,ppg:2.4,played:5,venue:'home'},
    awaySplit:overrides.awaySplit||{position:14,size:20,sampleReady:true,ppg:0.4,played:5,venue:'away'},
    earlySeason:overrides.earlySeason===true,
    h2h:overrides.h2h||[],
    marketOdds:overrides.marketOdds||markets({
      homeWin:1.35,awayWin:8.00,over15:1.22,under35:1.50,over25:1.70,under25:2.10,ggYes:1.80,gg2No:1.12
    })
  }
}

test('combined board attaches Perfect Split Filter Tips separately from All Picks and VAR Tips',()=>{
  const board=buildBoard([fixture()])
  assert.ok(Array.isArray(board.filterTips))
  assert.equal(board.meta.filterTipsEngine,ENGINE_ID)
  assert.equal(ENGINE_ID,'perfect-split-v1')
  assert.equal(board.filterTips[0].engine,ENGINE_ID)
  assert.equal(board.filterTips[0].route,'straight-win')
  assert.equal(board.filterTips[0].displaySelection,'Home Win')
  assert.ok(board.bestPicks.every(row=>row.engine!==ENGINE_ID))
})

test('Perfect Split publishes Home Win on a 5/5 win-loss split',()=>{
  const result=diagnoseFilterFixture(fixture())
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'straight-win')
  assert.equal(result.pick.marketId,'home-win')
  assert.equal(result.pick.selection,'Home')
  assert.equal(result.pick.odds,1.35)
  assert.equal(result.pick.consensus,100)
})

test('Perfect Split publishes Away Win when the venue split is reversed',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueRows(1,'home',weakAway),
    awayFixtures:venueRows(2,'away',strongHome),
    marketOdds:markets({homeWin:8.00,awayWin:1.40})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.marketId,'away-win')
  assert.equal(result.pick.selection,'Away')
})

test('a 4/5 opponent is a near miss, not a published Home Win',()=>{
  const result=diagnoseFilterFixture(fixture({
    awayFixtures:venueRows(2,'away',[[0,2],[1,3],[2,0],[0,1],[1,4]])
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'near-miss-no-consent')
})

test('Over 2.5 publishes only when both venue sides are 5/5 overs',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver),
    marketOdds:markets({over25:1.72,homeWin:2.10,awayWin:3.40})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'over-25')
  assert.equal(result.pick.market,'total-goals')
})

test('Under 2.5 publishes when both sides are 5/5 unders',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueRows(1,'home',homeUnder),
    awayFixtures:venueRows(2,'away',awayUnder),
    marketOdds:markets({under25:1.80,homeWin:2.20,awayWin:3.10})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'under-25')
})

test('short venue samples skip as insufficient-sample',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueRows(1,'home',[[2,0],[1,0]]),
    awayFixtures:venueRows(2,'away',weakAway)
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'insufficient-sample')
})

test('early season and cup ties are still hard skips',()=>{
  assert.equal(diagnoseFilterFixture(fixture({earlySeason:true})).skip,'early-season')
  assert.equal(isCupCompetition('FA Cup'),true)
  assert.equal(isCupCompetition('UEFA Champions League'),true)
  assert.equal(isCupCompetition('Premier League'),false)
  assert.equal(diagnoseFilterFixture(fixture({league:'FA Cup'})).skip,'cup')
})

test('V2 GG gate still lives on the legacy router',()=>{
  const result=diagnoseFilterFixtureV2(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.35,under35:1.40,ggYes:1.40,gg2No:1.45}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'gg')
  assert.equal(result.pick.market,'both-teams-score')
})

test('SportyBet market 60000 is GG 2+ No for the GG gate',()=>{
  const parsed=parseSportyBet([
    {id:29,name:'GG/NG',outcomes:[{desc:'Yes',odds:'1.40'},{desc:'No',odds:'2.80'}]},
    {id:60000,name:'GG/NG 2+',outcomes:[{desc:'Yes',odds:'3.10'},{desc:'No',odds:'1.45'}]},
    {id:18,name:'Over/Under',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.12'},{desc:'Under 1.5',odds:'6.00'}]}
  ])
  const by=Object.fromEntries(parsed.map(r=>[r.marketKey,r]))
  assert.equal(by['both-teams-score'].outcomes.find(o=>o.name==='Yes').odd,1.40)
  assert.equal(by['both-teams-score-2'].outcomes.find(o=>o.name==='No').odd,1.45)
  const odds=extractFilterOdds({marketOdds:parsed})
  assert.equal(odds.ggYes,1.40)
  assert.equal(odds.gg2No,1.45)
})

test('v2 extracts draw, team-total and goals-streak context when present',()=>{
  const odds=extractFilterOdds(fixture({marketOdds:markets({
    homeWin:1.35,drawWin:4.60,awayWin:8.00,homeO05:1.12,awayO05:1.55,homeO15:1.32,awayO15:2.10,streakYes:1.40
  })}))
  assert.equal(odds.drawWin,4.60)
  assert.equal(odds.homeO05,1.12)
  assert.equal(odds.awayO05,1.55)
})

test('filter board sorts published tips by kickoff',()=>{
  const board=buildFilterBoard([
    fixture({fixtureId:2,kickoff:'2026-08-27T20:00:00Z'}),
    fixture({fixtureId:1,kickoff:'2026-08-27T16:00:00Z'})
  ])
  assert.equal(board.bestPicks.length,2)
  assert.equal(board.bestPicks[0].fixtureId,1)
  assert.equal(board.meta.engine,ENGINE_ID)
  assert.equal(board.meta.filterVersion,'perfect-split-v1')
})
