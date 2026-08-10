import { analyzeFixture, buildBoard, TEAM_RESULT_ELIGIBILITY_POLICY, GG_POLICY } from './engine.js'
import { applyWinSafety } from './winSafety.js'

const team=(id,name,venue,position,overrides={})=>({
  id,name,venue,position,pointsPosition:position,positionSampleReady:true,leagueSize:10,played:8,
  ppg:2.1,goalsScored:1.5,goalsConceded:1.2,seasonWinRate:75,winRate:80,lossRate:0,
  goalsSample:8,bttsRate:80,failedToScoreRate:10,cleanSheetRate:20,
  over15:80,under15:20,over25:40,under25:60,over35:20,under35:80,
  recentGoalsScored:1.6,recentGoalsConceded:1.3,...overrides
})
const fixture=(homePos=4,awayPos=6,overrides={})=>({
  fixtureId:77,match:'Alpha vs Beta',league:'Test League',country:'Test',kickoff:'2026-08-11T18:00:00Z',kickoffLocal:'11 Aug, 18:00',
  home:team(1,'Alpha','home',homePos,overrides.home||{}),away:team(2,'Beta','away',awayPos,overrides.away||{}),
  odds:{home:1.55,draw:3.7,away:5.5,bttsYes:1.72,over15:1.25,under25:1.85,under35:1.25},
  marketOdds:[{marketKey:'both-teams-score',market:'Both Teams To Score',bookmaker:'Pinnacle',outcomes:[{name:'Yes',odd:1.72},{name:'No',odd:2.05}]}]
})

// Neither side is Top 3: no result market may exist, but GG may independently qualify.
let rows=analyzeFixture(fixture(4,6))
if(rows.some(r=>['1X2','DNB','DC'].includes(r.market)))throw new Error('Positions 4+ must never produce a team-result candidate')
const gg=rows.find(r=>r.market==='BTTS')
if(!gg||gg.selectedTeam!=='GG — Both teams to score'||gg.odds!==1.72)throw new Error('Strict split GG route should survive when both teams independently satisfy GG evidence')
if(gg.familyCount<3||gg.filterCount<4)throw new Error('GG must be supported by Goal Pattern + Attack + Defence evidence')

// Strong FTS or clean-sheet contradiction vetoes GG rather than relabelling it.
rows=analyzeFixture(fixture(4,6,{home:{failedToScoreRate:40}}))
if(rows.some(r=>r.market==='BTTS'))throw new Error('40%+ relevant split failed-to-score rate must veto GG')
rows=analyzeFixture(fixture(4,6,{away:{cleanSheetRate:60}}))
if(rows.some(r=>r.market==='BTTS'))throw new Error('60%+ relevant split clean-sheet rate must veto GG')

// A Top-3 team may enter the result engine, but still has to pass the existing safety layer.
const top3Fixture=fixture(2,6)
rows=analyzeFixture(top3Fixture)
if(!rows.some(r=>r.market==='1X2'&&r.selectedTeamId===1))throw new Error('Top-3 split team should remain eligible to enter the result engine')
const safe=applyWinSafety(buildBoard([top3Fixture]),[top3Fixture])
if(!safe.priority.some(r=>r.market==='1X2'&&r.selectedTeamId===1))throw new Error('Top-3 team with 80% HOME split win rate should remain publishable after safety checks')

if(TEAM_RESULT_ELIGIBILITY_POLICY!=='split-top3-only-v1')throw new Error('Unexpected Top-3 result policy version')
if(GG_POLICY!=='strict-split-btts-60-profile-v1')throw new Error('Unexpected GG policy version')
console.log(JSON.stringify({ok:true,teamResultPolicy:TEAM_RESULT_ELIGIBILITY_POLICY,ggPolicy:GG_POLICY},null,2))
