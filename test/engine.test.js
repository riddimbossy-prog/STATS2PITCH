import test from 'node:test'
import assert from 'node:assert/strict'
import {buildVenueFormTable,formTableProfile,leagueMature,analyzeFixture,buildBoard,ENGINE_VERSION,PROFILE_SOURCE} from '../server/engine.js'

const standings=Array.from({length:5},(_,i)=>({
  team:{id:i+1,name:`T${i+1}`},rank:i+1,_s2pGroupIndex:0,
  // Deliberately unrealistic normal-table numbers. Engine v2 must ignore all of them.
  all:{played:99,win:99,draw:0,lose:0,goals:{for:999,against:0}},
  home:{played:99,win:99,draw:0,lose:0,goals:{for:999,against:0}},
  away:{played:99,win:99,draw:0,lose:0,goals:{for:999,against:0}}
}))
const homeForm={1:['L','L','L','L','D'],2:['W','W','W','W','W'],3:['W','W','W','D','D'],4:['W','W','D','D','D'],5:['W','D','D','D','L']}
const awayForm={1:['W','W','W','W','W'],2:['W','W','W','W','D'],3:['W','W','W','D','L'],4:['W','D','L','L','L'],5:['D','L','L','L','L']}
function score(outcome,teamIsHome){if(outcome==='D')return[1,1];if(outcome==='W')return teamIsHome?[2,0]:[0,2];return teamIsHome?[0,2]:[2,0]}
function match(home,away,hg,ag,n){return{fixture:{id:1000+n,date:`2026-07-${String((n%28)+1).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:home,name:`T${home}`},away:{id:away,name:`T${away}`}},goals:{home:hg,away:ag}}}
function formHistory(){const rows=[];let n=0;for(let id=1;id<=5;id++){for(const outcome of homeForm[id]){const [h,a]=score(outcome,true);rows.push(match(id,100+id,h,a,n++))}for(const outcome of awayForm[id]){const [h,a]=score(outcome,false);rows.push(match(200+id,id,h,a,n++))}}return rows}
const history=formHistory()

test('HOME Form Table PPG and rank ignore the normal standings table',()=>{
  const p1=formTableProfile(history,standings,1,'home'),p2=formTableProfile(history,standings,2,'home')
  assert.equal(p1.source,PROFILE_SOURCE)
  assert.equal(p1.ppg,0.2)
  assert.equal(p1.position,5)
  assert.equal(p2.ppg,3)
  assert.equal(p2.position,1)
  const changed=structuredClone(standings);changed[0].rank=99;changed[0].home.win=0;changed[0].home.goals.for=0;changed[1].rank=1;changed[1].home.win=0
  assert.deepEqual(formTableProfile(history,changed,1,'home'),p1)
  assert.deepEqual(formTableProfile(history,changed,2,'home'),p2)
})

test('AWAY Form Table is calculated independently from AWAY results',()=>{
  const p1=formTableProfile(history,standings,1,'away'),p5=formTableProfile(history,standings,5,'away')
  assert.equal(p1.ppg,3)
  assert.equal(p1.position,1)
  assert.equal(p5.ppg,0.2)
  assert.equal(p5.position,5)
})

test('Form Table requires five HOME/AWAY samples across the group before maturity',()=>{
  assert.equal(leagueMature(history,standings,2,5),true)
  const short=history.filter(f=>!(String(f?.teams?.home?.id)==='2'&&String(f?.teams?.away?.id)==='102')).slice(1)
  const table=buildVenueFormTable(short,standings,2,'home')
  assert.equal(table.tableReady,false)
  assert.equal(leagueMature(short,standings,2,5),false)
})

const team=(id,name,venue,position,o={})=>({id,name,venue,source:PROFILE_SOURCE,formTableReady:true,formTableSample:5,position,positionSampleReady:true,leagueSize:10,played:5,ppg:2.1,goalsScored:1.6,goalsConceded:1.1,winRate:80,lossRate:0,goalsSample:5,bttsRate:80,failedToScoreRate:0,cleanSheetRate:20,over15:80,under15:20,over25:80,under25:20,over35:40,under35:60,recentGoalsScored:1.6,recentGoalsConceded:1.1,...o})
const fixture=(hp=1,ap=5,o={})=>({fixtureId:99,match:'Alpha vs Beta',league:'League',country:'Test',kickoff:'2026-08-11T20:00:00Z',kickoffLocal:'11 Aug, 20:00',home:team(1,'Alpha','home',hp,o.home),away:team(2,'Beta','away',ap,o.away),odds:{home:1.65,draw:3.8,away:4.8,over15:1.25,under15:3.5,over25:1.75,under25:2.0,over35:2.7,under35:1.4,bttsYes:1.72,dnbHome:1.4,dnbAway:3.1,dc1x:1.25,dcx2:2.1,...o.odds}})

test('normal-table Top 1 cannot rescue a Form Table position 4 result candidate',()=>{
  const rows=analyzeFixture(fixture(4,6))
  assert.equal(rows.some(x=>['1X2','DNB','DC'].includes(x.market)),false)
  assert.equal(rows.some(x=>x.market==='O1.5'||x.market==='BTTS'),true)
})

test('Form Table Top 3 with 60%+ wins can publish a straight win',()=>{
  const rows=analyzeFixture(fixture(1,6))
  assert.equal(rows.some(x=>x.market==='1X2'&&x.selection==='Alpha'),true)
  assert.match(rows.find(x=>x.market==='1X2').reasons.join(' '),/Form Table/)
})

test('under-60 Form Table win rate can only downgrade above 2.00 and never if non-Top3',()=>{
  let rows=analyzeFixture(fixture(1,6,{home:{winRate:40},odds:{home:2.3}}))
  assert.equal(rows.some(x=>x.market==='DNB'&&x.selection==='Alpha DNB'),true)
  rows=analyzeFixture(fixture(4,6,{home:{winRate:40},odds:{home:2.3}}))
  assert.equal(rows.some(x=>['DNB','DC','1X2'].includes(x.market)),false)
})

test('goals and GG require the Form Table source and use only its five-game metrics',()=>{
  assert.equal(analyzeFixture(fixture(4,6)).some(x=>x.market==='BTTS'),true)
  assert.equal(analyzeFixture(fixture(4,6,{home:{source:'normal-table'}})).some(x=>x.market==='BTTS'||x.market.startsWith('O')||x.market.startsWith('U')),false)
  assert.equal(analyzeFixture(fixture(4,6,{home:{failedToScoreRate:40}})).some(x=>x.market==='BTTS'),false)
  assert.equal(analyzeFixture(fixture(4,6,{away:{cleanSheetRate:60}})).some(x=>x.market==='BTTS'),false)
})

test('best picks is exactly one market per fixture and exposes form-table engine version',()=>{
  const board=buildBoard([fixture(1,6)])
  assert.equal(board.bestPicks.length,1)
  assert.equal(board.meta.engineVersion,ENGINE_VERSION)
  assert.equal(board.meta.profileSource,PROFILE_SOURCE)
  assert.equal(board.meta.formTableSample,5)
})
