import test from 'node:test'
import assert from 'node:assert/strict'
import {last5Form,last5Overall,h2hSnapshot,consensusReasons,varPublicReasons,attachWhy,fixtureHasStats,teamStats} from '../server/pickWhy.js'
import {analyzeFixture} from '../server/engine.js'
import {diagnoseAwayFavFixture} from '../server/awayFavEngine.js'
import {readFile} from 'node:fs/promises'

const finished=(id,homeId,awayId,h,a,home='Home FC',away='Away FC')=>({
  fixture:{id,date:`2026-08-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
  teams:{home:{id:homeId,name:home},away:{id:awayId,name:away}},
  goals:{home:h,away:a},
  score:{halftime:{home:0,away:0}}
})
const sample=(id,venue)=>Array.from({length:5},(_,i)=>venue==='home'
  ?finished(i+1,id,900+i,2,0,id===1?'Home FC':'Other',`Opp ${i}`)
  :finished(i+1,900+i,id,2,0,`Opp ${i}`,id===2?'Away FC':'Other'))
function analyzedFixture(){
  return{
    fixtureId:1,league:'Test',country:'Test',kickoff:'2026-08-20T12:00:00Z',
    home:{id:1,name:'Home FC',fixtures:sample(1,'home')},
    away:{id:2,name:'Away FC',fixtures:sample(2,'away')},
    homeSplit:{position:2,size:20,played:5,sampleReady:true,ppg:2.4},
    awaySplit:{position:18,size:20,played:5,sampleReady:true,ppg:0.4},
    h2h:[compactH2h()],
    marketOdds:[{marketKey:'total-goals',market:'Total Goals',outcomes:[{name:'Under 2.5',odd:1.4}]}]
  }
}
function compactH2h(){return{date:'2026-04-01T12:00:00Z',home:'Home FC',away:'Away FC',hs:2,as:1}}

function varFixture(){
  const weakHome=Array.from({length:5},(_,i)=>finished(i+1,1,900+i,0,2,'Home FC',`Opp ${i}`))
  const strongAway=Array.from({length:5},(_,i)=>finished(i+1,800+i,2,0,2,`Opp ${i}`,'Away FC'))
  return{
    fixtureId:101,league:'Test League',country:'England',kickoff:'2026-08-25T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:weakHome},
    away:{id:2,name:'Away FC',logo:null,fixtures:strongAway},
    homeSplit:{position:12,size:20,sampleReady:true,ppg:0.4,played:5,venue:'home'},
    awaySplit:{position:8,size:20,sampleReady:true,ppg:2.4,played:5,venue:'away'},
    h2h:[compactH2h()],
    marketOdds:[{marketKey:'both-teams-score',market:'Both teams to score',outcomes:[{name:'Yes',odd:1.45}]},{marketKey:'away-team-goals',market:'Away team goals',outcomes:[{name:'Over 0.5',odd:1.18},{name:'Over 1.5',odd:1.32}]},{marketKey:'home-team-goals',market:'Home team goals',outcomes:[{name:'Over 0.5',odd:1.20},{name:'Over 1.5',odd:1.80}]},{marketKey:'goals-streak-2',market:'Goals Streak 2+',outcomes:[{name:'Yes',odd:1.22}]}]
  }
}


test('last-5 and H2H snapshots keep compact venue results',()=>{
  const home=last5Form(sample(1,'home'),1,'home')
  assert.equal(home.length,5)
  assert.equal(home[0].result,'W')
  assert.equal(home[0].venue,'H')
  const h2h=h2hSnapshot([finished(9,1,2,2,1),finished(8,2,1,0,1)],1,2)
  assert.equal(h2h.length,2)
  assert.equal(h2h[0].hs,2)
})

test('All Picks attach public reasons and last-5 form',()=>{
  const picks=analyzeFixture(analyzedFixture())
  assert.ok(picks.length>=1)
  const p=picks[0]
  assert.ok(Array.isArray(p.reasons)&&p.reasons.length>=2)
  assert.match(p.reasons[0],/Home FC backed/)
  assert.equal(p.why.last5Home.length,5)
  assert.equal(p.why.last5Away.length,5)
  assert.equal(p.why.homeAvg.played,5)
  assert.equal(p.why.h2h.length,1)
})

test('VAR Tips expose public why copy without streak method text',()=>{
  const result=diagnoseAwayFavFixture(varFixture())
  assert.equal(result.skip,null)
  const reasons=result.pick.reasons.join(' ')
  assert.match(reasons,/priced favourite|venue|BTTS|Published/i)
  assert.doesNotMatch(reasons,/Goals Streak|first-match|1\.10/)
  assert.equal(result.pick.why.last5Home.length,5)
  assert.equal(result.pick.why.last5Away.length,5)
})

test('public why lines stay human readable',()=>{
  const lines=consensusReasons({home:'Arsenal',away:'Leeds',displaySelection:'Over 2.5',odds:1.33,homeConsensus:100,awayConsensus:80})
  assert.ok(lines.some(x=>x.includes('5/5')))
  const varLines=varPublicReasons({home:'Arsenal',away:'Leeds',displaySelection:'BTTS · Yes',odds:1.40,favourite:'away'},{ppg:1.2,gf:1.8,ga:0.6},{ppg:2.1,gf:2.4,ga:0.8})
  assert.ok(varLines.some(x=>/Leeds is the priced favourite/.test(x)))
})

test('attachWhy preserves pick fields',()=>{
  const next=attachWhy({fixtureId:7,home:'A',away:'B',odds:1.3,homeConsensus:100,awayConsensus:100,displaySelection:'Under 2.5'},analyzedFixture())
  assert.equal(next.fixtureId,7)
  assert.ok(next.why.last5Home.length)
  assert.ok(next.why.lastMatchesHome.length)
  assert.ok(next.reasons.length)
})

test('overall last matches and team stats match the SportyBet Stats tab',()=>{
  const rows=sample(1,'home')
  const last=last5Overall(rows,1)
  assert.equal(last.length,5)
  const stats=teamStats(last)
  assert.equal(stats.played,5)
  assert.equal(stats.winPct,100)
  assert.equal(stats.over15,100)
  assert.equal(fixtureHasStats(analyzedFixture()),true)
  assert.equal(fixtureHasStats({home:{id:1,fixtures:[]},away:{id:2,fixtures:[]}}),false)
  assert.equal(fixtureHasStats({statsReady:false,home:{id:1,fixtures:sample(1,'home')},away:{id:2,fixtures:sample(2,'away')}}),false)
})

test('All Picks, VAR Tips and Filter Tips open a why popup on match click',async()=>{
  const [app,varJs,varHtml,filterJs,filterHtml,popup]=await Promise.all([
    readFile(new URL('../public/appCrests.js',import.meta.url),'utf8'),
    readFile(new URL('../public/varTips.js',import.meta.url),'utf8'),
    readFile(new URL('../public/var-tips.html',import.meta.url),'utf8'),
    readFile(new URL('../public/filterTips.js',import.meta.url),'utf8'),
    readFile(new URL('../public/filter-tips.html',import.meta.url),'utf8'),
    readFile(new URL('../public/whyPopup.js',import.meta.url),'utf8')
  ])
  assert.match(app,/whySectionHtml/)
  assert.match(app,/bindWhyModal/)
  assert.match(app,/Why this pick/)
  assert.match(varJs,/whySectionHtml/)
  assert.match(varJs,/bindWhyModal/)
  assert.match(varHtml,/id="modal"/)
  assert.match(filterJs,/whySectionHtml/)
  assert.match(filterJs,/bindWhyModal/)
  assert.match(filterHtml,/id="modal"/)
  assert.match(popup,/Why this pick was chosen/)
  assert.match(popup,/last matches/)
  assert.match(popup,/Team stats/)
  assert.doesNotMatch(popup,/Goals Streak|first-match/)
  assert.doesNotMatch(varJs,/Goals Streak|first-match|streak window/)
})
