import test from 'node:test'
import assert from 'node:assert/strict'
import {isComboBoardPick,splitGoalsAndCombo,publicBoard} from '../server/publicBoard.js'

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
