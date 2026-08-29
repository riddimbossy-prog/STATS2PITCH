import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture,buildFilterBoard} from '../server/filterEngine.js'

function match(id,homeId,awayId,h,a,date){
  return{
    fixture:{id,date,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}

function venueHistory(teamId,venue,scores){
  return scores.map((pair,index)=>{
    const day=String(index+1).padStart(2,'0')
    return venue==='home'
      ?match(index+1,teamId,900+index,pair[0],pair[1],`2026-07-${day}T12:00:00Z`)
      :match(index+1,900+index,teamId,pair[1],pair[0],`2026-07-${day}T12:00:00Z`)
  })
}

function markets({homeWin=1.35,drawWin=4.80,awayWin=8.00,over15,under35,homeO05,awayO05,homeO15,awayO15}={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let row=rows.find(x=>x.marketKey===marketKey)
    if(!row){row={marketKey,market,outcomes:[]};rows.push(row)}
    row.outcomes.push({name,odd:Number(odd)})
  }
  add('match-winner','Match winner','Home',homeWin)
  add('match-winner','Match winner','Draw',drawWin)
  add('match-winner','Match winner','Away',awayWin)
  add('total-goals','Total goals','Over 1.5',over15)
  add('total-goals','Total goals','Under 3.5',under35)
  add('home-team-goals','Home team goals','Over 0.5',homeO05)
  add('away-team-goals','Away team goals','Over 0.5',awayO05)
  add('home-team-goals','Home team goals','Over 1.5',homeO15)
  add('away-team-goals','Away team goals','Over 1.5',awayO15)
  return rows
}

const strongHome=[[2,0],[3,0],[2,1],[3,1],[2,0]]
const weakAway=[[0,2],[0,1],[1,2],[0,2],[1,3]]

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||700,
    league:overrides.league||'Test League',
    round:overrides.round,
    country:'England',
    kickoff:'2026-08-30T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:overrides.homeFixtures||venueHistory(1,'home',strongHome)},
    away:{id:2,name:'Away FC',logo:null,fixtures:overrides.awayFixtures||venueHistory(2,'away',weakAway)},
    homeSplit:overrides.homeSplit||{position:3,size:20,sampleReady:true},
    awaySplit:overrides.awaySplit||{position:14,size:20,sampleReady:true},
    earlySeason:false,
    h2h:[],
    marketOdds:overrides.marketOdds||markets()
  }
}

test('same split tier is a hard Filter Tips skip',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeSplit:{position:6,size:20,sampleReady:true},
    awaySplit:{position:9,size:20,sampleReady:true}
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'same-tier')
})

test('a bottom-three favourite cannot publish a straight win',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeSplit:{position:18,size:20,sampleReady:true},
    awaySplit:{position:9,size:20,sampleReady:true}
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'bottom-three-favourite')
})

test('European league stage is allowed but a knockout round is skipped',()=>{
  const leagueStage=diagnoseFilterFixture(fixture({league:'UEFA Champions League',round:'League Stage - 1'}))
  assert.equal(leagueStage.skip,null)
  assert.equal(leagueStage.pick?.route,'straight-win')
  const knockout=diagnoseFilterFixture(fixture({league:'UEFA Champions League',round:'Round of 16'}))
  assert.equal(knockout.pick,null)
  assert.equal(knockout.skip,'cup')
})

test('longer venue baseline can veto a temporary 3-of-5 spike',()=>{
  const recentThreeHome=[[0,1],[0,2],[0,1],[0,2],[0,1],[0,1],[1,2],[2,0],[2,1],[1,0]]
  const recentThreeAway=[[2,0],[2,1],[1,0],[2,0],[3,1],[2,1],[1,2],[0,2],[1,3],[0,1]]
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueHistory(1,'home',recentThreeHome),
    awayFixtures:venueHistory(2,'away',recentThreeAway)
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'direction-disagree')
  const rejected=result.rejected.find(x=>x.route==='straight-win')
  assert.equal(rejected.direction.recentConsensus,60)
  assert.ok(rejected.direction.baselineConsensus<60)
  assert.ok(rejected.direction.consensus<60)
})

test('board metadata exposes the v2.1 capability refinement without changing the public engine id',()=>{
  const board=buildFilterBoard([fixture()])
  assert.equal(board.meta.filterVersion,'v2')
  assert.equal(board.meta.capabilityRevision,'v2.1')
  assert.equal(board.meta.baselineVenueSample,10)
  assert.deepEqual(board.meta.capabilityWeights,{recent:0.6,baseline:0.4})
})
