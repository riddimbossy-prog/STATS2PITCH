import { applyWinSafety } from './winSafety.js'
import { mergeLifecycleBoard } from './lifecycle.js'

const row=(overrides={})=>({fixtureId:1,match:'Alpha vs Beta',league:'Test',country:'Test',kickoff:'2026-08-09T18:00:00Z',kickoffLocal:'09 Aug, 18:00',selectedTeamId:1,selectedTeam:'Alpha',opponentTeamId:2,opponentTeam:'Beta',odds:2.40,drawOdds:3.30,market:'1X2',filterCount:3,familyCount:3,familyStrength:3,negativeFamilyStrength:0,engineRating:70,contradiction:'LOW',score:8,filters:['A','B','C'],filterCodes:['A','B','C'],negativeSignals:[],negativeSignalCodes:[],...overrides})
const board=r=>({meta:{},groups:{single:[],two:[],threePlus:r?[r]:[]},priority:r?[r]:[],bestPicks:r?[r]:[],oddsByFixture:{},availableMarkets:[]})
const baseHome={id:1,name:'Alpha',venue:'home',winRate:40,seasonWinRate:40,played:5,position:2,pointsPosition:2,positionSampleReady:true,leagueSize:10,goalsConceded:1}
const baseAway={id:2,name:'Beta',venue:'away',winRate:20,seasonWinRate:20,played:5,position:6,pointsPosition:6,positionSampleReady:true,leagueSize:10,goalsConceded:1.2}
const fixture=(overrides={})=>({fixtureId:1,home:{...baseHome,...(overrides.home||{})},away:{...baseAway,...(overrides.away||{})},marketOdds:[{marketKey:'draw-no-bet',outcomes:[{name:'Home',odd:1.72},{name:'Away',odd:2.30}]},{marketKey:'double-chance',outcomes:[{name:'Home or draw',odd:1.34},{name:'Draw or away',odd:1.68}]}],...Object.fromEntries(Object.entries(overrides).filter(([k])=>!['home','away'].includes(k)))})

let out=applyWinSafety(board(row()),[fixture()])
if(out.priority.length!==1||out.priority[0].market!=='DNB'||out.priority[0].odds!==1.72)throw new Error('Top-3 under-60 split favourite above 2.00 may downgrade to DNB')
out=applyWinSafety(board(row({odds:1.85})),[fixture()])
if(out.priority.length!==0)throw new Error('Top-3 under-60 split full-time win at 2.00 or below must be blocked without an exception')

out=applyWinSafety(board(row({odds:1.85})),[fixture({away:{position:10,played:4,goalsConceded:1.2}})])
if(out.priority.length!==0||out.meta.lastPlaceSampleBlocked!==1)throw new Error('Last-place split opponent with fewer than five venue games must not unlock the straight-win exception')
out=applyWinSafety(board(row({odds:1.85})),[fixture({away:{position:10,played:5,goalsConceded:1.2}})])
if(out.priority[0]?.market!=='1X2')throw new Error('Last-place split opponent with five venue games may unlock the exception after all hard gates pass')
out=applyWinSafety(board(row({odds:1.85})),[fixture({away:{position:6,played:5,goalsConceded:2.31}})])
if(out.priority[0]?.market!=='1X2')throw new Error('Opponent conceding above 2.30 in the relevant split may allow the exception for a Top-3 candidate')

out=applyWinSafety(board(row({contradiction:'HIGH',odds:1.81,negativeSignals:['PPG <1','scores <1','FTS 40%','won fewer than 2/5']})),[fixture({away:{position:10,played:8,goalsConceded:3.1}})])
if(out.priority.length!==0||out.meta.highContradictionBlocked!==1)throw new Error('HIGH contradiction must veto even when opponent is last and concedes above 2.30')
out=applyWinSafety(board(row({contradiction:'MODERATE',odds:1.90})),[fixture({home:{winRate:80},away:{position:10,played:8,goalsConceded:3.1}})])
if(out.priority.length!==0||out.meta.moderateContradictionBlocked!==1)throw new Error('MODERATE contradiction must not publish a straight win at 2.00 or below')
out=applyWinSafety(board(row({contradiction:'MODERATE',odds:2.40})),[fixture({home:{winRate:80},away:{position:10,played:8,goalsConceded:3.1}})])
if(out.priority.length!==1||out.priority[0].market!=='DNB'||out.meta.moderateContradictionDowngraded!==1)throw new Error('Top-3 MODERATE contradiction above 2.00 may downgrade rather than publish a straight win')

