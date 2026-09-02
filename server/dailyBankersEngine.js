import {FINISHED} from './config.js'
import {fixtureHasStats} from './pickWhy.js'
import {isSrlMatch} from './redFlags.js'
import {applyLearningToRows} from './learning.js'

export const DAILY_BANKERS_ENGINE='daily-bankers-v2'
export const DAILY_BANKERS_RULES=Object.freeze({
  recentSample:5,
  minSample:3,
  baselineSample:10,
  recentWeight:0.60,
  baselineWeight:0.40,
  safestMinOdd:1.15,
  safestMaxOdd:1.80,
  safestMinConsensus:75,
  safestMinScore:80,
  valueMinOdd:1.50,
  valueMaxOdd:3.10,
  valueMinConsensus:55,
  valueMinEdge:0.06,
  valueMinScore:72,
  maxSafest:8,
  maxValue:8
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const isHome=(f,id)=>String(f?.teams?.home?.id)===String(id)
const done=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
const pct=(h,t)=>t?Math.round((h/t)*100):null
const clamp=(v,min=0,max=99)=>Math.max(min,Math.min(max,Number(v)||0))

function full(f,id){
  const h=num(f?.goals?.home),a=num(f?.goals?.away)
  if(h===null||a===null)return null
  return isHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}

function half(f,id){
  const h=num(f?.score?.halftime?.home),a=num(f?.score?.halftime?.away)
  if(h===null||a===null)return null
  return isHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}

function rows(fixtures,id,venue,limit){
  return (fixtures||[]).filter(f=>done(f)&&(venue==='home'?isHome(f,id):String(f?.teams?.away?.id)===String(id)))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,limit)
}

function overallRows(fixtures,id,limit){
  return (fixtures||[]).filter(f=>{
    if(!done(f))return false
    const h=String(f?.teams?.home?.id??''),a=String(f?.teams?.away?.id??'')
    return h===String(id)||a===String(id)
  }).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,limit)
}

function rate(fixtures,id,venue,limit,test,halfOnly=false){
  let total=0,hits=0
  for(const f of rows(fixtures,id,venue,limit)){
    const g=halfOnly?half(f,id):full(f,id)
    if(!g)continue
    total++
    if(test(g))hits++
  }
  return{rate:pct(hits,total),hits,total}
}

function rateOverall(fixtures,id,limit,test,halfOnly=false){
  let total=0,hits=0
  for(const f of overallRows(fixtures,id,limit)){
    const g=halfOnly?half(f,id):full(f,id)
    if(!g)continue
    total++
    if(test(g))hits++
  }
  return{rate:pct(hits,total),hits,total}
}

function sideEvidence(fixture,side,test,halfOnly,limit){
  const team=fixture?.[side]||{}
  const id=team.id
  const venue=rate(team.fixtures,id,side,limit,test,halfOnly)
  if(venue.total>=DAILY_BANKERS_RULES.recentSample)return{...venue,source:'venue'}
  const overall=rateOverall(team.lastMatches||team.fixtures,id,Math.max(limit,DAILY_BANKERS_RULES.recentSample),test,halfOnly)
  if(venue.total>=1&&overall.total>=DAILY_BANKERS_RULES.minSample&&venue.rate!=null&&overall.rate!=null){
    return{rate:Math.round(venue.rate*0.7+overall.rate*0.3),hits:venue.hits,total:Math.max(venue.total,overall.total),source:'blended',overall:overall.rate}
  }
  if(overall.total>=DAILY_BANKERS_RULES.minSample)return{...overall,source:'overall'}
  return{...venue,source:'venue'}
}

function parseOU(s){
  const m=String(s||'').match(/\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)/i)
  return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null
}

