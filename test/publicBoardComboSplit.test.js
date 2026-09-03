import test from 'node:test'
import assert from 'node:assert/strict'
import {isComboBoardPick,splitGoalsAndCombo,publicBoard,sanitizeGoalsAndCombo} from '../server/publicBoard.js'
import {isolateComboBags} from '../server/store.js'

test('combo engine picks are not treated as Goals Bankers',()=>{
  const win={fixtureId:1,market:'match-winner',route:'FAV_WIN',selection:'Home'}
  const over={fixtureId:2,market:'total-goals',route:'OVER_2.5',selection:'Over 2.5'}
  const drawOr={fixtureId:3,market:'draw-or-over-25',route:'DRAW_OR_OVER_25',family:'Combo',selection:'Draw or Over 2.5'}
  const combo={fixtureId:4,market:'combo-home-over-25',route:'HOME_OVER_25',family:'Combo',engineVersion:'combo-v2-failure-state',selection:'Home Team or Over 2.5'}
  assert.equal(isComboBoardPick(win),false)
  assert.equal(isComboBoardPick(over),false)
  assert.equal(isComboBoardPick(drawOr),false)
  assert.equal(isComboBoardPick(combo),true)
  const split=splitGoalsAndCombo({goalsBankers:[win,over,drawOr,combo],comboPicks:[combo]})
  assert.deepEqual(split.goalsBankers.map(r=>r.fixtureId),[1,2,3])
  assert.deepEqual(split.comboPicks.map(r=>r.fixtureId),[4])
})

test('view=goals strips merged combo picks and view=combo recovers them',()=>{
  const goals={fixtureId:1,market:'match-winner',route:'FAV_WIN'}
  const combo={fixtureId:2,market:'combo-draw-gg',route:'DRAW_GG',engineVersion:'combo-v2-failure-state'}
  const board={
    meta:{goalsBankersEngine:'goals-bankers-v4',comboEngine:'combo-v2-failure-state',comboCount:1},
    goalsBankers:[goals,combo],
    comboPicks:[combo],
    comboMeta:{engine:'combo-v2-failure-state'}
  }
  const goalsView=publicBoard(board,'goals')
  const comboView=publicBoard(board,'combo')
  assert.equal(goalsView.goalsBankers.length,1)
  assert.equal(goalsView.goalsBankers[0].market,'match-winner')
  assert.equal(goalsView.comboPicks.length,0)
  assert.equal(comboView.comboPicks.length,1)
  assert.equal(comboView.comboPicks[0].market,'combo-draw-gg')
  assert.equal(comboView.goalsBankers.length,0)
})

test('legacy boards without comboPicks still split combo-* out of goalsBankers',()=>{
  const goals={fixtureId:1,market:'total-goals',route:'OVER_2.5'}
  const combo={fixtureId:2,market:'combo-away-under-25',route:'AWAY_UNDER_25'}
  const split=splitGoalsAndCombo({goalsBankers:[goals,combo]})
  assert.equal(split.goalsBankers.length,1)
  assert.equal(split.comboPicks.length,1)
  assert.equal(publicBoard({goalsBankers:[goals,combo]},'combo').comboPicks[0].market,'combo-away-under-25')
})

test('sanitizeGoalsAndCombo moves leftover combo-* out of goalsBankers',()=>{
  const goals={fixtureId:1,market:'total-goals',route:'OVER_2.5',selection:'Over 2.5'}
  const combo={fixtureId:2,market:'combo-home-gg',route:'HOME_GG',selection:'Home Team or GG'}
  const next=sanitizeGoalsAndCombo({goalsBankers:[goals,combo],comboPicks:[],meta:{}})
  assert.deepEqual(next.goalsBankers.map(r=>r.fixtureId),[1])
  assert.deepEqual(next.comboPicks.map(r=>r.market),['combo-home-gg'])
  assert.equal(next.meta.goalsBankersCount,1)
  assert.equal(next.meta.comboCount,1)
})

test('snapshot merge does not copy Combo leftovers back onto Goals',()=>{
  const now='2026-09-10T12:00:00.000Z'
  const existing={
    goalsBankers:[
      {fixtureId:1,market:'total-goals',selection:'Over 2.5',kickoff:'2026-09-10T18:00:00.000Z'},
      {fixtureId:2,market:'combo-home-gg',selection:'Home Team or GG',kickoff:'2026-09-10T19:00:00.000Z'}
    ],
    comboPicks:[]
  }
  const incoming={
    goalsBankers:[{fixtureId:1,market:'total-goals',selection:'Over 2.5',kickoff:'2026-09-10T18:00:00.000Z'}],
    comboPicks:[]
  }
  const {goalsBankers,comboPicks}=isolateComboBags(existing,incoming,now)
  assert.equal(goalsBankers.length,1)
  assert.equal(goalsBankers[0].market,'total-goals')
  assert.equal(comboPicks.length,1)
  assert.equal(comboPicks[0].market,'combo-home-gg')
})

test('combo merge keeps two combo markets on the same fixture',()=>{
  const now='2026-09-10T12:00:00.000Z'
  const existing={
    goalsBankers:[],
    comboPicks:[
      {fixtureId:9,market:'combo-home-gg',selection:'Home Team or GG',kickoff:'2026-09-10T20:00:00.000Z'},
      {fixtureId:9,market:'combo-home-clean-sheet',selection:'Home Team or Any Clean Sheet',kickoff:'2026-09-10T20:00:00.000Z'}
    ]
  }
  const incoming={goalsBankers:[],comboPicks:existing.comboPicks}
  const {comboPicks}=isolateComboBags(existing,incoming,now)
  assert.equal(comboPicks.length,2)
})
