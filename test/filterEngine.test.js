import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture,buildFilterBoard,extractFilterOdds,isCupCompetition,ENGINE_ID} from '../server/filterEngine.js'
import {buildBoard} from '../server/engine.js'
import {parseSportyBet} from '../server/odds.js'

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

const strongHome=[[2,0],[3,1],[2,1],[2,0],[3,0]]
const weakAway=[[0,2],[1,2],[0,1],[0,2],[1,3]]
const homeOver=[[3,0],[2,1],[3,1],[2,0],[4,1]]
const awayOver=[[2,1],[3,2],[2,2],[1,0],[3,1]]
const homeUnder=[[1,0],[2,0],[1,0],[2,1],[1,0]]
const awayUnder=[[0,1],[0,2],[1,1],[0,1],[1,2]]
const evenForm=[[1,1],[1,0],[0,1],[1,1],[2,2]]

function markets(odds={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let found=rows.find(row=>row.marketKey===marketKey)
    if(!found){found={marketKey,market,outcomes:[]};rows.push(found)}
    found.outcomes.push({name,odd:Number(odd)})
  }
  add('match-winner','Match winner','Home',odds.homeWin)
  add('match-winner','Match winner','Draw',odds.drawWin)
  add('match-winner','Match winner','Away',odds.awayWin)
  add('total-goals','Total goals','Over 1.5',odds.over15)
  add('total-goals','Total goals','Under 3.5',odds.under35)
  add('total-goals','Total goals','Over 2.5',odds.over25)
  add('total-goals','Total goals','Under 2.5',odds.under25)
  add('both-teams-score','Both teams to score','Yes',odds.ggYes)
  add('both-teams-score-2','GG/NG 2+','No',odds.gg2No)
  add('home-team-goals','Home team goals','Over 0.5',odds.homeO05)
  add('home-team-goals','Home team goals','Over 1.5',odds.homeO15)
  add('away-team-goals','Away team goals','Over 0.5',odds.awayO05)
  add('away-team-goals','Away team goals','Over 1.5',odds.awayO15)
  add('goals-streak-2','Goals Streak 2+','Yes',odds.streakYes)
  return rows
}

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||201,
    league:overrides.league||'Test League',
    country:'England',
    kickoff:overrides.kickoff||'2026-08-27T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:overrides.homeFixtures||venueRows(1,'home',strongHome)},
    away:{id:2,name:'Away FC',logo:null,fixtures:overrides.awayFixtures||venueRows(2,'away',weakAway)},
    homeSplit:overrides.homeSplit||{position:8,size:20,sampleReady:true,ppg:2.4,played:5,venue:'home'},
    awaySplit:overrides.awaySplit||{position:14,size:20,sampleReady:true,ppg:0.4,played:5,venue:'away'},
    earlySeason:overrides.earlySeason===true,
    h2h:overrides.h2h||[],
    marketOdds:overrides.marketOdds||markets({
      homeWin:1.35,awayWin:8.00,over15:1.22,under35:1.50,over25:1.70,under25:2.10,ggYes:1.80,gg2No:1.12
    })
  }
}

const winOnly=()=>markets({homeWin:1.35,drawWin:4.80,awayWin:8.00})

test('combined board attaches Filter Tips v2 separately from All Picks and VAR Tips',()=>{
  const board=buildBoard([fixture({marketOdds:winOnly()})])
  assert.ok(Array.isArray(board.filterTips))
  assert.equal(board.meta.filterTipsEngine,ENGINE_ID)
  assert.equal(board.filterTips[0].engine,ENGINE_ID)
  assert.equal(board.filterTips[0].route,'straight-win')
  assert.ok(Number.isFinite(board.filterTips[0].filterScore))
  assert.ok(board.bestPicks.every(row=>row.engine!==ENGINE_ID))
})

