import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gismoToFixture,eventsFromComment,seasonYear,overallSample,hasMatchStats,hasTeamStats} from '../server/sportyStats.js'

const barcaAway={
  _id:72478492,_utid:8,_seasonid:142176,
  comment:'0:1 (14.) Raphinha (pen), 0:2 (45.) K.Adeyemi, 0:3 (67.) Raphinha, 0:4 (71.) F.Lopez, 0:5 (79.) F.Lopez',
  result:{home:0,away:5,winner:'away'},
  periods:{ft:{home:0,away:5},p1:{home:0,away:2}},
  time:{uts:1787513400,date:'23/08/26',time:'19:30'},
  teams:{
    home:{_id:6669997,uid:2846,name:'Elche',mediumname:'Elche CF'},
    away:{_id:5198,uid:2817,name:'Barcelona',mediumname:'FC Barcelona'}
  },
  season:{year:'26/27'}
}

test('GISMO last-x maps scores, HT, team uids and SportyBet crest urls',()=>{
  const row=gismoToFixture(barcaAway,{leagueName:'LaLiga',country:'Spain'})
  assert.equal(row.fixture.id,72478492)
  assert.equal(row.fixture.status.short,'FT')
  assert.equal(row.teams.home.id,2846)
  assert.equal(row.teams.away.id,2817)
  assert.equal(row.goals.home,0)
  assert.equal(row.goals.away,5)
  assert.equal(row.score.halftime.home,0)
  assert.equal(row.score.halftime.away,2)
  assert.equal(row.league.id,8)
  assert.equal(row.league.season,2026)
  assert.equal(row.sporty.eventId,'sr:match:72478492')
  assert.ok(String(row.teams.away.logo).includes('2817.png'))
  assert.equal(row.eventsComplete,true)
  assert.equal(row.events.length,5)
  assert.equal(row.events[0].team.id,2817)
  assert.equal(row.events[0].time.elapsed,14)
})

test('goal comments become transition events in score order',()=>{
  const events=eventsFromComment('1:0 (73.) N.Tenaglia, 2:0 (90.) M.Diaz, 3:0 (90.) M.Rodriguez',10,20)
  assert.equal(events.length,3)
  assert.deepEqual(events.map(e=>e.team.id),[10,10,10])
  assert.equal(events[0].time.elapsed,73)
})

test('season year 26/27 is 2026',()=>{
  assert.equal(seasonYear({season:{year:'26/27'}}),2026)
  assert.equal(seasonYear({year:'25/26'}),2025)
})

test('refresh, settle, live API and the GitHub job no longer call API-Football',()=>{
  const files=[
    '../server/refresh.js',
    '../scripts/settleResults.js',
    '../scripts/refreshBoards.js',
    '../server/index.js',
    '../.github/workflows/refresh-board.yml',
    '../.github/workflows/supabase-functions.yml',
    '../supabase/functions/stats2pitch-api/index.ts'
  ]
  for(const rel of files){
    const text=readFileSync(new URL(rel,import.meta.url),'utf8')
    assert.equal(/apiFootball|API_FOOTBALL|api-sports\.io|x-apisports-key/.test(text),false,rel)
  }
})

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-08-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId,name:'Home'},away:{id:awayId,name:'Away'}},
    goals:{home:h,away:a}
  }
}

test('overall last-match sample is the SportyBet Stats tab last matches list',()=>{
  const rows=[
    finished(5,1653,99,1,0),
    finished(4,3110,1653,2,3),
    finished(3,80,1653,2,0),
    {fixture:{id:2,date:'2026-08-02T12:00:00Z',status:{short:'NS'}},teams:{home:{id:1653},away:{id:1}},goals:{home:null,away:null}}
  ]
  const last=overallSample(rows,1653,5)
  assert.equal(last.length,3)
  assert.equal(last[0].fixture.id,5)
  assert.equal(hasTeamStats(rows,1653),true)
  assert.equal(hasTeamStats([],1653),false)
  assert.equal(hasMatchStats(rows,1653,[finished(1,3110,4,0,1)],3110),true)
  assert.equal(hasMatchStats(rows,1653,[],3110),false)
})
