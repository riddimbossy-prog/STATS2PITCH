import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSportyBet,verifiedMarkets,isNoiseMarket} from '../server/odds.js'
import {applyEventIcons,eventQuery,resetSportyCache,sportyEventToFixture} from '../server/sportyBet.js'
import {extractOdds,diagnoseAwayFavFixture} from '../server/awayFavEngine.js'
import {keepEventMarket} from '../server/comboMarketHydrator.js'

const palaceMarkets=[
  {id:1,name:'1X2',outcomes:[{desc:'Home',odds:'5.13'},{desc:'Draw',odds:'4.27'},{desc:'Away',odds:'1.69'}]},
  {id:18,name:'Over/Under',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.22'},{desc:'Under 1.5',odds:'4.60'}]},
  {id:19,name:'Home O/U',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.49'},{desc:'Under 0.5',odds:'2.65'}]},
  {id:19,name:'Home O/U',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'3.30'}]},
  {id:20,name:'Away O/U',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.13'}]},
  {id:20,name:'Away O/U',specifier:'total=1.5',outcomes:[{desc:'Over 1.5',odds:'1.65'}]},
  {id:29,name:'GG/NG',outcomes:[{desc:'Yes',odds:'1.71'},{desc:'No',odds:'2.15'}]},
  {id:60000,name:'GG/NG 2+',outcomes:[{desc:'Yes',odds:'3.20'},{desc:'No',odds:'1.45'}]},
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
  assert.equal(by['both-teams-score-2'].outcomes.find(o=>o.name==='No').odd,1.45)
  assert.equal(by['goals-streak-2'].outcomes.find(o=>o.name==='Yes').odd,1.28)
})

test('SportyBet object specifiers still become Over 0.5 / Over 1.5 lines',()=>{
  const rows=parseSportyBet([
    {id:19,name:'Home O/U',specifiers:{total:'0.5'},outcomes:[{desc:'Over',odds:'1.22'},{desc:'Under',odds:'4.10'}]},
    {id:19,name:'Home O/U',specifier:{total:1.5},outcomes:[{desc:'Over',odds:'2.05'}]},
    {id:20,name:'Away O/U',specifiers:{total:'2.5'},outcomes:[{desc:'Over',odds:'3.40'}]}
  ])
  const by=Object.fromEntries(rows.map(r=>[r.marketKey,r]))
  assert.equal(by['home-team-goals'].outcomes.find(o=>o.name==='Over 0.5').odd,1.22)
  assert.equal(by['home-team-goals'].outcomes.find(o=>o.name==='Over 1.5').odd,2.05)
  assert.equal(by['away-team-goals'].outcomes.find(o=>o.name==='Over 2.5').odd,3.40)
})

