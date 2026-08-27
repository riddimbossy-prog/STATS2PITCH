import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSportyBet,verifiedMarkets} from '../server/odds.js'
import {applyEventIcons,eventQuery,resetSportyCache,sportyEventToFixture} from '../server/sportyBet.js'
import {extractOdds,diagnoseAwayFavFixture} from '../server/awayFavEngine.js'

const palaceMarkets=[
  {id:1,name:'1X2',outcomes:[{desc:'Home',odds:'5.13'},{desc:'Draw',odds:'4.27'},{desc:'Away',odds:'1.69'}]},
  {id:18,name:'Over/Under',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.22'},{desc:'Under 1.5',odds:'4.60'}]},
  {id:19,name:'Home O/U',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.49'},{desc:'Under 0.5',odds:'2.65'}]},
  {id:19,name:'Home O/U',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'3.30'}]},
  {id:20,name:'Away O/U',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.13'}]},
  {id:20,name:'Away O/U',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.65'}]},
  {id:29,name:'GG/NG',outcomes:[{desc:'Yes',odds:'1.71'},{desc:'No',odds:'2.15'}]},
  {id:60010,name:'',outcomes:[{desc:'Yes',odds:'1.28'},{desc:'No',odds:'3.40'}]}
]

test('SportyBet markets parse 1X2, totals, team goals, BTTS and streak',()=>{
  const rows=parseSportyBet(palaceMarkets)
  const by=Object.fromEntries(rows.map(r=>[r.marketKey,r]))
  assert.equal(by['match-winner'].outcomes.find(o=>o.name==='Away').odd,1.69)
  assert.equal(by['total-goals'].outcomes.find(o=>o.name==='Over 1.5').odd,1.22)
  assert.equal(by['home-team-goals'].outcomes.find(o=>o.name==='Over 0.5').odd,1.49)
  assert.equal(by['away-team-goals'].outcomes.find(o=>o.name==='Over 1.5').odd,1.65)
  assert.equal(by['both-teams-score'].outcomes.find(o=>o.name==='Yes').odd,1.71)
  assert.equal(by['goals-streak-2'].outcomes.find(o=>o.name==='Yes').odd,1.28)
})

test('verified SportyBet odds feed VAR without API-Football',()=>{
  const fixture={
    fixtureId:5789,
    league:'Premier League',
    country:'England',
    kickoff:'2026-08-28T19:00:00Z',
    home:{id:1,name:'Crystal Palace',logo:null,fixtures:[]},
    away:{id:2,name:'Man City',logo:null,fixtures:[]},
    homeSplit:null,
    awaySplit:null,
    sportyEventId:'sr:match:5789',
    marketOdds:verifiedMarkets({sportyMarkets:palaceMarkets})
  }
  const odds=extractOdds(fixture)
  assert.equal(odds.streak,1.28)
  assert.equal(odds.awayWin,1.69)
  assert.equal(odds.over15,1.22)
  const result=diagnoseAwayFavFixture(fixture)
  assert.equal(result.skip,null)
  assert.ok(result.pick)
  assert.equal(result.pick.favourite,'away')
})

test('SportyBet events keep numeric fixture ids and the raw event id',()=>{
  resetSportyCache()
  const row=sportyEventToFixture({
    eventId:'sr:match:57891234',
    gameId:'sr:game:99',
    estimateStartTime:Date.parse('2026-08-27T18:00:00Z'),
    status:0,
    matchStatus:'Not started',
    homeTeamId:'sr:competitor:10',
    homeTeamName:'Home FC',
    awayTeamId:'sr:competitor:20',
    awayTeamName:'Away FC',
    markets:palaceMarkets
  },{id:'sr:tournament:17',name:'Premier League',categoryName:'England'})
  assert.equal(row.fixture.id,57891234)
  assert.equal(row.fixture.status.short,'NS')
  assert.equal(row.league.id,17)
  assert.equal(row.teams.home.name,'Home FC')
  assert.ok(String(row.teams.home.logo).includes('10.png'))
  assert.equal(row.sporty.eventId,'sr:match:57891234')
  assert.equal(row.sporty.markets.length,palaceMarkets.length)
})

test('SportyBet match-details game IDs query event?gameId=',()=>{
  assert.deepEqual(eventQuery('44203'),{gameId:'44203'})
  assert.deepEqual(eventQuery('sr:match:73399176'),{eventId:'sr:match:73399176'})
  assert.equal(eventQuery(''),null)
})

test('match-details crests replace sportradar placeholders and reuse the team cache',()=>{
  resetSportyCache()
  const base={estimateStartTime:Date.parse('2026-08-27T16:45:00Z'),status:0,matchStatus:'Not started',markets:[]}
  const monaco=sportyEventToFixture({
    ...base,
    eventId:'sr:match:73399176',
    gameId:'44203',
    homeTeamId:'sr:competitor:1653',
    homeTeamName:'Monaco',
    awayTeamId:'sr:competitor:3110',
    awayTeamName:'Gornik Zabrze'
  },{id:'sr:tournament:540',name:'UEFA Conference League',categoryName:'International Clubs'})
  assert.ok(String(monaco.teams.home.logo).includes('1653.png'))
  applyEventIcons(monaco,{
    homeTeamId:'sr:competitor:1653',
    homeTeamIcon:'https://s.sporty.net/common/main/res/monaco.png',
    awayTeamId:'sr:competitor:3110',
    awayTeamIcon:'https://s.sporty.net/common/main/res/gornik.png'
  })
  assert.equal(monaco.teams.home.logo,'https://s.sporty.net/common/main/res/monaco.png')
  assert.equal(monaco.teams.away.logo,'https://s.sporty.net/common/main/res/gornik.png')
  const later=sportyEventToFixture({
    ...base,
    eventId:'sr:match:1',
    gameId:'99',
    homeTeamId:'sr:competitor:1653',
    homeTeamName:'Monaco',
    awayTeamId:'sr:competitor:17',
    awayTeamName:'Man City'
  },{name:'Friendly'})
  assert.equal(later.teams.home.logo,'https://s.sporty.net/common/main/res/monaco.png')
  assert.ok(String(later.teams.away.logo).includes('17.png'))
})
