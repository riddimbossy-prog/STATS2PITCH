import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateBankerFixture,buildLeagueScoringProfile,BANKER_ENGINE} from '../server/bankerEngine.js'

function outcome(name,odd){return{name,odd}}
function markets({homeWin=1.45,awayWin=4.20,draw=3.80,over15=1.22,over25=1.72,under35=1.55,homeO05=1.18,awayO05=1.85,homeO15=1.55,awayO15=2.40,homeO25=1.85,awayO25=3.10,streak=1.32,streak2=null}={}){
  const rows=[
    {marketKey:'match-winner',market:'1X2',outcomes:[outcome('Home',homeWin),outcome('Draw',draw),outcome('Away',awayWin)]},
    {marketKey:'total-goals',market:'Total Goals',outcomes:[outcome('Over 1.5',over15),outcome('Over 2.5',over25),outcome('Under 3.5',under35)]},
    {marketKey:'home-team-goals',market:'Home Team Goals',outcomes:[outcome('Over 0.5',homeO05),outcome('Over 1.5',homeO15),outcome('Over 2.5',homeO25)]},
    {marketKey:'away-team-goals',market:'Away Team Goals',outcomes:[outcome('Over 0.5',awayO05),outcome('Over 1.5',awayO15),outcome('Over 2.5',awayO25)]}
  ]
  if(streak!=null)rows.push({marketKey:'goals-streak-3',market:'3+ Goals Streak',outcomes:[outcome('Yes',streak)]})
  if(streak2!=null)rows.push({marketKey:'goals-streak-2',market:'Goals Streak',outcomes:[outcome('Yes',streak2)]})
  return rows
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
  const r=evaluateBankerFixture(fixture({awayO05:1.90,homeO25:1.90}))
  assert.equal(r.pick.engine,BANKER_ENGINE)
})

test('board starts only when a team total Over 2.5 is 2.05 or shorter',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.20,awayO25:2.40,over25:1.70,over15:1.40,under35:1.30,streak:1.60,awayO05:1.90}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'team-over25-above-board-max')
})

test('a single side at 2.05 is enough to enter the board',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:2.05,awayO25:3.40,awayO05:1.85,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
})

test('opponent Over 0.5 above 1.70 publishes favourite win',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:1.80,awayO05:1.85,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.market,'match-winner')
  assert.equal(r.pick?.selection,'Home')
  assert.equal(r.pick?.odds,1.40)
})

test('opponent team total under 1.50 publishes Over 2.5',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.88,awayO05:1.35,under35:1.45,homeO05:1.40,homeO25:1.90}))
  assert.equal(r.pick?.rule,'OPP_TT_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.88)
})

test('Under 3.5 above 1.60 publishes favourite 2+',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.90,awayO05:1.60,under35:1.75,homeO15:1.38,homeO25:1.95}))
  assert.equal(r.pick?.rule,'U35_FAV_2PLUS')
  assert.equal(r.pick?.market,'home-team-goals')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.displaySelection,'Home FC 2+')
})

test('both team totals under 1.30 and match Over 2.5 under 1.50 publishes Over 2.5 or Draw',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.32,homeO05:1.20,awayO05:1.22,draw:3.60,under35:1.45,homeO25:1.70}))
  assert.equal(r.pick?.rule,'DRAW_OR_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.32)
})

test('Over 1.5 board starts on 3+ goals streak Yes 1.20-1.40',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.20,awayO05:1.60}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.odds,1.22)
  assert.match(r.pick.whyText,/3\+ goals streak Yes is 1\.20/)
})

test('2-in-a-row streak Yes does not open the Over 1.5 board',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:null,streak2:1.28,awayO05:1.60}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'missing-3plus-streak')
})

test('3+ streak Yes below 1.20 does not publish Over 1.5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.19,awayO05:1.60}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'streak-3plus-outside-window')
})

test('streak Over 1.5 never publishes when both split tables are top 5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hpos:2,apos:4}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'both-top-five')
})

test('favourite can be the away side',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:3.80,awayWin:1.50,over25:1.70,homeO05:1.88,awayO05:1.15,under35:1.40,awayO25:1.75,homeO25:3.20}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.selection,'Away')
  assert.equal(r.pick?.displaySelection,'Away FC to Win')
})

test('league profile still recognises a high-scoring sample',()=>{
  const rows=[]
  for(let i=0;i<20;i++)rows.push({fixture:{status:{short:'FT'}},goals:{home:i%2?2:3,away:1}})
  assert.equal(buildLeagueScoringProfile(rows).class,'high-scoring')
})