function selectionTests(marketKey,name){
  const n=norm(name)
  if(marketKey==='match-winner'){
    if(n==='home'||n==='1')return{home:g=>g.own>g.opp,away:g=>g.own<g.opp,teamSide:'home'}
    if(n==='away'||n==='2')return{home:g=>g.own<g.opp,away:g=>g.own>g.opp,teamSide:'away'}
    return null
  }
  if(marketKey==='double-chance'){
    if(n==='1x'||n.includes('home or draw')||n==='home draw')return{home:g=>g.own>=g.opp,away:g=>g.own<=g.opp,teamSide:'home'}
    if(n==='x2'||n.includes('draw or away')||n==='draw away')return{home:g=>g.own<=g.opp,away:g=>g.own>=g.opp,teamSide:'away'}
    if(n==='12'||n.includes('home or away')||n==='home away')return{home:g=>g.own!==g.opp,away:g=>g.own!==g.opp,teamSide:null}
    return null
  }
  if(marketKey==='draw-no-bet'){
    if(n==='home'||n==='1')return{home:g=>g.own>=g.opp,away:g=>g.own<=g.opp,teamSide:'home',pushMarket:true}
    if(n==='away'||n==='2')return{home:g=>g.own<=g.opp,away:g=>g.own>=g.opp,teamSide:'away',pushMarket:true}
    return null
  }
  if(marketKey==='both-teams-score'){
    if(n==='yes'||n==='gg'||n==='btts yes'||n==='goal goal')return{home:g=>g.own>0&&g.opp>0,away:g=>g.own>0&&g.opp>0}
    if(n==='no'||n==='ng'||n==='btts no'||n==='no goal')return{home:g=>!(g.own>0&&g.opp>0),away:g=>!(g.own>0&&g.opp>0)}
    return null
  }
  if(marketKey==='total-goals'){
    const p=parseOU(name);if(!p||p.line<0.5||p.line>5.5)return null
    return{home:g=>p.side==='over'?g.total>p.line:g.total<p.line,away:g=>p.side==='over'?g.total>p.line:g.total<p.line,line:p.line,side:p.side}
  }
  if(marketKey==='first-half-goals'){
    const p=parseOU(name);if(!p||p.line<0.5||p.line>2.5)return null
    return{home:g=>p.side==='over'?g.total>p.line:g.total<p.line,away:g=>p.side==='over'?g.total>p.line:g.total<p.line,line:p.line,side:p.side,halfOnly:true}
  }
  if(marketKey==='first-half-winner'){
    if(n==='home'||n==='1')return{home:g=>g.own>g.opp,away:g=>g.own<g.opp,teamSide:'home',halfOnly:true}
    if(n==='away'||n==='2')return{home:g=>g.own<g.opp,away:g=>g.own>g.opp,teamSide:'away',halfOnly:true}
    return null
  }
  if(marketKey==='home-team-goals'){
    const p=parseOU(name);if(!p||p.line<0.5||p.line>3.5)return null
    return{home:g=>p.side==='over'?g.own>p.line:g.own<p.line,away:g=>p.side==='over'?g.opp>p.line:g.opp<p.line,line:p.line,side:p.side,teamSide:'home'}
  }
  if(marketKey==='away-team-goals'){
    const p=parseOU(name);if(!p||p.line<0.5||p.line>3.5)return null
    return{home:g=>p.side==='over'?g.opp>p.line:g.opp<p.line,away:g=>p.side==='over'?g.own>p.line:g.own<p.line,line:p.line,side:p.side,teamSide:'away'}
  }
  if(marketKey==='team-goals'){
    const p=parseOU(name);if(!p||p.line<0.5||p.line>3.5)return null
    if(/\bhome\b/.test(n))return{home:g=>p.side==='over'?g.own>p.line:g.own<p.line,away:g=>p.side==='over'?g.opp>p.line:g.opp<p.line,line:p.line,side:p.side,teamSide:'home'}
    if(/\baway\b/.test(n))return{home:g=>p.side==='over'?g.opp>p.line:g.opp<p.line,away:g=>p.side==='over'?g.own>p.line:g.own<p.line,line:p.line,side:p.side,teamSide:'away'}
    return null
  }
  return null
}

