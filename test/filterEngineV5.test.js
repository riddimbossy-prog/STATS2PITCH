import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture,buildFilterBoard,FILTER_RULE_VERSION} from '../server/filterEngine.js'

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-08-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}

function venueRows(teamId,venue,scores){
  return scores.map((pair,index)=>venue==='home'
    ?finished(index+1,teamId,800+index,pair[0],pair[1])
    :finished(index+1,800+index,teamId,pair[1],pair[0]))
}

function markets({homeWin=1.10,awayWin=8.00,over15=1.22,under35=1.50}={}){
  return[
    {marketKey:'match-winner',market:'Match winner',outcomes:[{name:'Home',odd:homeWin},{name:'Away',odd:awayWin}]},
    {marketKey:'total-goals',market:'Total goals',outcomes:[{name:'Over 1.5',odd:over15},{name:'Under 3.5',odd:under35}]}
  ]
}

function fixture({homeScores,awayScores,under35=1.50,over15=1.22}={}){
  return{
    fixtureId:9001,
    league:'V5 Test League',
    country:'Uzbekistan',
    kickoff:'2026-09-03T18:00:00Z',
    home:{id:1,name:'Home FC',fixtures:venueRows(1,'home',homeScores)},
    away:{id:2,name:'Away FC',fixtures:venueRows(2,'away',awayScores)},
    homeSplit:{position:6,size:20,sampleReady:true},
    awaySplit:{position:13,size:20,sampleReady:true},
    earlySeason:false,
    h2h:[],
    marketOdds:markets({under35,over15})
  }
}

test('V5 blocks the screenshot shape: 60/80 venue support plus marginal U3.5 1.42',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeScores:[[1,0],[1,0],[1,1],[2,0],[2,1]],
    awayScores:[[1,0],[1,1],[2,0],[2,1],[0,2]],
    under35:1.42,
    over15:1.20
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-over15-market-confirmation')
  assert.equal(result.v5Safety.recent.home,60)
  assert.equal(result.v5Safety.recent.away,80)
})

test('V5 still allows strong 80/80 venue support when U3.5 has acceptable separation',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeScores:[[1,1],[2,0],[2,1],[1,0],[3,0]],
    awayScores:[[1,1],[2,0],[2,1],[1,0],[0,2]],
    under35:1.46,
    over15:1.22
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick?.route,'over-15')
  assert.equal(result.pick?.filterRulesVersion,'v5')
  assert.equal(result.v5Safety.strongRecent,true)
})

test('V5 detects the 1-0 / 0-1 trap even when raw O1.5 venue rates are 80%',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeScores:[[1,1],[1,1],[1,1],[1,0],[2,0]],
    awayScores:[[0,2],[0,2],[0,2],[1,1],[1,0]],
    under35:1.46,
    over15:1.22
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-one-goal-trap')
  assert.equal(result.v5Safety.oneGoalTrap,true)
})

test('Filter board exposes the V5 rules revision without changing the public engine id',()=>{
  const board=buildFilterBoard([fixture({
    homeScores:[[1,1],[2,0],[2,1],[1,0],[3,0]],
    awayScores:[[1,1],[2,0],[2,1],[1,0],[0,2]],
    under35:1.46
  })])
  assert.equal(FILTER_RULE_VERSION,'v5')
  assert.equal(board.meta.rulesVersion,'v5')
  assert.equal(board.meta.safetyRevision,'v5.0-one-goal-trap')
  assert.equal(board.bestPicks.length,1)
})
