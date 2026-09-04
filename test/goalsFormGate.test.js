import test from 'node:test'
import assert from 'node:assert/strict'
import {goalsFormGate,weakFavouriteGate} from '../server/goalsFormGate.js'
import {diagnoseGoalsBankerFixture} from '../server/goalsBankersEngine.js'

const strong={played:5,ready:true,win:100,loss:0,over25:80,btts:80,scored2plus:80,conceded2plus:0}
const leaking={played:5,ready:true,win:20,loss:80,over25:80,btts:80,scored2plus:20,conceded2plus:80}
const shortPoor={played:3,ready:false,win:0,loss:100,over25:33,btts:33,scored2plus:0,conceded2plus:67}
const none={played:0,ready:false,win:null,loss:null,over25:null,btts:null,scored2plus:null,conceded2plus:null}

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-08-${String((id%27)+1).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}
function venueRows(teamId,venue,scores){
  return scores.map((pair,index)=>venue==='home'
    ?finished(index+1,teamId,800+index,pair[0],pair[1])
    :finished(index+1,800+index,teamId,pair[1],pair[0]))
}
function markets(){
  return[
    {marketKey:'goals-streak-2',market:'Goals Streak 2+',outcomes:[{name:'Yes',odd:1.22}]},
    {marketKey:'match-winner',market:'Match winner',outcomes:[{name:'Home',odd:1.28},{name:'Away',odd:8},{name:'Draw',odd:5}]},
    {marketKey:'draw-no-bet',market:'Draw no bet',outcomes:[{name:'Home',odd:1.18},{name:'Away',odd:3.20}]},
    {marketKey:'total-goals',market:'Total goals',outcomes:[{name:'Over 2.5',odd:1.90}]},
    {marketKey:'both-teams-score',market:'Both teams to score',outcomes:[{name:'Yes',odd:1.90}]},
    {marketKey:'home-team-goals',market:'Home team goals',outcomes:[{name:'Over 1.5',odd:1.32},{name:'Over 2.5',odd:1.92},{name:'Over 0.5',odd:1.20}]},
    {marketKey:'away-team-goals',market:'Away team goals',outcomes:[{name:'Over 1.5',odd:2.10},{name:'Over 2.5',odd:2.40},{name:'Over 0.5',odd:1.78}]}
  ]
}
function fixture(){
  return{
    fixtureId:501,
    league:'Test League',
    country:'England',
    kickoff:'2026-08-29T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:venueRows(1,'home',[[2,0],[3,1],[2,1],[2,0],[3,0]])},
    away:{id:2,name:'Away FC',logo:null,fixtures:venueRows(2,'away',[[0,2],[1,2],[0,1],[0,2],[1,3]])},
    homeSplit:{position:4,size:20,sampleReady:true,ppg:2.2,played:5,venue:'home'},
    awaySplit:{position:16,size:20,sampleReady:true,ppg:0.6,played:5,venue:'away'},
    earlySeason:false,
    statsReady:true,
    marketOdds:markets()
  }
}

test('waive does not skip form rates when a sample exists',()=>{
  const r=goalsFormGate('FAV_WIN','home',shortPoor,leaking,{waive:true})
  assert.equal(r.ok,false)
  assert.equal(r.skip,'form-fav-win')
})

test('waive still passes when neither side has played',()=>{
  const r=goalsFormGate('FAV_WIN','home',none,none,{waive:true})
  assert.equal(r.ok,true)
  assert.equal(r.waived,true)
})

test('without waive, short sample is form-sample',()=>{
  const r=goalsFormGate('FAV_WIN','home',shortPoor,leaking,{waive:false})
  assert.equal(r.ok,false)
  assert.equal(r.skip,'form-sample')
})

test('strong five-game sample still publishes FAV_WIN form',()=>{
  const r=goalsFormGate('FAV_WIN','home',strong,leaking)
  assert.equal(r.ok,true)
})

test('bottom-3 favourite is skipped on every market',()=>{
  const split={position:18,size:20,ppg:0.4,played:5}
  assert.equal(weakFavouriteGate('FAV_WIN','home',split,{position:10,size:20}).ok,false)
  assert.equal(weakFavouriteGate('FAV_2PLUS','home',split,{position:10,size:20}).skip,'weak-favourite')
  assert.equal(weakFavouriteGate('GG','home',split,{position:10,size:20}).ok,false)
  assert.equal(weakFavouriteGate('OVER_2.5','away',{position:8,size:20},{position:20,size:20,ppg:0.3,played:5}).ok,false)
})

test('poor PPG favourite is skipped even if not bottom-3',()=>{
  const split={position:14,size:20,ppg:0.7,played:5}
  assert.equal(weakFavouriteGate('FAV_WIN','home',split,{position:16,size:20}).skip,'weak-favourite-ppg')
})

test('top-half favourite with real PPG is allowed',()=>{
  const split={position:4,size:20,ppg:2.1,played:5}
  assert.equal(weakFavouriteGate('FAV_2PLUS','home',split,{position:16,size:20}).ok,true)
})

test('V5 no longer hard-skips one bottom-3 team when a goals fallback is clear',()=>{
  const row=fixture()
  row.homeSplit={position:19,size:20,ppg:0.4,played:5,venue:'home'}
  const r=diagnoseGoalsBankerFixture(row)
  assert.ok(r.pick)
  assert.equal(r.pick.route,'FAV_2PLUS')
})

test('V5 publishes DNB for a strong qualified team outside the overall Top 3',()=>{
  const r=diagnoseGoalsBankerFixture(fixture())
  assert.ok(r.pick)
  assert.equal(r.pick.route,'FAV_DNB')
})

test('V5 result and goals routes use the explicit ladder instead of the old form veto',()=>{
  const row=fixture()
  row.earlySeason=true
  row.home.fixtures=venueRows(1,'home',[[0,2],[0,1],[1,2]])
  row.away.fixtures=venueRows(2,'away',[[2,0],[1,0],[3,1]])
  const r=diagnoseGoalsBankerFixture(row)
  assert.ok(r.pick)
  assert.equal(r.pick.formGate.v5,true)
})
