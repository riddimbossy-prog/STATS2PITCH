import { buildSplitTable, splitStandingMetrics, deriveVenueRecentStats, SPLIT_ENGINE_POLICY } from './stats.js'
import { analyzeFixture } from './engine.js'

function standing(id,overallRank,home,away){
  const allPlayed=(home.played||0)+(away.played||0)
  const allWins=(home.win||0)+(away.win||0)
  const allDraws=(home.draw||0)+(away.draw||0)
  const gf=(home.goals?.for||0)+(away.goals?.for||0)
  const ga=(home.goals?.against||0)+(away.goals?.against||0)
  return{team:{id,name:`T${id}`},rank:overallRank,points:allWins*3+allDraws,all:{played:allPlayed,win:allWins,draw:allDraws,lose:allPlayed-allWins-allDraws,goals:{for:gf,against:ga}},home,away}
}
const rec=(played,win,draw,gf,ga)=>({played,win,draw,lose:played-win-draw,goals:{for:gf,against:ga}})

// T1 is 2nd overall but only 5th on the HOME-only table.
const standings=[
  standing(1,2,rec(5,1,1,4,8),rec(5,4,0,10,4)),
  standing(2,1,rec(5,5,0,12,2),rec(5,2,1,7,5)),
  standing(3,3,rec(5,4,1,10,3),rec(5,2,1,6,5)),
  standing(4,4,rec(5,3,1,9,5),rec(5,2,0,6,6)),
  standing(5,5,rec(5,2,1,7,6),rec(5,1,2,5,7)),
  standing(6,6,rec(5,0,1,2,11),rec(5,1,1,4,9)),
  standing(7,7,rec(5,1,0,3,9),rec(5,0,2,3,10)),
  standing(8,8,rec(5,0,0,2,12),rec(5,0,1,2,11))
]
const homeTable=buildSplitTable(standings,'home')
const t1=splitStandingMetrics(standings,1,'home')
if(t1.overallPosition!==2)throw new Error('Overall context should be retained separately')
if(t1.position!==5)throw new Error(`Expected T1 to be 5th in HOME split, got ${t1.position}`)
if(homeTable[0].teamId!==2)throw new Error('Split HOME table was not ranked from home-only records')

function fx(id,date,homeId,awayId,hg,ag){return{fixture:{id,date,status:{short:'FT'}},teams:{home:{id:homeId},away:{id:awayId}},goals:{home:hg,away:ag}}}
const homeRows=[
  fx(1,'2026-08-08T12:00:00Z',1,20,2,0),
  fx(2,'2026-08-01T12:00:00Z',1,21,1,0),
  fx(3,'2026-07-25T12:00:00Z',1,22,0,1),
  fx(4,'2026-07-18T12:00:00Z',1,23,1,2),
  fx(5,'2026-07-11T12:00:00Z',1,24,0,2),
  fx(6,'2026-07-04T12:00:00Z',1,25,2,0),
  fx(7,'2026-06-27T12:00:00Z',1,26,3,0),
  fx(8,'2026-06-20T12:00:00Z',1,27,2,1),
  fx(9,'2026-06-13T12:00:00Z',1,28,2,0),
  fx(10,'2026-06-06T12:00:00Z',1,29,2,0),
  // An AWAY win must never contaminate home-only form.
  fx(11,'2026-08-07T12:00:00Z',30,1,0,5)
]
const venueForm=deriveVenueRecentStats(homeRows,1,'home')
if(venueForm.formSample!==5||venueForm.formLongSample!==10)throw new Error('Home split form sample sizes are wrong')
if(venueForm.winRate!==40)throw new Error(`Expected 40% last-5 HOME win rate, got ${venueForm.winRate}`)
if(venueForm.winRate10!==70)throw new Error(`Expected 70% last-10 HOME win rate, got ${venueForm.winRate10}`)
const insufficient=deriveVenueRecentStats(homeRows.slice(0,4),1,'home')
if(insufficient.winRate!==null||insufficient.lossRate!==null)throw new Error('Fewer than five split matches must not produce Last-5 form rates')

const baseTeam={id:1,name:'Alpha',venue:'home',position:5,overallPosition:2,leagueSize:8,played:5,overallPlayed:10,ppg:.8,goalsScored:.8,goalsConceded:1.6,winRate:40,lossRate:60,winRate10:70,lossRate10:30,formAgreement:'NEUTRAL',over15:80,under15:20,over25:80,under25:20,over35:40,under35:60,cleanSheetRate:40,failedToScoreRate:40,bttsRate:40}
const awayTeam={id:2,name:'Beta',venue:'away',position:6,overallPosition:1,leagueSize:8,played:5,overallPlayed:10,ppg:.7,goalsScored:.8,goalsConceded:2.4,winRate:20,lossRate:80,winRate10:30,lossRate10:60,formAgreement:'LOSS_STRONG',over15:80,under15:20,over25:60,under25:40,over35:20,under35:80,cleanSheetRate:20,failedToScoreRate:60,bttsRate:40}
const fixture={fixtureId:99,match:'Alpha vs Beta',league:'Split Test',country:'Test',kickoff:'2026-08-10T18:00:00Z',kickoffLocal:'10 Aug, 18:00',splitPolicy:SPLIT_ENGINE_POLICY,home:baseTeam,away:awayTeam,odds:{home:1.55,draw:4.2,away:6,over15:1.2,under15:4.5,over25:1.7,under25:2.1,over35:2.5,under35:1.5}}
const picks=analyzeFixture(fixture)
const alpha=picks.find(p=>p.market==='1X2'&&p.selectedTeam==='Alpha')
if(alpha?.filterCodes?.includes('TOP3'))throw new Error('Overall Top-3 rank incorrectly fired the split TOP3 filter')
if(alpha?.filters?.some(x=>/top 3/i.test(x)))throw new Error('Overall rank leaked into split filter reasons')
const o25=picks.find(p=>p.market==='O2.5')
if(!o25||!o25.filters.some(x=>/Alpha.*home league matches/i.test(x))||!o25.filters.some(x=>/Beta.*away league matches/i.test(x)))throw new Error('Goal-pattern filters are not using both venue splits')

// Overall 8th but HOME split 2nd: split rank must be allowed to fire TOP3.
const splitStrong={...baseTeam,position:2,overallPosition:8,ppg:2.2,winRate:80,lossRate:0,failedToScoreRate:0}
const strongPicks=analyzeFixture({...fixture,home:splitStrong})
const strong=strongPicks.find(p=>p.market==='1X2'&&p.selectedTeam==='Alpha')
if(!strong?.filterCodes?.includes('TOP3'))throw new Error('HOME split Top-3 failed to fire because overall rank was poor')
if(!strong.filterFamilies.includes('Table Strength')||!strong.filterFamilies.includes('Form'))throw new Error('Split filters were not organized into the requested families')

// Overall 1st but HOME split bottom 3: absolute team-result veto.
const splitBottom={...splitStrong,position:6,overallPosition:1,winRate:100,ppg:3,goalsScored:3}
const bottomPicks=analyzeFixture({...fixture,home:splitBottom})
if(bottomPicks.some(p=>p.market==='1X2'&&p.selectedTeam==='Alpha'))throw new Error('Overall strength bypassed the split bottom-three veto')

console.log(JSON.stringify({ok:true,policy:SPLIT_ENGINE_POLICY,t1Overall:t1.overallPosition,t1Home:t1.position,last5HomeWinRate:venueForm.winRate,last10HomeWinRate:venueForm.winRate10},null,2))
