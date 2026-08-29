import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ENGINE_ID,
  classifyMatch,
  decideGoalsBanker,
  extractGoalsBankerOdds,
  diagnoseGoalsBankerFixture,
  canAddAccaLeg,
  buildGoalsBankerBoard
} from '../server/goalsBankersEngine.js'
import {evaluateTwoInARowMarket} from '../server/goalsBankersV3.js'
import {buildBoard} from '../server/engine.js'

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

function markets({
  streak=1.22,homeWin=1.30,awayWin=8.50,draw=5.00,over25=1.70,bttsYes=1.90,
  homeO15=1.35,awayO15=2.20,homeO25=1.95,awayO25=2.40,homeO05=1.45,awayO05=1.78
}={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let found=rows.find(row=>row.marketKey===marketKey)
    if(!found){found={marketKey,market,outcomes:[]};rows.push(found)}
    found.outcomes.push({name,odd:Number(odd)})
  }
  add('goals-streak-2','Goals Streak 2+','Yes',streak)
  add('match-winner','Match winner','Home',homeWin)
  add('match-winner','Match winner','Away',awayWin)
  add('match-winner','Match winner','Draw',draw)
  add('total-goals','Total goals','Over 2.5',over25)
  add('both-teams-score','Both teams to score','Yes',bttsYes)
  add('home-team-goals','Home team goals','Over 1.5',homeO15)
  add('away-team-goals','Away team goals','Over 1.5',awayO15)
  add('home-team-goals','Home team goals','Over 2.5',homeO25)
  add('away-team-goals','Away team goals','Over 2.5',awayO25)
  add('home-team-goals','Home team goals','Over 0.5',homeO05)
  add('away-team-goals','Away team goals','Over 0.5',awayO05)
  return rows
}

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||401,
    league:overrides.league||'Test League',
    country:overrides.country||'England',
    kickoff:overrides.kickoff||'2026-08-28T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:venueRows(1,'home',[[2,0],[3,1],[2,1],[2,0],[3,0]])},
    away:{id:2,name:'Away FC',logo:null,fixtures:venueRows(2,'away',[[0,2],[1,2],[0,1],[0,2],[1,3]])},
    homeSplit:{position:4,size:20,sampleReady:true,ppg:2.2,played:5,venue:'home'},
    awaySplit:{position:16,size:20,sampleReady:true,ppg:0.6,played:5,venue:'away'},
    earlySeason:false,
    statsReady:true,
    marketOdds:overrides.marketOdds||markets(overrides.odds||{})
  }
}

function odds(partial={}){
  return{
    favourite:'home',
    fav_odds:1.30,
    opp_odds:8.00,
    draw_odds:5.00,
    over25:1.70,
    btts_yes:1.90,
    fav_2plus:1.35,
    fav_tt_over25:1.95,
    opp_tt_over05:1.78,
    streak_yes:1.22,
    ...partial
  }
}

function decide(partial){
  return decideGoalsBanker(odds(partial))
}

test('engine id is goals-bankers-v3',()=>{
  assert.equal(ENGINE_ID,'goals-bankers-v3')
})

test('streak gate skips outside 1.10-1.50 inclusive and never publishes streak',()=>{
  assert.equal(decide({streak_yes:null}).route,'SKIP')
  assert.equal(decide({streak_yes:1.09}).route,'SKIP')
  assert.equal(decide({streak_yes:1.51}).route,'SKIP')
  assert.notEqual(decide({streak_yes:1.10}).route,'SKIP')
  assert.notEqual(decide({streak_yes:1.40}).route,'SKIP')
  assert.notEqual(decide({streak_yes:1.50}).route,'SKIP')
  const pick=diagnoseGoalsBankerFixture(fixture()).pick
  assert.ok(pick)
  assert.notEqual(pick.market,'goals-streak-2')
  assert.notEqual(pick.route,'STREAK')
  assert.equal(pick.engine,ENGINE_ID)
  assert.equal(pick.oddsBook?.streak_yes,undefined)
  assert.equal(pick.streakUsedAsFilter,undefined)
  assert.doesNotMatch(String(pick.reason||''),/streak|first-match|2-in-a-row/i)
  assert.doesNotMatch(JSON.stringify(pick.reasons||[]),/streak|first-match|2-in-a-row/i)
})

