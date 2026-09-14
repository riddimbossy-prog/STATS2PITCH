import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeH2HFixture,formSupport,H2H_ENGINE_VERSION,H2H_MIN_RATE,H2H_MIN_MATCHES,H2H_FORM_MIN,H2H_FORM_SAMPLE} from '../server/h2hEngine.js'
const market=(id,name,outcomes,specifier)=>({id,name,specifier,outcomes:outcomes.map(([desc,odds])=>({desc,odds}))})
const game=(id,h,a,home=1,away=2)=>({fixture:{id,date:new Date(Date.UTC(2026,0,Math.max(1,Number(id)||1))).toISOString(),status:{short:'FT'}},teams:{home:{id:home},away:{id:away}},goals:{home:h,away:a}})
const STRONG_HOME=[[2,1],[3,0],[2,0],[1,0],[2,1]]
const STRONG_AWAY=[[1,2],[0,3],[0,2],[0,1],[1,2]]
const WEAK_HOME=[[0,2],[1,2],[0,1],[0,3],[1,3]]
function venueRows(teamId,venue,scores){
  return scores.map((pair,i)=>venue==='home'
    ?game(40+i,pair[0],pair[1],teamId,800+i)
    :game(50+i,pair[1],pair[0],900+i,teamId))
}
const fixture=(history,markets,form={})=>{
  const homeScores=form.home||STRONG_HOME
  const awayScores=form.away||STRONG_AWAY
  return{
    fixtureId:99,kickoff:'2026-09-10T12:00:00Z',league:'Test',country:'GH',
    home:{id:1,name:'Home',fixtures:venueRows(1,'home',homeScores)},
    away:{id:2,name:'Away',fixtures:venueRows(2,'away',awayScores)},
    h2hHistory:history,
    sportyMarkets:markets||[market(1,'1X2',[['Home','1.50'],['Draw','3.50'],['Away','5.00']]),market(10,'Over/Under',[['Over 2.5','1.80'],['Under 2.5','1.90']])]
  }
}
test('publishes only SportyBet selections occurring in at least 80% of same-venue H2Hs',()=>{const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,1,1)];const picks=analyzeH2HFixture(fixture(rows));assert.equal(H2H_MIN_RATE,80);assert.equal(H2H_MIN_MATCHES,5);assert.ok(picks.some(x=>x.market==='match-winner'&&x.selection==='Home'&&x.occurrence===80));assert.ok(picks.every(x=>x.occurrence>=80));assert.ok(picks.every(x=>!/sporty\s*bet/i.test(JSON.stringify(x))))})
test('reversed venue meetings do not enter the split sample',()=>{const rows=[game(1,2,0),game(2,2,0),game(3,2,0),game(4,2,0),game(5,2,0),game(6,0,4,2,1)];const picks=analyzeH2HFixture(fixture(rows));assert.ok(picks.some(x=>x.selection==='Home'&&x.h2hMatches===5&&x.occurrence===100))})
test('tiny H2H samples never become bankers',()=>{assert.deepEqual(analyzeH2HFixture(fixture([game(1,4,0),game(2,4,0),game(3,4,0)])),[])})
test('Asian Over 1 and 1X2&OU hybrids never publish as match totals',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,1),game(4,2,0),game(5,2,1)]
  const markets=[
    market(18,'Over/Under',[['Over 1.5','1.15'],['Under 1.5','5.50']],'total=1'),
    market(18,'Over/Under',[['Over 1.5','1.40'],['Under 1.5','2.80'],['Home/Draw & Over 1.5','3.80']],'total=1.5')
  ]
  const picks=analyzeH2HFixture(fixture(rows,markets))
  assert.equal(H2H_ENGINE_VERSION,'h2h-v1.4-form-60')
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
test('Home or away and Home or draw never publish; next 80%+ market does',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,2,1)]
  const markets=[
    market(10,'Double Chance',[['Home or away','1.25'],['Home or draw','1.30'],['Draw or away','3.80']]),
    market(18,'Over/Under',[['Over 1.5','1.40'],['Under 1.5','2.80']],'total=1.5'),
    market(1,'1X2',[['Home','1.50'],['Draw','4.00'],['Away','6.00']])
  ]
  const picks=analyzeH2HFixture(fixture(rows,markets))
  assert.equal(H2H_ENGINE_VERSION,'h2h-v1.4-form-60')
  assert.ok(picks.length>=1)
  assert.ok(picks.every(x=>!/home or away|home or draw|^12$|^1x$/i.test(String(x.selection))))
  assert.ok(picks.some(x=>x.selection==='Home'||x.selection==='Over 1.5'))
})
test('skips the match entirely when current form is below 60%',()=>{
  const rows=[game(1,2,0),game(2,3,0),game(3,2,0),game(4,1,0),game(5,2,0)]
  const picks=analyzeH2HFixture(fixture(rows,null,{home:WEAK_HOME,away:WEAK_HOME}))
  assert.equal(H2H_FORM_MIN,60)
  assert.equal(H2H_FORM_SAMPLE,5)
  assert.deepEqual(picks,[])
})
test('skips the match entirely when last-5 venue form is incomplete',()=>{
  const rows=[game(1,2,0),game(2,3,0),game(3,2,0),game(4,1,0),game(5,2,0)]
  const picks=analyzeH2HFixture(fixture(rows,null,{home:[[2,0],[3,0]],away:STRONG_AWAY}))
  assert.deepEqual(picks,[])
})
test('an 80% H2H tip still needs 60% current form on the relevant side',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,1,1)]
  const f=fixture(rows)
  const picks=analyzeH2HFixture(f)
  const home=picks.find(x=>x.selection==='Home')
  assert.ok(home)
  assert.ok(home.formRate>=60)
  assert.ok(home.formMatches>=5)
  assert.match(home.userWhy,/current-form gate/i)
  const form=formSupport(f,{market:'match-winner',selection:'Home',test:(h,a)=>h>a})
  assert.equal(form.ok,true)
  assert.ok(form.rate>=60)
})
test('publishes the form-backed H2H market and drops the unbacked one',()=>{
  const rows=[game(1,2,1),game(2,3,0),game(3,1,0),game(4,2,0),game(5,2,1)]
  const markets=[
    market(1,'1X2',[['Home','1.50'],['Draw','4.00'],['Away','6.00']]),
    market(18,'Over/Under',[['Over 1.5','1.40'],['Under 1.5','2.80']],'total=1.5')
  ]
  const picks=analyzeH2HFixture(fixture(rows,markets,{home:WEAK_HOME,away:STRONG_AWAY}))
  assert.ok(picks.every(x=>x.selection!=='Home'))
  assert.ok(picks.some(x=>x.selection==='Over 1.5'&&x.formRate>=60))
})
