import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeH2HFixture,H2H_ENGINE_VERSION,H2H_MIN_RATE,H2H_MIN_MATCHES} from '../server/h2hEngine.js'
const market=(id,name,outcomes,specifier)=>({id,name,specifier,outcomes:outcomes.map(([desc,odds])=>({desc,odds}))})
const game=(id,h,a,home=1,away=2)=>({fixture:{id,date:`2026-0${id}-01T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:home},away:{id:away}},goals:{home:h,away:a}})
const fixture=(history,markets)=>({fixtureId:99,kickoff:'2026-09-10T12:00:00Z',league:'Test',country:'GH',home:{id:1,name:'Home'},away:{id:2,name:'Away'},h2hHistory:history,sportyMarkets:markets||[market(1,'1X2',[['Home','1.50'],['Draw','3.50'],['Away','5.00']]),market(10,'Over/Under',[['Over 2.5','1.80'],['Under 2.5','1.90']])]})
test('publishes only SportyBet selections occurring in at least 80% of same-venue H2Hs',()=>{const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,1,1)];const picks=analyzeH2HFixture(fixture(rows));assert.equal(H2H_MIN_RATE,80);assert.equal(H2H_MIN_MATCHES,5);assert.ok(picks.some(x=>x.market==='match-winner'&&x.selection==='Home'&&x.occurrence===80));assert.ok(picks.every(x=>x.occurrence>=80))})
test('reversed venue meetings do not enter the split sample',()=>{const rows=[game(1,2,0),game(2,2,0),game(3,2,0),game(4,2,0),game(5,2,0),game(6,0,4,2,1)];const picks=analyzeH2HFixture(fixture(rows));assert.ok(picks.some(x=>x.selection==='Home'&&x.h2hMatches===5&&x.occurrence===100))})
test('tiny H2H samples never become bankers',()=>{assert.deepEqual(analyzeH2HFixture(fixture([game(1,4,0),game(2,4,0),game(3,4,0)])),[])})
test('Asian Over 1 and 1X2&OU hybrids never publish as match totals',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,1),game(4,2,0),game(5,2,1)]
  const markets=[
    market(18,'Over/Under',[['Over 1.5','1.15'],['Under 1.5','5.50']],'total=1'),
    market(18,'Over/Under',[['Over 1.5','1.40'],['Under 1.5','2.80'],['Home/Draw & Over 1.5','3.80']],'total=1.5')
  ]
  const picks=analyzeH2HFixture(fixture(rows,markets))
  assert.equal(H2H_ENGINE_VERSION,'h2h-v1.2-split-80')
  assert.ok(picks.every(x=>x.selection!=='Over 1'))
  assert.ok(picks.every(x=>!String(x.selection).includes('&')))
  assert.ok(picks.some(x=>x.selection==='Over 1.5'))
})
test('prices shorter than 1.20 never publish',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,1,1)]
  const markets=[market(1,'1X2',[['Home','1.15'],['Draw','3.50'],['Away','5.00']]),market(18,'Over/Under',[['Over 1.5','1.40'],['Under 1.5','2.80']],'total=1.5')]
  const picks=analyzeH2HFixture(fixture(rows,markets))
  assert.ok(picks.every(x=>Number(x.odds)>=1.20))
  assert.ok(picks.every(x=>x.selection!=='Home'))
  assert.ok(picks.some(x=>x.selection==='Over 1.5'))
})
