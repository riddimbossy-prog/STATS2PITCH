import { buildSplitTable, splitStandingMetrics, deriveVenueRecentStats, SPLIT_ENGINE_POLICY } from './stats.js'
import { analyzeFixture, comparePicks } from './engine.js'

function standing(id,overallRank,home,away,group=null){
  const allPlayed=(home.played||0)+(away.played||0),allWins=(home.win||0)+(away.win||0),allDraws=(home.draw||0)+(away.draw||0),gf=(home.goals?.for||0)+(away.goals?.for||0),ga=(home.goals?.against||0)+(away.goals?.against||0)
  return{team:{id,name:`T${id}`},rank:overallRank,points:allWins*3+allDraws,all:{played:allPlayed,win:allWins,draw:allDraws,lose:allPlayed-allWins-allDraws,goals:{for:gf,against:ga}},home,away,group,_s2pGroupIndex:0,_s2pGroupName:group||'League'}
}
const rec=(played,win,draw,gf,ga)=>({played,win,draw,lose:played-win-draw,goals:{for:gf,against:ga}})
const standings=[
  standing(1,2,rec(5,1,1,4,8),rec(5,4,0,10,4)),standing(2,1,rec(5,5,0,12,2),rec(5,2,1,7,5)),standing(3,3,rec(5,4,1,10,3),rec(5,2,1,6,5)),standing(4,4,rec(5,3,1,9,5),rec(5,2,0,6,6)),standing(5,5,rec(5,2,1,7,6),rec(5,1,2,5,7)),standing(6,6,rec(5,0,1,2,11),rec(5,1,1,4,9)),standing(7,7,rec(5,1,0,3,9),rec(5,0,2,3,10)),standing(8,8,rec(5,0,0,2,12),rec(5,0,1,2,11))
]
const homeTable=buildSplitTable(standings,'home',1),t1=splitStandingMetrics(standings,1,'home')
if(t1.overallPosition!==2)throw new Error('Overall context should be retained separately')
if(t1.position!==5)throw new Error(`Expected T1 to be 5th in HOME split strength, got ${t1.position}`)
if(t1.seasonWinRate!==20)throw new Error(`Expected strict HOME season win rate of 20%, got ${t1.seasonWinRate}`)
if(homeTable[0].teamId!==2)throw new Error('Split HOME table was not ranked from home-only strength')

const uneven=[standing(11,1,rec(3,3,0,6,1),rec(3,1,0,2,4)),standing(12,2,rec(5,4,0,8,2),rec(5,2,0,5,5)),standing(13,3,rec(5,2,1,6,5),rec(5,2,1,6,5)),standing(14,4,rec(5,1,1,4,7),rec(5,1,1,4,7))]
const u11=splitStandingMetrics(uneven,11,'home'),u12=splitStandingMetrics(uneven,12,'home')
if(u11.position!==1||u12.position!==2)throw new Error('Uneven venue schedules must rank engine strength by PPG before raw points')
if(u11.pointsPosition===u11.position)throw new Error('Test fixture should distinguish raw points rank from PPG strength rank')

function fx(id,date,homeId,awayId,hg,ag){return{fixture:{id,date,status:{short:'FT'}},teams:{home:{id:homeId},away:{id:awayId}},goals:{home:hg,away:ag}}}
const homeRows=[fx(1,'2026-08-08T12:00:00Z',1,20,2,0),fx(2,'2026-08-01T12:00:00Z',1,21,1,0),fx(3,'2026-07-25T12:00:00Z',1,22,0,1),fx(4,'2026-07-18T12:00:00Z',1,23,1,2),fx(5,'2026-07-11T12:00:00Z',1,24,0,2),fx(6,'2026-07-04T12:00:00Z',1,25,2,0),fx(7,'2026-06-27T12:00:00Z',1,26,3,0),fx(8,'2026-06-20T12:00:00Z',1,27,2,1),fx(9,'2026-06-13T12:00:00Z',1,28,2,0),fx(10,'2026-06-06T12:00:00Z',1,29,2,0),fx(11,'2026-08-07T12:00:00Z',30,1,0,5)]
const venueForm=deriveVenueRecentStats(homeRows,1,'home')
if(venueForm.formSample!==5||venueForm.formLongSample!==10)throw new Error('Home split form sample sizes are wrong')
if(venueForm.winRate!==40||venueForm.winRate10!==70)throw new Error('HOME Last-5/Last-10 form was calculated incorrectly')
const insufficient=deriveVenueRecentStats(homeRows.slice(0,4),1,'home')
if(insufficient.winRate!==null||insufficient.lossRate!==null)throw new Error('Fewer than five split matches must not produce Last-5 form rates')
const missingScore=[...homeRows.slice(0,5),fx(99,'2026-08-09T12:00:00Z',1,99,null,null)]
const clean=deriveVenueRecentStats(missingScore,1,'home')
if(clean.formSample!==5)throw new Error('Missing historical score must be excluded rather than interpreted as 0-0')

