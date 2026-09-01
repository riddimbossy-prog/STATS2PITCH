import {FINISHED} from './config.js'
import {isSrlMatch} from './redFlags.js'

export const BANKER_ENGINE='banker-totals-v1'
export const BANKER_RULES=Object.freeze({
  boardTeamOver25Max:2.05,
  oppOver05FavWinMin:1.70,
  oppTeamTotalOver25Max:1.50,
  under35Fav2PlusMin:1.60,
  bothTeamTotalMax:1.30,
  drawOrOver25MatchMax:1.50,
  drawOrOver25TypicalMax:1.35,
  streakNoMin:1.20,
  streakNoMax:1.40,
  over15Max:1.30,
  streakUnder35Min:1.40,
  minPublishOdds:1.20,
  ggYesMax:1.50,
  gg2NoMin:1.30,
  topFive:5,
  bottomFour:4,
  formSample:5,
  formMinPct:60,
  formAvgMinPct:60
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const px=v=>finite(v)?+Number(v).toFixed(2):null
const finished=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())

function oddOf(markets,key,names){
  for(const market of markets||[]){
    if(market?.marketKey!==key)continue
    for(const name of names){
      const hit=(market.outcomes||[]).find(o=>norm(o?.name)===norm(name))
      const price=num(hit?.odd)
      if(price)return price
    }
  }
  return null
}

function scanOdd(markets,test){
  for(const market of markets||[]){
    for(const outcome of market.outcomes||[]){
      const price=num(outcome?.odd)
      if(!price)continue
      if(test(norm(market.marketKey),norm(market.market),norm(outcome.name),outcome,market))return price
    }
  }
  return null
}

function isThreePlusStreak(key,market,name){
  const blob=`${key} ${market} ${name}`
  if(/2\s*\+/.test(blob)&&!/3\s*\+/.test(blob))return false
  if(/streak 2/.test(blob)||/2 streak/.test(blob)||key==='goals-streak-2')return false
  return /3\s*\+\s*goals?\s*streak/.test(blob)
    ||/goals?\s*streak\s*3/.test(blob)
    ||/3\s*\+\s*streak/.test(blob)
    ||/streak\s*3/.test(blob)
    ||/3 streak/.test(blob)
    ||/3\+ goals in a row/.test(blob)
    ||/3 or more goals in a row/.test(blob)
    ||/three plus goals?/.test(blob)
    ||key==='goals-streak-3'
    ||key==='goals streak 3'
}

function isTwoPlusStreak(key,market,name){
  const blob=`${key} ${market} ${name}`
  return key==='goals-streak-2'
    ||/2 or more goals in a row/.test(blob)
    ||/goals? streak/.test(blob)
}

function teamGoalOdd(markets,side,line,teamName){
  const key=side==='home'?'home-team-goals':'away-team-goals'
  const direct=oddOf(markets,key,[`Over ${line}`,`O ${line}`])
  if(direct)return direct
  const wanted=norm(teamName)
  return scanOdd(markets,(marketKey,market,name)=>{
    if(!/over/.test(name)||!name.includes(String(line)))return false
    if(marketKey===key)return true
    if(marketKey!=='team-goals'&&!/team goals/.test(market)&&!/team total/.test(market))return false
    if(side==='home'&&(/home/.test(name)||(wanted&&name.includes(wanted))))return true
    if(side==='away'&&(/away/.test(name)||(wanted&&name.includes(wanted))))return true
    return false
  })
}

function streakNoOdd(markets){
  let streak=scanOdd(markets,(key,market,name)=>isThreePlusStreak(key,market,name)&&(name==='no'||/(^| )no($| )/.test(name)))
  if(!streak)streak=oddOf(markets,'goals-streak-3',['No'])
  return streak||null
}

function gg2NoOdd(markets){
  const direct=oddOf(markets,'both-teams-score-2',['No'])
  if(direct)return direct
  return scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return (/gg.?ng.?2|gg 2|btts 2|both teams.*2/.test(blob)||key==='both-teams-score-2'||key==='60000')&&/\bno\b/.test(name)
  })
}

