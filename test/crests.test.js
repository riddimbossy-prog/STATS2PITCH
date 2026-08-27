import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {crestSrc,fixtureCrests,preferLogo,sportradarCrest,FALLBACK} from '../public/crests.js'
import {attachCrests,saveBoard,clearBoard} from '../server/store.js'
import {sportyEventToFixture} from '../server/sportyBet.js'

test('SportyBet event icons beat constructed Sportradar crests',()=>{
  const row=sportyEventToFixture({
    eventId:'sr:match:72478456',
    homeTeamId:'sr:competitor:2817',
    homeTeamName:'Barcelona',
    homeTeamIcon:'https://s.sporty.net/common/main/res/barca.png',
    awayTeamId:'sr:competitor:2825',
    awayTeamName:'Athletic Bilbao',
    awayTeamIcon:'https://s.sporty.net/common/main/res/athletic.png',
    estimateStartTime:Date.parse('2026-08-27T19:00:00Z'),
    status:0,
    matchStatus:'Not started',
    markets:[]
  },{id:'sr:tournament:8',name:'LaLiga',categoryName:'Spain'})
  assert.equal(row.teams.home.logo,'https://s.sporty.net/common/main/res/barca.png')
  assert.equal(row.teams.away.logo,'https://s.sporty.net/common/main/res/athletic.png')
})

test('client crests fall back to board fixtures then SportyBet/Sportradar ids',()=>{
  const board={fixtures:[{fixtureId:72478456,homeLogo:'https://img.sportradar.com/ls/crest/big/2817.png',awayLogo:'https://img.sportradar.com/ls/crest/big/2825.png'}]}
  const fx=fixtureCrests(board)
  const src=crestSrc({fixtureId:72478456,home:'Barcelona',away:'Athletic Bilbao'},'home',fx)
  assert.equal(src,'https://img.sportradar.com/ls/crest/big/2817.png')
  assert.equal(crestSrc({homeId:2817},'home',new Map()),sportradarCrest(2817))
  assert.equal(crestSrc({},'home',new Map()),FALLBACK)
  assert.equal(preferLogo('https://img.sportradar.com/ls/crest/big/2817.png','https://s.sporty.net/common/main/res/barca.png'),'https://s.sporty.net/common/main/res/barca.png')
})

test('preserved VAR tips inherit crests from the current fixture list',async()=>{
  const date='2099-03-08'
  await clearBoard(date)
  const existing={
    bestPicks:[],
    varTips:[{fixtureId:72478456,market:'away-team-goals',selection:'Over 0.5',home:'Barcelona',away:'Athletic Bilbao',homeLogo:null,awayLogo:null,kickoff:`${date}T19:00:00Z`}],
    priority:[],
    bankers:[],
    results:{},
    availableMarkets:[],
    fixtures:[],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:1,scheduledFixtures:1,publishedPicks:0,varTipsCount:1}
  }
  await saveBoard(date,existing,{preservePublished:false})
  const incoming={
    bestPicks:[],
    varTips:[{fixtureId:72478456,market:'away-team-goals',selection:'Over 0.5',home:'Barcelona',away:'Athletic Bilbao',homeLogo:'https://img.sportradar.com/ls/crest/big/2817.png',awayLogo:'https://img.sportradar.com/ls/crest/big/2825.png',kickoff:`${date}T19:00:00Z`}],
    priority:[],
    bankers:[],
    results:{},
    availableMarkets:[],
    fixtures:[{fixtureId:72478456,home:'Barcelona',away:'Athletic Bilbao',homeLogo:'https://img.sportradar.com/ls/crest/big/2817.png',awayLogo:'https://img.sportradar.com/ls/crest/big/2825.png'}],
    meta:{date,engineVersion:'stats2pitch-v5-var-tips',sourceFixtures:1,scheduledFixtures:1,generatedAt:new Date().toISOString()}
  }
  const merged=await saveBoard(date,incoming)
  assert.equal(merged.varTips[0].homeLogo,'https://img.sportradar.com/ls/crest/big/2817.png')
  assert.equal(merged.varTips[0].awayLogo,'https://img.sportradar.com/ls/crest/big/2825.png')
  const patched=attachCrests({
    varTips:[{fixtureId:1,homeLogo:null}],
    fixtures:[{fixtureId:1,homeLogo:'https://s.sporty.net/common/main/res/x.png'}]
  })
  assert.equal(patched.varTips[0].homeLogo,'https://s.sporty.net/common/main/res/x.png')
  await clearBoard(date)
})

test('public boards import the shared SportyBet crest helper',async()=>{
  const files=['public/varTips.js','public/appCrests.js','public/bankerRules.js']
  for(const rel of files){
    const text=await readFile(new URL(`../${rel}`,import.meta.url),'utf8')
    assert.match(text,/from '\.\/crests\.js'/)
    assert.match(text,/crestSrc/)
    assert.match(text,/bindCrestFallbacks/)
  }
})
