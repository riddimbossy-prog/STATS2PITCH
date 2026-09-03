import {attachWhy,fixtureHasStats} from './pickWhy.js'

export const COMBO_MIN_ODD=Math.max(1.20,Number(process.env.COMBO_MIN_ODD||1.20))
export const COMBO_MIN_SCORE=Math.max(80,Math.min(95,Number(process.env.COMBO_MIN_SCORE||80)))
export const COMBO_MAX_PER_FIXTURE=2
export const COMBO_ENGINE_VERSION='combo-v2-failure-state'

export const COMBO_MARKETS=Object.freeze([
  {route:'HOME_OVER_25',market:'combo-home-over-25',label:'Home Team or Over 2.5',result:'home',second:'over25',group:'result-goals'},
  {route:'HOME_UNDER_25',market:'combo-home-under-25',label:'Home Team or Under 2.5',result:'home',second:'under25',group:'result-goals'},
  {route:'DRAW_OVER_25',market:'combo-draw-over-25',label:'Draw or Over 2.5',result:'draw',second:'over25',group:'result-goals'},
  {route:'DRAW_UNDER_25',market:'combo-draw-under-25',label:'Draw or Under 2.5',result:'draw',second:'under25',group:'result-goals'},
  {route:'AWAY_OVER_25',market:'combo-away-over-25',label:'Away or Over 2.5',result:'away',second:'over25',group:'result-goals'},
  {route:'AWAY_UNDER_25',market:'combo-away-under-25',label:'Away or Under 2.5',result:'away',second:'under25',group:'result-goals'},
  {route:'HOME_GG',market:'combo-home-gg',label:'Home Team or GG',result:'home',second:'gg',group:'result-gg'},
  {route:'DRAW_GG',market:'combo-draw-gg',label:'Draw or GG',result:'draw',second:'gg',group:'result-gg'},
  {route:'AWAY_GG',market:'combo-away-gg',label:'Away Team or GG',result:'away',second:'gg',group:'result-gg'},
  {route:'HOME_CLEAN_SHEET',market:'combo-home-clean-sheet',label:'Home Team or Any Clean Sheet',result:'home',second:'cleanSheet',group:'result-clean-sheet'},
  {route:'DRAW_CLEAN_SHEET',market:'combo-draw-clean-sheet',label:'Draw or Any Clean Sheet',result:'draw',second:'cleanSheet',group:'result-clean-sheet'},
  {route:'AWAY_CLEAN_SHEET',market:'combo-away-clean-sheet',label:'Away Team or Any Clean Sheet',result:'away',second:'cleanSheet',group:'result-clean-sheet'}
])

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const pct=(hits,total)=>total?Math.round(hits*100/total):null
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const same=(a,b)=>{const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))}

function marketRoute(raw){
  const n=norm(raw)
  let result=null,second=null
  if(/\bhome(?: team)? or\b/.test(n))result='home'
  else if(/\bdraw or\b/.test(n))result='draw'
  else if(/\baway(?: team)? or\b/.test(n))result='away'
  if(!result)return null
  if(/\bover 2\.5\b/.test(n))second='over25'
  else if(/\bunder 2\.5\b/.test(n))second='under25'
  else if(/\bany clean sheet\b|\bclean sheet\b/.test(n))second='cleanSheet'
  else if(/\bgg\b|both teams.*score/.test(n))second='gg'
  if(!second)return null
  return COMBO_MARKETS.find(x=>x.result===result&&x.second===second)||null
}

function oddFrom(v){
  const n=Number(v)
  return Number.isFinite(n)&&n>1.001&&n<20?n:null
}
function yesOdd(market){
  for(const o of market?.outcomes||[]){
    const name=norm(o?.desc??o?.name??o?.value)
    if(name!=='yes')continue
    const price=oddFrom(o?.odds??o?.odd??o?.price)
    if(price)return price
  }
  return null
}

export function listedComboMarkets(sportyMarkets=[]){
  const found=new Map()
  for(const raw of sportyMarkets||[]){
    const def=marketRoute(raw?.name||raw?.desc||raw?.marketName||'')
    if(!def)continue
    const odds=yesOdd(raw)
    if(!odds||odds<COMBO_MIN_ODD)continue
    const prior=found.get(def.route)
    if(!prior||odds>prior.odds)found.set(def.route,{...def,odds:+odds.toFixed(2),source:'SportyBet',sportyMarketId:raw?.id??null})
  }
  return [...found.values()]
}