export function extractBankerOdds(fixture){
  const markets=fixture?.marketOdds||[]
  const homeName=fixture?.home?.name||''
  const awayName=fixture?.away?.name||''
  const homeWin=oddOf(markets,'match-winner',['Home','1'])
  const awayWin=oddOf(markets,'match-winner',['Away','2'])
  const draw=oddOf(markets,'match-winner',['Draw','X'])
  const over15=oddOf(markets,'total-goals',['Over 1.5','O 1.5'])
  const over25=oddOf(markets,'total-goals',['Over 2.5','O 2.5'])
  const under35=oddOf(markets,'total-goals',['Under 3.5','U 3.5'])
  const homeO05=teamGoalOdd(markets,'home',0.5,homeName)
  const awayO05=teamGoalOdd(markets,'away',0.5,awayName)
  const homeO15=teamGoalOdd(markets,'home',1.5,homeName)
  const awayO15=teamGoalOdd(markets,'away',1.5,awayName)
  const homeO25=teamGoalOdd(markets,'home',2.5,homeName)
  const awayO25=teamGoalOdd(markets,'away',2.5,awayName)
  const streak=streakNoOdd(markets)
  const ggYes=oddOf(markets,'both-teams-score',['Yes','GG'])
  const gg2No=gg2NoOdd(markets)
  const drawOrOver25=scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return /draw/.test(blob)&&/over/.test(blob)&&/2\.5/.test(blob)
  })
  let favourite=null
  if(homeWin&&awayWin){
    if(homeWin<awayWin)favourite='home'
    else if(awayWin<homeWin)favourite='away'
  }else if(homeWin&&!awayWin)favourite='home'
  else if(awayWin&&!homeWin)favourite='away'
  const favWin=favourite==='home'?homeWin:favourite==='away'?awayWin:null
  const oppWin=favourite==='home'?awayWin:favourite==='away'?homeWin:null
  const oppO05=favourite==='home'?awayO05:favourite==='away'?homeO05:null
  const favO15=favourite==='home'?homeO15:favourite==='away'?awayO15:null
  const favO25=favourite==='home'?homeO25:favourite==='away'?awayO25:null
  const teamOver25Prices=[homeO25,awayO25].filter(finite).map(Number)
  const boardTeamOver25=teamOver25Prices.length?Math.min(...teamOver25Prices):null
  return{
    favourite,homeWin,awayWin,draw,favWin,oppWin,
    over15,over25,under35,streakNo:streak,streakYes:streak,drawOrOver25,ggYes,gg2No,
    homeO05,awayO05,homeO15,awayO15,homeO25,awayO25,oppO05,favO15,favO25,boardTeamOver25
  }
}

export function buildLeagueScoringProfile(history=[]){
  const rows=(history||[]).filter(f=>finished(f)&&finite(f?.goals?.home)&&finite(f?.goals?.away))
  let goals=0,draws=0,over25=0
  for(const f of rows){
    const h=Number(f.goals.home),a=Number(f.goals.away),t=h+a
    goals+=t;if(h===a)draws++;if(t>2.5)over25++
  }
  const matches=rows.length
  const avgGoals=matches?Math.round(goals*100/matches)/100:null
  const drawRate=matches?Math.round(draws*1000/matches)/10:null
  const over25Rate=matches?Math.round(over25*1000/matches)/10:null
  let className='insufficient'
  if(matches>=20){
    if(Number(over25Rate)>=56||Number(avgGoals)>=2.8)className='high-scoring'
    else if(Number(over25Rate)<50&&Number(avgGoals)<=2.6&&Number(drawRate)>=30)className='neutral'
    else className='neutral'
  }
  return{class:className,matches,avgGoals,drawRate,over25Rate}
}

function ordinal(n){
  const i=Math.round(Number(n))
  if(!Number.isFinite(i))return '—'
  const k=i%100,s=i%10
  const suf=k>=11&&k<=13?'th':s===1?'st':s===2?'nd':s===3?'rd':'th'
  return `${i}${suf}`
}

