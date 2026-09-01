import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateBankerFixture,buildLeagueScoringProfile,buildOverallTable,confirmLast5,BANKER_ENGINE} from '../server/bankerEngine.js'

function outcome(name,odd){return{name,odd}}
function markets({homeWin=1.45,awayWin=4.20,draw=3.80,over15=1.22,over25=1.72,under35=1.55,homeO05=1.18,awayO05=1.85,homeO15=1.55,awayO15=2.40,homeO25=1.85,awayO25=3.10,streak=1.32,streak2=null,ggYes=null,gg2No=null}={}){
  const rows=[
    {marketKey:'match-winner',market:'1X2',outcomes:[outcome('Home',homeWin),outcome('Draw',draw),outcome('Away',awayWin)]},
    {marketKey:'total-goals',market:'Total Goals',outcomes:[outcome('Over 1.5',over15),outcome('Over 2.5',over25),outcome('Under 3.5',under35)]},
    {marketKey:'home-team-goals',market:'Home Team Goals',outcomes:[outcome('Over 0.5',homeO05),outcome('Over 1.5',homeO15),outcome('Over 2.5',homeO25)]},
    {marketKey:'away-team-goals',market:'Away Team Goals',outcomes:[outcome('Over 0.5',awayO05),outcome('Over 1.5',awayO15),outcome('Over 2.5',awayO25)]}
  ]
  if(streak!=null)rows.push({marketKey:'goals-streak-3',market:'3+ Goals Streak',outcomes:[outcome('No',streak)]})
  if(streak2!=null)rows.push({marketKey:'goals-streak-2',market:'Goals Streak',outcomes:[outcome('Yes',streak2)]})
  if(ggYes!=null)rows.push({marketKey:'both-teams-score',market:'GG/NG',outcomes:[outcome('Yes',ggYes),outcome('No',2.80)]})
  if(gg2No!=null)rows.push({marketKey:'both-teams-score-2',market:'GG/NG 2+',outcomes:[outcome('Yes',3.10),outcome('No',gg2No)]})
  return rows
}

function played(id,homeId,awayId,hg,ag,day){
  return{
    fixture:{id,date:`2026-08-${String(day).padStart(2,'0')}T15:00:00Z`,status:{short:'FT'}},
    teams:{home:{id:homeId,name:String(homeId)},away:{id:awayId,name:String(awayId)}},
    goals:{home:hg,away:ag}
  }
}

function supportingForm({homeHits=4,awayHits=4,n=5,homeScore=[3,1],awayScore=[1,3],miss=[0,0]}={}){
  const home=[],away=[]
  for(let i=0;i<n;i++){
    const h=i<homeHits?homeScore:miss
    const a=i<awayHits?awayScore:miss
    home.push(played(10+i,1,90+i,h[0],h[1],20-i))
    away.push(played(50+i,80+i,2,a[0],a[1],20-i))
  }
  return{home,away}
}

function fixture(odds={},extra={}){
  const form=extra.noForm?{home:[],away:[]}:extra.form||supportingForm(extra.formOpts||{})
  return{
    fixtureId:'fx',league:'Test League',country:'Test',kickoff:'2026-08-20T18:00:00Z',
    home:{id:1,name:'Home FC',fixtures:form.home,formHistory:form.home,lastMatches:form.home},
    away:{id:2,name:'Away FC',fixtures:form.away,formHistory:form.away,lastMatches:form.away},
    homeSplit:{position:extra.hpos??7,size:12,sampleReady:true},
    awaySplit:{position:extra.apos??10,size:12,sampleReady:true},
    homeStanding:{position:extra.hstand??8,size:extra.hsize??12,played:5},
    awayStanding:{position:extra.astand??9,size:extra.asize??12,played:5},
    marketOdds:markets(odds),
    ...extra.rest
  }
}

test('engine id is banker-totals-v1',()=>{
  const r=evaluateBankerFixture(fixture({awayO05:1.90,homeO25:1.90}))
  assert.equal(r.pick.engine,BANKER_ENGINE)
})

test('board starts only when a team total Over 2.5 is 2.05 or shorter',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.20,awayO25:2.40,over25:1.70,over15:1.40,under35:1.30,streak:null,awayO05:1.90}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'missing-3plus-streak')
})