test('classify uses mismatch / strong / lean / balanced then balanced-goals override',()=>{
  assert.equal(classifyMatch(odds({fav_odds:1.40,opp_odds:5.00})),'MISMATCH')
  assert.equal(classifyMatch(odds({fav_odds:1.55,opp_odds:3.80,over25:1.90,btts_yes:1.90})),'STRONG')
  assert.equal(classifyMatch(odds({fav_odds:1.80,opp_odds:3.50,over25:1.90,btts_yes:1.90})),'LEAN')
  assert.equal(classifyMatch(odds({fav_odds:1.81,opp_odds:3.50})),'BALANCED')
  assert.equal(classifyMatch(odds({fav_odds:1.50,opp_odds:4.00,btts_yes:1.70,over25:1.65})),'BALANCED_GOALS')
  assert.equal(classifyMatch(odds({fav_odds:1.30,opp_odds:6.00,btts_yes:1.60,over25:1.50})),'MISMATCH')
})

test('V3 domination publishes 2+ or win, not GG',()=>{
  const r=decide({})
  assert.ok(r.route==='FAV_2PLUS'||r.route==='FAV_WIN')
  assert.equal(r.v3.matchShape,'FAV_DOMINATION')
  assert.equal(r.v3.eligibleMarkets.includes('GG'),false)
})

test('live underdog does not auto-ban GG',()=>{
  const r=evaluateTwoInARowMarket(odds({
    fav_odds:1.28,draw_odds:5.4,opp_odds:7,fav_2plus:1.4,
    fav_tt_over25:1.98,opp_tt_over05:1.45,over25:1.55,btts_yes:1.52
  }))
  assert.equal(r.contradictions.includes('WEAK_RESULT_LIVE_GOAL_THREAT'),true)
  assert.notEqual(r.scores.GG,null)
})

test('mismatch with live opponent keeps GG eligible',()=>{
  const r=evaluateTwoInARowMarket(odds({
    fav_odds:1.33,draw_odds:5,opp_odds:8,fav_2plus:1.45,
    fav_tt_over25:2.05,opp_tt_over05:1.48,over25:1.62,btts_yes:1.5
  }))
  assert.equal(r.matchType,'MISMATCH')
  assert.ok(r.eligibleMarkets.includes('GG'))
})

test('result control with weak scoring publishes FAV_WIN',()=>{
  assert.equal(decide({
    fav_odds:1.3,draw_odds:5.1,opp_odds:7.2,fav_2plus:1.7,
    fav_tt_over25:2.5,opp_tt_over05:1.85,over25:1.9,btts_yes:2.1
  }).route,'FAV_WIN')
})

test('close Over vs GG is SKIP when separation is 5 or less',()=>{
  const r=evaluateTwoInARowMarket(odds({
    fav_odds:1.29,draw_odds:5.6,opp_odds:7,fav_2plus:1.38,
    fav_tt_over25:1.9,opp_tt_over05:1.45,over25:1.5,btts_yes:1.5
  }))
  if(r.finalPick==='SKIP'){
    assert.ok(['LOW_MARKET_SEPARATION','BELOW_FLOOR','CONFLICT_NO_CONFIRMATION'].includes(r.reasonCode))
  }else if(r.separation!==null&&r.separation<=5){
    assert.fail('published a pick with separation <= 5')
  }
})

test('never invents odds — missing team totals skip',()=>{
  assert.equal(decide({fav_tt_over25:null}).skip,'missing-odds')
  assert.equal(decide({opp_tt_over05:null}).skip,'missing-odds')
})

test('Why copy explains the published market against the other three',()=>{
  const two=diagnoseGoalsBankerFixture(fixture({odds:{streak:1.22,homeWin:1.28,awayWin:8.00,over25:1.90,bttsYes:1.90,homeO15:1.32,awayO15:2.10,homeO25:1.92,awayO05:1.78}})).pick
  assert.equal(two.route,'FAV_2PLUS')
  const twoBlob=two.reasons.join(' ')
  assert.match(twoBlob,/2\+/)
  assert.match(twoBlob,/Favourite win/)
  assert.match(twoBlob,/Over 2\.5/)
  assert.match(twoBlob,/GG/)
  assert.match(twoBlob,/passed over/i)
  assert.match(twoBlob,/V3 banker/)
  assert.doesNotMatch(twoBlob,/streak|first-match|2-in-a-row|MISMATCH|BALANCED/i)

  const win=diagnoseGoalsBankerFixture(fixture({odds:{streak:1.22,homeWin:1.30,awayWin:8.50,draw:5.2,over25:1.92,bttsYes:2.15,homeO15:1.70,awayO15:2.20,homeO25:2.50,awayO05:1.88}})).pick
  assert.equal(win.route,'FAV_WIN')
  const winBlob=win.reasons.join(' ')
  assert.match(winBlob,/Favourite win|V3 banker/)
  assert.match(winBlob,/Favourite 2\+|2\+/)
  assert.match(winBlob,/Over 2\.5/)
  assert.match(winBlob,/GG/)
  assert.match(winBlob,/passed over/i)
})