export function buildOverallTable(history=[]){
  const teams=new Map()
  const bump=(t,gf,ga,pts)=>{
    if(t?.id===undefined||t?.id===null)return
    const k=String(t.id)
    const row=teams.get(k)||{id:t.id,name:t.name||'',played:0,points:0,gf:0,ga:0}
    row.played++;row.gf+=gf;row.ga+=ga;row.points+=pts
    if(!row.name&&t.name)row.name=t.name
    teams.set(k,row)
  }
  for(const f of history||[]){
    const done=['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||'').toUpperCase())
    if(!done)continue
    const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
    if(!Number.isFinite(h)||!Number.isFinite(a))continue
    bump(f?.teams?.home,h,a,h>a?3:h===a?1:0)
    bump(f?.teams?.away,a,h,a>h?3:a===h?1:0)
  }
  const rows=[...teams.values()].map(r=>({...r,gd:r.gf-r.ga}))
  rows.sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||String(a.name).localeCompare(String(b.name)))
  return new Map(rows.map((r,i)=>[String(r.id),{position:i+1,size:rows.length,played:r.played,points:r.points,gd:r.gd,gf:r.gf,ga:r.ga,name:r.name}]))
}

function tablePos(f,side){
  return num(f?.[side==='home'?'homeStanding':'awayStanding']?.position)
}

function tableSize(f,side){
  return num(f?.[side==='home'?'homeStanding':'awayStanding']?.size)
}

function bothTopFive(f){
  const hp=tablePos(f,'home'),ap=tablePos(f,'away')
  return finite(hp)&&finite(ap)&&hp<=BANKER_RULES.topFive&&ap<=BANKER_RULES.topFive
}

function inBottomFour(position,size){
  return finite(position)&&finite(size)&&size>=BANKER_RULES.bottomFour&&position>size-BANKER_RULES.bottomFour
}

function bothBottomFour(f){
  return inBottomFour(tablePos(f,'home'),tableSize(f,'home'))&&inBottomFour(tablePos(f,'away'),tableSize(f,'away'))
}

function tableReason(f){
  const hp=tablePos(f,'home'),ap=tablePos(f,'away')
  const home=text(f?.home?.name||'Home'),away=text(f?.away?.name||'Away')
  if(finite(hp)&&finite(ap))return `League table: ${home} ${ordinal(hp)} vs ${away} ${ordinal(ap)} — not Top-5 vs Top-5 or Bottom-4 vs Bottom-4.`
  return 'League table places were not both confirmed, so Top-5 vs Top-5 and Bottom-4 vs Bottom-4 did not apply.'
}

function venueRows(fixtures,teamId,venue){
  return (fixtures||[]).filter(row=>{
    if(!finished(row))return false
    const hid=String(row?.teams?.home?.id??''),aid=String(row?.teams?.away?.id??'')
    const id=String(teamId??'')
    if(!id)return false
    return venue==='home'?hid===id:aid===id
  }).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
}

function hitRate(rows,venue,test){
  let played=0,hits=0
  for(const row of rows||[]){
    const h=num(row?.goals?.home),a=num(row?.goals?.away)
    if(h===null||a===null)continue
    const own=venue==='home'?h:a,opp=venue==='home'?a:h
    played++
    if(test({h,a,own,opp,total:h+a}))hits++
  }
  return{played,hits,rate:played?Math.round(hits*100/played):null}
}

function publishedTest(published,side,favourite){
  const market=String(published?.market||'')
  const sel=String(published?.selection||'')
  if(market==='both-teams-score')return /yes|gg/.test(norm(sel))?x=>x.h>0&&x.a>0:x=>!(x.h>0&&x.a>0)
  if(market==='total-goals'){
    if(sel==='Over 1.5')return x=>x.total>1.5
    if(sel==='Over 2.5')return x=>x.total>2.5
    if(sel==='Under 3.5')return x=>x.total<3.5
  }
  if(market==='draw-or-over-25')return x=>x.h===x.a||x.total>2.5
  if(market==='match-winner'){
    if(sel==='Draw'||sel==='X')return x=>x.h===x.a
    const want=sel==='Home'||(favourite==='home'&&sel!=='Away')?'home':'away'
    if(side!==want)return null
    return x=>x.own>x.opp
  }
  if(market==='home-team-goals'){
    if(side!=='home')return null
    if(sel==='Over 1.5')return x=>x.own>=2
    if(sel==='Over 2.5')return x=>x.own>=3
  }
  if(market==='away-team-goals'){
    if(side!=='away')return null
    if(sel==='Over 1.5')return x=>x.own>=2
    if(sel==='Over 2.5')return x=>x.own>=3
  }
  return x=>x.total>1.5
}

