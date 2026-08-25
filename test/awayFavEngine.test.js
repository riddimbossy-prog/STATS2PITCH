import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseAwayFavFixture,buildAwayFavBoard,extractOdds,RULES} from '../server/awayFavEngine.js'
import {buildBoard} from '../server/engine.js'
import {ENGINE_VERSION} from '../server/config.js'
import {buildEliteFeed} from '../server/eliteExport.js'

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-03-${String((id%27)+1).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}

function venueRows(teamId,venue,scores){
  return scores.map((pair,index)=>venue==='home'
    ?finished(index+1,teamId,800+index,pair[0],pair[1])
    :finished(index+1,800+index,teamId,pair[1],pair[0]))
}

const strongAway=[[2,0],[3,1],[2,1],[2,0],[3,0]]
const weakHome=[[0,2],[1,2],[0,1],[0,2],[1,3]]
const evenForm=[[1,1],[1,0],[0,1],[1,1],[2,2]]

function markets({streak,awayO05,awayO15,homeO05,homeO15,over15,awayWin,bttsYes}={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let found=rows.find(row=>row.marketKey===marketKey)
    if(!found){found={marketKey,market,outcomes:[]};rows.push(found)}
    found.outcomes.push({name,odd:Number(odd)})
  }
  add('goals-streak-2','Goals Streak 2+','Yes',streak)
  add('away-team-goals','Away team goals','Over 0.5',awayO05)
  add('away-team-goals','Away team goals','Over 1.5',awayO15)
  add('home-team-goals','Home team goals','Over 0.5',homeO05)
  add('home-team-goals','Home team goals','Over 1.5',homeO15)
  add('total-goals','Total goals','Over 1.5',over15)
  add('match-winner','Match winner','Away',awayWin)
  add('both-teams-score','Both teams to score','Yes',bttsYes)
  return rows
}

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||101,
    league:'Test League',
    country:'England',
    kickoff:overrides.kickoff||'2026-08-25T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:overrides.homeFixtures||venueRows(1,'home',weakHome)},
    away:{id:2,name:'Away FC',logo:null,fixtures:overrides.awayFixtures||venueRows(2,'away',strongAway)},
    homeSplit:overrides.homeSplit||{position:12,size:20,sampleReady:true,ppg:0.4,played:5,venue:'home'},
    awaySplit:overrides.awaySplit||{position:8,size:20,sampleReady:true,ppg:2.4,played:5,venue:'away'},
    earlySeason:overrides.earlySeason===true,
    marketOdds:overrides.marketOdds||markets({
      streak:1.22,awayO05:1.18,awayO15:1.32,homeO05:1.20,homeO15:1.80,over15:1.28,awayWin:1.70,bttsYes:1.45
    })
  }
}

test('board version is the away-fav streak engine',()=>{
  assert.equal(ENGINE_VERSION,'away-fav-streak-v1')
  assert.equal(buildBoard([]).meta.engineVersion,ENGINE_VERSION)
  assert.equal(buildBoard([]).meta.engine,'away-fav-streak-v1')
})

test('missing required odds fail closed',()=>{
  const result=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.22,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(result.skip,'missing-odds')
  assert.equal(result.pick,null)
})

test('streak outside 1.10-1.49 is skipped',()=>{
  const high=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.60,awayO05:1.18,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(high.skip,'streak-window')
  const low=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.05,awayO05:1.18,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(low.skip,'streak-window')
})

test('home favourite on team-goals over 1.5 is skipped',()=>{
  const result=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.22,awayO05:1.18,awayO15:1.40,homeO05:1.20,homeO15:1.25,bttsYes:1.40})}))
  assert.equal(result.skip,'fav-is-home')
})

test('both top five and both bottom three are skipped',()=>{
  const top=diagnoseAwayFavFixture(fixture({homeSplit:{position:2,size:20,sampleReady:true},awaySplit:{position:4,size:20,sampleReady:true}}))
  assert.equal(top.skip,'both-top-five')
  const bottom=diagnoseAwayFavFixture(fixture({homeSplit:{position:19,size:20,sampleReady:true},awaySplit:{position:18,size:20,sampleReady:true}}))
  assert.equal(bottom.skip,'both-bottom-three')
})

test('early season and similar form are skipped',()=>{
  const early=diagnoseAwayFavFixture(fixture({earlySeason:true}))
  assert.equal(early.skip,'early-season')
  const similar=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',evenForm),
    awayFixtures:venueRows(2,'away',evenForm)
  }))
  assert.equal(similar.skip,'similar-form')
})

