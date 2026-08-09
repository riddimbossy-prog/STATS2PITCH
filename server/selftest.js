import { buildBoard } from './engine.js'
import { buildVerifiedOdds } from './oddsV2.js'
import { leagueGamesPlayed, leagueTotalCompletedGames, hasMinimumLeagueGames, MIN_LEAGUE_GAMES } from './stats.js'
import { filterMatureFixtures, snapshotHasStrictMaturityPolicy, EARLY_SEASON_POLICY } from './maturity.js'

const fixtureShape={teams:{home:{name:'Alpha'},away:{name:'Beta'}}}

// This is the exact regression that previously slipped through: in a large
// league, only two rounds can already mean 18 total competition fixtures.
// That must NOT count as "10 games" for Stats2Pitch.
const largeEarlyLeague=Array.from({length:18},(_,i)=>({team:{id:i+1},all:{played:2}}))
if(leagueTotalCompletedGames(largeEarlyLeague)!==18) throw new Error('Large-league total fixture calculation changed unexpectedly')
if(leagueGamesPlayed(largeEarlyLeague)!==2) throw new Error('Strict league maturity must use the least-played team')
if(hasMinimumLeagueGames(largeEarlyLeague,MIN_LEAGUE_GAMES)) throw new Error('Two-round league incorrectly passed the 10-game gate')

const oneTeamStillNine=[
  {team:{id:1},all:{played:10}},
  {team:{id:2},all:{played:10}},
  {team:{id:3},all:{played:9}},
  {team:{id:4},all:{played:10}}
]
const allTeamsTen=[
  {team:{id:1},all:{played:10}},
  {team:{id:2},all:{played:10}},
  {team:{id:3},all:{played:10}},
  {team:{id:4},all:{played:10}}
]
if(leagueGamesPlayed(oneTeamStillNine)!==9) throw new Error('Least-played team should report 9')
if(hasMinimumLeagueGames(oneTeamStillNine,MIN_LEAGUE_GAMES)) throw new Error('League with one team on 9 was not blocked')
if(leagueGamesPlayed(allTeamsTen)!==10) throw new Error('All-teams-ten maturity value failed')
if(!hasMinimumLeagueGames(allTeamsTen,MIN_LEAGUE_GAMES)) throw new Error('League where every team has 10 should be allowed')
if(hasMinimumLeagueGames([],MIN_LEAGUE_GAMES)) throw new Error('Missing standings must not bypass early-season gate')

const statsPayload={data:{bookmakers:[
  {
    bookmaker:'Pinnacle',
    markets:{
      match_odds:{home:{last_seen:1.45},draw:{last_seen:4.40},away:{last_seen:7.00}},
      total_goals:{
        '1.5':{over:{last_seen:1.18},under:{last_seen:4.90}},
        '2.5':{over:{last_seen:1.72},under:{last_seen:2.10}},
        '3.5':{over:{last_seen:2.62},under:{last_seen:1.47}}
      },
      btts:{yes:{last_seen:1.85},no:{last_seen:1.95}},
      double_chance:{home_or_draw:{last_seen:1.10},home_or_away:{last_seen:1.20},draw_or_away:{last_seen:2.60}}
    }
  },
  {
    bookmaker:'Outlier Book',
    markets:{
      match_odds:{home:{last_seen:1.69},draw:{last_seen:5.20},away:{last_seen:9.50}},
      total_goals:{'2.5':{over:{last_seen:1.99},under:{last_seen:2.40}}}
    }
  }
]}}

const apiPayload=[{
  bookmakers:[{
    name:'Another Book',
    bets:[
      {name:'Match Winner',values:[{value:'Home',odd:'1.60'},{value:'Draw',odd:'4.80'},{value:'Away',odd:'8.20'}]},
      {name:'Goals Over/Under',values:[{value:'Over 2.5',odd:'1.90'},{value:'Under 2.5',odd:'2.20'}]}
    ]
  }]
}]

const verified=buildVerifiedOdds({apiPayload,statsPayload,fixture:fixtureShape})
const marketOdds=verified.marketOdds
const parsed=verified.canonical