out=applyWinSafety(board(row()),[fixture({home:{winRate:60,position:2}})])
if(out.priority[0]?.market!=='1X2')throw new Error('60% HOME-split last-five win rate must allow a LOW-contradiction straight win for a Top-3 selection')
out=applyWinSafety(board(row()),[fixture({home:{winRate:null,seasonWinRate:60,played:5,position:2}})])
if(out.priority[0]?.market!=='1X2'||out.priority[0]?.winRateSource!=='season-split')throw new Error('Mature 60% HOME season-split rate may recover when the selected team is Top 3')
out=applyWinSafety(board(row({odds:1.85})),[fixture({home:{winRate:null,seasonWinRate:75,played:4,position:2}})])
if(out.priority.length!==0)throw new Error('Fewer than five venue games must not use season split as a 60% win fallback')

// New absolute eligibility rule: positions 4+ get no 1X2, DNB or DC regardless of form, price or opponent weakness.
out=applyWinSafety(board(row({odds:3.20})),[fixture({home:{position:4,winRate:100,seasonWinRate:100,played:10},away:{position:10,played:10,goalsConceded:3.5}})])
if(out.priority.length!==0||out.meta.nonTop3TeamResultBlocked!==1)throw new Error('Non-Top-3 selected team must be hard-vetoed from every team-result route')

out=applyWinSafety(board(row({odds:1.45})),[fixture({home:{winRate:100,seasonWinRate:100,played:8,position:8,goalsConceded:.5},away:{winRate:0,position:10,played:8,goalsConceded:3.4}})])
if(out.priority.length!==0||out.meta.bottom3TeamResultBlocked!==1)throw new Error('Bottom-three selected split team must be vetoed regardless of form/odds/opponent')
out=applyWinSafety(board(row({odds:2.80})),[fixture({home:{winRate:20,played:8,position:9}})])
if(out.priority.length!==0)throw new Error('Bottom-three selected split team must not downgrade to DNB/1X/X2')

const goalRow=row({market:'O2.5',selectedTeamId:0,selectedTeam:'Over 2.5 goals',odds:1.72})
out=applyWinSafety(board(goalRow),[fixture({home:{winRate:20,position:9}})])
if(out.priority[0]?.market!=='O2.5')throw new Error('Top-3 result veto must not remove independently-qualified goals-market picks')
const ggRow=row({market:'BTTS',selectedTeamId:0,selectedTeam:'GG — Both teams to score',odds:1.74})
out=applyWinSafety(board(ggRow),[fixture({home:{position:5},away:{position:7}})])
if(out.priority[0]?.market!=='BTTS')throw new Error('Top-3 result veto must not remove independently-qualified GG picks')

out=applyWinSafety(board(row()),[fixture({home:{venue:null}})])
if(out.priority.length!==0||out.meta.missingSplitBlocked!==1)throw new Error('Team-result route must fail closed when split identity is missing')
out=applyWinSafety(board(row()),[fixture({away:{positionSampleReady:false,position:null}})])
if(out.priority.length!==0)throw new Error('Team-result route must fail closed when opponent split rank sample is not ready')

const safe=applyWinSafety(board(row()),[fixture()])
const live=mergeLifecycleBoard({meta:{},groups:{single:[],two:[],threePlus:[]},priority:[],bestPicks:[]},safe,{'1':{statusGroup:'live',statusShort:'2H',elapsed:67,homeScore:1,awayScore:0}})
if(live.priority[0]?.statusGroup!=='live'||live.priority[0]?.homeScore!==1||live.bestPicks.length!==1)throw new Error('Published split pick must carry into live status and Best Picks without recalculation')

console.log(JSON.stringify({ok:true,policy:out.meta.winSafetyPolicy},null,2))
