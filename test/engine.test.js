import test from 'node:test'
import assert from 'node:assert/strict'
import {venueSample,buildBoard} from '../server/engine.js'
import {ENGINE_VERSION} from '../server/config.js'

function fx(id,home,away,h,a,hh=0,ah=0){
  return{fixture:{id,date:`2026-08-${String(10-id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:home},away:{id:away}},goals:{home:h,away:a},score:{halftime:{home:hh,away:ah}}}
}
test('venue sample keeps five matching venue games',()=>{
  const rows=[fx(1,1,9,2,0),fx(2,1,8,1,0),fx(3,1,7,3,1),fx(4,1,6,2,1),fx(5,1,5,4,0),fx(6,4,1,0,1)]
  assert.equal(venueSample(rows,1,'home').length,5)
})
test('board has current engine version',()=>assert.equal(buildBoard([]).meta.engineVersion,ENGINE_VERSION))