function formLabel(published){
  const market=String(published?.market||'')
  const sel=String(published?.displaySelection||published?.selection||'this pick')
  if(market==='both-teams-score')return 'BTTS'
  if(market==='draw-or-over-25')return 'Draw or Over 2.5'
  if(market==='match-winner'&&(sel==='Draw'||published?.selection==='Draw'))return 'Draw'
  return sel
}

export function confirmLast5(f,published,favourite){
  const sample=BANKER_RULES.formSample
  const minPct=BANKER_RULES.formMinPct
  const avgMin=BANKER_RULES.formAvgMinPct
  const homeId=f?.home?.id,awayId=f?.away?.id
  const homeAll=venueRows(f?.home?.fixtures||f?.home?.lastMatches,homeId,'home')
  const awayAll=venueRows(f?.away?.fixtures||f?.away?.lastMatches,awayId,'away')
  const sides=[
    {side:'home',label:text(f?.home?.name||'Home'),venue:'home',all:homeAll,test:publishedTest(published,'home',favourite)},
    {side:'away',label:text(f?.away?.name||'Away'),venue:'away',all:awayAll,test:publishedTest(published,'away',favourite)}
  ].filter(row=>typeof row.test==='function')
  if(!sides.length)return{ok:false,skip:'form-sample',reasons:['Last 5 form could not be matched to this market.']}
  const reasons=[]
  for(const row of sides){
    const last=hitRate(row.all.slice(0,sample),row.venue,row.test)
    const avg=hitRate(row.all,row.venue,row.test)
    if(last.played<sample)return{ok:false,skip:'form-sample',reasons:[`${row.label} last ${sample} ${row.venue} games are incomplete (${last.played}/${sample}).`]}
    const ofAvg=finite(avg.rate)&&avg.rate>0?Math.round(last.rate*100/avg.rate):null
    if(last.rate<minPct)return{ok:false,skip:'form-confirm',reasons:[`${row.label} last ${sample}: ${formLabel(published)} in ${last.hits}/${last.played} (${last.rate}%) — below ${minPct}%.`]}
    if(finite(avg.rate)&&avg.played>sample&&avg.rate<avgMin)return{ok:false,skip:'form-avg',reasons:[`${row.label} average ${formLabel(published)} is ${avg.rate}% over ${avg.played} ${row.venue} games — below ${avgMin}%.`]}
    if(ofAvg!=null&&ofAvg<BANKER_RULES.formAvgMinPct)return{ok:false,skip:'form-avg',reasons:[`${row.label} last ${sample} is ${last.rate}% vs average ${avg.rate}% (${ofAvg}% of average) — below ${BANKER_RULES.formAvgMinPct}%.`]}
    const avgBit=finite(avg.rate)?`, average ${avg.rate}% over ${avg.played}`:''
    const matchBit=ofAvg!=null?` — last 5 is ${ofAvg}% of the average`:''
    reasons.push(`${row.label} last ${sample} ${row.venue}: ${formLabel(published)} in ${last.hits}/${last.played} (${last.rate}%${avgBit})${matchBit}. Clears ${minPct}%.`)
  }
  return{ok:true,skip:null,reasons}
}

function publishedGg(odds){
  const price=px(odds.ggYes)
  if(!price||price<BANKER_RULES.minPublishOdds||price>=BANKER_RULES.ggYesMax)return null
  if(finite(odds.gg2No)&&odds.gg2No<=BANKER_RULES.gg2NoMin)return null
  return{market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',odds:price,family:'BTTS'}
}

function publishedFavWin(f,odds){
  const price=px(odds.favWin)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'match-winner',selection:'Home',displaySelection:`${f.home.name} to Win`,odds:price,family:'1X2'}
    :{market:'match-winner',selection:'Away',displaySelection:`${f.away.name} to Win`,odds:price,family:'1X2'}
}

