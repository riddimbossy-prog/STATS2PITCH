import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateBankerFixture,buildLeagueScoringProfile} from '../server/bankerEngine.js'

let seq=1
function homeGame(gf,ga){return{fixture:{id:seq++,date:`2026-07-${String(seq).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:1},away:{id:99}},goals:{home:gf,away:ga}}}
function awayGame(gf,ga){return{fixture:{id:seq++,date:`2026-07-${String(seq).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:98},away:{id:2}},goals:{home:ga,away:gf}}}
function fixture(homeRows,awayRows,{early=false,hpos=7,apos=10,leagueClass='neutral'}={}){return{fixtureId:'fx',league:'Test League',country:'Test',kickoff:'2026-08-20T18:00:00Z',home:{id:1,name:'Home',fixtures:homeRows},away:{id:2,name:'Away',fixtures:awayRows},earlySeason:early,homeSplit:{position:hpos,size:12,sampleReady:true},awaySplit:{position:apos,size:12,sampleReady:true},bankerLeagueProfile:{class:leagueClass,matches:60,avgGoals:leagueClass==='high-scoring'?3.1:2.4,over25Rate:leagueClass==='high-scoring'?61:42,drawRate:leagueClass==='low-scoring-draw-heavy'?34:20}}}

const dominant=[homeGame(2,0),homeGame(3,1),homeGame(2,0),homeGame(2,1),homeGame(3,0)]
const weakAway=[awayGame(0,2),awayGame(1,3),awayGame(0,2),awayGame(1,2),awayGame(1,1)]

test('home straight win needs any two home strength factors while all away weakness factors pass',()=>{
  const r=evaluateBankerFixture(fixture(dominant,weakAway))
  assert.equal(r.pick?.rule,'HOME_STRAIGHT_WIN')
  assert.equal(r.pick?.market,'match-winner')
  assert.equal(r.pick?.ruleMeta?.homeFactorsPassed,2,'GF average is below 2.50, so PPG + GA must be enough')
  assert.equal(r.pick?.ruleMeta?.awayFactorsPassed,3)
})

test('home straight win is blocked when only one of three home factors passes',()=>{
  const oneFactorHome=[homeGame(3,2),homeGame(2,1),homeGame(2,1),homeGame(2,1),homeGame(1,1)]
  const r=evaluateBankerFixture(fixture(oneFactorHome,weakAway))
  assert.notEqual(r.pick?.rule,'HOME_STRAIGHT_WIN')
  assert.equal(r.pick?.rule,'AWAY_TEAM_NOT_TO_WIN')
})

test('home straight win away-side weakness is non-negotiable',()=>{
  const awayFailsGA=[awayGame(0,1),awayGame(0,1),awayGame(0,1),awayGame(0,1),awayGame(1,1)]
  const r=evaluateBankerFixture(fixture(dominant,awayFailsGA))
  assert.notEqual(r.pick?.rule,'HOME_STRAIGHT_WIN','missing the mandatory away GA >=2.00 factor must block straight win')
  assert.equal(r.pick?.rule,'AWAY_TEAM_NOT_TO_WIN')
})

test('away team not to win keeps home 1.50 PPG mandatory and accepts any one away weakness factor',()=>{
  const steadyHome=[homeGame(1,0),homeGame(1,1),homeGame(2,1),homeGame(0,1),homeGame(1,0)]
  const awayOnlyGA=[awayGame(4,3),awayGame(4,3),awayGame(0,3),awayGame(0,3),awayGame(3,3)]
  const r=evaluateBankerFixture(fixture(steadyHome,awayOnlyGA))
  assert.equal(r.pick?.rule,'AWAY_TEAM_NOT_TO_WIN')
  assert.equal(r.pick?.ruleMeta?.homePPGMandatory,true)
  assert.equal(r.pick?.ruleMeta?.awayFactorsPassed,1,'only the away GA >=2.50 factor should be required here')
})

test('away team not to win cannot qualify when home is below the mandatory 1.50 PPG constant',()=>{
  const home14=[homeGame(1,0),homeGame(1,0),homeGame(1,1),homeGame(0,1),homeGame(0,1)]
  const awayOnlyGA=[awayGame(4,3),awayGame(4,3),awayGame(0,3),awayGame(0,3),awayGame(3,3)]
  const r=evaluateBankerFixture(fixture(home14,awayOnlyGA))
  assert.equal(r.skip,'no-rule-qualified')
  assert.equal(r.pick,null)
})

test('early season is a hard skip',()=>{
  const r=evaluateBankerFixture(fixture(dominant,weakAway,{early:true}))
  assert.equal(r.skip,'early-season')
})

test('two split top-five teams are skipped',()=>{
  const r=evaluateBankerFixture(fixture(dominant,weakAway,{hpos:2,apos:5}))
  assert.equal(r.skip,'both-top-five')
})

test('home below one PPG is a global red flag even when both teams are weak',()=>{
  const weakHome=[homeGame(1,0),homeGame(0,1),homeGame(0,2),homeGame(1,1),homeGame(0,2)]
  const r=evaluateBankerFixture(fixture(weakHome,weakAway,{leagueClass:'low-scoring-draw-heavy'}))
  assert.equal(r.skip,'home-under-1-ppg')
  assert.equal(r.pick,null)
})

test('away 1.5+ PPG, 2+ GF and 1+ GA produces Over 1.5 route',()=>{
  const home=[homeGame(1,0),homeGame(1,1),homeGame(0,1),homeGame(2,1),homeGame(0,0)]
  const away=[awayGame(2,1),awayGame(2,1),awayGame(3,2),awayGame(2,2),awayGame(1,2)]
  const r=evaluateBankerFixture(fixture(home,away,{hpos:7,apos:3}))
  assert.equal(r.pick?.rule,'AWAY_STRENGTH_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
})

test('balanced 1.5+ PPG teams use O2.5 in a high-scoring league',()=>{
  const home=[homeGame(3,1),homeGame(3,1),homeGame(2,2),homeGame(3,0),homeGame(0,1)]
  const away=[awayGame(1,0),awayGame(1,1),awayGame(2,1),awayGame(1,2),awayGame(2,1)]
  const r=evaluateBankerFixture(fixture(home,away,{hpos:3,apos:8,leagueClass:'high-scoring'}))
  assert.equal(r.pick?.rule,'BALANCED_HIGH_SCORING_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
})

test('balanced 1.5+ PPG teams use O1.5 in a low-scoring draw-heavy league',()=>{
  const home=[homeGame(3,1),homeGame(3,1),homeGame(2,2),homeGame(3,0),homeGame(0,1)]
  const away=[awayGame(1,0),awayGame(1,1),awayGame(2,1),awayGame(1,2),awayGame(2,1)]
  const r=evaluateBankerFixture(fixture(home,away,{hpos:3,apos:8,leagueClass:'low-scoring-draw-heavy'}))
  assert.equal(r.pick?.rule,'BALANCED_LOW_SCORING_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
})

test('league profile recognises high scoring sample',()=>{
  const rows=[]
  for(let i=0;i<20;i++)rows.push({fixture:{status:{short:'FT'}},goals:{home:i%2?2:3,away:1}})
  assert.equal(buildLeagueScoringProfile(rows).class,'high-scoring')
})
