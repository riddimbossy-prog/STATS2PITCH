import { buildBoard } from './engine.js'
import { buildVerifiedOdds } from './oddsV2.js'
import { leagueGamesPlayed, hasMinimumLeagueGames, MIN_LEAGUE_GAMES } from './stats.js'

const fixtureShape={
  teams:{home:{name:'Alpha'},away:{name:'Beta'}}
}

// Early-season gate: 9 league games must be rejected; 10 must be accepted.
const nineGameStandings=[
  {team:{id:1},all:{played:5}},
  {team:{id:2},all:{played:5}},
  {team:{id:3},all:{played:4}},
  {team:{id:4},all:{played:4}}
]
const tenGameStandings=[
  {team:{id:1},all:{played:5}},
  {team:{id:2},all:{played:5}},
  {team:{id:3},all:{played:5}},
  {team:{id:4},all:{played:5}}
]
if(leagueGamesPlayed(nineGameStandings)!==9) throw new Error('League game count failed for 9 games')
if(hasMinimumLeagueGames(nineGameStandings,MIN_LEAGUE_GAMES)) throw new Error('Early-season league with 9 games was not blocked')
if(leagueGamesPlayed(tenGameStandings)!==10) throw new Error('League game count failed for 10 games')
if(!hasMinimumLeagueGames(tenGameStandings,MIN_LEAGUE_GAMES)) throw new Error('League with 10 games should be allowed')
if(hasMinimumLeagueGames([],MIN_LEAGUE_GAMES)) throw new Error('Missing standings must not bypass early-season gate')

// Match the real TheStatsAPI layout used elsewhere in this project:
// bookmakers[].markets.match_odds / total_goals with last_seen/opening values.
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

const fixture={fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:new Date().toISOString(),kickoffLocal:'Today',marketOdds,odds:{...parsed},home:{id:1,name:'Alpha',position:1,leagueSize:12,ppg:2.3,goalsScored:2.4,goalsConceded:.7,winRate:80,lossRate:0,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80},away:{id:2,name:'Beta',position:12,leagueSize:12,ppg:.7,goalsScored:.8,goalsConceded:2.5,winRate:20,lossRate:80,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}}
const board=buildBoard([fixture],{fixturesScanned:1,generatedAt:new Date().toISOString()})
if(!board.groups.threePlus.length) throw new Error('Expected 3+ filter pick')
if(!board.oddsByFixture['1']?.length) throw new Error('Expected market prices on board')
if(!board.priority.some(p=>p.market==='O2.5'&&p.odds===1.72)) throw new Error('Expected verified Over 2.5 price on pick')

console.log(JSON.stringify({
  ok:true,
  earlySeasonGate:{minimum:MIN_LEAGUE_GAMES,rejects:9,allows:10},
  filters:board.groups.threePlus[0].filterCount,
  markets:board.oddsByFixture['1'].length,
  home:parsed.home,
  draw:parsed.draw,
  away:parsed.away,
  over15:parsed.over15,
  over25:parsed.over25,
  under35:parsed.under35
},null,2))