import {attachWhy,fixtureHasStats} from './pickWhy.js'

export const COMBO_MIN_ODD=Math.max(1.20,Number(process.env.COMBO_MIN_ODD||1.20))
export const COMBO_MIN_SCORE=Math.max(55,Math.min(90,Number(process.env.COMBO_MIN_SCORE||68)))
export const COMBO_MAX_PER_FIXTURE=2

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

function literalRate(rows,def){
  let total=0,hits=0
  for(const f of rows||[]){const s=scores(f);if(!s)continue;total++;if(literalHit(def,s.h,s.a))hits++}
  return{hits,total,rate:pct(hits,total)}
}

function projectedRate(rows,teamId,role,def){
  let total=0,hits=0
  for(const f of rows||[]){
    const s=scores(f);if(!s)continue
    const isHome=String(f?.teams?.home?.id??'')===String(teamId??'')
    const isAway=String(f?.teams?.away?.id??'')===String(teamId??'')
    if(!isHome&&!isAway)continue
    const own=isHome?s.h:s.a,opp=isHome?s.a:s.h
    const sidePass=def.result==='draw'?own===opp:(def.result===role?own>opp:own<opp)
    total++;if(sidePass||secondPass(def,s.h,s.a))hits++
  }
  return{hits,total,rate:pct(hits,total)}
}

function h2hRate(rows,homeName,awayName,def){
  let total=0,hits=0
  for(const r of rows||[]){
    const hs=Number(r?.hs),as=Number(r?.as);if(!Number.isFinite(hs)||!Number.isFinite(as))continue
    let currentHome,currentAway
    if(same(r?.home,homeName)&&same(r?.away,awayName)){currentHome=hs;currentAway=as}
    else if(same(r?.home,awayName)&&same(r?.away,homeName)){currentHome=as;currentAway=hs}
    else continue
    const sidePass=def.result==='home'?currentHome>currentAway:def.result==='away'?currentAway>currentHome:currentHome===currentAway
    total++;if(sidePass||secondPass(def,currentHome,currentAway))hits++
  }
  return{hits,total,rate:pct(hits,total)}
}

function splitStrength(split){
  const pos=Number(split?.position),size=Number(split?.size),ppg=Number(split?.ppg)
  if(split?.sampleReady!==true||!Number.isFinite(pos)||!Number.isFinite(size)||size<2)return null
  const rank=1-(pos-1)/(size-1)
  const point=Number.isFinite(ppg)?clamp(ppg/3,0,1):rank
  return clamp(rank*0.6+point*0.4,0,1)
}
function splitAdjustment(f,def){
  const hs=splitStrength(f?.homeSplit),as=splitStrength(f?.awaySplit)
  if(hs==null||as==null)return 0
  const gap=hs-as
  if(def.result==='home')return clamp(gap*10,-8,8)
  if(def.result==='away')return clamp(-gap*10,-8,8)
  return clamp(5-Math.abs(gap)*13,-4,5)
}
function secondSupport(f,def){
  const h=f?.homeStats||{},a=f?.awayStats||{}
  let r=null
  if(def.second==='over25'&&finite(h.over25)&&finite(a.over25))r=(Number(h.over25)+Number(a.over25))/2
  if(def.second==='under25'&&finite(h.over25)&&finite(a.over25))r=100-(Number(h.over25)+Number(a.over25))/2
  if(def.second==='gg'&&finite(h.btts)&&finite(a.btts))r=(Number(h.btts)+Number(a.btts))/2
  if(def.second==='cleanSheet'){
    const vals=[h.cs,a.cs,h.fts,a.fts].filter(finite).map(Number)
    if(vals.length)r=vals.reduce((x,y)=>x+y,0)/vals.length
  }
  return r==null?0:clamp((r-50)*0.07,-4,4)
}
function weighted(parts){
  let top=0,weight=0
  for(const [row,w] of parts){if(row?.rate==null||row.total<1)continue;top+=row.rate*w;weight+=w}
  return weight?top/weight:null
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
  return null
}