function scores(f){
  const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
  return Number.isFinite(h)&&Number.isFinite(a)?{h,a}:null
}
function eventTime(f){
  const raw=f?.fixture?.date??f?.date??f?.kickoff??f?.timestamp
  const ts=Date.parse(String(raw||''))
  return Number.isFinite(ts)?ts:0
}
function recentRows(rows,limit=5){
  return (rows||[]).filter(scores).map((row,index)=>({row,index,ts:eventTime(row)})).sort((a,b)=>b.ts-a.ts||a.index-b.index).slice(0,limit).map(x=>x.row)
}
function secondPass(def,h,a){
  const total=h+a
  if(def.second==='over25')return total>2.5
  if(def.second==='under25')return total<2.5
  if(def.second==='gg')return h>0&&a>0
  if(def.second==='cleanSheet')return h===0||a===0
  return false
}
function resultPass(def,h,a){
  if(def.result==='home')return h>a
  if(def.result==='away')return a>h
  return h===a
}
function literalHit(def,h,a){return resultPass(def,h,a)||secondPass(def,h,a)}
function rateFrom(rows,pass){
  let total=0,hits=0
  for(const f of rows||[]){const s=scores(f);if(!s)continue;total++;if(pass(s.h,s.a))hits++}
  return{hits,total,failures:Math.max(0,total-hits),rate:pct(hits,total)}
}
function literalRate(rows,def){return rateFrom(rows,(h,a)=>literalHit(def,h,a))}
function resultRate(rows,def){return rateFrom(rows,(h,a)=>resultPass(def,h,a))}
function secondRate(rows,def){return rateFrom(rows,(h,a)=>secondPass(def,h,a))}
function combinedRate(a,b){
  const total=Number(a?.total||0)+Number(b?.total||0)
  const hits=Number(a?.hits||0)+Number(b?.hits||0)
  return{hits,total,failures:Math.max(0,total-hits),rate:pct(hits,total)}
}

function projectedRate(rows,teamId,role,def){
  let total=0,hits=0
  for(const f of recentRows(rows,5)){
    const s=scores(f);if(!s)continue
    const isHome=String(f?.teams?.home?.id??'')===String(teamId??'')
    const isAway=String(f?.teams?.away?.id??'')===String(teamId??'')
    if(!isHome&&!isAway)continue
    const own=isHome?s.h:s.a,opp=isHome?s.a:s.h
    const sidePass=def.result==='draw'?own===opp:(def.result===role?own>opp:own<opp)
    total++;if(sidePass||secondPass(def,s.h,s.a))hits++
  }
  return{hits,total,failures:Math.max(0,total-hits),rate:pct(hits,total)}
}

function h2hRate(rows,homeName,awayName,def){
  let total=0,hits=0
  for(const r of (rows||[]).slice(0,5)){
    const hs=Number(r?.hs),as=Number(r?.as);if(!Number.isFinite(hs)||!Number.isFinite(as))continue
    let currentHome,currentAway
    if(same(r?.home,homeName)&&same(r?.away,awayName)){currentHome=hs;currentAway=as}
    else if(same(r?.home,awayName)&&same(r?.away,homeName)){currentHome=as;currentAway=hs}
    else continue
    const sidePass=def.result==='home'?currentHome>currentAway:def.result==='away'?currentAway>currentHome:currentHome===currentAway
    total++;if(sidePass||secondPass(def,currentHome,currentAway))hits++
  }
  return{hits,total,failures:Math.max(0,total-hits),rate:pct(hits,total)}
}

