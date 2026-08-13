import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeFixture,buildBoard,ENGINE_VERSION,PROFILE_SOURCE,MIN_ODD,MAX_ODD,MIN_CONSENSUS} from '../server/engine.js'

const team=(name,o={})=>({name,logo:null,source:PROFILE_SOURCE,formTableReady:true,formTableSample:5,played:5,over15:80,under15:20,over25:80,under25:20,over35:40,under35:60,bttsRate:80,...o})
const fixture=(o={})=>({fixtureId:99,match:'Alpha vs Beta',league:'League',country:'Test',kickoff:'2026-08-13T20:00:00Z',kickoffLocal:'13 Aug, 20:00',home:team('Alpha',o.home),away:team('Beta',o.away),odds:{over15:1.25,under15:3.5,over25:1.50,under25:2.0,over35:2.7,under35:1.40,bttsYes:1.55,...o.odds}})

test('publishes only markets priced inside 1.20-1.55 inclusive',()=>{
  const rows=analyzeFixture(fixture())
  assert.equal(rows.some(x=>x.market==='O1.5'&&x.odds===1.25),true)
  assert.equal(rows.some(x=>x.market==='O2.5'&&x.odds===1.50),true)
  assert.equal(rows.some(x=>x.market==='BTTS'&&x.odds===1.55),true)
  assert.equal(rows.some(x=>x.market==='U1.5'),false)
})

test('rejects market if either team is below 80 percent consensus',()=>{
  assert.equal(analyzeFixture(fixture({home:{over15:100},away:{over15:60}})).some(x=>x.market==='O1.5'),false)
  assert.equal(analyzeFixture(fixture({home:{over15:80},away:{over15:80}})).some(x=>x.market==='O1.5'),true)
})

test('odds boundary is inclusive and outside values are discarded',()=>{
  let rows=analyzeFixture(fixture({odds:{over15:MIN_ODD}}))
  assert.equal(rows.some(x=>x.market==='O1.5'),true)
  rows=analyzeFixture(fixture({odds:{over15:MAX_ODD}}))
  assert.equal(rows.some(x=>x.market==='O1.5'),true)
  rows=analyzeFixture(fixture({odds:{over15:1.19}}))
  assert.equal(rows.some(x=>x.market==='O1.5'),false)
  rows=analyzeFixture(fixture({odds:{over15:1.56}}))
  assert.equal(rows.some(x=>x.market==='O1.5'),false)
})

test('published row matches frontend contract',()=>{
  const row=analyzeFixture(fixture())[0]
  assert.equal(typeof row.home,'string')
  assert.equal(typeof row.away,'string')
  assert.equal(typeof row.odds,'number')
  assert.equal(Array.isArray(row.reasons),true)
  assert.equal(Array.isArray(row.warnings),true)
  assert.equal(typeof row.engineRating,'string')
  assert.equal(row.filterCount,2)
})

test('best picks keeps one market per fixture and exposes simple engine policy',()=>{
  const board=buildBoard([fixture()])
  assert.equal(board.bestPicks.length,1)
  assert.equal(board.meta.engineVersion,ENGINE_VERSION)
  assert.equal(board.meta.profileSource,PROFILE_SOURCE)
  assert.equal(board.meta.minOdd,MIN_ODD)
  assert.equal(board.meta.maxOdd,MAX_ODD)
  assert.equal(board.meta.minConsensus,MIN_CONSENSUS)
})
