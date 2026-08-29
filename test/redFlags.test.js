import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeFixture} from '../server/engine.js'
import {redFlagSkip,isCupCompetition,isSrlMatch,isEarlySeason} from '../server/redFlags.js'
import {diagnoseFilterFixture} from '../server/filterEngine.js'
import {diagnoseAwayFavFixture} from '../server/awayFavEngine.js'
import {diagnoseGoalsBankerFixture} from '../server/goalsBankersEngine.js'

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

const strong=[[2,0],[3,1],[2,1],[2,0],[3,0]]
const weak=[[0,2],[1,2],[0,1],[0,2],[1,3]]

function fixture(overrides={}){
  return{
    fixtureId:301,
    league:overrides.league||'Premier League',
    country:'England',
    kickoff:'2026-08-27T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:overrides.homeFixtures||venueRows(1,'home',strong)},
    away:{id:2,name:'Away FC',logo:null,fixtures:overrides.awayFixtures||venueRows(2,'away',weak)},
    homeSplit:overrides.homeSplit||{position:2,size:20,sampleReady:true,ppg:2.4},
    awaySplit:overrides.awaySplit||{position:14,size:20,sampleReady:true,ppg:0.4},
    earlySeason:overrides.earlySeason===true,
    h2h:overrides.h2h||[],
    marketOdds:[{marketKey:'match-winner',market:'Match winner',outcomes:[{name:'Home',odd:1.40},{name:'Away',odd:7.50}]}]
  }
}

test('cup names are detected',()=>{
  assert.equal(isCupCompetition('FA Cup'),true)
  assert.equal(isCupCompetition('Premier League'),false)
})

test('SRL simulated matches are skipped on every board',()=>{
  const league=fixture({league:'K-League 1 SRL'})
  const sim=fixture({league:'Simulated Reality League'})
  const team={...fixture(),home:{id:1,name:'Seoul SRL',fixtures:[]},away:{id:2,name:'Bucheon FC SRL',fixtures:[]}}
  assert.equal(isSrlMatch(league),true)
  assert.equal(isSrlMatch(sim),true)
  assert.equal(isSrlMatch(team),true)
  assert.equal(isSrlMatch(fixture({league:'Premier League'})),false)
  assert.equal(redFlagSkip(league),'srl')
  assert.equal(analyzeFixture(league).length,0)
  assert.equal(diagnoseFilterFixture(league).skip,'srl')
  assert.equal(diagnoseAwayFavFixture(league).skip,'srl')
  assert.equal(diagnoseGoalsBankerFixture(league).skip,'srl')
})

test('All Picks skips early season, cups, top-five clashes and similar form',()=>{
  assert.equal(analyzeFixture(fixture({earlySeason:true})).length,0)
  assert.equal(analyzeFixture(fixture({league:'Champions League'})).length,0)
  assert.equal(analyzeFixture(fixture({
    homeSplit:{position:1,size:20,sampleReady:true},
    awaySplit:{position:3,size:20,sampleReady:true}
  })).length,0)
  assert.equal(redFlagSkip(fixture({
    homeFixtures:venueRows(1,'home',[[1,1],[1,0],[0,1],[1,1],[2,2]]),
    awayFixtures:venueRows(2,'away',[[1,1],[1,0],[0,1],[1,1],[2,2]])
  }),{
    home:{ppg:1.2,gf:1.1,ga:1.1},
    away:{ppg:1.2,gf:1.1,ga:1.0}
  }),'similar-form')
})

test('fewer than 5 current venue rounds is an early-season flag, not a Goals Bankers hard skip',()=>{
  const short=fixture({earlySeason:false})
  short.earlySeason=false
  short.currentVenueSamples={home:3,away:4}
  assert.equal(isEarlySeason(short),true)
  assert.equal(redFlagSkip(short),null)
  const diagnosed=diagnoseGoalsBankerFixture({...short,marketOdds:[]})
  assert.notEqual(diagnosed.skip,'early-season')
})

test('split top-five and bottom-three clashes hard-gate Goals Bankers',()=>{
  const top=fixture({
    homeSplit:{position:1,size:20,sampleReady:true,ppg:2.4},
    awaySplit:{position:4,size:20,sampleReady:true,ppg:2.1}
  })
  const bottom=fixture({
    homeSplit:{position:18,size:20,sampleReady:true,ppg:0.4},
    awaySplit:{position:20,size:20,sampleReady:true,ppg:0.2}
  })
  assert.equal(redFlagSkip(top),'both-top-five')
  assert.equal(redFlagSkip(bottom),'both-bottom-three')
  assert.equal(diagnoseGoalsBankerFixture(top).skip,'both-top-five')
  assert.equal(diagnoseGoalsBankerFixture(bottom).skip,'both-bottom-three')
})

test('overall stats that contradict home/away split are a stats-mismatch hard gate',()=>{
  const clash=fixture()
  clash.homeStats={played:5,ppg:2.40,gf:2.2,ga:0.6}
  clash.awayStats={played:5,ppg:0.60,gf:0.6,ga:2.0}
  clash.homeSplit={position:12,size:20,sampleReady:true,ppg:0.80,played:5}
  clash.awaySplit={position:6,size:20,sampleReady:true,ppg:1.80,played:5}
  assert.equal(redFlagSkip(clash,{
    home:{ppg:0.80,gf:0.8,ga:1.6},
    away:{ppg:1.80,gf:1.6,ga:0.8}
  }),'stats-mismatch')
})
