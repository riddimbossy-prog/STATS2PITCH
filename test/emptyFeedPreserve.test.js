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

test('a non-empty V5 refresh replaces old Goals Bankers instead of preserving V4 rows',async()=>{
  const date='2099-02-03'
  await clearBoard(date)
  const oldPick={fixtureId:'31',market:'match-winner',selection:'Home',route:'FAV_WIN',engine:'goals-bankers-v4',kickoff:`${date}T18:00:00Z`}
  await saveBoard(date,{
    bestPicks:[],varTips:[],filterTips:[],goalsBankers:[oldPick],comboPicks:[],bankers:[],priority:[],results:{},availableMarkets:[],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',goalsBankersEngine:'goals-bankers-v4',sourceFixtures:20,scheduledFixtures:20}
  },{preservePublished:false})
  const freshPick={fixtureId:'32',market:'home-team-goals',selection:'Over 1.5',route:'FAV_2PLUS',engine:'goals-bankers-v5',kickoff:`${date}T19:00:00Z`}
  const saved=await saveBoard(date,{
    bestPicks:[],varTips:[],filterTips:[],goalsBankers:[freshPick],comboPicks:[],bankers:[],priority:[],results:{},availableMarkets:[],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',goalsBankersEngine:'goals-bankers-v5',sourceFixtures:20,scheduledFixtures:20,generatedAt:`${date}T06:00:00Z`}
  })
  assert.deepEqual(saved.goalsBankers.map(row=>row.fixtureId),['32'])
  assert.equal(saved.goalsBankers[0].engine,'goals-bankers-v5')
  await clearBoard(date)
})

test('a late refresh keeps already-published picks and Daily Bankers', async()=>{
  const date='2099-03-04'
  await clearBoard(date)
  const morning={
    bestPicks:[{fixtureId:'10',market:'total-goals',selection:'Over 1.5',kickoff:`${date}T12:00:00Z`}],
    varTips:[{fixtureId:'11',market:'match-winner',selection:'Home',kickoff:`${date}T12:00:00Z`}],
    filterTips:[],
    goalsBankers:[],
    bankers:[
      {fixtureId:'10',market:'total-goals',selection:'Over 1.5',displaySelection:'Over 1.5',family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T12:00:00Z`},
      {fixtureId:'12',market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',family:'BTTS',rule:'GG_BOTH_TT',kickoff:`${date}T15:00:00Z`}
    ],
    results:{'10':{outcome:'won',matchState:'settled',homeScore:2,awayScore:1}},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:80,scheduledFixtures:80,publishedPicks:1}
  }
  await saveBoard(date,morning,{preservePublished:false})
  const late={
    bestPicks:[{fixtureId:'13',market:'total-goals',selection:'Over 2.5',kickoff:`${date}T20:00:00Z`}],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    bankers:[{fixtureId:'13',market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T20:00:00Z`}],
    results:{},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:8,scheduledFixtures:1,generatedAt:`${date}T21:00:00Z`}
  }
  const kept=await saveBoard(date,late)
  assert.equal(kept.bestPicks.map(p=>String(p.fixtureId)).sort().join(','),'10,13')
  assert.equal(kept.varTips.length,1)
  assert.equal(kept.varTips[0].fixtureId,'11')
  assert.equal(kept.bankers.map(p=>String(p.fixtureId)).sort().join(','),'10,12,13')
  assert.equal(kept.safestBankers.length,3)
  assert.equal(kept.dailyBankers.length,3)
  assert.equal(kept.results['10'].outcome,'won')
  await clearBoard(date)
})

test('pre-match refresh republishes overlapping bankers at the new engine price', async()=>{
  const date='2099-05-06'
  await clearBoard(date)
  const morning={
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    bankers:[{fixtureId:'20',market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:1.54,family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T18:00:00Z`,publishedAt:`${date}T00:55:00Z`}],
    results:{},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:40,scheduledFixtures:40,generatedAt:`${date}T00:55:00Z`}
  }
  await saveBoard(date,morning,{preservePublished:false})
  const later={
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    bankers:[{fixtureId:'20',market:'total-goals',selection:'Over 1.5',displaySelection:'Over 1.5',odds:1.16,family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T18:00:00Z`}],
    results:{},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:40,scheduledFixtures:40,generatedAt:`${date}T06:00:00Z`}
  }
  const kept=await saveBoard(date,later)
  assert.equal(kept.bankers.length,1)
  assert.equal(kept.bankers[0].selection,'Over 1.5')
  assert.equal(kept.bankers[0].odds,1.16)
  assert.equal(kept.bankers[0].publishedAt,`${date}T00:55:00Z`)
  await clearBoard(date)
})

test('after kickoff the published market stays even if the engine would change it', async()=>{
  const date='2020-05-06'
  await clearBoard(date)
  const morning={
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    bankers:[{fixtureId:'21',market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:1.54,family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T12:00:00Z`,publishedAt:`${date}T00:55:00Z`}],
    results:{},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:40,scheduledFixtures:40,generatedAt:`${date}T00:55:00Z`}
  }
  await saveBoard(date,morning,{preservePublished:false})
  const later={
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    bankers:[{fixtureId:'21',market:'total-goals',selection:'Over 1.5',displaySelection:'Over 1.5',odds:1.16,family:'Goals',rule:'STREAK_OVER15',kickoff:`${date}T12:00:00Z`}],
    results:{},
    availableMarkets:['total-goals'],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:8,scheduledFixtures:1,generatedAt:`${date}T18:00:00Z`}
  }
  const kept=await saveBoard(date,later)
  assert.equal(kept.bankers[0].selection,'Over 2.5')
  assert.equal(kept.bankers[0].odds,1.54)
  await clearBoard(date)
})
