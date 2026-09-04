import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ENGINE_ID,
  extractGoalsBankerOdds,
  diagnoseGoalsBankerFixture,
  canAddAccaLeg,
  buildGoalsBankerBoard
} from '../server/goalsBankersEngine.js'
import {V5_RULES,evaluateTwoInARowMarket} from '../server/goalsBankersV5.js'
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
  streak=1.22,homeWin=1.50,awayWin=6.50,homeDnb=1.20,awayDnb=2.50,draw=4.40,
  over25=1.72,bttsYes=1.90,homeO05=1.18,awayO05=1.70,
  homeO15=1.40,awayO15=2.30,homeO25=2.10,awayO25=3.20
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
  add('draw-no-bet','Draw no bet','Home',homeDnb)
  add('draw-no-bet','Draw no bet','Away',awayDnb)
  add('total-goals','Total goals','Over 2.5',over25)
  add('both-teams-score','Both teams to score','Yes',bttsYes)
  add('home-team-goals','Home team goals','Over 0.5',homeO05)
  add('home-team-goals','Home team goals','Over 1.5',homeO15)
  add('home-team-goals','Home team goals','Over 2.5',homeO25)
  add('away-team-goals','Away team goals','Over 0.5',awayO05)
  add('away-team-goals','Away team goals','Over 1.5',awayO15)
  add('away-team-goals','Away team goals','Over 2.5',awayO25)
  return rows
}

function fixture(overrides={}){
  return{
    fixtureId:overrides.fixtureId||401,
    league:overrides.league||'Test League',
    country:'England',
    kickoff:'2026-09-04T18:00:00Z',
    home:{id:1,name:'Home FC',logo:null,fixtures:venueRows(1,'home',[[2,0],[3,1],[2,1],[2,0],[3,0]])},
    away:{id:2,name:'Away FC',logo:null,fixtures:venueRows(2,'away',[[0,2],[1,2],[0,1],[0,2],[1,3]])},
    homeSplit:overrides.homeSplit||{position:2,size:20,sampleReady:true,ppg:2.2,played:5,venue:'home'},
    awaySplit:overrides.awaySplit||{position:12,size:20,sampleReady:true,ppg:0.6,played:5,venue:'away'},
    homeStanding:overrides.homeStanding||{position:2,size:20},
    awayStanding:overrides.awayStanding||{position:12,size:20},
    earlySeason:false,
    statsReady:true,
    marketOdds:overrides.marketOdds||markets(overrides.odds||{})
  }
}

function diagnosed(overrides={}){return diagnoseGoalsBankerFixture(fixture(overrides))}

function raw(extra={}){
  return{
    favourite:'home',homeWin:1.50,awayWin:6.50,homeDnb:1.20,awayDnb:2.50,
    fav_odds:1.50,opp_odds:6.50,draw_odds:3.60,over25:1.72,btts_yes:1.70,
    homeO05:1.25,awayO05:1.30,homeO15:1.40,awayO15:2.30,homeO25:2.30,awayO25:3.20,
    fav_2plus:1.40,fav_tt_over25:2.30,opp_tt_over05:1.30,streak_yes:1.22,
    ...extra
  }
}

test('Goals Bankers V5 is active and publishes exact rule metadata',()=>{
  assert.equal(ENGINE_ID,'goals-bankers-v5')
  const board=buildGoalsBankerBoard([fixture()])
  assert.equal(board.meta.engine,ENGINE_ID)
  assert.deepEqual(board.meta.rules,V5_RULES)
  assert.deepEqual(board.meta.publishedRoutes,['FAV_WIN','FAV_DNB','FAV_2PLUS','OVER_2.5','GG'])
})

test('home entry requires Home Team Over 2.5 at 2.10 or below',()=>{
  assert.equal(diagnosed({odds:{homeO25:2.10}}).route,'FAV_WIN')
  const rejected=diagnosed({odds:{homeO25:2.11,awayO15:2.11}})
  assert.equal(rejected.pick,null)
  assert.equal(rejected.skip,'entry-filter')
})

