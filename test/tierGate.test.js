import test from 'node:test'
import assert from 'node:assert/strict'
import {tierFromSplit,tierGate,analyzeFixture} from '../server/engine.js'

const split=(position,size=20)=>({position,size,played:5,sampleReady:true})
const finished=(id,teamHome,teamAway,h,a)=>({fixture:{id,date:`2026-08-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:teamHome},away:{id:teamAway}},goals:{home:h,away:a},score:{halftime:{home:0,away:0}}})
const sample=(id,venue)=>Array.from({length:5},(_,i)=>venue==='home'?finished(i+1,id,900+i,1,0):finished(i+1,900+i,id,0,1))
function fixture(homePos,awayPos){return{fixtureId:1,league:'Test',country:'Test',kickoff:'2026-08-20T12:00:00Z',home:{id:1,name:'Home',fixtures:sample(1,'home')},away:{id:2,name:'Away',fixtures:sample(2,'away')},homeSplit:split(homePos),awaySplit:split(awayPos),marketOdds:[{marketKey:'total-goals',market:'Total Goals',outcomes:[{name:'Under 2.5',odd:1.4}]}]}}

test('split positions are divided into four venue tiers',()=>{assert.equal(tierFromSplit(split(1)),'A');assert.equal(tierFromSplit(split(6)),'B');assert.equal(tierFromSplit(split(11)),'C');assert.equal(tierFromSplit(split(20)),'D')})
test('same-tier fixtures are rejected before market analysis',()=>{const f=fixture(2,4);assert.equal(tierGate(f).allowed,false);assert.equal(tierGate(f).reason,'same-tier');assert.equal(analyzeFixture(f).length,0)})
test('different-tier fixtures remain eligible for analysis',()=>{const f=fixture(2,18);assert.equal(tierGate(f).allowed,true)})
test('unverified tier data is rejected',()=>{const f=fixture(2,18);f.awaySplit=null;assert.equal(tierGate(f).allowed,false);assert.equal(analyzeFixture(f).length,0)})