test('a single side at 2.05 is enough to enter the board',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:2.05,awayO25:3.40,awayO05:1.85,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
})

test('opponent Over 0.5 above 1.70 publishes favourite win',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:1.80,awayO05:1.85,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.market,'match-winner')
  assert.equal(r.pick?.selection,'Home')
  assert.equal(r.pick?.odds,1.40)
  assert.match(r.pick.whyText,/last 5 home: Home FC to Win in 4\/5/)
})

test('favourite win shorter than 1.20 stays when 2+ form does not confirm',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.15,awayWin:5.80,homeO25:1.80,awayO05:1.85,homeO15:1.33,under35:1.40},{formOpts:{homeScore:[1,0],awayScore:[0,1]}}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.displaySelection,'Home FC to Win')
  assert.equal(r.pick?.odds,1.15)
  assert.match(r.pick.whyText,/did not confirm the bump/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('favourite win shorter than 1.20 bumps to 2+ when last 5 confirms',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.15,awayWin:5.80,homeO25:1.80,awayO05:1.85,homeO15:1.33,under35:1.40}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.displaySelection,'Home FC 2+')
  assert.equal(r.pick?.odds,1.33)
  assert.match(r.pick.whyText,/Last 5 form confirms Home FC 2\+/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('opponent team total under 1.50 publishes Over 2.5',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.88,awayO05:1.35,under35:1.45,homeO05:1.40,homeO25:1.90}))
  assert.equal(r.pick?.rule,'OPP_TT_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.88)
})

test('Under 3.5 above 1.60 publishes favourite 2+',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.90,awayO05:1.60,under35:1.75,homeO15:1.38,homeO25:1.95}))
  assert.equal(r.pick?.rule,'U35_FAV_2PLUS')
  assert.equal(r.pick?.market,'home-team-goals')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.displaySelection,'Home FC 2+')
})

test('favourite 2+ shorter than 1.20 stays when 3+ form does not confirm',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.90,awayO05:1.60,under35:1.75,homeO15:1.12,homeO25:1.95,over15:1.26},{formOpts:{homeScore:[2,0],awayScore:[0,2]}}))
  assert.equal(r.pick?.rule,'U35_FAV_2PLUS')
  assert.equal(r.pick?.displaySelection,'Home FC 2+')
  assert.equal(r.pick?.odds,1.12)
  assert.match(r.pick.whyText,/did not confirm the bump/)
})

test('favourite 2+ shorter than 1.20 bumps to 3+ when last 5 confirms',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.90,awayO05:1.60,under35:1.75,homeO15:1.12,homeO25:1.95,over15:1.26}))
  assert.equal(r.pick?.rule,'U35_FAV_2PLUS')
  assert.equal(r.pick?.displaySelection,'Home FC 3+')
  assert.equal(r.pick?.odds,1.95)
  assert.match(r.pick.whyText,/Last 5 form confirms Home FC 3\+/)
})

test('both team totals under 1.30 and match Over 2.5 under 1.50 publishes Over 2.5 or Draw',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.32,homeO05:1.20,awayO05:1.22,draw:3.60,under35:1.45,homeO25:1.70}))
  assert.equal(r.pick?.rule,'DRAW_OR_OVER25')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.32)
})

test('GG publishes when both sides are priced to score and BTTS Yes is under 1.50',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.80,homeO05:1.18,awayO05:1.22,ggYes:1.38,gg2No:1.45,homeO25:1.90,awayO05:1.22}))
  assert.equal(r.pick?.rule,'GG_BOTH_TT')
  assert.equal(r.pick?.market,'both-teams-score')
  assert.equal(r.pick?.selection,'Yes')
  assert.equal(r.pick?.displaySelection,'BTTS · Yes')
  assert.equal(r.pick?.odds,1.38)
  assert.match(r.pick.whyText,/BTTS in 4\/5/)
  assert.match(r.pick.whyText,/Clears 60%/)
})

test('BTTS Yes shorter than 1.20 publishes at that price',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.80,homeO05:1.18,awayO05:1.22,ggYes:1.16,gg2No:1.45,homeO25:1.90}))
  assert.equal(r.pick?.rule,'GG_BOTH_TT')
  assert.equal(r.pick?.displaySelection,'BTTS · Yes')
  assert.equal(r.pick?.odds,1.16)
  assert.doesNotMatch(r.pick.whyText,/Next available/)
})