function tier(split){
  const p=num(split?.position),size=num(split?.size)
  if(split?.sampleReady!==true||!p||!size||p<1||p>size)return null
  return Math.max(1,Math.min(4,Math.ceil((p*4)/size)))
}

function bottomThree(split){
  const p=num(split?.position),size=num(split?.size)
  return !!p&&!!size&&p>size-3
}

function marketLabel(m,o){
  const s=String(o?.name||'Selection')
  if(m.marketKey==='match-winner')return`1X2 · ${s}`
  if(m.marketKey==='double-chance')return`Double Chance · ${s}`
  if(m.marketKey==='draw-no-bet')return`DNB · ${s}`
  if(m.marketKey==='both-teams-score')return`BTTS · ${s}`
  if(m.marketKey==='home-team-goals'||(m.marketKey==='team-goals'&&/\bhome\b/.test(norm(o?.name))))return`Home Team · ${s}`
  if(m.marketKey==='away-team-goals'||(m.marketKey==='team-goals'&&/\baway\b/.test(norm(o?.name))))return`Away Team · ${s}`
  if(m.marketKey==='first-half-goals')return`1H · ${s}`
  if(m.marketKey==='first-half-winner')return`1H Result · ${s}`
  if(m.marketKey==='total-goals')return s
  return s
}

function reliabilityBonus(marketKey,name){
  const p=parseOU(name)
  if(marketKey==='double-chance')return 6
  if(marketKey==='draw-no-bet')return 4
  if(marketKey==='total-goals'&&p?.line===1.5&&p.side==='over')return 6
  if(marketKey==='total-goals'&&p?.line===3.5&&p.side==='under')return 5
  if((marketKey==='home-team-goals'||marketKey==='away-team-goals'||marketKey==='team-goals')&&p?.line===0.5&&p.side==='over')return 5
  if(marketKey==='both-teams-score')return 2
  if(marketKey==='match-winner')return 1
  if(marketKey.startsWith('first-half'))return-4
  return 0
}

function supportedMarket(marketKey){
  return new Set(['match-winner','double-chance','draw-no-bet','both-teams-score','total-goals','home-team-goals','away-team-goals','team-goals','first-half-goals','first-half-winner']).has(marketKey)
}