export function analyzeComboFixture(f){
  if(!fixtureHasStats(f))return[]
  if((f?.home?.fixtures||[]).length<3||(f?.away?.fixtures||[]).length<3)return[]
  const listed=listedComboMarkets(f?.sportyMarkets||f?.sporty?.markets||[])
  if(!listed.length)return[]
  const candidates=[]
  for(const def of listed){
    const homeSplit=literalRate(f.home.fixtures,def)
    const awaySplit=literalRate(f.away.fixtures,def)
    const homeRecent=projectedRate(f.home.lastMatches||f.home.fixtures,f.home.id,'home',def)
    const awayRecent=projectedRate(f.away.lastMatches||f.away.fixtures,f.away.id,'away',def)
    const h2h=h2hRate(f.h2h,f.home.name,f.away.name,def)
    const base=weighted([[homeSplit,.30],[awaySplit,.30],[homeRecent,.16],[awayRecent,.16],[h2h,.08]])
    if(base==null)continue
    const score=Math.round(clamp(base+splitAdjustment(f,def)+secondSupport(f,def),1,99))
    if(score<COMBO_MIN_SCORE)continue
    const reasons=[
      `${f.home.name} home split backed ${def.label} in ${homeSplit.hits}/${homeSplit.total} (${homeSplit.rate}%).`,
      `${f.away.name} away split backed ${def.label} in ${awaySplit.hits}/${awaySplit.total} (${awaySplit.rate}%).`,
      homeRecent.total?`Recent ${f.home.name} form projects this combo in ${homeRecent.hits}/${homeRecent.total} (${homeRecent.rate}%).`:null,
      awayRecent.total?`Recent ${f.away.name} form projects this combo in ${awayRecent.hits}/${awayRecent.total} (${awayRecent.rate}%).`:null,
      h2h.total?`H2H backed this combo in ${h2h.hits}/${h2h.total} meetings (${h2h.rate}%).`:'H2H was not used because there was not enough verified history.',
      splitReason(f),
      losingShape(def),
      `SportyBet Yes price ${def.odds.toFixed(2)} passes the ${COMBO_MIN_ODD.toFixed(2)} minimum.`
    ].filter(Boolean)
    const pick={
      fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
      home:f.home.name,away:f.away.name,homeId:f.home.id??null,awayId:f.away.id??null,homeLogo:f.home.logo||null,awayLogo:f.away.logo||null,
      market:def.market,marketName:'Combo',selection:def.label,displaySelection:def.label,route:def.route,group:def.group,family:'Combo',
      odds:def.odds,oddsVerified:true,source:'SportyBet',sportyMarketId:def.sportyMarketId,
      comboScore:score,confidence:score,homeConsensus:homeSplit.rate,awayConsensus:awaySplit.rate,
      recentHomeHit:homeRecent,recentAwayHit:awayRecent,h2hHit:h2h,
      homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,
      sportyEventId:f.sportyEventId||null,sportyGameId:f.sportyGameId||null,
      earlySeason:f.earlySeason===true
    }
    candidates.push(attachWhy(pick,f,{reasons}))
  }
  return candidates.sort((a,b)=>b.comboScore-a.comboScore||b.odds-a.odds).slice(0,COMBO_MAX_PER_FIXTURE).map((p,i)=>({
    ...p,rank:i+1,
    reasons:[`#${i+1} Combo for this match · model score ${p.comboScore}%.`,...(p.reasons||[])]
  }))
}

export function buildComboBoard(fixtures,meta={}){
  const bestPicks=[]
  let eligibleMarkets=0,fixturesWithListed=0,fixturesWithPicks=0
  const skipped={noStats:0,noComboOdds:0,belowScore:0}
  for(const f of fixtures||[]){
    if(!fixtureHasStats(f)){skipped.noStats++;continue}
    const listed=listedComboMarkets(f?.sportyMarkets||f?.sporty?.markets||[])
    eligibleMarkets+=listed.length
    if(!listed.length){skipped.noComboOdds++;continue}
    fixturesWithListed++
    const picks=analyzeComboFixture(f)
    if(!picks.length){skipped.belowScore++;continue}
    fixturesWithPicks++
    bestPicks.push(...picks)
  }
  return{
    bestPicks,
    meta:{
      engine:'combo-v1',generatedAt:meta?.generatedAt||new Date().toISOString(),minOdd:COMBO_MIN_ODD,minScore:COMBO_MIN_SCORE,
      maxPerFixture:COMBO_MAX_PER_FIXTURE,supportedMarkets:COMBO_MARKETS.length,eligibleMarkets,fixturesWithListed,fixturesWithPicks,
      picks:bestPicks.length,skipped
    }
  }
}
