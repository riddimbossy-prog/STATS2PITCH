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

function markets({streak,awayO05,awayO15,homeO05,homeO15,over15,awayWin,homeWin,bttsYes}={}){
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
  add('match-winner','Match winner','Home',homeWin)
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
    statsReady:overrides.statsReady,
    marketOdds:overrides.marketOdds||markets({
      streak:1.22,awayO05:1.18,awayO15:1.32,homeO05:1.20,homeO15:1.80,over15:1.28,awayWin:1.70,bttsYes:1.45
    })
  }
}

test('board version is consensus All Picks plus VAR Tips',()=>{
  assert.equal(ENGINE_VERSION,'stats2pitch-v5-var-tips')
  const board=buildBoard([])
  assert.equal(board.meta.engineVersion,ENGINE_VERSION)
  assert.equal(board.meta.engine,'stats2pitch-consensus-v4-over25')
  assert.equal(board.meta.varTipsEngine,'away-fav-streak-v1')
  assert.ok(Array.isArray(board.bestPicks))
  assert.ok(Array.isArray(board.varTips))
  assert.ok(Array.isArray(board.filterTips))
  assert.ok(Array.isArray(board.goalsBankers))
  assert.equal(board.meta.filterTipsEngine,'sporty-filter-v1')
  assert.equal(board.meta.goalsBankersEngine,'goals-bankers-v3')
})

test('combined board attaches VAR Tips separately from All Picks',()=>{
  const board=buildBoard([fixture()])
  assert.equal(board.varTips.length,1)
  assert.equal(board.varTips[0].engine,'away-fav-streak-v1')
  assert.equal(board.varTips[0].route,'btts')
  assert.equal(board.meta.varTipsCount,1)
  assert.ok(board.bestPicks.every(row=>row.engine!=='away-fav-streak-v1'))
})

test('missing required odds fail closed',()=>{
  const result=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.22,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(result.skip,'missing-odds')
  assert.equal(result.pick,null)
})

test('streak outside 1.10-1.49 falls back to a priced favourite route',()=>{
  const high=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.60,awayO05:1.18,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(high.skip,null)
  assert.equal(high.pick.route,'btts')
  const low=diagnoseAwayFavFixture(fixture({marketOdds:markets({streak:1.05,awayO05:1.18,awayO15:1.32,homeO05:1.20,bttsYes:1.40})}))
  assert.equal(low.skip,null)
  assert.equal(low.pick.route,'btts')
})

test('home favourite on team-goals over 1.5 now qualifies on the home path',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',strongAway),
    awayFixtures:venueRows(2,'away',weakHome),
    marketOdds:markets({streak:1.22,awayO05:1.18,awayO15:1.40,homeO05:1.20,homeO15:1.25,bttsYes:1.40})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.favourite,'home')
  assert.equal(result.pick.route,'btts')
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

test('matches without SportyBet last-match stats are skipped',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:[],
    awayFixtures:[],
    homeSplit:null,
    awaySplit:null
  }))
  assert.equal(result.skip,'no-stats')
  assert.equal(result.pick,null)
  const flagged=diagnoseAwayFavFixture(fixture({statsReady:false}))
  assert.equal(flagged.skip,'no-stats')
})

test('SportyBet 2+ in-a-row market is the streak universe',()=>{
  const odds=extractOdds(fixture({
    marketOdds:[
      {marketKey:'60010',market:'Any Team To Score 2 or More Goals in a Row',outcomes:[{name:'Yes',odd:1.27}]},
      {marketKey:'away-team-goals',market:'Away O/U',outcomes:[{name:'Over 0.5',odd:1.18},{name:'Over 1.5',odd:1.32}]},
      {marketKey:'home-team-goals',market:'Home O/U',outcomes:[{name:'Over 0.5',odd:1.20}]},
      {marketKey:'total-goals',market:'Over/Under',outcomes:[{name:'Over 0.5',odd:1.04}]},
      {marketKey:'total-goals',market:'Over/Under',outcomes:[{name:'Over 1.5',odd:1.29}]}
    ]
  }))
  assert.equal(odds.streak,1.27)
  assert.equal(odds.over15,1.29)
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
  assert.equal(result.pick.favourite,'away')
  assert.equal(result.pick.route,'over-15')
  assert.equal(result.pick.market,'total-goals')
  assert.equal(result.pick.selection,'Over 1.5')
  assert.notEqual(result.pick.selection,'Over 2.5')
})

