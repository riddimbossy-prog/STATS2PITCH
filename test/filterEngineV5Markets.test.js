import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseFilterFixture} from '../server/filterEngine.js'

function finished(id,homeId,awayId,h,a){
  return{
    fixture:{id,date:`2026-08-${String(id).padStart(2,'0')}T12:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId},away:{id:awayId}},
    goals:{home:h,away:a}
  }
}

function venueRows(teamId,venue,scores){
  return scores.map((pair,index)=>venue==='home'
    ?finished(index+1,teamId,800+index,pair[0],pair[1])
    :finished(index+1,800+index,teamId,pair[1],pair[0]))
}

function markets(odds={}){
  const rows=[]
  const add=(marketKey,market,name,odd)=>{
    if(!Number.isFinite(Number(odd)))return
    let row=rows.find(x=>x.marketKey===marketKey)
    if(!row){row={marketKey,market,outcomes:[]};rows.push(row)}
    row.outcomes.push({name,odd:Number(odd)})
  }
  add('match-winner','Match winner','Home',odds.homeWin)
  add('match-winner','Match winner','Draw',odds.drawWin)
  add('match-winner','Match winner','Away',odds.awayWin)
  add('total-goals','Total goals','Over 1.5',odds.over15)
  add('total-goals','Total goals','Over 2.5',odds.over25)
  add('total-goals','Total goals','Under 2.5',odds.under25)
  add('total-goals','Total goals','Under 3.5',odds.under35)
  add('both-teams-score','Both teams to score','Yes',odds.ggYes)
  add('both-teams-score-2','GG/NG 2+','No',odds.gg2No)
  add('home-team-goals','Home team goals','Over 0.5',odds.homeO05)
  add('home-team-goals','Home team goals','Over 1.5',odds.homeO15)
  add('away-team-goals','Away team goals','Over 0.5',odds.awayO05)
  add('away-team-goals','Away team goals','Over 1.5',odds.awayO15)
  add('goals-streak-2','Goals Streak 2+','Yes',odds.streakYes)
  return rows
}

function fixture(homeScores,awayScores,odds){
  return{
    fixtureId:9101,
    league:'V5 Market Safety League',
    country:'England',
    kickoff:'2026-09-04T18:00:00Z',
    home:{id:1,name:'Home FC',fixtures:venueRows(1,'home',homeScores)},
    away:{id:2,name:'Away FC',fixtures:venueRows(2,'away',awayScores)},
    homeSplit:{position:6,size:20,sampleReady:true},
    awaySplit:{position:13,size:20,sampleReady:true},
    earlySeason:false,
    h2h:[],
    marketOdds:markets(odds)
  }
}

test('V5 straight win rejects two 60% sides even when V2 evidence score is high',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[2,0],[1,0],[2,1],[0,1],[1,1]],
    [[0,1],[0,2],[1,2],[1,1],[1,0]],
    {homeWin:1.35,drawWin:4.20,awayWin:7.50}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-win-two-sided-support')
})

test('V5 high-price straight win requires clear draw separation',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[2,0],[1,0],[2,1],[3,0],[1,1]],
    [[0,1],[0,2],[1,2],[0,3],[1,1]],
    {homeWin:1.50,drawWin:3.80,awayWin:6.50}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-win-high-price-risk')
})

test('V5 Under 3.5 requires 80% recent venue control on both sides',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[1,0],[1,1],[2,0],[2,2],[3,1]],
    [[1,0],[1,1],[2,0],[2,1],[3,1]],
    {under35:1.22,over15:1.50}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-under35-venue-support')
})

test('V5 Over 2.5 requires a real three-goal production route',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[0,3],[0,3],[0,3],[0,3],[1,0]],
    [[0,3],[0,3],[0,3],[0,3],[1,0]],
    {over25:1.40,under35:1.75}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-over25-no-goal-source')
})

test('V5 Under 2.5 rejects an active 2+ goals streak signal',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[1,0],[1,1],[0,1],[2,0],[2,1]],
    [[1,0],[1,1],[0,1],[2,0],[1,2]],
    {under25:1.45,over15:1.70,streakYes:1.30}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-under25-streak-conflict')
})

test('V5 BTTS rejects when one team goal price is too cold',()=>{
  const result=diagnoseFilterFixture(fixture(
    [[1,1],[2,1],[1,2],[2,2],[1,0]],
    [[1,1],[2,1],[1,2],[2,2],[1,0]],
    {ggYes:1.40,gg2No:1.45,homeO05:1.25,awayO05:1.70}
  ))
  assert.equal(result.pick,null)
  assert.equal(result.skip,'v5-gg-team-goal-confirmation')
})

test('V5 keeps genuinely strong versions of the other five markets publishable',async t=>{
  await t.test('straight win',()=>{
    const result=diagnoseFilterFixture(fixture(
      [[2,0],[1,0],[2,1],[3,0],[1,1]],
      [[0,1],[0,2],[1,2],[0,3],[1,1]],
      {homeWin:1.35,drawWin:4.20,awayWin:7.50,awayO05:1.80,homeO15:1.45}
    ))
    assert.equal(result.pick?.route,'straight-win')
  })

  await t.test('Under 3.5',()=>{
    const result=diagnoseFilterFixture(fixture(
      [[1,0],[1,1],[2,0],[1,0],[3,0]],
      [[1,0],[1,1],[2,0],[1,0],[2,1]],
      {under35:1.22,over15:1.50}
    ))
    assert.equal(result.pick?.route,'under-35')
  })

  await t.test('Over 2.5',()=>{
    const result=diagnoseFilterFixture(fixture(
      [[2,1],[3,0],[2,2],[1,2],[2,0]],
      [[2,1],[3,0],[2,2],[1,2],[2,0]],
      {over25:1.40,under35:1.75}
    ))
    assert.equal(result.pick?.route,'over-25')
  })

  await t.test('Under 2.5',()=>{
    const result=diagnoseFilterFixture(fixture(
      [[1,0],[1,1],[0,1],[2,0],[2,1]],
      [[1,0],[1,1],[0,1],[2,0],[1,2]],
      {under25:1.45,over15:1.70}
    ))
    assert.equal(result.pick?.route,'under-25')
  })

  await t.test('BTTS',()=>{
    const result=diagnoseFilterFixture(fixture(
      [[1,1],[2,1],[1,2],[2,2],[1,0]],
      [[1,1],[2,1],[1,2],[2,2],[1,0]],
      {ggYes:1.40,gg2No:1.45,homeO05:1.25,awayO05:1.30}
    ))
    assert.equal(result.pick?.route,'gg')
  })
})