function publishedFav2Plus(f,odds){
  const price=px(odds.favO15)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'home-team-goals',selection:'Over 1.5',displaySelection:`${f.home.name} 2+`,odds:price,family:'Team Goals'}
    :{market:'away-team-goals',selection:'Over 1.5',displaySelection:`${f.away.name} 2+`,odds:price,family:'Team Goals'}
}

function publishedFav3Plus(f,odds){
  const price=px(odds.favO25)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'home-team-goals',selection:'Over 2.5',displaySelection:`${f.home.name} 3+`,odds:price,family:'Team Goals'}
    :{market:'away-team-goals',selection:'Over 2.5',displaySelection:`${f.away.name} 3+`,odds:price,family:'Team Goals'}
}

function publishedOver(line,price){
  const odd=px(price)
  if(!odd)return null
  return{market:'total-goals',selection:`Over ${line}`,displaySelection:`Over ${line}`,odds:odd,family:'Goals'}
}

function publishedDraw(odds){
  const price=px(odds.draw)
  if(!price)return null
  return{market:'match-winner',selection:'Draw',displaySelection:'1X2 \u00b7 Draw',odds:price,family:'1X2'}
}

function publishedDrawOrOver25(odds){
  const combo=px(odds.drawOrOver25)
  if(combo)return{market:'draw-or-over-25',selection:'Draw or Over 2.5',displaySelection:'Draw or Over 2.5',odds:combo,family:'Combo'}
  const over=px(odds.over25),draw=px(odds.draw)
  const overOk=finite(over)&&over<=BANKER_RULES.drawOrOver25TypicalMax
  const drawOk=finite(draw)&&draw<=BANKER_RULES.drawOrOver25TypicalMax
  if(overOk&&!drawOk)return publishedOver(2.5,over)
  if(drawOk&&!overOk)return publishedDraw(odds)
  if(overOk&&drawOk)return over<=draw?publishedOver(2.5,over):publishedDraw(odds)
  if(finite(over)&&over<BANKER_RULES.drawOrOver25MatchMax)return publishedOver(2.5,over)
  return null
}

function nextAvailableSteps(f,odds,published){
  const sel=String(published?.selection||'')
  const fam=String(published?.family||'')
  if(fam==='1X2'&&(sel==='Home'||sel==='Away'))return [publishedFav2Plus(f,odds),publishedOver(1.5,odds.over15),publishedFav3Plus(f,odds),publishedOver(2.5,odds.over25)]
  if(fam==='Team Goals'&&sel==='Over 1.5')return [publishedFav3Plus(f,odds),publishedOver(1.5,odds.over15),publishedOver(2.5,odds.over25)]
  if(fam==='Goals'&&sel==='Over 1.5')return [publishedOver(2.5,odds.over25)]
  if(sel==='Over 2.5'||fam==='Combo')return [publishedDraw(odds),publishedFav2Plus(f,odds)]
  return [publishedFav2Plus(f,odds),publishedOver(1.5,odds.over15),publishedOver(2.5,odds.over25)]
}

function liftToFloor(f,odds,published){
  if(!published)return{published:null,lifted:false,from:null}
  if(Number(published.odds)>=BANKER_RULES.minPublishOdds)return{published,lifted:false,from:null}
  const from={...published}
  for(const next of nextAvailableSteps(f,odds,published)){
    if(next&&Number(next.odds)>=BANKER_RULES.minPublishOdds)return{published:next,lifted:true,from}
  }
  return{published:null,lifted:true,from}
}

function pack(f,odds,rule,published,reasons){
  return{
    fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
    home:f.home?.name,away:f.away?.name,homeId:f.home?.id??null,awayId:f.away?.id??null,
    homeLogo:f.home?.logo||null,awayLogo:f.away?.logo||null,
    homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,
    homeStanding:f.homeStanding||null,awayStanding:f.awayStanding||null,
    market:published.market,selection:published.selection,displaySelection:published.displaySelection,
    pick:published.displaySelection,odds:published.odds,family:published.family,
    rule,engine:BANKER_ENGINE,favourite:odds.favourite||null,
    reasons,why:reasons,whyText:reasons.join(' '),
    oddsBook:{
      favWin:px(odds.favWin),oppWin:px(odds.oppWin),draw:px(odds.draw),
      over15:px(odds.over15),over25:px(odds.over25),under35:px(odds.under35),
      oppO05:px(odds.oppO05),homeO05:px(odds.homeO05),awayO05:px(odds.awayO05),
      favO15:px(odds.favO15),homeO25:px(odds.homeO25),awayO25:px(odds.awayO25),
      favO25:px(odds.favO25),boardTeamOver25:px(odds.boardTeamOver25),streakNo:px(odds.streakNo),streakYes:px(odds.streakNo),
      ggYes:px(odds.ggYes),gg2No:px(odds.gg2No)
    },
    sportyEventId:f.sportyEventId||null
  }
}