function splitPpg(f){
  const home=finite(f?.homeSplit?.ppg)?Number(f.homeSplit.ppg):null
  const away=finite(f?.awaySplit?.ppg)?Number(f.awaySplit.ppg):null
  return{home,away,ready:home!=null&&away!=null}
}
function directionalFoundation(f,def,homeResult,awayResult){
  const ppg=splitPpg(f)
  const combined=combinedRate(homeResult,awayResult)
  if(def.result==='draw'){
    const gap=ppg.ready?Math.abs(ppg.home-ppg.away):null
    const balanced=gap!=null&&gap<=0.45
    const drawBacked=combined.rate!=null&&combined.rate>=40
    return{ok:balanced||drawBacked,ppgGap:gap,resultRate:combined.rate,reason:balanced?'Split PPG is balanced, so no side owns a clear directional edge.':'The split draw rate itself is strong enough to justify a draw-based cover.'}
  }
  const gap=ppg.ready?(def.result==='home'?ppg.home-ppg.away:ppg.away-ppg.home):null
  const oneStrong=Math.max(homeResult.rate??0,awayResult.rate??0)>=60
  const oneElite=Math.max(homeResult.rate??0,awayResult.rate??0)>=80
  const combinedOkay=(combined.rate??0)>=40
  const ok=combinedOkay&&((gap!=null&&gap>=0.20&&oneStrong)||(gap!=null&&gap>=0&&oneElite)||(gap!=null&&gap>=0.75))
  return{ok,ppgGap:gap,resultRate:combined.rate,reason:ok?`${def.result==='home'?'Home':'Away'} direction has a real venue foundation instead of being added only as insurance.`:'The directional leg does not have enough split advantage to justify this Combo.'}
}