test('Over 1.5 board starts on 3+ goals streak No 1.20-1.40',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.20,awayO05:1.60}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.odds,1.22)
  assert.match(r.pick.whyText,/3\+ goals streak No is 1\.2/)
})

test('Over 1.5 shorter than 1.20 stays when Over 2.5 form does not confirm',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:1.28,over15:1.08,under35:1.55,streak:1.24,awayO05:1.60},{formOpts:{homeScore:[2,0],awayScore:[0,2]}}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.equal(r.pick?.selection,'Over 1.5')
  assert.equal(r.pick?.odds,1.08)
  assert.match(r.pick.whyText,/did not confirm the bump/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('Over 1.5 shorter than 1.20 bumps to Over 2.5 when last 5 confirms',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:1.28,over15:1.08,under35:1.55,streak:1.24,awayO05:1.60}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.equal(r.pick?.selection,'Over 2.5')
  assert.equal(r.pick?.odds,1.28)
  assert.match(r.pick.whyText,/Last 5 form confirms Over 2\.5/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('2-in-a-row streak Yes is ignored; Over 1.5 needs 3+ streak No 1.20-1.40',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:4.20,streak2:1.28,awayO05:1.60}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'streak-3plus-outside-window')
})

test('streak No below 1.20 does not publish Over 1.5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.19,streak2:1.19,awayO05:1.60}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'streak-3plus-outside-window')
})

test('streak Over 1.5 never publishes when both overall table places are top 5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hpos:10,apos:1,hstand:5,astand:2}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'both-top-five')
})

test('streak Over 1.5 never publishes when both overall table places are bottom 4',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hpos:2,apos:4,hstand:11,astand:10,hsize:12,asize:12}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'both-bottom-four')
})

test('one side in the bottom 4 does not block Over 1.5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hstand:12,astand:8,hsize:12,asize:12}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.match(r.pick.whyText,/12th vs Away FC 8th/)
  assert.match(r.pick.whyText,/Bottom-4 vs Bottom-4/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('venue-split top 5 does not block Over 1.5 when the league table is not Top-5 vs Top-5',()=>{
  const r=evaluateBankerFixture(fixture({homeO25:2.40,awayO25:2.50,over25:2.30,over15:1.22,under35:1.55,streak:1.30},{hpos:2,apos:4,hstand:10,astand:8}))
  assert.equal(r.pick?.rule,'STREAK_OVER15')
  assert.match(r.pick.whyText,/10th vs Away FC 8th/)
  assert.match(r.pick.whyText,/not Top-5 vs Top-5 or Bottom-4 vs Bottom-4/)
  assert.doesNotMatch(r.pick.whyText,/is blocked/)
})

test('overall table ranks current-season points then goal difference',()=>{
  const ft=id=>({fixture:{id,status:{short:'FT'}}})
  const rows=[
    {...ft(1),teams:{home:{id:1,name:'Leaders'},away:{id:2,name:'Second'}},goals:{home:2,away:0}},
    {...ft(2),teams:{home:{id:2,name:'Second'},away:{id:3,name:'Third'}},goals:{home:1,away:0}},
    {...ft(3),teams:{home:{id:1,name:'Leaders'},away:{id:3,name:'Third'}},goals:{home:1,away:1}}
  ]
  const table=buildOverallTable(rows)
  assert.equal(table.get('1').position,1)
  assert.equal(table.get('1').points,4)
  assert.equal(table.get('2').position,2)
  assert.equal(table.get('3').position,3)
})

test('favourite can be the away side',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:3.80,awayWin:1.50,over25:1.70,homeO05:1.88,awayO05:1.15,under35:1.40,awayO25:1.75,homeO25:3.20}))
  assert.equal(r.pick?.rule,'OPP_O05_FAV_WIN')
  assert.equal(r.pick?.selection,'Away')
  assert.equal(r.pick?.displaySelection,'Away FC to Win')
})

