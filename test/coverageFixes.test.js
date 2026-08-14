import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {settlePick,settleBoard} from '../server/settlement.js'
import {buildLearningProfiles,learningAllows} from '../server/learning.js'

const finished=(home,away,hh=0,ha=0)=>({fixtureId:10,status:'FT',finished:true,live:false,cancelled:false,matchState:'settled',homeScore:home,awayScore:away,htHome:hh,htAway:ha})

test('supported markets settle correctly',()=>{
  assert.equal(settlePick({market:'match-winner',selection:'Home'},finished(2,0)).outcome,'won')
  assert.equal(settlePick({market:'draw-no-bet',selection:'Home'},finished(1,1)).outcome,'void')
  assert.equal(settlePick({market:'both-teams-score',selection:'Yes'},finished(2,1)).outcome,'won')
  assert.equal(settlePick({market:'total-goals',selection:'Under 3.5'},finished(2,1)).outcome,'won')
  assert.equal(settlePick({market:'away-team-goals',selection:'Over 0.5'},finished(2,1)).outcome,'won')
  assert.equal(settlePick({market:'first-half-goals',selection:'Over 0.5'},finished(2,1,1,0)).outcome,'won')
})

test('board settlement produces summary',()=>{
  const board={bestPicks:[{fixtureId:10,market:'match-winner',selection:'Home'}]}
  const raw={fixture:{id:10,status:{short:'FT'}},teams:{home:{name:'A'},away:{name:'B'}},goals:{home:1,away:0},score:{fulltime:{home:1,away:0},halftime:{home:1,away:0}}}
  assert.equal(settleBoard(board,[raw]).resultSummary.won,1)
})

test('learning only tightens after meaningful samples',()=>{
  const picks=Array.from({length:20},(_,i)=>({fixtureId:i,country:'Ghana',league:'Premier',market:'total-goals'}))
  const board={bestPicks:picks,results:Object.fromEntries(picks.map((p,i)=>[String(p.fixtureId),{outcome:i<10?'won':'lost'}]))}
  const profiles=buildLearningProfiles([board],20)
  assert.equal(profiles[0].gate,'100-only')
  assert.equal(learningAllows({...picks[0],homeConsensus:80,awayConsensus:80},profiles).allowed,false)
  assert.equal(learningAllows({...picks[0],homeConsensus:100,awayConsensus:100},profiles).allowed,true)
})

test('refresh workflow generates future boards and settles published picks',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/refresh-board.yml',import.meta.url),'utf8')
  assert.match(workflow,/npm run refresh/)
  assert.match(workflow,/npm run settle/)
  assert.match(workflow,/RESULT_LOOKBACK_DAYS/)
})