function evaluateOutcome(fixture,market,outcome){
  const odds=num(outcome?.odd)
  if(!odds||odds<DAILY_BANKERS_RULES.safestMinOdd||odds>DAILY_BANKERS_RULES.valueMaxOdd)return null
  if(!supportedMarket(market?.marketKey))return null
  const tests=selectionTests(market.marketKey,outcome.name)
  if(!tests)return null
  const homeId=fixture?.home?.id,awayId=fixture?.away?.id
  const recentHome=sideEvidence(fixture,'home',tests.home,tests.halfOnly,DAILY_BANKERS_RULES.recentSample)
  const recentAway=sideEvidence(fixture,'away',tests.away,tests.halfOnly,DAILY_BANKERS_RULES.recentSample)
  if(recentHome.total<DAILY_BANKERS_RULES.minSample||recentAway.total<DAILY_BANKERS_RULES.minSample)return null
  if(recentHome.rate==null||recentAway.rate==null)return null
  const baseHome=sideEvidence(fixture,'home',tests.home,tests.halfOnly,DAILY_BANKERS_RULES.baselineSample)
  const baseAway=sideEvidence(fixture,'away',tests.away,tests.halfOnly,DAILY_BANKERS_RULES.baselineSample)
  const recentConsensus=Math.min(recentHome.rate,recentAway.rate)
  const baselineConsensus=Math.min(baseHome.rate??recentHome.rate,baseAway.rate??recentAway.rate)
  const baselineReady=baseHome.total>=DAILY_BANKERS_RULES.minSample&&baseAway.total>=DAILY_BANKERS_RULES.minSample
  const capability=baselineReady
    ?Math.round(recentConsensus*DAILY_BANKERS_RULES.recentWeight+baselineConsensus*DAILY_BANKERS_RULES.baselineWeight)
    :recentConsensus

  const homeTier=tier(fixture?.homeSplit),awayTier=tier(fixture?.awaySplit)
  const sameTier=homeTier&&awayTier&&homeTier===awayTier
  if(tests.teamSide&&['match-winner','draw-no-bet','first-half-winner'].includes(market.marketKey)){
    if(sameTier)return null
    const selectedSplit=tests.teamSide==='home'?fixture?.homeSplit:fixture?.awaySplit
    if(bottomThree(selectedSplit))return null
  }

  const implied=1/odds
  const edge=(capability/100)-implied
  let rawScore=capability+reliabilityBonus(market.marketKey,outcome.name)
  if(recentConsensus===100)rawScore+=5
  if(baselineReady&&baselineConsensus>=80)rawScore+=5
  if(outcome?.verified===true)rawScore+=3
  if(tests.teamSide&&homeTier&&awayTier&&!sameTier)rawScore+=3
  if(edge>0)rawScore+=Math.min(12,edge*100)
  if(Math.abs(recentConsensus-baselineConsensus)>=30)rawScore-=8
  if(tests.halfOnly)rawScore-=3
  if(recentHome.total<DAILY_BANKERS_RULES.recentSample||recentAway.total<DAILY_BANKERS_RULES.recentSample)rawScore-=4
  if(fixture?.earlySeason===true)rawScore-=2

  const reasons=[]
  reasons.push(`Both sides' recent form supports ${marketLabel(market,outcome)}: ${recentHome.rate}% from the home side and ${recentAway.rate}% from the away side over the recent sample.`)
  if(baselineReady)reasons.push(`The longer baseline is ${baselineConsensus}% in the same direction, so this is not relying only on the latest matches.`)
  if(tests.teamSide&&homeTier&&awayTier&&!sameTier)reasons.push(`The selected side also has a different venue tier from the opponent, which reduces the risk of a same-level matchup.`)
  if(market.marketKey==='double-chance')reasons.push('This market protects the stake against one of the three match results, which is why it can qualify as a safer banker.')
  if(market.marketKey==='draw-no-bet')reasons.push('A draw returns the stake, so the selection only needs the chosen side to avoid losing for stake protection.')
  if(market.marketKey==='total-goals')reasons.push('Both teams are showing the same total-goals direction in their relevant home/away games.')
  if(market.marketKey==='both-teams-score')reasons.push('Both teams repeatedly show the same scoring/conceding pattern, so the BTTS price has statistical support from both sides.')
  if(market.marketKey.includes('team-goals'))reasons.push('The team-total pick is supported by one side producing that goal line and the opponent allowing it in the matching venue split.')
  reasons.push(`At odds ${odds.toFixed(2)}, the price implies about ${Math.round(implied*100)}%; the blended evidence is ${capability}%.`)

  const safest=odds>=DAILY_BANKERS_RULES.safestMinOdd&&odds<=DAILY_BANKERS_RULES.safestMaxOdd
    &&capability>=DAILY_BANKERS_RULES.safestMinConsensus&&rawScore>=DAILY_BANKERS_RULES.safestMinScore
  const value=!tests.pushMarket&&odds>=DAILY_BANKERS_RULES.valueMinOdd&&odds<=DAILY_BANKERS_RULES.valueMaxOdd
    &&capability>=DAILY_BANKERS_RULES.valueMinConsensus&&edge>=DAILY_BANKERS_RULES.valueMinEdge&&rawScore>=DAILY_BANKERS_RULES.valueMinScore
  if(!safest&&!value)return null

  return{
    fixtureId:fixture.fixtureId,league:fixture.league,country:fixture.country,kickoff:fixture.kickoff,
    home:fixture?.home?.name,away:fixture?.away?.name,homeId,awayId,
    homeLogo:fixture?.home?.logo||null,awayLogo:fixture?.away?.logo||null,
    market:market.marketKey,marketName:market.market||market.marketKey,selection:outcome.name,
    displaySelection:marketLabel(market,outcome),pick:marketLabel(market,outcome),odds:+odds.toFixed(2),
    engine:DAILY_BANKERS_ENGINE,category:safest?'safest':'value',
    bankerScore:Math.round(clamp(rawScore)),rawScore:+rawScore.toFixed(2),capability,
    recentConsensus,baselineConsensus:baselineReady?baselineConsensus:null,
    impliedProbability:+(implied*100).toFixed(1),valueEdge:+(edge*100).toFixed(1),
    oddsVerified:outcome?.verified===true,homeTier,awayTier,
    why:reasons,whyText:reasons.join(' '),
    evidence:{recent:{home:recentHome.rate,away:recentAway.rate,sourceHome:recentHome.source,sourceAway:recentAway.source},baseline:baselineReady?{home:baseHome.rate,away:baseAway.rate}:null}
  }
}

