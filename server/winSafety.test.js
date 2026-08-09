import { applyWinSafety } from './winSafety.js'
import { mergeLifecycleBoard } from './lifecycle.js'

const row=(overrides={})=>({fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:'2026-08-09T18:00:00Z',kickoffLocal:'09 Aug, 18:00',selectedTeamId:1,selectedTeam:'Alpha',opponentTeamId:2,opponentTeam:'Beta',odds:2.40,drawOdds:3.30,market:'1X2',filterCount:3,contradiction:'LOW',score:3,filters:['A','B','C'],filterCodes:['A','B','C'],negativeSignals:[],negativeSignalCodes:[],...overrides})
const board=r=>({meta:{},groups:{single:[],two:[],threePlus:r?[r]:[]},priority:r?[r]:[],oddsByFixture:{},availableMarkets:[]})
const fixture=(overrides={})=>({fixtureId:1,home:{id:1,name:'Alpha',winRate:40,position:4,leagueSize:10,goalsConceded:1},away:{id:2,name:'Beta',winRate:20,position:6,leagueSize:10,goalsConceded:1.2},marketOdds:[{marketKey:'draw-no-bet',outcomes:[{name:'Home',odd:1.72},{name:'Away',odd:2.30}]},{marketKey:'double-chance',outcomes:[{name:'Home or draw',odd:1.34},{name:'Draw or away',odd:1.68}]}],...overrides})

let out=applyWinSafety(board(row()),[fixture()])
if(out.priority.length!==1||out.priority[0].market!=='DNB'||out.priority[0].odds!==1.72)throw new Error('Under-60 favourite above 2.00 must downgrade to DNB first')

out=applyWinSafety(board(row({odds:1.85})),[fixture()])
if(out.priority.length!==0)throw new Error('Under-60 full-time win at 2.00 or below must be blocked without an exception')

out=applyWinSafety(board(row()),[fixture({away:{id:2,name:'Beta',winRate:20,position:10,leagueSize:10,goalsConceded:1.2}})])
if(out.priority[0]?.market!=='1X2')throw new Error('Last-place opponent must allow the straight-win exception for a non-bottom-three selection')

out=applyWinSafety(board(row()),[fixture({away:{id:2,name:'Beta',winRate:20,position:6,leagueSize:10,goalsConceded:2.31}})])
if(out.priority[0]?.market!=='1X2')throw new Error('Opponent conceding above 2.30 must allow the straight-win exception for a non-bottom-three selection')

out=applyWinSafety(board(row()),[fixture({home:{id:1,name:'Alpha',winRate:60,position:4,leagueSize:10,goalsConceded:1}})])
if(out.priority[0]?.market!=='1X2')throw new Error('60% win rate must allow a straight win for a non-bottom-three selection')

// Absolute bottom-three veto: even excellent form, favourable odds, a last-place
// opponent and available DNB/DC prices may not publish a team-result selection.
out=applyWinSafety(board(row({odds:1.45})),[fixture({home:{id:1,name:'Alpha',winRate:100,position:8,leagueSize:10,goalsConceded:.5},away:{id:2,name:'Beta',winRate:0,position:10,leagueSize:10,goalsConceded:3.4}})])
if(out.priority.length!==0)throw new Error('Bottom-three selected team must be vetoed even with strong form, short odds and opponent exceptions')
if(out.meta.bottom3TeamResultBlocked!==1)throw new Error('Bottom-three veto must be counted in board metadata')

out=applyWinSafety(board(row({odds:2.80})),[fixture({home:{id:1,name:'Alpha',winRate:20,position:9,leagueSize:10,goalsConceded:1}})])
if(out.priority.length!==0)throw new Error('Bottom-three selected team must not downgrade to DNB/1X/X2')

const goalRow=row({market:'O2.5',selectedTeamId:0,selectedTeam:'Over 2.5 goals',odds:1.72})
out=applyWinSafety(board(goalRow),[fixture({home:{id:1,name:'Alpha',winRate:20,position:9,leagueSize:10,goalsConceded:1}})])
if(out.priority[0]?.market!=='O2.5')throw new Error('Bottom-three veto must not remove unrelated goals-market picks')

const safe=applyWinSafety(board(row()),[fixture()])
const live=mergeLifecycleBoard({meta:{},groups:{single:[],two:[],threePlus:[]},priority:[]},safe,{'1':{statusGroup:'live',statusShort:'2H',elapsed:67,homeScore:1,awayScore:0}})
if(live.priority[0]?.statusGroup!=='live'||live.priority[0]?.homeScore!==1)throw new Error('Published pick must carry into live status without recalculation')

console.log(JSON.stringify({ok:true,policy:out.meta.winSafetyPolicy},null,2))