test('home win beats team-goals 2+ when away over 0.5 is weak and 1X2 is short enough',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',strongAway),
    awayFixtures:venueRows(2,'away',weakHome),
    homeSplit:{position:4,size:20,sampleReady:true,ppg:2.4,played:5,venue:'home'},
    awaySplit:{position:16,size:20,sampleReady:true,ppg:0.4,played:5,venue:'away'},
    marketOdds:markets({streak:1.25,homeO05:1.40,homeO15:1.35,awayO05:1.75,awayO15:2.10,over15:1.30,homeWin:1.42,awayWin:4.20,bttsYes:1.70})
  }))
  assert.equal(result.pick.favourite,'home')
  assert.equal(result.pick.route,'home-win')
  assert.equal(result.pick.market,'match-winner')
  assert.equal(result.pick.selection,'Home')
})

test('home team goals over 1.5 is used when the home win is not short enough',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',strongAway),
    awayFixtures:venueRows(2,'away',weakHome),
    marketOdds:markets({streak:1.25,homeO05:1.40,homeO15:1.35,awayO05:1.82,awayO15:2.20,over15:1.30,homeWin:1.80,awayWin:4.00,bttsYes:1.70})
  }))
  assert.equal(result.pick.favourite,'home')
  assert.equal(result.pick.route,'home-o15')
  assert.equal(result.pick.market,'home-team-goals')
  assert.equal(result.pick.selection,'Over 1.5')
})

test('home-fav open game with a scoring away side becomes total over 1.5',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',strongAway),
    awayFixtures:venueRows(2,'away',weakHome),
    marketOdds:markets({streak:1.28,homeO05:1.40,homeO15:1.38,awayO05:1.50,awayO15:1.90,over15:1.33,homeWin:1.55,awayWin:4.10,bttsYes:1.70})
  }))
  assert.equal(result.pick.favourite,'home')
  assert.equal(result.pick.route,'over-15')
  assert.equal(result.pick.market,'total-goals')
  assert.equal(result.pick.selection,'Over 1.5')
})

test('missing streak market is not proxied from team-goals',()=>{
  const odds=extractOdds(fixture({
    marketOdds:markets({awayO05:1.18,awayO15:1.20,homeO05:1.20,bttsYes:1.40})
  }))
  assert.equal(odds.streak,null)
  assert.equal(odds.streakSource,null)
})

test('priced favourite without streak still publishes a 1X2 route',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeSplit:null,
    awaySplit:null,
    marketOdds:markets({awayWin:1.38,homeWin:4.20,over15:1.28,bttsYes:1.62})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.favourite,'away')
  assert.equal(result.pick.route,'away-win')
  assert.equal(result.pick.market,'match-winner')
  assert.ok(result.pick.engineRating>=RULES.supportedAt)
  assert.ok(!result.pick.families.includes('Streak 2+'))
})

test('home favourite without streak publishes from match-winner odds',()=>{
  const result=diagnoseAwayFavFixture(fixture({
    homeFixtures:venueRows(1,'home',strongAway),
    awayFixtures:venueRows(2,'away',weakHome),
    homeSplit:null,
    awaySplit:null,
    marketOdds:markets({homeWin:1.35,awayWin:5.10,over15:1.30,bttsYes:1.70})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.favourite,'home')
  assert.equal(result.pick.route,'home-win')
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

test('elite export reads VAR Tips and publishes every qualifier without method fields',()=>{
  const qualified=diagnoseAwayFavFixture(fixture()).pick
  const extras=Array.from({length:11},(_,index)=>({
    ...qualified,
    fixtureId:200+index,
    kickoff:`2026-08-2${index<7?6:5}T${String(10+index).padStart(2,'0')}:00:00Z`,
    home:`Home ${index}`,
    away:`Away ${index}`
  }))
  const consensus={fixtureId:999,home:'Old',away:'Consensus',market:'match-winner',selection:'Home',odds:1.40,engineRating:90,engine:'stats2pitch-consensus-v4-over25'}
  const feed=buildEliteFeed({
    meta:{date:'2026-08-25',generatedAt:'2026-08-25T09:00:00Z',engine:'stats2pitch-consensus-v4-over25',varTipsEngine:'away-fav-streak-v1'},
    varTips:[qualified,...extras],
    bestPicks:[consensus]
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