test('verified SportyBet odds feed VAR without API-Football',()=>{
  const form=Array.from({length:5},(_,i)=>({
    fixture:{id:i+1,date:`2026-08-0${i+1}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:i%2?2:1,name:i%2?'Man City':'Crystal Palace'},away:{id:i%2?1:2,name:i%2?'Crystal Palace':'Man City'}},
    goals:{home:i%2?2:0,away:i%2?0:2}
  }))
  const fixture={
    fixtureId:5789,
    league:'Premier League',
    country:'England',
    kickoff:'2026-08-28T19:00:00Z',
    home:{id:1,name:'Crystal Palace',logo:null,fixtures:form},
    away:{id:2,name:'Man City',logo:null,fixtures:form},
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

test('VAR skips a SportyBet match when last-match stats are missing',()=>{
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
  const result=diagnoseAwayFavFixture(fixture)
  assert.equal(result.skip,'no-stats')
  assert.equal(result.pick,null)
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

test('SportyBet postponed events keep PST instead of cancelled',()=>{
  resetSportyCache()
  const row=sportyEventToFixture({
    eventId:'sr:match:11',
    estimateStartTime:Date.parse('2026-08-27T18:00:00Z'),
    status:4,
    matchStatus:'Postponed',
    homeTeamId:'sr:competitor:10',
    homeTeamName:'Home FC',
    awayTeamId:'sr:competitor:20',
    awayTeamName:'Away FC',
    markets:[]
  },{id:'sr:tournament:17',name:'Premier League',categoryName:'England'})
  assert.equal(row.fixture.status.short,'PST')
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

test('match Over 0.5 keeps the full-time price when 1H Over 0.5 is also listed',()=>{
  const rows=parseSportyBet([
    {id:68,name:'1st Half Over/Under',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.24'},{desc:'Under 0.5',odds:'3.80'}]},
    {id:18,name:'Over/Under',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.02'},{desc:'Under 0.5',odds:'12.00'}]},
    {id:18,name:'Over/Under',specifier:'total=2.5',outcomes:[{desc:'Over 2.5',odds:'1.39'},{desc:'Under 2.5',odds:'2.90'}]}
  ])
  const by=Object.fromEntries(rows.map(r=>[r.marketKey,r]))
  assert.equal(by['total-goals'].outcomes.find(o=>o.name==='Over 0.5').odd,1.02)
  assert.equal(by['total-goals'].outcomes.find(o=>o.name==='Over 2.5').odd,1.39)
  assert.equal(by['first-half-goals'].outcomes.find(o=>o.name==='Over 0.5').odd,1.24)
})

test('1H double chance is not treated as match double chance',()=>{
  const rows=parseSportyBet([
    {id:62,name:'1st Half Double Chance',outcomes:[{desc:'1X',odds:'1.12'},{desc:'12',odds:'1.08'},{desc:'X2',odds:'1.55'}]},
    {id:10,name:'Double Chance',outcomes:[{desc:'1X',odds:'1.33'},{desc:'12',odds:'1.22'},{desc:'X2',odds:'1.90'}]}
  ])
  const by=Object.fromEntries(rows.map(r=>[r.marketKey,r]))
  assert.equal(by['double-chance'].outcomes.find(o=>o.name==='Home or draw').odd,1.33)
  assert.equal(by['double-chance'].outcomes.find(o=>o.name==='Home or away').odd,1.22)
  assert.equal(by['first-half-winner'],undefined)
})

test('corners, early goals, HT/FT and 1X2&O/U hybrids are ignored',()=>{
  assert.equal(isNoiseMarket('Corners Over/Under'),true)
  assert.equal(isNoiseMarket('Early Goals'),true)
  assert.equal(isNoiseMarket('1X2 & Over/Under'),true)
  const rows=parseSportyBet([
    {id:16,name:'Corners Over/Under',specifier:'total=8.5',outcomes:[{desc:'Over 8.5',odds:'1.70'}]},
    {id:31,name:'Early Goals',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.18'}]},
    {id:47,name:'Halftime/Fulltime',outcomes:[{desc:'Home/Home',odds:'2.10'}]},
    {id:99,name:'1X2 & Over/Under',outcomes:[{desc:'Home & Over 2.5',odds:'2.40'}]},
    {id:18,name:'Over/Under',specifier:'total=2.5',outcomes:[{desc:'Over 2.5',odds:'1.39'}]}
  ])
  assert.deepEqual(rows.map(r=>r.marketKey),['total-goals'])
  assert.equal(rows[0].outcomes.find(o=>o.name==='Over 2.5').odd,1.39)
})

test('Asian Over 2 is kept as Over 2, not Over 2.5',()=>{
  const rows=parseSportyBet([
    {id:18,name:'Over/Under',specifier:'total=2',outcomes:[{desc:'Over 2.5',odds:'1.15'},{desc:'Under 2.5',odds:'5.50'}]},
    {id:18,name:'Over/Under',specifier:'total=2.5',outcomes:[{desc:'Over 2.5',odds:'1.39'},{desc:'Under 2.5',odds:'2.90'}]}
  ])
  const totals=rows.find(r=>r.marketKey==='total-goals')
  assert.equal(totals.outcomes.find(o=>o.name==='Over 2').odd,1.15)
  assert.equal(totals.outcomes.find(o=>o.name==='Over 2.5').odd,1.39)
})

test('2nd half over/under is dropped instead of becoming 1H or match totals',()=>{
  const rows=parseSportyBet([
    {id:77,name:'2nd Half Over/Under',specifier:'total=0.5',outcomes:[{desc:'Over 0.5',odds:'1.40'}]},
    {id:18,name:'Over/Under',specifier:'total=2.5',outcomes:[{desc:'Over 2.5',odds:'1.39'}]}
  ])
  const by=Object.fromEntries(rows.map(r=>[r.marketKey,r]))
  assert.equal(by['total-goals'].outcomes.find(o=>o.name==='Over 2.5').odd,1.39)
  assert.equal(by['first-half-goals'],undefined)
  assert.equal(by['total-goals'].outcomes.find(o=>o.name==='Over 0.5'),undefined)
})

test('combo hydrator keeps match and combo markets, drops 1H and corners',()=>{
  assert.equal(keepEventMarket({id:18,name:'Over/Under'}),true)
  assert.equal(keepEventMarket({id:1,name:'1X2'}),true)
  assert.equal(keepEventMarket({id:854,name:'Home Team or Over 2.5'}),true)
  assert.equal(keepEventMarket({id:999,name:'Home Team or GG'}),true)
  assert.equal(keepEventMarket({id:68,name:'1st Half Over/Under'}),false)
  assert.equal(keepEventMarket({id:16,name:'Corners Over/Under'}),false)
  assert.equal(keepEventMarket({id:99,name:'1X2 & Over/Under'}),false)
})