function splitStrengthScore(f,def,homeResult,awayResult){
  const ppg=splitPpg(f)
  const combined=combinedRate(homeResult,awayResult)
  if(def.result==='draw'){
    const balance=ppg.ready?1-clamp(Math.abs(ppg.home-ppg.away)/1.0,0,1):0.5
    return clamp(balance*0.6+clamp((combined.rate??0)/100,0,1)*0.4,0,1)
  }
  const gap=ppg.ready?(def.result==='home'?ppg.home-ppg.away:ppg.away-ppg.home):0
  const ppgComponent=clamp((gap+0.10)/1.40,0,1)
  return clamp(clamp((combined.rate??0)/100,0,1)*0.55+ppgComponent*0.45,0,1)
}
function statsSecondRate(f,def){
  const h=f?.homeStats||{},a=f?.awayStats||{}
  if(def.second==='over25'&&finite(h.over25)&&finite(a.over25))return clamp((Number(h.over25)+Number(a.over25))/2,0,100)
  if(def.second==='under25'&&finite(h.over25)&&finite(a.over25))return clamp(100-(Number(h.over25)+Number(a.over25))/2,0,100)
  if(def.second==='gg'&&finite(h.btts)&&finite(a.btts))return clamp((Number(h.btts)+Number(a.btts))/2,0,100)
  if(def.second==='cleanSheet'){
    if(finite(h.btts)&&finite(a.btts))return clamp(100-(Number(h.btts)+Number(a.btts))/2,0,100)
    const vals=[h.cs,a.cs,h.fts,a.fts].filter(finite).map(Number)
    if(vals.length)return clamp(vals.reduce((x,y)=>x+y,0)/vals.length,0,100)
  }
  return null
}
function weightedRate(parts){
  let top=0,weight=0
  for(const [row,w] of parts){if(row?.rate==null||row.total<1)continue;top+=row.rate*w;weight+=w}
  return weight?top/weight:null
}
function marketSupportScore(f,def,homeSecond,awaySecond){
  const split=combinedRate(homeSecond,awaySecond).rate
  const stats=statsSecondRate(f,def)
  if(split==null&&stats==null)return 0.5
  if(split==null)return clamp(stats/100,0,1)
  if(stats==null)return clamp(split/100,0,1)
  return clamp((split*0.70+stats*0.30)/100,0,1)
}
function primaryInsurance(def,homeResult,awayResult,homeSecond,awaySecond){
  const result=combinedRate(homeResult,awayResult)
  const second=combinedRate(homeSecond,awaySecond)
  const resultLabel=def.result==='home'?'Home win':def.result==='away'?'Away win':'Draw'
  const secondLabel=def.second==='over25'?'Over 2.5':def.second==='under25'?'Under 2.5':def.second==='gg'?'GG':'Any Clean Sheet'
  const primary=(result.rate??0)>=(second.rate??0)?{key:'result',label:resultLabel,...result}:{key:'second',label:secondLabel,...second}
  const insurance=primary.key==='result'?{key:'second',label:secondLabel,...second}:{key:'result',label:resultLabel,...result}
  return{result,second,primary,insurance}
}
function routeGate(def,routes){
  if((routes.primary.rate??0)<70)return{ok:false,reason:'No primary route reaches the required 70% split support.'}
  if((routes.insurance.rate??0)<30)return{ok:false,reason:'The insurance route is too weak; this would behave like a disguised single-market bet.'}
  if(def.result!=='draw'&&(routes.result.rate??0)<40)return{ok:false,reason:'The directional side contributes less than 40% combined split support.'}
  if((routes.second.rate??0)<40&&(routes.result.rate??0)<80)return{ok:false,reason:'The second market is weak and the result leg is not dominant enough to compensate.'}
  if((routes.second.rate??0)<30&&(routes.result.rate??0)<90)return{ok:false,reason:'The market-specific leg conflicts with the match shape.'}
  return{ok:true,reason:null}
}
function h2hVeto(h2h){return h2h.total>=3&&h2h.failures>=3&&(h2h.rate??0)<=40}
function oddsPoints(odds){
  if(odds<1.50)return 5
  if(odds<1.70)return 4
  if(odds<1.90)return 3
  if(odds<2.00)return 1.5
  return 1
}
function oddsTier(odds){
  if(odds<1.50)return'1.20–1.49 normal qualifying range'
  if(odds<1.70)return'1.50–1.69 strong-data range'
  if(odds<1.90)return'1.70–1.89 elite-evidence range'
  if(odds<2.00)return'1.90–1.99 bookmaker-warning range'
  return'2.00+ exceptional-evidence only'
}
function oddsGate(odds,score,homeSplit,awaySplit){
  const combined=combinedRate(homeSplit,awaySplit).rate??0
  const hi=Math.max(homeSplit.rate??0,awaySplit.rate??0),lo=Math.min(homeSplit.rate??0,awaySplit.rate??0)
  if(odds<COMBO_MIN_ODD)return{ok:false,reason:`Odds ${odds.toFixed(2)} are below the ${COMBO_MIN_ODD.toFixed(2)} floor.`}
  if(odds<1.50)return{ok:score>=COMBO_MIN_SCORE,reason:`Normal range requires score ${COMBO_MIN_SCORE}+.`}
  if(odds<1.70)return{ok:score>=85&&combined>=90,reason:'1.50–1.69 requires score 85+ and at least 90% combined split hits.'}
  if(odds<1.90)return{ok:score>=90&&hi>=100&&lo>=80,reason:'1.70–1.89 requires score 90+, one 100% split and the other at least 80%.'}
  if(odds<2.00)return{ok:score>=92&&hi>=100&&lo>=100,reason:'1.90–1.99 requires score 92+ and 100% on both venue splits.'}
  return{ok:score>=94&&hi>=100&&lo>=100,reason:'2.00+ requires score 94+ and 100% on both venue splits.'}
}
function comboScore(f,def,homeSplit,awaySplit,homeResult,awayResult,homeSecond,awaySecond,homeRecent,awayRecent,h2h){
  const venue=((homeSplit.rate??0)+(awaySplit.rate??0))/200
  const failure=Math.min(homeSplit.rate??0,awaySplit.rate??0)/100
  const split=splitStrengthScore(f,def,homeResult,awayResult)
  const market=marketSupportScore(f,def,homeSecond,awaySecond)
  const recent=weightedRate([[homeRecent,.5],[awayRecent,.5]])
  const recentNorm=recent==null?0.5:recent/100
  const h2hNorm=h2h.total?h2h.rate/100:0.5
  const breakdown={
    venueHistory:+(venue*30).toFixed(1),
    failureAvoidance:+(failure*20).toFixed(1),
    splitStrength:+(split*15).toFixed(1),
    marketPattern:+(market*15).toFixed(1),
    recentForm:+(recentNorm*8).toFixed(1),
    h2h:+(h2hNorm*7).toFixed(1),
    odds:+oddsPoints(def.odds).toFixed(1)
  }
  const total=Object.values(breakdown).reduce((a,b)=>a+Number(b||0),0)
  return{score:Math.round(clamp(total,1,100)),breakdown}
}
function losingShape(def){
  const side=def.result==='home'?'the home side does not win':def.result==='away'?'the away side does not win':'the match is not a draw'
  if(def.second==='over25')return `It loses only when ${side} and the game stays on 0–2 goals.`
  if(def.second==='under25')return `It loses only when ${side} and the game reaches 3+ goals.`
  if(def.second==='gg')return `It loses only when ${side} and at least one team fails to score.`
  return `It loses only when ${side} and both teams score.`
}
function splitReason(f){
  const h=f?.homeSplit,a=f?.awaySplit
  if(h?.sampleReady&&a?.sampleReady)return `Venue split: ${f.home.name} ${h.position}/${h.size} at ${h.ppg} PPG; ${f.away.name} ${a.position}/${a.size} away at ${a.ppg} PPG.`
  if(finite(h?.ppg)&&finite(a?.ppg))return `Venue PPG: ${f.home.name} ${Number(h.ppg).toFixed(2)}; ${f.away.name} away ${Number(a.ppg).toFixed(2)}.`
  return null
}
function archetype(def){
  const lead=def.result==='draw'?'Balanced match':def.result==='home'?'Home strength':'Away strength'
  const tail=def.second==='over25'?'high event':def.second==='under25'?'controlled/low event':def.second==='gg'?'both teams capable':'one side likely to blank'
  return `${lead} + ${tail}`
}
function selectedCandidates(candidates){
  const sorted=[...(candidates||[])].sort((a,b)=>b.comboScore-a.comboScore||b.homeConsensus-a.homeConsensus||a.odds-b.odds)
  if(!sorted.length)return[]
  const first=sorted[0],out=[first]
  const distinct=sorted.slice(1).filter(x=>x.resultRoute!==first.resultRoute)
  if(!distinct.length)return out
  const second=distinct[0]
  const third=distinct[1]
  const overallSecond=sorted[1],overallThird=sorted[2]
  const congested=overallSecond&&overallThird&&Math.abs(first.comboScore-overallSecond.comboScore)<=2&&Math.abs(overallSecond.comboScore-overallThird.comboScore)<=2
  const secondAmbiguous=third&&Math.abs(second.comboScore-third.comboScore)<3
  if(congested||secondAmbiguous)return out
  out.push(second)
  return out.slice(0,COMBO_MAX_PER_FIXTURE)
}