test('straight win publishes a favourite priced 1.20 to 1.55 when it is the clear route',()=>{
  const result=diagnoseFilterFixture(fixture({marketOdds:winOnly()}))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'straight-win')
  assert.equal(result.pick.selection,'Home')
  assert.equal(result.pick.odds,1.35)
  const low=diagnoseFilterFixture(fixture({marketOdds:markets({homeWin:1.19,awayWin:8.00,over15:1.40,under35:1.20})}))
  assert.notEqual(low.pick?.route,'straight-win')
  const high=diagnoseFilterFixture(fixture({marketOdds:markets({homeWin:1.56,awayWin:4.00,over15:1.40,under35:1.20})}))
  assert.notEqual(high.pick?.route,'straight-win')
})

test('over 1.5 needs O1.5 under 1.30 and U3.5 over 1.39',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.22,under35:1.50}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'over-15')
  const miss=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.30,under35:1.50}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.notEqual(miss.pick?.route,'over-15')
})

test('under 3.5 needs U3.5 under 1.30 and O1.5 over 1.39',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.45,under35:1.22}),
    homeFixtures:venueRows(1,'home',homeUnder),
    awayFixtures:venueRows(2,'away',awayUnder)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'under-35')
})

test('over 2.5 needs O2.5 under 1.50 and U3.5 over 1.60',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.35,under35:1.70,over25:1.40}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'over-25')
})

test('under 2.5 needs U2.5 under 1.52 and O1.5 over 1.60',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.70,under35:1.40,under25:1.45}),
    homeFixtures:venueRows(1,'home',homeUnder),
    awayFixtures:venueRows(2,'away',awayUnder)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'under-25')
})

test('GG needs GG Yes under 1.50 and GG 2+ No over 1.30',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.35,under35:1.40,ggYes:1.40,gg2No:1.45}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'gg')
  assert.equal(result.pick.market,'both-teams-score')
  const miss=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.35,under35:1.40,ggYes:1.40,gg2No:1.30}),
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.notEqual(miss.pick?.route,'gg')
})

test('v2 skips a fixture when competing routes are too close instead of taking first match',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({
      homeWin:1.32,awayWin:8.00,over15:1.22,under35:1.70,over25:1.40,under25:1.45,ggYes:1.40,gg2No:1.45
    })
  }))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'low-market-separation')
  assert.ok(result.candidates.length>=2)
})

test('H2H and stats against the priced favourite skip only the straight-win route',()=>{
  const h2h=[
    {home:'Home FC',away:'Away FC',hs:0,as:2},
    {home:'Away FC',away:'Home FC',hs:2,as:0},
    {home:'Home FC',away:'Away FC',hs:1,as:1},
    {home:'Home FC',away:'Away FC',hs:0,as:1},
    {home:'Away FC',away:'Home FC',hs:3,as:1}
  ]
  const blocked=diagnoseFilterFixture(fixture({
    h2h,
    homeFixtures:venueRows(1,'home',weakAway),
    awayFixtures:venueRows(2,'away',strongHome),
    marketOdds:markets({homeWin:1.35,awayWin:8.00})
  }))
  assert.equal(blocked.skip,'fav-conflict')
  const next=diagnoseFilterFixture(fixture({
    h2h,
    homeFixtures:venueRows(1,'home',homeOver),
    awayFixtures:venueRows(2,'away',awayOver),
    marketOdds:markets({homeWin:1.35,awayWin:8.00,over15:1.22,under35:1.50})
  }))
  assert.equal(next.skip,null)
  assert.equal(next.pick.route,'over-15')
})

