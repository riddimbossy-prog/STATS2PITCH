import test from 'node:test'
import assert from 'node:assert/strict'
import {leagueMature,splitStandingProfile,recentVenueProfile,analyzeFixture,buildBoard,ENGINE_VERSION} from '../server/engine.js'

const row=(id,rank,allPlayed,home,away)=>({team:{id,name:`T${id}`},rank,all:{played:allPlayed},home:{played:home.played,win:home.win,draw:home.draw,lose:home.lose,goals:{for:home.gf,against:home.ga}},away:{played:away.played,win:away.win,draw:away.draw,lose:away.lose,goals:{for:away.gf,against:away.ga}}})
const rec=(played,win,draw,lose,gf,ga)=>({played,win,draw,lose,gf,ga})
const standings=[row(1,1,8,rec(4,4,0,0,9,2),rec(4,1,1,2,4,5)),row(2,2,8,rec(4,2,1,1,7,4),rec(4,3,1,0,8,3)),row(3,3,8,rec(4,2,1,1,6,4),rec(4,2,1,1,6,4)),row(4,4,8,rec(4,1,1,2,4,6),rec(4,1,1,2,4,6)),row(5,5,8,rec(4,0,1,3,2,8),rec(4,0,1,3,2,8))]

test('four-game maturity is strict overall',()=>{assert.equal(leagueMature(standings,1,2),true);const weak=structuredClone(standings);weak[4].all.played=3;assert.equal(leagueMature(weak,1,2),false)})
test('split rank is venue-specific and needs 3 samples',()=>{assert.equal(splitStandingProfile(standings,1,'home').position,1);assert.equal(splitStandingProfile(standings,2,'away').position,1);const short=structuredClone(standings);short[0].home.played=2;assert.equal(splitStandingProfile(short,1,'home').position,null)})

test('recent form refuses incomplete last-five sample',()=>{assert.equal(recentVenueProfile([],1,'home').winRate,null)})

const team=(id,name,venue,position,o={})=>({id,name,venue,position,positionSampleReady:true,leagueSize:10,played:8,ppg:2.1,goalsScored:1.6,goalsConceded:1.1,seasonWinRate:75,winRate:80,lossRate:0,goalsSample:8,bttsRate:70,failedToScoreRate:10,cleanSheetRate:20,over15:80,under15:20,over25:70,under25:30,over35:30,under35:70,recentGoalsScored:1.7,recentGoalsConceded:1.2,...o})
const fixture=(hp=1,ap=5,o={})=>({fixtureId:99,match:'Alpha vs Beta',league:'League',country:'Test',kickoff:'2026-08-11T20:00:00Z',kickoffLocal:'11 Aug, 20:00',home:team(1,'Alpha','home',hp,o.home),away:team(2,'Beta','away',ap,o.away),odds:{home:1.65,draw:3.8,away:4.8,over15:1.25,under15:3.5,over25:1.75,under25:2.0,over35:2.7,under35:1.4,bttsYes:1.72,dnbHome:1.4,dnbAway:3.1,dc1x:1.25,dcx2:2.1,...o.odds}})

test('non-top3 can never produce Win/DNB/DC but goals survive',()=>{const rows=analyzeFixture(fixture(4,6));assert.equal(rows.some(x=>['1X2','DNB','DC'].includes(x.market)),false);assert.equal(rows.some(x=>x.market==='O1.5'||x.market==='O2.5'||x.market==='BTTS'),true)})
test('top3 with strong split win rate can publish straight win',()=>{const rows=analyzeFixture(fixture(1,6));assert.equal(rows.some(x=>x.market==='1X2'&&x.selection==='Alpha'),true)})
test('under60 top3 at odds above 2 can downgrade, never if non-top3',()=>{let rows=analyzeFixture(fixture(1,6,{home:{winRate:40,seasonWinRate:40},odds:{home:2.3}}));assert.equal(rows.some(x=>x.market==='DNB'&&x.selection==='Alpha DNB'),true);rows=analyzeFixture(fixture(4,6,{home:{winRate:40,seasonWinRate:40},odds:{home:2.3}}));assert.equal(rows.some(x=>['DNB','DC','1X2'].includes(x.market)),false)})
test('strict GG is vetoed by FTS 40 or clean sheet 60',()=>{assert.equal(analyzeFixture(fixture(4,6)).some(x=>x.market==='BTTS'),true);assert.equal(analyzeFixture(fixture(4,6,{home:{failedToScoreRate:40}})).some(x=>x.market==='BTTS'),false);assert.equal(analyzeFixture(fixture(4,6,{away:{cleanSheetRate:60}})).some(x=>x.market==='BTTS'),false)})
test('best picks is exactly one market per fixture',()=>{const board=buildBoard([fixture(1,6)]);assert.equal(board.bestPicks.length,1);assert.equal(board.meta.engineVersion,ENGINE_VERSION)})