if(parsed.home!==1.45||parsed.draw!==4.4||parsed.away!==7) throw new Error('Bookmaker-consistent 1X2 selection failed')
if(parsed.over15!==1.18||parsed.under15!==4.9) throw new Error('Nested 1.5 total-goals parsing failed')
if(parsed.over25!==1.72||parsed.under25!==2.1) throw new Error('Nested 2.5 total-goals parsing failed')
if(parsed.over35!==2.62||parsed.under35!==1.47) throw new Error('Nested 3.5 total-goals parsing failed')
if(parsed.bttsYes!==1.85||parsed.bttsNo!==1.95) throw new Error('BTTS mapping failed')
if(!marketOdds.some(m=>m.marketKey==='double-chance')) throw new Error('Expected double-chance coverage')
if(parsed.home===1.69||parsed.over25===1.99) throw new Error('Odds were incorrectly maxed across bookmakers')

const strongHome={id:1,name:'Alpha',position:1,leagueSize:12,played:10,ppg:2.3,goalsScored:2.4,goalsConceded:.7,winRate:80,lossRate:0,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}
const weakAway={id:2,name:'Beta',position:12,leagueSize:12,played:10,ppg:.7,goalsScored:.8,goalsConceded:2.5,winRate:20,lossRate:80,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}
const fixture={fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:new Date().toISOString(),kickoffLocal:'Today',marketOdds,odds:{...parsed},leagueMinimumPlayed:10,earlySeasonEligible:true,home:strongHome,away:weakAway}

if(filterMatureFixtures([fixture]).length!==1) throw new Error('Mature fixture failed second gate')
const immatureFixture={...fixture,fixtureId:99,leagueMinimumPlayed:9,home:{...strongHome,played:9}}
if(filterMatureFixtures([immatureFixture]).length!==0) throw new Error('Immature fixture passed second gate')

const board=buildBoard(filterMatureFixtures([fixture]),{fixturesScanned:1,generatedAt:new Date().toISOString(),earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES})
if(!board.groups.threePlus.length) throw new Error('Expected 3+ filter pick')
if(!board.oddsByFixture['1']?.length) throw new Error('Expected market prices on board')
if(!board.priority.some(p=>p.market==='O2.5'&&p.odds===1.72)) throw new Error('Expected verified Over 2.5 price on pick')
if(board.priority.some(p=>!(Number.isFinite(p.odds)&&p.odds>1.001))) throw new Error('Published board contains an invalid price')
if(!snapshotHasStrictMaturityPolicy(board)) throw new Error('Fresh board missing strict maturity policy marker')
if(snapshotHasStrictMaturityPolicy({...board,meta:{...board.meta,earlySeasonPolicy:'old-policy'}})) throw new Error('Legacy snapshot was accepted')

// Regression for the screenshot odds bug: strong stats with no bookmaker price
// still must not appear.
const unpricedFixture={...fixture,fixtureId:2,match:'Gamma vs Delta',marketOdds:[],odds:{home:null,draw:null,away:null,over15:null,under15:null,over25:null,under25:null,over35:null,under35:null},home:{...strongHome,id:3,name:'Gamma'},away:{...weakAway,id:4,name:'Delta'}}
const unpricedBoard=buildBoard(filterMatureFixtures([unpricedFixture]),{fixturesScanned:1,generatedAt:new Date().toISOString(),earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES})
if(unpricedBoard.priority.length!==0) throw new Error('Unpriced fixture was incorrectly published')
if(unpricedBoard.groups.single.length||unpricedBoard.groups.two.length||unpricedBoard.groups.threePlus.length) throw new Error('Unpriced fixture reached a filter group')

console.log(JSON.stringify({
  ok:true,
  earlySeasonGate:{
    minimumPerTeam:MIN_LEAGUE_GAMES,
    largeLeagueTotalFixtures:leagueTotalCompletedGames(largeEarlyLeague),
    largeLeagueLeastPlayed:leagueGamesPlayed(largeEarlyLeague),
    oneTeamOnNineAllowed:false,
    allTeamsOnTenAllowed:true,
    policy:EARLY_SEASON_POLICY
  },
  pricingPolicy:board.meta.pricingPolicy,
  unpricedFixturePublished:unpricedBoard.priority.length,
  filters:board.groups.threePlus[0].filterCount,
  markets:board.oddsByFixture['1'].length,
  home:parsed.home,
  draw:parsed.draw,
  away:parsed.away,
  over15:parsed.over15,
  over25:parsed.over25,
  under35:parsed.under35
},null,2))