test('one or two H2H rows cannot overrule a strong current venue profile',()=>{
  const result=diagnoseFilterFixture(fixture({
    h2h:[{home:'Home FC',away:'Away FC',hs:0,as:2}],
    marketOdds:winOnly()
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'straight-win')
})

test('top five vs top five and bottom three vs bottom three are skipped',()=>{
  const top=diagnoseFilterFixture(fixture({homeSplit:{position:2,size:20,sampleReady:true},awaySplit:{position:4,size:20,sampleReady:true}}))
  assert.equal(top.skip,'both-top-five')
  const bottom=diagnoseFilterFixture(fixture({homeSplit:{position:19,size:20,sampleReady:true},awaySplit:{position:18,size:20,sampleReady:true}}))
  assert.equal(bottom.skip,'both-bottom-three')
})

test('early season and cup ties are still hard skips',()=>{
  assert.equal(diagnoseFilterFixture(fixture({earlySeason:true})).skip,'early-season')
  assert.equal(isCupCompetition('FA Cup'),true)
  assert.equal(isCupCompetition('UEFA Champions League'),true)
  assert.equal(isCupCompetition('Premier League'),false)
  assert.equal(diagnoseFilterFixture(fixture({league:'FA Cup'})).skip,'cup')
})

test('similar form vetoes the win route but does not automatically kill a supported goals route',()=>{
  const result=diagnoseFilterFixture(fixture({
    homeFixtures:venueRows(1,'home',evenForm),
    awayFixtures:venueRows(2,'away',evenForm),
    marketOdds:markets({homeWin:1.35,awayWin:8.00,over15:1.22,under35:1.50})
  }))
  assert.equal(result.skip,null)
  assert.equal(result.pick.route,'over-15')
  assert.ok(result.rejected.some(row=>row.route==='straight-win'&&row.reason==='similar-form-win'))
})

test('direction disagreement skips the market',()=>{
  const result=diagnoseFilterFixture(fixture({
    marketOdds:markets({homeWin:1.10,awayWin:8.00,over15:1.22,under35:1.70,over25:1.40}),
    homeFixtures:venueRows(1,'home',homeUnder),
    awayFixtures:venueRows(2,'away',awayOver)
  }))
  assert.equal(result.skip,'direction-disagree')
})

test('SportyBet market 60000 is GG 2+ No for the GG gate',()=>{
  const parsed=parseSportyBet([
    {id:29,name:'GG/NG',outcomes:[{desc:'Yes',odds:'1.40'},{desc:'No',odds:'2.80'}]},
    {id:60000,name:'GG/NG 2+',outcomes:[{desc:'Yes',odds:'3.10'},{desc:'No',odds:'1.45'}]},
    {id:18,name:'Over/Under',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.12'},{desc:'Under 1.5',odds:'6.00'}]}
  ])
  const by=Object.fromEntries(parsed.map(r=>[r.marketKey,r]))
  assert.equal(by['both-teams-score'].outcomes.find(o=>o.name==='Yes').odd,1.40)
  assert.equal(by['both-teams-score-2'].outcomes.find(o=>o.name==='No').odd,1.45)
  const odds=extractFilterOdds({marketOdds:parsed})
  assert.equal(odds.ggYes,1.40)
  assert.equal(odds.gg2No,1.45)
})

test('v2 extracts draw, team-total and goals-streak context when present',()=>{
  const odds=extractFilterOdds(fixture({marketOdds:markets({
    homeWin:1.35,drawWin:4.60,awayWin:8.00,homeO05:1.12,awayO05:1.55,homeO15:1.32,awayO15:2.10,streakYes:1.40
  })}))
  assert.equal(odds.drawWin,4.60)
  assert.equal(odds.homeO05,1.12)
  assert.equal(odds.awayO05,1.55)
  assert.equal(odds.streakYes,1.40)
})

test('filter board sorts published tips by kickoff',()=>{
  const board=buildFilterBoard([
    fixture({fixtureId:2,kickoff:'2026-08-27T20:00:00Z',marketOdds:winOnly()}),
    fixture({fixtureId:1,kickoff:'2026-08-27T16:00:00Z',marketOdds:winOnly()})
  ])
  assert.equal(board.bestPicks.length,2)
  assert.equal(board.bestPicks[0].fixtureId,1)
  assert.equal(board.meta.engine,ENGINE_ID)
  assert.equal(board.meta.filterVersion,'v2')
})