function boardReason(odds){
  return `Board filter: team total Over 2.5 is ${px(odds.boardTeamOver25)} (home ${px(odds.homeO25)} / away ${px(odds.awayO25)}), max ${BANKER_RULES.boardTeamOver25Max.toFixed(2)}.`
}

function emit(f,odds,rule,published,reasons){
  const chosen=liftToFloor(f,odds,published)
  if(!chosen.published)return{pick:null,skip:'odds-below-floor',odds}
  if(chosen.lifted)reasons.push(`Qualified price ${chosen.from.displaySelection} @ ${chosen.from.odds} was under ${BANKER_RULES.minPublishOdds.toFixed(2)}. Next available: ${chosen.published.displaySelection} @ ${chosen.published.odds}.`)
  const form=confirmLast5(f,chosen.published,odds.favourite)
  if(!form.ok)return{pick:null,skip:form.skip,odds,form}
  reasons.push(...form.reasons)
  return{pick:pack(f,odds,rule,chosen.published,reasons),skip:null,odds}
}

function take(out,state){
  if(out?.pick)return out
  if(out?.skip&&String(out.skip).startsWith('form')){state.formSkip=out.skip;return null}
  return out
}

export function evaluateBankerFixture(f){
  if(isSrlMatch(f))return{pick:null,skip:'srl'}
  const odds=extractBankerOdds(f)
  const over25=num(odds.over25)
  const oppO05=num(odds.oppO05)
  const homeO05=num(odds.homeO05)
  const awayO05=num(odds.awayO05)
  const under35=num(odds.under35)
  const over15=num(odds.over15)
  const streak=num(odds.streakNo??odds.streakYes)
  const boardTeamOver25=num(odds.boardTeamOver25)
  const onBoard=finite(boardTeamOver25)&&boardTeamOver25<=BANKER_RULES.boardTeamOver25Max
  const bothScore=finite(homeO05)&&finite(awayO05)&&homeO05<BANKER_RULES.bothTeamTotalMax&&awayO05<BANKER_RULES.bothTeamTotalMax
  const state={formSkip:null}

  if(bothScore){
    const gg=publishedGg(odds)
    if(gg){
      const out=take(emit(f,odds,'GG_BOTH_TT',gg,[
        `GG board: both team totals Over 0.5 are under ${BANKER_RULES.bothTeamTotalMax.toFixed(2)} (${px(homeO05)} / ${px(awayO05)}).`,
        `BTTS Yes is ${px(odds.ggYes)} (under ${BANKER_RULES.ggYesMax.toFixed(2)}).`,
        finite(odds.gg2No)?`GG 2+ No is ${px(odds.gg2No)} (over ${BANKER_RULES.gg2NoMin.toFixed(2)}).`:`GG 2+ No was not required because it was not on the board.`
      ]),state)
      if(out)return out
    }
  }

  if(onBoard&&bothScore&&finite(over25)&&over25<BANKER_RULES.drawOrOver25MatchMax){
    const published=publishedDrawOrOver25(odds)
    if(published){
      const out=take(emit(f,odds,'DRAW_OR_OVER25',published,[
        boardReason(odds),
        `Both team totals Over 0.5 are under ${BANKER_RULES.bothTeamTotalMax.toFixed(2)} (${px(homeO05)} / ${px(awayO05)}).`,
        `Match Over 2.5 is ${px(over25)} (under ${BANKER_RULES.drawOrOver25MatchMax.toFixed(2)}).`,
        `Qualified ${published.displaySelection} @ ${published.odds}.`
      ]),state)
      if(out)return out
    }
  }

  if(onBoard&&finite(oppO05)&&oppO05>BANKER_RULES.oppOver05FavWinMin){
    const published=publishedFavWin(f,odds)
    if(published){
      const out=take(emit(f,odds,'OPP_O05_FAV_WIN',published,[
        boardReason(odds),
        `Opponent team total Over 0.5 is ${px(oppO05)} > ${BANKER_RULES.oppOver05FavWinMin.toFixed(2)}.`,
        `Favourite to win: ${published.displaySelection} @ ${published.odds}.`
      ]),state)
      if(out)return out
    }else return{pick:null,skip:'missing-fav-win-odds',odds}
  }

  if(onBoard&&finite(oppO05)&&oppO05<BANKER_RULES.oppTeamTotalOver25Max){
    const published=publishedOver(2.5,over25)
    if(published){
      const out=take(emit(f,odds,'OPP_TT_OVER25',published,[
        boardReason(odds),
        `Opponent team total Over 0.5 is ${px(oppO05)} < ${BANKER_RULES.oppTeamTotalOver25Max.toFixed(2)}.`,
        `Total goals Over 2.5 @ ${published.odds}.`
      ]),state)
      if(out)return out
    }
  }

  if(onBoard&&finite(under35)&&under35>BANKER_RULES.under35Fav2PlusMin){
    const published=publishedFav2Plus(f,odds)
    if(published){
      const out=take(emit(f,odds,'U35_FAV_2PLUS',published,[
        boardReason(odds),
        `Under 3.5 is ${px(under35)} > ${BANKER_RULES.under35Fav2PlusMin.toFixed(2)}.`,
        `Favourite to score 2+: ${published.displaySelection} @ ${published.odds}.`
      ]),state)
      if(out)return out
    }else return{pick:null,skip:'missing-fav-2plus-odds',odds}
  }

  const streakWindow=finite(streak)&&streak>=BANKER_RULES.streakNoMin&&streak<=BANKER_RULES.streakNoMax
  const over15Cheap=finite(over15)&&over15<BANKER_RULES.over15Max
  const under35Open=finite(under35)&&under35>BANKER_RULES.streakUnder35Min
  if(streakWindow&&over15Cheap&&under35Open){
    if(bothTopFive(f))return{pick:null,skip:'both-top-five',odds}
    if(bothBottomFour(f))return{pick:null,skip:'both-bottom-four',odds}
    const published=publishedOver(1.5,over15)
    if(published){
      const out=take(emit(f,odds,'STREAK_OVER15',published,[
        `Over 1.5 board: 3+ goals streak No is ${px(streak)} (${BANKER_RULES.streakNoMin.toFixed(2)}-${BANKER_RULES.streakNoMax.toFixed(2)}).`,
        `Over 1.5 is ${px(over15)} < ${BANKER_RULES.over15Max.toFixed(2)}.`,
        `Under 3.5 is ${px(under35)} > ${BANKER_RULES.streakUnder35Min.toFixed(2)}.`,
        tableReason(f)
      ]),state)
      if(out)return out
    }
  }

  if(!onBoard&&finite(streak)&&!streakWindow)return{pick:null,skip:'streak-3plus-outside-window',odds}
  if(!onBoard&&!finite(streak)&&finite(over15))return{pick:null,skip:'missing-3plus-streak',odds}
  if(!finite(boardTeamOver25))return{pick:null,skip:'missing-team-over25',odds}
  if(!onBoard)return{pick:null,skip:'team-over25-above-board-max',odds}
  return{pick:null,skip:state.formSkip||'no-rule-qualified',odds}
}

export function buildBankerRules(fixtures=[]){
  const picks=[],skipCounts={}
  for(const f of fixtures||[]){
    const result=evaluateBankerFixture(f)
    if(result.pick)picks.push(result.pick)
    else skipCounts[result.skip]=(skipCounts[result.skip]||0)+1
  }
  picks.sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(a.odds)-Number(b.odds))
  return{picks,meta:{engine:BANKER_ENGINE,count:picks.length,skips:skipCounts,rules:BANKER_RULES}}
}
