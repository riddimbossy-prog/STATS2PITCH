import { buildBoard } from './engine.js'
import { buildVerifiedOdds } from './oddsV2.js'
import { leagueGamesPlayed, leagueTotalCompletedGames, hasMinimumLeagueGames, MIN_LEAGUE_GAMES } from './stats.js'
import { filterMatureFixtures, snapshotHasStrictMaturityPolicy, EARLY_SEASON_POLICY } from './maturity.js'
import { selectMatureCandidates } from './enrich.js'

const fixtureShape={teams:{home:{name:'Alpha'},away:{name:'Beta'}}}

// A league must not pass until every team has played at least four league games.
const largeEarlyLeague=Array.from({length:18},(_,i)=>({team:{id:i+1},all:{played:2}}))
if(leagueTotalCompletedGames(largeEarlyLeague)!==18) throw new Error('Large-league total fixture calculation changed unexpectedly')
if(leagueGamesPlayed(largeEarlyLeague)!==2) throw new Error('League maturity must use the least-played team')
if(hasMinimumLeagueGames(largeEarlyLeague,MIN_LEAGUE_GAMES)) throw new Error('Two-round league incorrectly passed the four-game gate')

const oneTeamStillThree=[
  {team:{id:1},all:{played:4}},
  {team:{id:2},all:{played:4}},
  {team:{id:3},all:{played:3}},
  {team:{id:4},all:{played:4}}
]
const allTeamsFour=[
  {team:{id:1},all:{played:4}},
  {team:{id:2},all:{played:4}},
  {team:{id:3},all:{played:4}},
  {team:{id:4},all:{played:4}}
]
if(leagueGamesPlayed(oneTeamStillThree)!==3) throw new Error('Least-played team should report 3')
if(hasMinimumLeagueGames(oneTeamStillThree,MIN_LEAGUE_GAMES)) throw new Error('League with one team on 3 was not blocked')
if(leagueGamesPlayed(allTeamsFour)!==4) throw new Error('All-teams-four maturity value failed')
if(!hasMinimumLeagueGames(allTeamsFour,MIN_LEAGUE_GAMES)) throw new Error('League where every team has 4 should be allowed')
if(hasMinimumLeagueGames([],MIN_LEAGUE_GAMES)) throw new Error('Missing standings must not bypass early-season gate')

// Regression for the 595 scanned / 0 picks bug. The old implementation sliced
// the first N fixtures BEFORE maturity filtering. Here the first three fixtures
// are immature and the mature ones appear later. With max=2, both mature later
// fixtures must still be selected.
const preflightFixtures=[
  {fixture:{id:101},league:{id:1,season:2026,name:'Early A'}},
  {fixture:{id:102},league:{id:2,season:2026,name:'Early B'}},
  {fixture:{id:103},league:{id:3,season:2026,name:'Early C'}},
  {fixture:{id:201},league:{id:4,season:2026,name:'Mature A'}},
  {fixture:{id:202},league:{id:5,season:2026,name:'Mature B'}}
]
const standingsByLeague=new Map([
  [1,largeEarlyLeague],[2,largeEarlyLeague],[3,largeEarlyLeague],[4,allTeamsFour],[5,allTeamsFour]
])
const preflight=await selectMatureCandidates(preflightFixtures,async league=>standingsByLeague.get(league)||[],2)
if(preflight.selected.length!==2) throw new Error('Maturity-first candidate selection did not fill the enrichment cap')
if(preflight.selected[0].f.fixture.id!==201||preflight.selected[1].f.fixture.id!==202) throw new Error('Later mature fixtures were not reached after early-season skips')
if(preflight.earlySeasonSkipped!==3) throw new Error('Preflight early-season skip count is incorrect')

const statsPayload={data:{bookmakers:[
  {bookmaker:'Pinnacle',markets:{match_odds:{home:{last_seen:1.45},draw:{last_seen:4.40},away:{last_seen:7.00}},total_goals:{'1.5':{over:{last_seen:1.18},under:{last_seen:4.90}},'2.5':{over:{last_seen:1.72},under:{last_seen:2.10}},'3.5':{over:{last_seen:2.62},under:{last_seen:1.47}}},btts:{yes:{last_seen:1.85},no:{last_seen:1.95}},double_chance:{home_or_draw:{last_seen:1.10},home_or_away:{last_seen:1.20},draw_or_away:{last_seen:2.60}}}},
  {bookmaker:'Outlier Book',markets:{match_odds:{home:{last_seen:1.69},draw:{last_seen:5.20},away:{last_seen:9.50}},total_goals:{'2.5':{over:{last_seen:1.99},under:{last_seen:2.40}}}}}
]}}