export function analyzeDailyBankerFixture(fixture){
  if(isSrlMatch(fixture)||!fixtureHasStats(fixture))return{safe:null,value:null,candidates:[]}
  const candidates=[]
  for(const market of fixture?.marketOdds||[])for(const outcome of market?.outcomes||[]){
    const row=evaluateOutcome(fixture,market,outcome)
    if(row)candidates.push(row)
  }
  candidates.sort((a,b)=>b.rawScore-a.rawScore||b.capability-a.capability||a.odds-b.odds)
  const safe=candidates.filter(x=>x.category==='safest').sort((a,b)=>b.rawScore-a.rawScore||a.odds-b.odds)[0]||null
  const value=candidates.filter(x=>x.category==='value').sort((a,b)=>b.valueEdge-a.valueEdge||b.rawScore-a.rawScore)[0]||null
  return{safe,value,candidates}
}

function samePick(a,b){
  return a&&b&&String(a.fixtureId)===String(b.fixtureId)&&String(a.market)===String(b.market)&&norm(a.selection)===norm(b.selection)
}

export function buildDailyBankersBoard(fixtures,meta={},learningState=null){
  const safest=[],value=[]
  for(const fixture of fixtures||[]){
    const result=analyzeDailyBankerFixture(fixture)
    if(result.safe)safest.push(result.safe)
    if(result.value&&!samePick(result.safe,result.value))value.push(result.value)
  }
  safest.sort((a,b)=>b.rawScore-a.rawScore||a.odds-b.odds||Date.parse(a.kickoff)-Date.parse(b.kickoff))
  value.sort((a,b)=>b.valueEdge-a.valueEdge||b.rawScore-a.rawScore||Date.parse(a.kickoff)-Date.parse(b.kickoff))
  const safestBankers=applyLearningToRows(safest.slice(0,DAILY_BANKERS_RULES.maxSafest),learningState,{board:'bankers',tightenMinScore:88})
  const valueBankers=applyLearningToRows(value.slice(0,DAILY_BANKERS_RULES.maxValue),learningState,{board:'bankers',tightenMinScore:84})
  const all=[...safestBankers,...valueBankers]
  return{
    meta:{...meta,engine:DAILY_BANKERS_ENGINE,safestCount:safestBankers.length,valueCount:valueBankers.length,total:all.length,
      recentSample:DAILY_BANKERS_RULES.recentSample,baselineSample:DAILY_BANKERS_RULES.baselineSample,
      safestMinConsensus:DAILY_BANKERS_RULES.safestMinConsensus,valueMinEdgePct:DAILY_BANKERS_RULES.valueMinEdge*100},
    safestBankers,valueBankers,bestPicks:all,priority:all,
    availableMarkets:[...new Set(all.map(x=>x.market))].sort()
  }
}