test('fixture packs favourite 2+ as team Over 1.5, never the streak price',()=>{
  const home=diagnoseGoalsBankerFixture(fixture({odds:{streak:1.22,homeWin:1.28,awayWin:8.00,over25:1.90,bttsYes:1.90,homeO15:1.32,awayO15:2.10,homeO25:1.92,awayO05:1.78}})).pick
  assert.equal(home.route,'FAV_2PLUS')
  assert.equal(home.market,'home-team-goals')
  assert.equal(home.selection,'Over 1.5')
  assert.equal(home.odds,1.32)
  assert.notEqual(home.odds,1.22)
  const awayFix=fixture({odds:{streak:1.22,homeWin:8.00,awayWin:1.28,over25:1.90,bttsYes:1.90,homeO15:2.10,awayO15:1.32,awayO25:1.92,homeO05:1.78}})
  awayFix.home.fixtures=venueRows(1,'home',[[0,2],[1,2],[0,1],[0,2],[1,3]])
  awayFix.away.fixtures=venueRows(2,'away',[[2,0],[3,1],[2,1],[2,0],[3,0]])
  const away=diagnoseGoalsBankerFixture(awayFix).pick
  assert.equal(away.route,'FAV_2PLUS')
  assert.equal(away.favourite,'away')
  assert.equal(away.market,'away-team-goals')
  assert.equal(away.selection,'Over 1.5')
  assert.equal(away.odds,1.32)
})

test('board builder attaches Goals Bankers separately from All Picks and VAR',()=>{
  const row=fixture({odds:{streak:1.22,homeWin:1.28,awayWin:8.00,over25:1.90,bttsYes:1.90,homeO15:1.32,homeO25:1.92,awayO05:1.78}})
  const isolated=buildGoalsBankerBoard([row])
  assert.equal(isolated.meta.engine,ENGINE_ID)
  assert.equal(isolated.bestPicks.length,1)
  assert.equal(isolated.meta.streakFilter,undefined)
  const board=buildBoard([row])
  assert.ok(Array.isArray(board.goalsBankers))
  assert.equal(board.meta.goalsBankersEngine,ENGINE_ID)
  assert.equal(board.goalsBankers[0].engine,ENGINE_ID)
  assert.notEqual(board.goalsBankers[0].market,'goals-streak-2')
  assert.ok((board.bestPicks||[]).every(item=>item.engine!==ENGINE_ID))
  assert.ok((board.varTips||[]).every(item=>item.engine!==ENGINE_ID))
})

test('acca rules: max 3, max one FAV_WIN, goals leg on 3, no second borderline lean',()=>{
  const win={fixtureId:1,route:'FAV_WIN',classification:'MISMATCH',odds:1.30}
  const two={fixtureId:2,route:'FAV_2PLUS',classification:'STRONG',odds:1.32}
  const over={fixtureId:3,route:'OVER_2.5',classification:'LEAN',borderline:true,odds:1.50}
  const gg={fixtureId:4,route:'GG',classification:'BALANCED',odds:1.65}
  const lean2={fixtureId:5,route:'OVER_2.5',classification:'LEAN',borderline:true,odds:1.52}
  const strong={fixtureId:6,route:'FAV_2PLUS',classification:'STRONG',odds:1.40}
  assert.equal(canAddAccaLeg([win,two],over).ok,true)
  assert.equal(canAddAccaLeg([win,two,over],gg).ok,false)
  assert.equal(canAddAccaLeg([win],{...win,fixtureId:9,route:'FAV_WIN'}).ok,false)
  assert.equal(canAddAccaLeg([win,two],{fixtureId:8,route:'FAV_2PLUS',classification:'STRONG'}).reason,'need-goals-leg')
  assert.equal(canAddAccaLeg([over],lean2).ok,false)
  assert.equal(canAddAccaLeg([over],strong).ok,false)
  assert.equal(canAddAccaLeg([],over).ok,true)
  assert.equal(canAddAccaLeg([gg,two],win).ok,true)
  assert.equal(canAddAccaLeg([],{fixtureId:7,route:'FAV_WIN',market:'goals-streak-2'}).ok,false)
})

test('extractOdds maps favourite 2+, team totals and streak filter inputs',()=>{
  const book=extractGoalsBankerOdds(fixture({odds:{streak:1.18,homeWin:1.25,awayWin:9.00,draw:5.5,over25:1.88,bttsYes:1.92,homeO15:1.40,awayO15:2.20,homeO25:1.98,awayO05:1.74}}))
  assert.equal(book.favourite,'home')
  assert.equal(book.fav_odds,1.25)
  assert.equal(book.opp_odds,9.00)
  assert.equal(book.fav_2plus,1.40)
  assert.equal(book.fav_tt_over25,1.98)
  assert.equal(book.opp_tt_over05,1.74)
  assert.equal(book.streak_yes,1.18)
  assert.equal(book.over25,1.88)
})
