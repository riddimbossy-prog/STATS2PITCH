import test from 'node:test'
import assert from 'node:assert/strict'
import {saveBoard,loadBoard,clearBoard} from '../server/store.js'

test('empty upstream feed does not wipe an existing board, even if engine version changed', async()=>{
  const date='2099-01-02'
  await clearBoard(date)
  const existing={
    bestPicks:[{fixtureId:'1',market:'double-chance',selection:'home or draw',kickoff:`${date}T15:00:00Z`}],
    varTips:[],
    priority:[{fixtureId:'1'}],
    bankers:[],
    results:{},
    availableMarkets:['double-chance'],
    meta:{date,engineVersion:'old-engine',sourceFixtures:40,scheduledFixtures:40,publishedPicks:1}
  }
  await saveBoard(date,existing,{preservePublished:false})
  const empty={
    bestPicks:[],
    varTips:[],
    priority:[],
    bankers:[],
    results:{},
    availableMarkets:[],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:0,scheduledFixtures:0,diagnostics:{sourceFixtures:0,scheduledFixtures:0},generatedAt:new Date().toISOString()}
  }
  const kept=await saveBoard(date,empty)
  assert.equal(kept.bestPicks.length,1)
  assert.equal(kept.bestPicks[0].fixtureId,'1')
  const loaded=await loadBoard(date,{allowVersionMismatch:true})
  assert.equal(loaded.bestPicks.length,1)
  await clearBoard(date)
})