const baseTeam={id:1,name:'Alpha',venue:'home',position:5,pointsPosition:5,positionSampleReady:true,overallPosition:2,leagueSize:8,played:5,seasonWinRate:20,overallPlayed:10,ppg:.8,goalsScored:.8,goalsConceded:1.6,winRate:40,lossRate:60,winRate10:70,lossRate10:30,formAgreement:'NEUTRAL',over15:80,under15:20,over25:80,under25:20,over35:40,under35:60,cleanSheetRate:40,failedToScoreRate:40,bttsRate:40,recentGoalsScored:1.8,recentGoalsConceded:1.4}
const awayTeam={id:2,name:'Beta',venue:'away',position:6,pointsPosition:6,positionSampleReady:true,overallPosition:1,leagueSize:8,played:5,seasonWinRate:20,overallPlayed:10,ppg:.7,goalsScored:.8,goalsConceded:2.4,winRate:20,lossRate:80,winRate10:30,lossRate10:60,formAgreement:'LOSS_STRONG',over15:80,under15:20,over25:60,under25:40,over35:20,under35:80,cleanSheetRate:20,failedToScoreRate:60,bttsRate:40,recentGoalsScored:1.0,recentGoalsConceded:1.7}
const fixture={fixtureId:99,match:'Alpha vs Beta',league:'Split Test',country:'Test',kickoff:'2026-08-10T18:00:00Z',kickoffLocal:'10 Aug, 18:00',splitPolicy:SPLIT_ENGINE_POLICY,home:baseTeam,away:awayTeam,odds:{home:1.55,draw:4.2,away:6,over15:1.2,under15:4.5,over25:1.7,under25:2.1,over35:2.5,under35:1.5}}
const picks=analyzeFixture(fixture),alpha=picks.find(p=>p.market==='1X2'&&p.selectedTeam==='Alpha')
if(alpha?.filterCodes?.includes('TOP3'))throw new Error('Overall Top-3 rank incorrectly fired the split TOP3 filter')
const o25=picks.find(p=>p.market==='O2.5')
if(!o25||!o25.filters.some(x=>/Alpha.*home league matches/i.test(x))||!o25.filters.some(x=>/Beta.*away league matches/i.test(x)))throw new Error('O2.5 must require both HOME and AWAY split trend agreement')
const oneSided=analyzeFixture({...fixture,away:{...awayTeam,over25:40,under25:60}})
if(oneSided.some(p=>p.market==='O2.5'))throw new Error('One-sided O2.5 trend must not average into a goal pick')

const splitStrong={...baseTeam,position:2,pointsPosition:4,overallPosition:8,ppg:2.2,seasonWinRate:80,winRate:80,lossRate:0,failedToScoreRate:0}
const strong=analyzeFixture({...fixture,home:splitStrong}).find(p=>p.market==='1X2'&&p.selectedTeam==='Alpha')
if(!strong?.filterCodes?.includes('TOP3')||!strong.filterFamilies.includes('Table Strength')||!strong.filterFamilies.includes('Form'))throw new Error('Split Top-3/Form filters failed when overall rank was poor')
const splitBottom={...splitStrong,position:7,overallPosition:1,winRate:100,seasonWinRate:100,ppg:.3,goalsScored:.5}
if(analyzeFixture({...fixture,home:splitBottom}).some(p=>p.market==='1X2'&&p.selectedTeam==='Alpha'))throw new Error('Overall strength bypassed the split bottom-three veto')

const correlated={fixtureId:1,familyCount:2,familyStrength:3.2,contradiction:'LOW',score:9,odds:1.5,filterCount:7},diverse={fixtureId:2,familyCount:4,familyStrength:4.1,contradiction:'LOW',score:8,odds:1.8,filterCount:4}
if(comparePicks(correlated,diverse)<=0)throw new Error('Raw correlated filter count must not outrank broader independent family support')

console.log(JSON.stringify({ok:true,policy:SPLIT_ENGINE_POLICY,t1Overall:t1.overallPosition,t1Home:t1.position,unevenPpgRank:u11.position,last5HomeWinRate:venueForm.winRate,last10HomeWinRate:venueForm.winRate10},null,2))
