import { buildBoard } from './engine.js'
const fixture={fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:new Date().toISOString(),kickoffLocal:'Today',odds:{home:1.45,draw:4.4,away:7.0},home:{id:1,name:'Alpha',position:1,leagueSize:12,ppg:2.3,goalsScored:2.4,goalsConceded:.7,winRate:80,lossRate:0,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80},away:{id:2,name:'Beta',position:12,leagueSize:12,ppg:.7,goalsScored:.8,goalsConceded:2.5,winRate:20,lossRate:80,over15:80,under15:20,over25:60,under25:40,over35:20,under35:80}}
const board=buildBoard([fixture],{fixturesScanned:1,generatedAt:new Date().toISOString()})
if(!board.groups.threePlus.length) throw new Error('Expected 3+ filter pick')
console.log(JSON.stringify(board,null,2))
