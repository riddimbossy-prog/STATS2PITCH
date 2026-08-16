import test from 'node:test'
import assert from 'node:assert/strict'
import {buildOver25Profile,isOver25Selection,over25Gate} from '../server/over25.js'

function fx(id,date,home,away,h,a){
  return{fixture:{id,date,status:{short:'FT'}},teams:{home:{id:home},away:{id:away}},goals:{home:h,away:a}}
}
function strongHistory(){
  const rows=[]
  for(let i=0;i<12;i++){
    const day=String(i+1).padStart(2,'0')
    rows.push(i%2===0?fx(100+i,`2026-07-${day}T12:00:00Z`,1,100+i,3,1):fx(100+i,`2026-07-${day}T12:00:00Z`,100+i,1,1,3))
    rows.push(i%2===0?fx(200+i,`2026-07-${day}T15:00:00Z`,200+i,2,1,3):fx(200+i,`2026-07-${day}T15:00:00Z`,2,200+i,3,1))
  }
  return rows
}

test('strict Over 2.5 profile passes all mandatory checks with mature high-scoring data',()=>{
  const p=buildOver25Profile(strongHistory(),1,2)
  assert.equal(p.allowed,true)
  assert.equal(p.grade,'strong')
  assert.equal(p.xgStatus,'unavailable')
  assert.equal(p.metrics.homeMatches,12)
  assert.equal(p.metrics.awayMatches,12)
  assert.equal(p.metrics.homeLast6Overs,6)
  assert.equal(p.metrics.awayLast6Overs,6)
  assert.ok(p.metrics.homeSeasonOver25>=70)
  assert.ok(p.metrics.homeVenueOver25>=72)
  assert.ok(p.metrics.awayVenueOver25>=68)
  assert.ok(p.metrics.combinedAverageGoals>=3.4)
  assert.ok(p.metrics.leagueOver25>=56)
})

test('xG upgrades a qualifying Over 2.5 profile to elite when available and above 3.10',()=>{
  const p=buildOver25Profile(strongHistory(),1,2,{xg:{home:{xg:1.8,xga:1.4},away:{xg:1.7,xga:1.5}}})
  assert.equal(p.allowed,true)
  assert.equal(p.grade,'elite')
  assert.equal(p.xgStatus,'pass')
  assert.equal(p.metrics.combinedXg,3.2)
})

test('11-match maturity is a hard Over 2.5 requirement',()=>{
  const p=buildOver25Profile(strongHistory().filter((_,i)=>i<20),1,2)
  assert.equal(p.allowed,false)
  assert.equal(p.checks.find(x=>x.key==='maturity')?.ok,false)
})

test('gate targets only exact total-goals Over 2.5 selections',()=>{
  const market={marketKey:'total-goals'}
  assert.equal(isOver25Selection(market,{name:'Over 2.5'}),true)
  assert.equal(isOver25Selection(market,{name:'Over 1.5'}),false)
  assert.equal(isOver25Selection({marketKey:'home-team-goals'},{name:'Over 2.5'}),false)
  assert.equal(over25Gate({over25Profile:{allowed:true}},market,{name:'Over 2.5'}).allowed,true)
  assert.equal(over25Gate({over25Profile:{allowed:false}},market,{name:'Over 2.5'}).allowed,false)
})
