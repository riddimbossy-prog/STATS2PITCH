import { buildBoard } from './engine.js'
import { parseStatsApiMarkets, mergeMarkets, canonicalOddsFromMarkets } from './statsApi.js'

const statsPayload={data:{bookmakers:[{
  name:'Pinnacle',
  match_odds:{home:{last_seen:1.45},draw:{last_seen:4.40},away:{last_seen:7.00}},
  total_goals:{over_1_5:{last_seen:1.18},under_1_5:{last_seen:4.90},over_2_5:{last_seen:1.72},under_2_5:{last_seen:2.10},over_3_5:{last_seen:2.62},under_3_5:{last_seen:1.47}},
  btts:{yes:{last_seen:1.85},no:{last_seen:1.95}},
  double_chance:{home_or_draw:{last_seen:1.10},home_or_away:{last_seen:1.20},draw_or_away:{last_seen:2.60}}
}]}}

const marketOdds=mergeMarkets(parseStatsApiMarkets(statsPayload))
const parsed=canonicalOddsFromMarkets(marketOdds)
if(parsed.home!==1.45||parsed.draw!==4.4||parsed.away!==7) throw new Error('Stats API 1X2 mapping failed')
if(parsed.over25!==1.72||parsed.under35!==1.47||parsed.bttsYes!==1.85) throw new Error('Stats API market mapping failed')
if(!marketOdds.some(m=>m.marketKey==='double-chance')) throw new Error('Expected additional market coverage')

const fixture={fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:new Date().toISOString(),kickoffLocal:'Today',marketOdds,odds:{...parsed},home:{id:1,name:'Alpha',position:1,leagueSize:12,ppg:2.3,goalsScored:2.4,goalsConceded:.7,winRate:80,lossRate:0,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80},away:{id:2,name:'Beta',position:12,leagueSize:12,ppg:.7,goalsScored:.8,goalsConceded:2.5,winRate:20,lossRate:80,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}}
const board=buildBoard([fixture],{fixturesScanned:1,generatedAt:new Date().toISOString()})
if(!board.groups.threePlus.length) throw new Error('Expected 3+ filter pick')
if(!board.oddsByFixture['1']?.length) throw new Error('Expected market prices on board')
if(!board.priority.some(p=>p.market==='O2.5'&&p.odds===1.72)) throw new Error('Expected real goal-market price on pick')
console.log(JSON.stringify({ok:true,filters:board.groups.threePlus[0].filterCount,markets:board.oddsByFixture['1'].length,over25:parsed.over25},null,2))
