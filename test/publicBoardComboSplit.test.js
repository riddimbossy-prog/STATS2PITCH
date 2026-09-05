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

test('public combo view keeps rank and group so two options render per match',()=>{
  const combo={
    fixtureId:9,market:'combo-home-gg',route:'HOME_GG',family:'Combo',
    rank:1,group:'result-gg',engineVersion:'combo-v3.3-best-two',selection:'Home Team or GG'
  }
  const view=publicBoard({comboPicks:[combo],meta:{comboEngine:'combo-v3.3-best-two'}},'combo')
  assert.equal(view.comboPicks[0].rank,1)
  assert.equal(view.comboPicks[0].group,'result-gg')
})

test('view=h2h returns only split H2H picks',()=>{
  const pick={fixtureId:9,market:'match-winner',selection:'Home',occurrence:100,h2hHits:5,h2hMatches:5,userWhy:'same venue'}
  const board={
    meta:{h2hEngine:'h2h-v1-split-80',h2hCount:1},
    h2hPicks:[pick],
    comboPicks:[{fixtureId:2,market:'combo-home-gg'}],
    bestPicks:[{fixtureId:1,market:'total-goals'}]
  }
  const view=publicBoard(board,'h2h')
  assert.equal(view.h2hPicks.length,1)
  assert.equal(view.h2hPicks[0].occurrence,100)
  assert.equal(view.h2hPicks[0].userWhy,'same venue')
  assert.equal(view.comboPicks.length,0)
  assert.equal(view.bestPicks.length,0)
  assert.equal(view.meta.h2hEngine,'h2h-v1-split-80')
})

test('public board drops stale Filter V2, blank odds and sub-1.20 prices',()=>{
  const board={
    meta:{filterTipsEngine:'perfect-split-v1',filterTipsCount:3},
    filterTips:[
      {fixtureId:1,engine:'sporty-filter-v2',selection:'Over 1.5',odds:1.40,market:'total-goals'},
      {fixtureId:2,engine:'perfect-split-v1',selection:'Over 1.5',odds:null,market:'total-goals'},
      {fixtureId:3,engine:'perfect-split-v1',selection:'Over 0.5',odds:1.14,market:'home-team-goals'},
      {fixtureId:4,engine:'perfect-split-v1',selection:'Over 1.5',odds:1.21,market:'total-goals'}
    ]
  }
  const view=publicBoard(board,'filter')
  assert.deepEqual(view.filterTips.map(r=>r.fixtureId),[4])
  assert.equal(view.meta.filterTipsCount,1)
})

test('public board drops leftover All Picks Asian totals and H2H hybrids',()=>{
  const board={
    meta:{h2hEngine:'h2h-v1.1-split-80'},
    bestPicks:[
      {fixtureId:1,market:'total-goals',selection:'Under 3',odds:1.26},
      {fixtureId:2,market:'total-goals',selection:'Over 0.5',odds:1.20},
      {fixtureId:3,market:'total-goals',selection:'Over 1.5',odds:1.33},
      {fixtureId:4,market:'double-chance',selection:'Home or away',odds:1.22}
    ],
    h2hPicks:[
      {fixtureId:5,market:'total-goals',selection:'Over 1',odds:1.05,occurrence:90},
      {fixtureId:6,market:'total-goals',selection:'Home/Draw & Over 1.5',odds:3.80,occurrence:100},
      {fixtureId:7,market:'total-goals',selection:'Over 0.5',odds:1.26,occurrence:100}
    ]
  }
  const all=publicBoard(board,'all')
  assert.deepEqual(all.bestPicks.map(r=>r.selection),['Over 1.5','Home or away'])
  const h2h=publicBoard(board,'h2h')
  assert.deepEqual(h2h.h2hPicks.map(r=>r.selection),['Over 0.5'])
  assert.equal(h2h.meta.h2hCount,1)
})
