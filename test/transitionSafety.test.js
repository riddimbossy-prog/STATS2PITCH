import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateTransitionSafety} from '../server/transitionSafety.js'

const strong={
  ready:true,played:5,covered:5,
  concededMatchRate:60,
  scoreFirstRate:60,
  scoreFirstWinRate:100,
  scoreFirstNonLossRate:100,
  leadHoldRate:100,
  concededFirst:2,
  comebackWinRate:50,
  comebackNonLossRate:100
}
const weak={
  ready:true,played:5,covered:5,
  concedeFirstRate:60,
  stayDownRate:66.7
}

test('win side passes when weaker stay-down and stronger lead/comeback evidence all clear',()=>{
  const gate=evaluateTransitionSafety({stronger:strong,weaker:weak,mode:'win',strongerName:'Strong',weakerName:'Weak'})
  assert.equal(gate.allowed,true)
  assert.equal(gate.redirectGoals,false)
})

test('team-side pick fails closed when ordered goal-event evidence is incomplete',()=>{
  const gate=evaluateTransitionSafety({stronger:{...strong,ready:false,covered:4},weaker:weak,mode:'win'})
  assert.equal(gate.allowed,false)
  assert.equal(gate.reason,'transition-evidence-incomplete')
})

test('conceding in exactly 80 percent does not trigger the greater-than-80 redirect',()=>{
  const gate=evaluateTransitionSafety({stronger:{...strong,concededMatchRate:80},weaker:weak,mode:'win'})
  assert.equal(gate.redirectGoals,false)
})

test('conceding in more than 80 percent forces goals redirect and blocks team-side call',()=>{
  const gate=evaluateTransitionSafety({stronger:{...strong,concededMatchRate:100},weaker:weak,mode:'win'})
  assert.equal(gate.allowed,false)
  assert.equal(gate.redirectGoals,true)
  assert.equal(gate.reason,'stronger-team-leaks-over-80')
})

test('weak opponent that does not stay down blocks a win call',()=>{
  const gate=evaluateTransitionSafety({stronger:strong,weaker:{...weak,stayDownRate:33.3},mode:'win'})
  assert.equal(gate.allowed,false)
  assert.equal(gate.reason,'transition-safety-failed')
})

test('not-to-lose route uses score-first protection and comeback non-loss evidence',()=>{
  const gate=evaluateTransitionSafety({
    stronger:{...strong,scoreFirstRate:40,scoreFirstNonLossRate:100,comebackNonLossRate:50},
    weaker:{...weak,concedeFirstRate:40,stayDownRate:50},
    mode:'not-lose'
  })
  assert.equal(gate.allowed,true)
})