test('home win needs odds below 1.58, 2.0 venue PPG, and away Over 0.5 above 1.60',()=>{
  assert.equal(diagnosed({odds:{homeWin:1.57,awayO05:1.61},homeSplit:{position:2,size:20,ppg:2.0,played:5}}).route,'FAV_WIN')
  assert.equal(diagnosed({odds:{homeWin:1.58,awayO05:1.61}}).route,'FAV_2PLUS')
  assert.equal(diagnosed({odds:{homeWin:1.57,awayO05:1.61},homeSplit:{position:2,size:20,ppg:1.99,played:5}}).route,'FAV_2PLUS')
  assert.equal(diagnosed({odds:{homeWin:1.57,awayO05:1.60}}).route,'FAV_2PLUS')
})

test('home falls back to team 2+ unless away Over 0.5 is at most 1.50',()=>{
  const two=diagnosed({odds:{homeWin:1.58,awayO05:1.51}}).pick
  assert.equal(two.route,'FAV_2PLUS')
  assert.equal(two.market,'home-team-goals')
  assert.equal(two.selection,'Over 1.5')
  const over=diagnosed({odds:{homeWin:1.58,awayO05:1.50}}).pick
  assert.equal(over.route,'OVER_2.5')
  assert.equal(over.market,'total-goals')
})

test('away entry mirrors the win and 2+ rules using Away Team Over 1.5 at 2.10 or below',()=>{
  const base={
    homeStanding:{position:12,size:20},awayStanding:{position:2,size:20},
    homeSplit:{position:12,size:20,ppg:0.6,played:5},awaySplit:{position:2,size:20,ppg:2.0,played:5}
  }
  assert.equal(diagnosed({...base,odds:{homeWin:6.50,awayWin:1.57,homeO25:2.30,awayO15:2.10,homeO05:1.61}}).route,'FAV_WIN')
  const rejected=diagnosed({...base,odds:{homeWin:6.50,awayWin:1.57,homeO25:2.30,awayO15:2.11,homeO05:1.61}})
  assert.equal(rejected.skip,'entry-filter')
})

test('away only chooses Over 2.5 when weaker home Over 0.5 is at most 1.30',()=>{
  const base={
    homeStanding:{position:12,size:20},awayStanding:{position:2,size:20},
    homeSplit:{position:12,size:20,ppg:0.6,played:5},awaySplit:{position:2,size:20,ppg:1.8,played:5}
  }
  assert.equal(diagnosed({...base,odds:{homeWin:6.50,awayWin:1.65,homeO25:2.30,awayO15:2.10,homeO05:1.30,awayO05:1.45,draw:3.40}}).route,'OVER_2.5')
  const two=diagnosed({...base,odds:{homeWin:6.50,awayWin:1.65,homeO25:2.30,awayO15:2.10,homeO05:1.31,awayO05:1.45,draw:3.40}}).pick
  assert.equal(two.route,'FAV_2PLUS')
  assert.equal(two.market,'away-team-goals')
  assert.equal(two.odds,2.10)
})

test('a qualified result outside the overall Top 3 is downgraded to DNB',()=>{
  const pick=diagnosed({homeStanding:{position:4,size:20},awayStanding:{position:12,size:20},odds:{homeDnb:1.24}}).pick
  assert.equal(pick.route,'FAV_DNB')
  assert.equal(pick.market,'draw-no-bet')
  assert.equal(pick.selection,'Home')
  assert.equal(pick.odds,1.24)
})

test('overall Top 5 clashes and Bottom 3 clashes are skipped',()=>{
  assert.equal(diagnosed({homeStanding:{position:2,size:20},awayStanding:{position:5,size:20}}).skip,'both-top-five')
  assert.equal(diagnosed({homeStanding:{position:18,size:20},awayStanding:{position:20,size:20}}).skip,'both-bottom-three')
})

