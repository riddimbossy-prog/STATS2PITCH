import test from 'node:test'
import assert from 'node:assert/strict'
import {chooseGoalsCombo,comboWins,publishedCombo} from '../server/goalsCombo.js'
import {decideGoalsBanker,canAddAccaLeg} from '../server/goalsBankersEngine.js'
import {settlePick} from '../server/settlement.js'

function odds(partial={}){
  return{
    favourite:'home',
    fav_odds:1.55,
    opp_odds:4.20,
    draw_odds:3.60,
    over25:1.70,
    under25:2.10,
    btts_yes:1.72,
    fav_2plus:1.58,
    fav_tt_over25:2.20,
    opp_tt_over05:1.62,
    streak_yes:1.28,
    ...partial
  }
}

function skippedV4(extra={}){
  return{
    finalPick:'SKIP',
    reasonCode:'LOW_MARKET_SEPARATION',
    matchShape:'CONFLICT_ZONE',
    resultProfile:'DRAW_RESISTANCE',
    opponentGoalProfile:'CONFLICT',
    topMarket:'GG',
    runnerUp:'OVER_2.5',
    provisionalPick:'GG',
    capabilities:{over25:{score:68},gg:{score:70}},
    ...extra
  }
}

test('combo wins if either leg lands',()=>{
  assert.equal(comboWins('DRAW_OR_OVER_25',1,1),true)
  assert.equal(comboWins('DRAW_OR_OVER_25',2,1),true)
  assert.equal(comboWins('DRAW_OR_OVER_25',1,0),false)
  assert.equal(comboWins('DRAW_OR_UNDER_25',1,0),true)
  assert.equal(comboWins('DRAW_OR_UNDER_25',1,1),true)
  assert.equal(comboWins('DRAW_OR_UNDER_25',2,1),false)
  assert.equal(comboWins('DRAW_OR_GG',0,0),true)
  assert.equal(comboWins('DRAW_OR_GG',2,1),true)
  assert.equal(comboWins('DRAW_OR_GG',2,0),false)
})

test('settlement grades all three combo markets',()=>{
  const ft=(h,a)=>({fixtureId:1,status:'FT',finished:true,live:false,cancelled:false,matchState:'settled',homeScore:h,awayScore:a})
  assert.equal(settlePick({market:'draw-or-over-25',selection:'Draw or Over 2.5'},ft(0,0)).outcome,'won')
  assert.equal(settlePick({market:'draw-or-over-25',selection:'Draw or Over 2.5'},ft(2,0)).outcome,'lost')
  assert.equal(settlePick({market:'draw-or-under-25',selection:'Draw or Under 2.5'},ft(2,2)).outcome,'won')
  assert.equal(settlePick({market:'draw-or-under-25',selection:'Draw or Under 2.5'},ft(3,0)).outcome,'lost')
  assert.equal(settlePick({market:'draw-or-gg',selection:'Draw or GG'},ft(0,0)).outcome,'won')
  assert.equal(settlePick({market:'draw-or-gg',selection:'Draw or GG'},ft(1,0)).outcome,'lost')
})

test('unsure opponent contribution prefers Draw or GG',()=>{
  const picked=chooseGoalsCombo(odds({draw_odds:3.55,btts_yes:1.68,over25:1.78,opp_tt_over05:1.60}),skippedV4({
    matchShape:'CONFLICT_ZONE',opponentGoalProfile:'CONFLICT',topMarket:'GG',runnerUp:'FAV_WIN'
  }))
  assert.equal(picked.route,'DRAW_OR_GG')
})

test('open but unseparated game prefers Draw or Over 2.5',()=>{
  const picked=chooseGoalsCombo(odds({draw_odds:3.80,over25:1.62,btts_yes:1.88,opp_tt_over05:1.66,fav_tt_over25:1.95}),skippedV4({
    matchShape:'HIGH_EVENT_BOTH_SIDES',opponentGoalProfile:'CONFLICT',topMarket:'OVER_2.5',runnerUp:'FAV_WIN',resultProfile:'NORMAL'
  }))
  assert.equal(picked.route,'DRAW_OR_OVER_25')
})

test('tight controlled match prefers Draw or Under 2.5',()=>{
  const picked=chooseGoalsCombo(odds({draw_odds:3.30,over25:1.95,btts_yes:1.92,fav_tt_over25:2.40,opp_tt_over05:1.78}),skippedV4({
    matchShape:'CONTROLLED_FAVORITE',opponentGoalProfile:'COLD',topMarket:'FAV_WIN',runnerUp:'GG',resultProfile:'DRAW_RESISTANCE'
  }))
  assert.equal(picked.route,'DRAW_OR_UNDER_25')
})

test('clear V4 banker is never replaced by a combo',()=>{
  assert.equal(chooseGoalsCombo(odds(),{finalPick:'OVER_2.5',reasonCode:'HIGH_EVENT_OVER'}),null)
})

test('missing data and streak skips stay skips, not combos',()=>{
  assert.equal(chooseGoalsCombo(odds(),{finalPick:'SKIP',reasonCode:'STREAK_GATE'}),null)
  assert.equal(chooseGoalsCombo(odds(),{finalPick:'SKIP',reasonCode:'INSUFFICIENT_MARKET_DATA'}),null)
})

test('decideGoalsBanker can publish a combo after a low-separation skip',()=>{
  const r=decideGoalsBanker(odds({
    fav_odds:1.62,opp_odds:4.10,draw_odds:3.50,fav_2plus:1.62,
    fav_tt_over25:2.22,opp_tt_over05:1.61,over25:1.74,btts_yes:1.70,streak_yes:1.28
  }))
  assert.ok(r.route==='SKIP'||String(r.route).startsWith('DRAW_OR_'),r.route)
  if(r.route!=='SKIP'){
    assert.ok(r.combo)
    assert.ok(publishedCombo(r.route,r.odds)?.odds)
  }
})

test('combo covers stay off the acca slip',()=>{
  assert.equal(canAddAccaLeg([],{fixtureId:9,route:'DRAW_OR_GG',family:'Combo',odds:1.45}).ok,false)
  assert.equal(canAddAccaLeg([],{fixtureId:9,route:'DRAW_OR_GG',family:'Combo',odds:1.45}).reason,'combo-not-on-slip')
})
