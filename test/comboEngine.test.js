import test from 'node:test'
import assert from 'node:assert/strict'
import {listedComboMarkets,analyzeComboFixture,COMBO_MIN_ODD} from '../server/comboEngine.js'
import {settlePick} from '../server/settlement.js'

const market=(name,yes)=>({name,outcomes:[{name:'Yes',odds:yes},{name:'No',odds:3.2}]})
const ft=(id,homeId,awayId,h,a,date)=>({fixture:{id,date,status:{short:'FT'}},teams:{home:{id:homeId,name:`T${homeId}`},away:{id:awayId,name:`T${awayId}`}},goals:{home:h,away:a},score:{fulltime:{home:h,away:a},halftime:{home:0,away:0}}})

test('recognizes all twelve Combo market families and enforces 1.20 minimum',()=>{
  const rows=[
    market('Home Team or Over 2.5',1.44),market('Home Team or Under 2.5',1.76),market('Draw or Over 2.5',1.29),market('Draw or Under 2.5',1.92),
    market('Away or Over 2.5',1.25),market('Away or Under 2.5',1.19),market('Home Team or GG',1.45),market('Draw or GG',1.52),market('Away Team or GG',1.22),
    market('Home Team or Any Clean Sheet',1.75),market('Draw or Any Clean Sheet',1.56),market('Away Team or Any Clean Sheet',1.33)
  ]
  const parsed=listedComboMarkets(rows)
  assert.equal(COMBO_MIN_ODD,1.20)
  assert.equal(parsed.length,11)
  assert.ok(parsed.every(x=>x.odds>=1.20))
  assert.ok(parsed.some(x=>x.market==='combo-home-over-25'))
  assert.ok(parsed.some(x=>x.market==='combo-draw-clean-sheet'))
})

test('publishes no more than two ranked Combo picks per fixture',()=>{
  const homeId=1,awayId=2
  const homeFixtures=[ft(1,homeId,9,2,0,'2026-08-30'),ft(2,homeId,8,3,1,'2026-08-24'),ft(3,homeId,7,2,1,'2026-08-18'),ft(4,homeId,6,1,0,'2026-08-12'),ft(5,homeId,5,3,0,'2026-08-06')]
  const awayFixtures=[ft(11,9,awayId,1,2,'2026-08-29'),ft(12,8,awayId,1,1,'2026-08-23'),ft(13,7,awayId,0,2,'2026-08-17'),ft(14,6,awayId,1,2,'2026-08-11'),ft(15,5,awayId,0,1,'2026-08-05')]
  const f={fixtureId:99,league:'Test League',country:'Test',kickoff:'2026-09-06T15:00:00Z',statsReady:true,home:{id:homeId,name:'Home FC',fixtures:homeFixtures,lastMatches:homeFixtures},away:{id:awayId,name:'Away FC',fixtures:awayFixtures,lastMatches:awayFixtures},homeSplit:{sampleReady:true,position:1,size:10,ppg:2.6},awaySplit:{sampleReady:true,position:3,size:10,ppg:2.0},homeStats:{over25:80,btts:60,cs:40,fts:0},awayStats:{over25:80,btts:60,cs:20,fts:10},h2h:[],sportyMarkets:[market('Home Team or Over 2.5',1.44),market('Draw or Over 2.5',1.29),market('Away or Over 2.5',1.25),market('Home Team or GG',1.45)]}
  const picks=analyzeComboFixture(f)
  assert.ok(picks.length<=2)
  assert.ok(picks.length>=1)
  assert.equal(picks[0].rank,1)
  assert.ok(picks.every(x=>x.odds>=1.20&&x.reasons.length>0&&x.why))
})

test('settles Combo OR logic correctly',()=>{
  const fixture={fixture:{id:7,status:{short:'FT'}},goals:{home:1,away:1},score:{fulltime:{home:1,away:1},halftime:{home:0,away:0}},teams:{home:{name:'A'},away:{name:'B'}}}
  assert.equal(settlePick({market:'combo-draw-over-25',selection:'Draw or Over 2.5'},fixture).outcome,'won')
  assert.equal(settlePick({market:'combo-home-over-25',selection:'Home Team or Over 2.5'},fixture).outcome,'lost')
  assert.equal(settlePick({market:'combo-away-gg',selection:'Away Team or GG'},fixture).outcome,'won')
  assert.equal(settlePick({market:'combo-draw-clean-sheet',selection:'Draw or Any Clean Sheet'},fixture).outcome,'won')
})
