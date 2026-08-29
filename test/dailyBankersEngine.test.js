import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeDailyBankerFixture,buildDailyBankersBoard,DAILY_BANKERS_ENGINE} from '../server/dailyBankersEngine.js'
import {publicBoard} from '../server/publicBoard.js'

function finished(id,homeId,awayId,h,a){
  return{fixture:{id,date:`2026-07-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:homeId},away:{id:awayId}},goals:{home:h,away:a},score:{halftime:{home:Math.min(h,1),away:Math.min(a,1)}}}
}
function history(id,venue,scores){
  return scores.map((s,i)=>venue==='home'?finished(i+1,id,800+i,s[0],s[1]):finished(i+1,800+i,id,s[1],s[0]))
}
function market(marketKey,marketName,name,odd){return{marketKey,market:marketName,outcomes:[{name,odd,verified:true}]}}
function fixture({fixtureId=1,homeScores,awayScores,marketOdds,homeSplit={position:3,size:20,sampleReady:true},awaySplit={position:14,size:20,sampleReady:true}}){
  return{fixtureId,league:'Test League',country:'England',kickoff:'2026-08-30T18:00:00Z',earlySeason:false,
    home:{id:11,name:'Home FC',fixtures:history(11,'home',homeScores),lastMatches:history(11,'home',homeScores)},
    away:{id:22,name:'Away FC',fixtures:history(22,'away',awayScores),lastMatches:history(22,'away',awayScores)},
    homeSplit,awaySplit,h2h:[],marketOdds}
}

const highScoring=[[3,1],[2,1],[4,0],[2,2],[3,0],[2,1],[3,2],[2,0],[4,1],[3,1]]
const leakingAway=[[1,3],[0,2],[1,4],[2,2],[0,3],[1,2],[2,3],[0,2],[1,4],[1,3]]

test('short, highly supported market becomes a Safest Banker',()=>{
  const f=fixture({homeScores:highScoring,awayScores:leakingAway,marketOdds:[market('home-team-goals','Home team goals','Over 0.5',1.25)]})
  const result=analyzeDailyBankerFixture(f)
  assert.ok(result.safe)
  assert.equal(result.safe.category,'safest')
  assert.equal(result.safe.market,'home-team-goals')
  assert.ok(result.safe.capability>=80)
  assert.ok(Array.isArray(result.safe.why)&&result.safe.why.length>0)
})

test('higher price with statistical probability edge becomes a Value Banker',()=>{
  const f=fixture({homeScores:highScoring,awayScores:leakingAway,marketOdds:[market('total-goals','Total goals','Over 2.5',2.20)]})
  const result=analyzeDailyBankerFixture(f)
  assert.equal(result.safe,null)
  assert.ok(result.value)
  assert.equal(result.value.category,'value')
  assert.ok(result.value.valueEdge>=8)
})

test('same-tier straight result is rejected even when the price and recent results look strong',()=>{
  const f=fixture({homeScores:highScoring,awayScores:leakingAway,homeSplit:{position:6,size:20,sampleReady:true},awaySplit:{position:8,size:20,sampleReady:true},marketOdds:[market('match-winner','Match winner','Home',1.55)]})
  const result=analyzeDailyBankerFixture(f)
  assert.equal(result.safe,null)
  assert.equal(result.value,null)
})

test('daily board keeps fixtures in only one category and public bankers view exposes both groups',()=>{
  const safeFixture=fixture({fixtureId:1,homeScores:highScoring,awayScores:leakingAway,marketOdds:[market('home-team-goals','Home team goals','Over 0.5',1.25)]})
  const valueFixture=fixture({fixtureId:2,homeScores:highScoring,awayScores:leakingAway,marketOdds:[market('total-goals','Total goals','Over 2.5',2.20)]})
  const board=buildDailyBankersBoard([safeFixture,valueFixture],{date:'2026-08-30'})
  assert.equal(board.meta.engine,DAILY_BANKERS_ENGINE)
  assert.equal(board.safestBankers.length,1)
  assert.equal(board.valueBankers.length,1)
  const full={meta:{dailyBankersEngine:DAILY_BANKERS_ENGINE},dailyBankers:board.bestPicks,safestBankers:board.safestBankers,valueBankers:board.valueBankers,dailyBankersMeta:board.meta}
  const pub=publicBoard(full,'bankers')
  assert.equal(pub.safestBankers.length,1)
  assert.equal(pub.valueBankers.length,1)
})