export function analyzeComboFixture(f){
  if(!fixtureHasStats(f))return[]
  const homeRows=recentRows(f?.home?.fixtures,5),awayRows=recentRows(f?.away?.fixtures,5)
  if(homeRows.length<4||awayRows.length<4)return[]
  const listed=listedComboMarkets(f?.sportyMarkets||f?.sporty?.markets||[])
  if(!listed.length)return[]
  const candidates=[]
  for(const def of listed){
    const homeSplit=literalRate(homeRows,def),awaySplit=literalRate(awayRows,def)
    if((homeSplit.rate??0)<80||(awaySplit.rate??0)<80)continue
    if(homeSplit.failures>=2||awaySplit.failures>=2)continue

    const homeResult=resultRate(homeRows,def),awayResult=resultRate(awayRows,def)
    const homeSecond=secondRate(homeRows,def),awaySecond=secondRate(awayRows,def)
    const routes=primaryInsurance(def,homeResult,awayResult,homeSecond,awaySecond)
    const routeCheck=routeGate(def,routes)
    if(!routeCheck.ok)continue

    const direction=directionalFoundation(f,def,homeResult,awayResult)
    if(!direction.ok)continue

    const homeRecent=projectedRate(f?.home?.lastMatches||homeRows,f?.home?.id,'home',def)
    const awayRecent=projectedRate(f?.away?.lastMatches||awayRows,f?.away?.id,'away',def)
    const h2h=h2hRate(f?.h2h,f?.home?.name,f?.away?.name,def)
    if(h2hVeto(h2h))continue

    const scoring=comboScore(f,def,homeSplit,awaySplit,homeResult,awayResult,homeSecond,awaySecond,homeRecent,awayRecent,h2h)
    if(scoring.score<COMBO_MIN_SCORE)continue
    const priceGate=oddsGate(def.odds,scoring.score,homeSplit,awaySplit)
    if(!priceGate.ok)continue

    const combined=combinedRate(homeSplit,awaySplit)
    const reasons=[
      `${f.home.name} home split: ${homeSplit.hits}/${homeSplit.total} (${homeSplit.rate}%) for ${def.label}.`,
      `${f.away.name} away split: ${awaySplit.hits}/${awaySplit.total} (${awaySplit.rate}%) for ${def.label}.`,
      `Exact failure state appeared ${combined.failures}/${combined.total} times across the two venue samples; neither split failed more than once.`,
      `Primary route: ${routes.primary.label} ${routes.primary.hits}/${routes.primary.total} (${routes.primary.rate}%). Insurance route: ${routes.insurance.label} ${routes.insurance.hits}/${routes.insurance.total} (${routes.insurance.rate}%).`,
      direction.reason,
      splitReason(f),
      homeRecent.total?`Recent ${f.home.name} form projects the full Combo in ${homeRecent.hits}/${homeRecent.total} (${homeRecent.rate}%).`:null,
      awayRecent.total?`Recent ${f.away.name} form projects the full Combo in ${awayRecent.hits}/${awayRecent.total} (${awayRecent.rate}%).`:null,
      h2h.total?`Recent H2H: ${h2h.hits}/${h2h.total} (${h2h.rate}%) supported this exact Combo.`:'H2H was neutral because there was not enough verified recent history.',
      losingShape(def),
      `SportyBet Yes price ${def.odds.toFixed(2)} sits in the ${oddsTier(def.odds)} and passed its stricter evidence gate.`,
      `Score breakdown — venue ${scoring.breakdown.venueHistory}/30, failure avoidance ${scoring.breakdown.failureAvoidance}/20, split strength ${scoring.breakdown.splitStrength}/15, market pattern ${scoring.breakdown.marketPattern}/15, recent form ${scoring.breakdown.recentForm}/8, H2H ${scoring.breakdown.h2h}/7, odds ${scoring.breakdown.odds}/5.`
    ].filter(Boolean)

    const pick={
      fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
      home:f.home.name,away:f.away.name,homeId:f.home.id??null,awayId:f.away.id??null,homeLogo:f.home.logo||null,awayLogo:f.away.logo||null,
      market:def.market,marketName:'Combo',selection:def.label,displaySelection:def.label,route:def.route,group:def.group,family:'Combo',
      odds:def.odds,oddsVerified:true,source:'SportyBet',sportyMarketId:def.sportyMarketId,
      comboScore:scoring.score,confidence:scoring.score,homeConsensus:homeSplit.rate,awayConsensus:awaySplit.rate,
      recentHomeHit:homeRecent,recentAwayHit:awayRecent,h2hHit:h2h,
      homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,
      resultRoute:def.result,secondaryRoute:def.second,archetype:archetype(def),
      primaryRoute:routes.primary,insuranceRoute:routes.insurance,combinedSplitHit:combined,
      failureState:{homeFailures:homeSplit.failures,awayFailures:awaySplit.failures,combinedFailures:combined.failures,total:combined.total,text:losingShape(def)},
      scoreBreakdown:scoring.breakdown,engineVersion:COMBO_ENGINE_VERSION,
      sportyEventId:f.sportyEventId||null,sportyGameId:f.sportyGameId||null,
      earlySeason:f.earlySeason===true
    }
    candidates.push(attachWhy(pick,f,{reasons}))
  }

  return selectedCandidates(candidates).map((p,i)=>({
    ...p,rank:i+1,
    reasons:[`#${i+1} Combo for this match · strict failure-state score ${p.comboScore}/100.`,...(p.reasons||[])]
  }))
}