test('league profile still recognises a high-scoring sample',()=>{
  const rows=[]
  for(let i=0;i<20;i++)rows.push({fixture:{status:{short:'FT'}},goals:{home:i%2?2:3,away:1}})
  assert.equal(buildLeagueScoringProfile(rows).class,'high-scoring')
})

test('last 5 below 60% blocks the selected tip',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:1.80,awayO05:1.85,under35:1.40},{formOpts:{homeHits:2,awayHits:2}}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'form-confirm')
})

test('missing last 5 sample blocks the selected tip',()=>{
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:1.80,awayO05:1.85,under35:1.40},{noForm:true}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'form-sample')
})

test('last 5 must also match at least 60% of the average',()=>{
  const recent=supportingForm({homeHits:4,awayHits:4,n:5,homeScore:[3,1],awayScore:[1,3],miss:[0,0]})
  const olderHome=supportingForm({homeHits:0,awayHits:0,n:5,homeScore:[3,1],awayScore:[1,3],miss:[0,0]}).home.map((row,i)=>({...row,fixture:{...row.fixture,id:200+i,date:`2026-07-${String(20-i).padStart(2,'0')}T15:00:00Z`}}))
  const olderAway=supportingForm({homeHits:0,awayHits:0,n:5,homeScore:[3,1],awayScore:[1,3],miss:[0,0]}).away.map((row,i)=>({...row,fixture:{...row.fixture,id:300+i,date:`2026-07-${String(20-i).padStart(2,'0')}T15:00:00Z`}}))
  const r=evaluateBankerFixture(fixture({homeWin:1.40,awayWin:5.00,homeO25:1.80,awayO05:1.85,under35:1.40},{form:{home:[...recent.home,...olderHome],away:[...recent.away,...olderAway]}}))
  assert.equal(r.pick,null)
  assert.equal(r.skip,'form-avg')
})

test('GG last 5 BTTS below 60% is not published',()=>{
  const r=evaluateBankerFixture(fixture({over25:1.80,homeO05:1.18,awayO05:1.22,ggYes:1.38,gg2No:1.45,homeO25:1.90},{formOpts:{homeHits:2,awayHits:2,homeScore:[3,1],awayScore:[1,3],miss:[1,0]}}))
  assert.equal(r.pick,null)
  assert.ok(r.skip==='form-confirm'||r.skip==='form-avg'||r.skip==='no-rule-qualified'||String(r.skip).startsWith('form'))
})

test('confirmLast5 requires 3 of last 5 and 60% of the average',()=>{
  const form=supportingForm({homeHits:4,awayHits:4})
  const published={market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5'}
  const ok=confirmLast5({home:{id:1,name:'Home FC',fixtures:form.home},away:{id:2,name:'Away FC',fixtures:form.away}},published,null)
  assert.equal(ok.ok,true)
  const weak=confirmLast5({home:{id:1,name:'Home FC',fixtures:supportingForm({homeHits:2,awayHits:2}).home},away:{id:2,name:'Away FC',fixtures:supportingForm({homeHits:2,awayHits:2}).away}},published,null)
  assert.equal(weak.ok,false)
  assert.equal(weak.skip,'form-confirm')
})

test('confirmLast5 uses formHistory last 5 against the longer average',()=>{
  const recent=supportingForm({homeHits:4,awayHits:4,n:5})
  const olderHome=supportingForm({homeHits:10,awayHits:10,n:10}).home.map((row,i)=>({...row,fixture:{...row.fixture,id:400+i,date:`2026-06-${String(20-i).padStart(2,'0')}T15:00:00Z`}}))
  const olderAway=supportingForm({homeHits:10,awayHits:10,n:10}).away.map((row,i)=>({...row,fixture:{...row.fixture,id:500+i,date:`2026-06-${String(20-i).padStart(2,'0')}T15:00:00Z`}}))
  const published={market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5'}
  const ok=confirmLast5({
    home:{id:1,name:'Home FC',fixtures:recent.home.slice(0,5),formHistory:[...recent.home,...olderHome]},
    away:{id:2,name:'Away FC',fixtures:recent.away.slice(0,5),formHistory:[...recent.away,...olderAway]}
  },published,null)
  assert.equal(ok.ok,true)
  assert.match(ok.reasons.join(' '),/average/)
})