test('both over 0.5 under 1.30 routes to BTTS yes',()=>{
  const result=diagnoseAwayFavFixture(fixture())
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'btts')
  assert.equal(result.pick.market,'both-teams-score')
  assert.equal(result.pick.selection,'Yes')
  assert.ok(result.pick.engineRating>=RULES.supportedAt)
})

test('away win beats team-goals 2+ when home over 0.5 is weak and 1X2 is short enough',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    marketOdds:markets({streak:1.25,awayO05:1.40,awayO15:1.35,homeO05:1.75,over15:1.30,awayWin:1.42,bttsYes:1.70})
  }))
  assert.equal(result.pick.route,'away-win')
  assert.equal(result.pick.market,'match-winner')
  assert.equal(result.pick.selection,'Away')
})

test('away team goals over 1.5 is used when the away win is not short enough',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    marketOdds:markets({streak:1.25,awayO05:1.40,awayO15:1.35,homeO05:1.82,over15:1.30,awayWin:1.80,bttsYes:1.70})
  }))
  assert.equal(result.pick.route,'away-o15')
  assert.equal(result.pick.market,'away-team-goals')
  assert.equal(result.pick.selection,'Over 1.5')
  assert.ok(result.pick.engineRating>=78)
})

test('open game with a scoring home side becomes total over 1.5 never over 2.5',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    marketOdds:markets({streak:1.28,awayO05:1.40,awayO15:1.38,homeO05:1.50,over15:1.33,awayWin:1.90,bttsYes:1.70})
  }))
  assert.equal(result.pick.route,'over-15')
  assert.equal(result.pick.market,'total-goals')
  assert.equal(result.pick.selection,'Over 1.5')
  assert.notEqual(result.pick.selection,'Over 2.5')
})

test('missing streak market fails closed and is never proxied from team-goals',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    marketOdds:markets({awayO05:1.18,awayO15:1.20,homeO05:1.20,bttsYes:1.40})
  }))
  assert.equal(result.skip,'missing-odds')
  assert.equal(result.pick,null)
  const odds=extractOdds(fixture({
    marketOdds:markets({awayO05:1.18,awayO15:1.20,homeO05:1.20,bttsYes:1.40})
  }))
  assert.equal(odds.streak,null)
  assert.equal(odds.streakSource,null)
})

test('board keeps one pick per fixture and publishes every qualifier',()=>{
  const fixtures=Array.from({length:12},(_,index)=>fixture({
    fixtureId:index+1,
    kickoff:`2026-08-25T${String(12+index).padStart(2,'0')}:00:00Z`
  }))
  const board=buildAwayFavBoard(fixtures)
  assert.equal(board.bestPicks.length,12)
  assert.equal(board.priority.length,12)
  assert.equal(new Set(board.bestPicks.map(row=>row.fixtureId)).size,12)
  assert.ok(board.bestPicks.every(row=>row.engine==='away-fav-streak-v1'))
  const kickoffs=board.bestPicks.map(row=>Date.parse(row.kickoff))
  assert.deepEqual(kickoffs,[...kickoffs].sort((a,b)=>a-b))
})

test('elite export publishes every away-fav qualifier without method fields',()=>{
  const qualified=diagnoseAwayFavFixture(fixture()).pick
  const extras=Array.from({length:11},(_,index)=>({
    ...qualified,
    fixtureId:200+index,
    kickoff:`2026-08-2${index<7?6:5}T${String(10+index).padStart(2,'0')}:00:00Z`,
    home:`Home ${index}`,
    away:`Away ${index}`
  }))
  const feed=buildEliteFeed({
    meta:{date:'2026-08-25',generatedAt:'2026-08-25T09:00:00Z',engine:'away-fav-streak-v1'},
    bestPicks:[
      qualified,
      ...extras,
      {fixtureId:999,home:'Old',away:'Consensus',market:'match-winner',selection:'Home',odds:1.40,engineRating:90,engine:'stats2pitch-consensus-v4-over25'}
    ]
  },{date:'2026-08-25'})
  assert.equal(feed.items.length,12)
  assert.equal(feed.items[0].label,'Elite')
  assert.equal(feed.items[0].market,'Both Teams To Score')
  assert.equal(feed.engine,undefined)
  assert.equal(feed.max,undefined)
  assert.ok(feed.items.every(row=>row.reason==null))
  assert.ok(feed.items.every(row=>row.elite_score==null))
  assert.ok(feed.items.every(row=>!row.families))
  const kickoffs=feed.items.map(row=>Date.parse(row.kickoff))
  assert.deepEqual(kickoffs,[...kickoffs].sort((a,b)=>a-b))
})