export function buildComboBoard(fixtures,meta={}){
  const bestPicks=[]
  let eligibleMarkets=0,fixturesWithListed=0,fixturesWithPicks=0
  const skipped={noStats:0,noComboOdds:0,rulesRejected:0}
  for(const f of fixtures||[]){
    if(!fixtureHasStats(f)){skipped.noStats++;continue}
    const listed=listedComboMarkets(f?.sportyMarkets||f?.sporty?.markets||[])
    eligibleMarkets+=listed.length
    if(!listed.length){skipped.noComboOdds++;continue}
    fixturesWithListed++
    const picks=analyzeComboFixture(f)
    if(!picks.length){skipped.rulesRejected++;continue}
    fixturesWithPicks++
    bestPicks.push(...picks)
  }
  return{
    bestPicks,
    meta:{
      engine:COMBO_ENGINE_VERSION,generatedAt:meta?.generatedAt||new Date().toISOString(),minOdd:COMBO_MIN_ODD,minScore:COMBO_MIN_SCORE,
      maxPerFixture:COMBO_MAX_PER_FIXTURE,supportedMarkets:COMBO_MARKETS.length,eligibleMarkets,fixturesWithListed,fixturesWithPicks,
      splitSample:'last-5-home-vs-last-5-away',minSplitMatches:4,minSplitHitRate:80,picks:bestPicks.length,skipped
    }
  }
}
