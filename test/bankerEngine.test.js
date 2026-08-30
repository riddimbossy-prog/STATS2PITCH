import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateBankerFixture,buildLeagueScoringProfile,BANKER_ENGINE} from '../server/bankerEngine.js'

function outcome(name,odd){return{name,odd}}
function markets({homeWin=1.45,awayWin=4.20,draw=3.80,over15=1.22,over25=1.72,under35=1.55,homeO05=1.18,awayO05=1.85,homeO15=1.55,awayO15=2.40,streak=1.32}={}){
  return[
    {marketKey:'match-winner',market:'1X2',outcomes:[outcome('Home',homeWin),outcome('Draw',draw),outcome('Away',awayWin)]},
    {marketKey:'total-goals',market:'Total Goals',outcomes:[outcome('Over 1.5',over15),outcome('Over 2.5',over25),outcome('Under 3.5',under35)]},
    {marketKey:'home-team-goals',market:'Home Team Goals',outcomes:[outcome('Over 0.5',homeO05),outcome('Over 1.5',homeO15)]},
    {marketKey:'away-team-goals',market:'Away Team Goals',outcomes:[outcome('Over 0.5',awayO05),outcome('Over 1.5',awayO15)]},
    {marketKey:'goals-streak-2',market:'Goals Streak',outcomes:[outcome('Yes',streak)]}
  ]
}

function fixture(odds={},extra={}){
  return{
    fixtureId:'fx',league:'Test League',country:'Test',kickoff:'2026-08-20T18:00:00Z',
    home:{id:1,name:'Home FC'},away:{id:2,name:'Away FC'},
    homeSplit:{position:extra.hpos??7,size:12,sampleReady:true},
    awaySplit:{position:extra.apos??10,size:12,sampleReady:true},
    marketOdds:markets(odds),
    ...extra.rest
  }
}

test('engine id is banker-totals-v1',()=>{
  const r=evaluateBankerFixture(fixture({awayO05:1.90,over25:1.80}))
  assert.equal(r.pick.engine,BANKER_ENGINE)
})

test('board skips when Over 2.5 is above 2.05 and streak route is not open',()=>{
  const r=evaluateBankerFixture(fixture({over25:2.20,over15:1.40,under35:1.30,streak:1.60,awayO05:1.90}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'over25-above-board-max')
})

test('opponent Over 0.5 above 1.70 publishes favourite win',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,over25:1.85,awayO05:1.85,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.market,'match-winner')
  assert.equal(r.pick?.selection,'Home')
  assert.equal(r.pick?.odds,1.40)
})

test('opponent team total under 1.50 publishes Over 2.5',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.88,awayO05:1.35,under35:1.45,homeO05:1.40}))
  assert.equal(r.pick?.rule,'OPP_TT_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.88)
})

test('Under 3.5 above 1.60 publishes favourite 2+',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.90,awayO05:1.60,under35:1.75,homeO15:1.38}))
  assert.equal(r.pick?.rule,'U35_FAV_2PLUS')
  assert.equal(r.pick?.market,'home-team-goals')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.displaySelection,'Home FC 2+')
})

test('both team totals under 1.30 and Over 2.5 under 1.50 publishes Over 2.5 or Draw',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.32,homeO05:1.20,awayO05:1.22,draw:3.60,under35:1.45}))
  assert.equal(r.pick?.rule,'DRAW_OR_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.32)
})

test('streak Yes 1.25-1.40 with cheap Over 1.5 and open Under 3.5 publishes Over 1.5',()=>{
  const r=evaluateBankerFixture(fixture({over25:2.30,over15:1.22,under35:1.55,streak:1.30,awayO05:1.60}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.odds,1.22)
})

test('streak Over 1.5 never publishes when both split tables are top 5',()=>{
  const r=evaluateBankerFixture(fixture({over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hpos:2,apos:4}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'both-top-five')
})

test('favourite can be the away side',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:3.80,awayWin:1.50,over25:1.70,homeO05:1.88,awayO05:1.15,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.selection,'Away')
  assert.equal(r.pick?.displaySelection,'Away FC to Win')
})

test('league profile still recognises a high-scoring sample',()=>{
  const rows=[]
  for(let i=0;i<20;i++)rows.push({fixture:{status:{short:'FT'}},goals:{home:i%2?2:3,away:1}})
  assert.equal(buildLeagueScoringProfile(rows).class,'high-scoring')
})