const apiPayload=[{bookmakers:[{name:'Another Book',bets:[{name:'Match Winner',values:[{value:'Home',odd:'1.60'},{value:'Draw',odd:'4.80'},{value:'Away',odd:'8.20'}]},{name:'Goals Over/Under',values:[{value:'Over 2.5',odd:'1.90'},{value:'Under 2.5',odd:'2.20'}]}]}]}]

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

const strongHome={id:1,name:'Alpha',position:1,leagueSize:12,played:4,ppg:2.3,goalsScored:2.4,goalsConceded:.7,winRate:80,lossRate:0,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}
const weakAway={id:2,name:'Beta',position:12,leagueSize:12,played:4,ppg:.7,goalsScored:.8,goalsConceded:2.5,winRate:20,lossRate:80,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}
const fixture={fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:new Date().toISOString(),kickoffLocal:'Today',marketOdds,odds:{...parsed},leagueMinimumPlayed:4,earlySeasonEligible:true,home:strongHome,away:weakAway}
if(filterMatureFixtures([fixture]).length!==1) throw new Error('Mature fixture failed second gate')
const immatureFixture={...fixture,fixtureId:99,leagueMinimumPlayed:3,home:{...strongHome,played:3}}
if(filterMatureFixtures([immatureFixture]).length!==0) throw new Error('Immature fixture passed second gate')

const board=buildBoard(filterMatureFixtures([fixture]),{fixturesScanned:1,generatedAt:new Date().toISOString(),earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES})
if(!board.groups.threePlus.length) throw new Error('Expected 3+ filter pick')
if(!board.oddsByFixture['1']?.length) throw new Error('Expected market prices on board')
if(!board.priority.some(p=>p.market==='O2.5'&&p.odds===1.72)) throw new Error('Expected verified Over 2.5 price on pick')
if(board.priority.some(p=>!(Number.isFinite(p.odds)&&p.odds>1.001))) throw new Error('Published board contains an invalid price')
if(!snapshotHasStrictMaturityPolicy(board)) throw new Error('Fresh board missing four-game maturity policy marker')
if(snapshotHasStrictMaturityPolicy({...board,meta:{...board.meta,earlySeasonPolicy:'old-policy'}})) throw new Error('Legacy snapshot was accepted')

const unpricedFixture={...fixture,fixtureId:2,match:'Gamma vs Delta',marketOdds:[],odds:{home:null,draw:null,away:null,over15:null,under15:null,over25:null,under25:null,over35:null,under35:null},home:{...strongHome,id:3,name:'Gamma'},away:{...weakAway,id:4,name:'Delta'}}
const unpricedBoard=buildBoard(filterMatureFixtures([unpricedFixture]),{fixturesScanned:1,generatedAt:new Date().toISOString(),earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES})
if(unpricedBoard.priority.length!==0) throw new Error('Unpriced fixture was incorrectly published')

console.log(JSON.stringify({ok:true,earlySeasonGate:{minimumPerTeam:MIN_LEAGUE_GAMES,largeLeagueTotalFixtures:leagueTotalCompletedGames(largeEarlyLeague),largeLeagueLeastPlayed:leagueGamesPlayed(largeEarlyLeague),oneTeamOnThreeAllowed:false,allTeamsOnFourAllowed:true,policy:EARLY_SEASON_POLICY},maturityFirstSelection:{earlySkipped:preflight.earlySeasonSkipped,selected:preflight.selected.map(x=>x.f.fixture.id)},pricingPolicy:board.meta.pricingPolicy,unpricedFixturePublished:unpricedBoard.priority.length,filters:board.groups.threePlus[0].filterCount,home:parsed.home,draw:parsed.draw,away:parsed.away,over25:parsed.over25},null,2))