test('two mid-table teams force goals even when result odds clear the win gate',()=>{
  const result=diagnosed({homeStanding:{position:7,size:20},awayStanding:{position:10,size:20}})
  assert.equal(result.route,'FAV_2PLUS')
  assert.equal(result.v3.midTableOverride,true)
})

test('GG keeps the old decision and adds balanced O0.5, 1.30, and Draw 3.60 gates',()=>{
  const standingFixture=fixture({homeStanding:{position:6,size:20},awayStanding:{position:15,size:20}})
  const legacy={finalPick:'GG',matchType:'BALANCED_GOALS',capabilities:null}
  assert.equal(evaluateTwoInARowMarket(raw(),{fixture:standingFixture,legacyDecision:legacy}).finalPick,'GG')
  assert.equal(evaluateTwoInARowMarket(raw({draw_odds:3.59}),{fixture:standingFixture,legacyDecision:legacy}).finalPick,'SKIP')
  assert.equal(evaluateTwoInARowMarket(raw({awayO05:1.31}),{fixture:standingFixture,legacyDecision:legacy}).finalPick,'SKIP')
  assert.equal(evaluateTwoInARowMarket(raw({homeO05:1.19,awayO05:1.30}),{fixture:standingFixture,legacyDecision:legacy}).finalPick,'SKIP')
  assert.equal(evaluateTwoInARowMarket(raw(),{fixture:standingFixture,legacyDecision:{finalPick:'FAV_WIN'}}).finalPick,'SKIP')
})

test('the old streak market is not a V5 entry gate or published market',()=>{
  const pick=diagnosed({odds:{streak:null}}).pick
  assert.ok(pick)
  assert.notEqual(pick.market,'goals-streak-2')
  assert.equal(pick.engine,ENGINE_ID)
})

test('missing exact route odds fail closed with a specific diagnostic',()=>{
  const result=diagnosed({homeStanding:{position:4,size:20},odds:{homeDnb:null}})
  assert.equal(result.pick,null)
  assert.equal(result.skip,'missing-dnb-odds')
})

test('odds extraction includes DNB and all V5 team-total inputs',()=>{
  const book=extractGoalsBankerOdds(fixture({odds:{homeDnb:1.24,awayDnb:2.70}}))
  assert.equal(book.favourite,'home')
  assert.equal(book.homeDnb,1.24)
  assert.equal(book.awayDnb,2.70)
  assert.equal(book.homeO25,2.10)
  assert.equal(book.awayO15,2.30)
  assert.equal(book.homeO05,1.18)
  assert.equal(book.awayO05,1.70)
})

test('board builder attaches V5 separately and exposes DNB',()=>{
  const dnb=fixture({homeStanding:{position:4,size:20},odds:{homeDnb:1.24}})
  const isolated=buildGoalsBankerBoard([dnb])
  assert.equal(isolated.bestPicks[0].route,'FAV_DNB')
  const board=buildBoard([dnb])
  assert.equal(board.meta.goalsBankersEngine,ENGINE_ID)
  assert.equal(board.goalsBankers[0].engine,ENGINE_ID)
  assert.ok((board.bestPicks||[]).every(item=>item.engine!==ENGINE_ID))
  assert.ok((board.varTips||[]).every(item=>item.engine!==ENGINE_ID))
})

test('slips allow only one result leg across win and DNB',()=>{
  const win={fixtureId:1,route:'FAV_WIN',classification:'V5_RESULT_CONTROL'}
  const dnb={fixtureId:2,route:'FAV_DNB',classification:'V5_RESULT_CONTROL'}
  const over={fixtureId:3,route:'OVER_2.5',classification:'V5_GOALS_FALLBACK'}
  const two={fixtureId:4,route:'FAV_2PLUS',classification:'V5_GOALS_FALLBACK'}
  assert.equal(canAddAccaLeg([win],dnb).reason,'max-1-result')
  assert.equal(canAddAccaLeg([dnb],win).reason,'max-1-result')
  assert.equal(canAddAccaLeg([win,two],over).ok,true)
})
