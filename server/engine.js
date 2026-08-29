import {ENGINE_VERSION,MIN_ODD,MAX_ODD,MIN_CONSENSUS,FORM_SAMPLE,FINISHED} from './config.js'
import {learningAllows} from './learning.js'
import {over25Gate} from './over25.js'
import {buildTransitionProfile,evaluateTransitionSafety} from './transitionSafety.js'
import {buildAwayFavBoard,venueMetrics,favouriteSide,extractOdds} from './awayFavEngine.js'
import {buildFilterBoard} from './filterEngine.js'
import {buildGoalsBankerBoard} from './goalsBankersEngine.js'
import {attachWhy,fixtureHasStats} from './pickWhy.js'
import {redFlagSkip,favConflict} from './redFlags.js'


const finite=v=>Number.isFinite(Number(v))
const pct=(h,t)=>t?Math.round(h*100/t):null
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const inWindow=v=>finite(v)&&Number(v)>=MIN_ODD&&Number(v)<=MAX_ODD
const isHome=(f,id)=>String(f?.teams?.home?.id)===String(id)
const done=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
function full(f,id){
  const h=Number(f?.goals?.home),a=Number(f?.goals?.away);if(!finite(h)||!finite(a))return null
  return isHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}
function half(f,id){
  const h=Number(f?.score?.halftime?.home),a=Number(f?.score?.halftime?.away);if(!finite(h)||!finite(a))return null
  return isHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}
export function venueSample(rows,teamId,venue){
  return (rows||[]).filter(f=>done(f)&&(venue==='home'?isHome(f,teamId):String(f?.teams?.away?.id)===String(teamId)))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,FORM_SAMPLE)
}
function eventRate(profile,test,halfOnly=false){
  let t=0,h=0
  for(const f of profile.fixtures){const g=halfOnly?half(f,profile.id):full(f,profile.id);if(!g)continue;t++;if(test(g))h++}
  return pct(h,t)
}
const resultRate=(p,w,halfOnly=false)=>eventRate(p,g=>(g.own>g.opp?'win':g.own<g.opp?'loss':'draw')===w,halfOnly)
const totalRate=(p,side,line,halfOnly=false)=>eventRate(p,g=>side==='over'?g.total>line:g.total<line,halfOnly)
const ownRate=(p,side,line)=>eventRate(p,g=>side==='over'?g.own>line:g.own<line)
const oppRate=(p,side,line)=>eventRate(p,g=>side==='over'?g.opp>line:g.opp<line)
const bttsRate=(p,yes)=>eventRate(p,g=>(g.own>0&&g.opp>0)===yes)
const dcRate=(p,type)=>eventRate(p,g=>type==='not-loss'?g.own>=g.opp:type==='not-win'?g.own<=g.opp:g.own!==g.opp)
function ou(name){const m=String(name||'').match(/\b(Over|Under)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null}
function sane(k,line){
  if(!finite(line))return false
  if(k==='total-goals')return line>=0.5&&line<=6.5
  if(k==='first-half-goals')return line>=0.5&&line<=3.5
  if(['home-team-goals','away-team-goals','team-goals'].includes(k))return line>=0.5&&line<=4.5
  return true
}
function support(f,m,o){
  const k=m.marketKey,n=norm(o.name),home=f.home,away=f.away
  if(k==='match-winner'){
    if(n==='home'||n==='1')return[resultRate(home,'win'),resultRate(away,'loss')]
    if(n==='away'||n==='2')return[resultRate(home,'loss'),resultRate(away,'win')]
    if(n==='draw'||n==='x')return[resultRate(home,'draw'),resultRate(away,'draw')]
  }
  if(k==='double-chance'){
    if(n.includes('home or draw')||n==='1x')return[dcRate(home,'not-loss'),dcRate(away,'not-win')]
    if(n.includes('draw or away')||n==='x2')return[dcRate(home,'not-win'),dcRate(away,'not-loss')]
    if(n.includes('home or away')||n==='12')return[dcRate(home,'not-draw'),dcRate(away,'not-draw')]
  }
  if(k==='draw-no-bet'){
    if(n==='home'||n==='1')return[dcRate(home,'not-loss'),dcRate(away,'not-win')]
    if(n==='away'||n==='2')return[dcRate(home,'not-win'),dcRate(away,'not-loss')]
  }
  if(k==='both-teams-score'){
    if(n==='yes')return[bttsRate(home,true),bttsRate(away,true)]
    if(n==='no')return[bttsRate(home,false),bttsRate(away,false)]
  }
  if(k==='total-goals'){const p=ou(o.name);if(p&&sane(k,p.line))return[totalRate(home,p.side,p.line),totalRate(away,p.side,p.line)]}
  if(k==='first-half-goals'){const p=ou(o.name);if(p&&sane(k,p.line))return[totalRate(home,p.side,p.line,true),totalRate(away,p.side,p.line,true)]}
  if(k==='first-half-winner'){
    if(n==='home'||n==='1')return[resultRate(home,'win',true),resultRate(away,'loss',true)]
    if(n==='away'||n==='2')return[resultRate(home,'loss',true),resultRate(away,'win',true)]
    if(n==='draw'||n==='x')return[resultRate(home,'draw',true),resultRate(away,'draw',true)]
  }
  if(k==='home-team-goals'){const p=ou(o.name);if(p&&sane(k,p.line))return[ownRate(home,p.side,p.line),oppRate(away,p.side,p.line)]}
  if(k==='away-team-goals'){const p=ou(o.name);if(p&&sane(k,p.line))return[oppRate(home,p.side,p.line),ownRate(away,p.side,p.line)]}
  return null
}
function display(m,o){
  const s=String(o.name||'Selection')
  if(m.marketKey==='first-half-goals')return`1H · ${s}`
  if(m.marketKey==='first-half-winner')return`1H Result · ${s}`
  if(m.marketKey==='home-team-goals')return`Home Team · ${s}`
  if(m.marketKey==='away-team-goals')return`Away Team · ${s}`
  if(m.marketKey==='both-teams-score')return`BTTS · ${s}`
  if(m.marketKey==='double-chance')return`Double Chance · ${s}`
  if(m.marketKey==='draw-no-bet')return`DNB · ${s}`
  if(m.marketKey==='match-winner')return`1X2 · ${s}`
  return s
}
export function tierFromSplit(split){
  const position=Number(split?.position),size=Number(split?.size)
  if(split?.sampleReady!==true||!Number.isFinite(position)||!Number.isFinite(size)||position<1||size<2||position>size)return null
  const band=Math.max(1,Math.min(4,Math.ceil((position*4)/size)))
  return ['A','B','C','D'][band-1]
}
export function tierGate(f){
  const homeTier=tierFromSplit(f?.homeSplit),awayTier=tierFromSplit(f?.awaySplit)
  if(!homeTier||!awayTier)return{allowed:false,homeTier,awayTier,reason:'tier-unverified'}
  if(homeTier===awayTier)return{allowed:false,homeTier,awayTier,reason:'same-tier'}
  return{allowed:true,homeTier,awayTier,reason:'different-tier'}
}

function transitionForMarket(f,m,o,profiles){
  const k=m.marketKey,n=norm(o.name)
  let side=null,mode=null
  if(k==='match-winner'){
    if(n==='home'||n==='1'){side='home';mode='win'}
    else if(n==='away'||n==='2'){side='away';mode='win'}
  }else if(k==='double-chance'){
    if(n.includes('home or draw')||n==='1x'){side='home';mode='not-lose'}
    else if(n.includes('draw or away')||n==='x2'){side='away';mode='not-lose'}
  }else if(k==='draw-no-bet'){
    if(n==='home'||n==='1'){side='home';mode='not-lose'}
    else if(n==='away'||n==='2'){side='away';mode='not-lose'}
  }
  if(!side)return null
  const other=side==='home'?'away':'home'
  return evaluateTransitionSafety({
    stronger:profiles[side],weaker:profiles[other],mode,
    strongerName:f[side].name,weakerName:f[other].name
  })
}

function redirectGoalMarket(p){
  if(p.market==='both-teams-score')return norm(p.selection)==='yes'
  if(p.market!=='total-goals')return false
  const parsed=ou(p.selection)
  return parsed?.side==='over'&&(parsed.line===1.5||parsed.line===2.5)
}

function bankerSafety(f,m,o,hr,ar,price,transition=null){
  const checks=[]
  const add=(ok,label)=>checks.push({ok,label})
  const fullSample=f.home.fixtures.length>=FORM_SAMPLE&&f.away.fixtures.length>=FORM_SAMPLE
  const fullAgreement=Number(hr)===100&&Number(ar)===100
  const validOdds=inWindow(price)
  add(fullSample,'Full recent home/away sample')
  add(fullAgreement,'Both teams agree 100%')
  add(validOdds,'Odds inside the approved range')
  let approved=fullSample&&fullAgreement&&validOdds
  const n=norm(o.name),k=m.marketKey
  if(k==='match-winner'){
    const homePick=n==='home'||n==='1',awayPick=n==='away'||n==='2'
    const split=homePick?f.homeSplit:awayPick?f.awaySplit:null
    const splitReady=split?.sampleReady===true&&Number.isFinite(Number(split.position))&&Number.isFinite(Number(split.size))
    if(splitReady){
      const bottom3=Number(split.position)>Number(split.size)-3
      add(!bottom3,'Selected team is not bottom three in the venue split table')
      if(bottom3)approved=false
    }
  }
  if(transition){
    for(const row of transition.checks||[])add(row.ok,`Transition: ${row.label}`)
    if(!transition.allowed)approved=false
  }
  return{approved,checks}
}

export function analyzeFixture(f,{ignoreTransition=false}={}){
  if(!fixtureHasStats(f))return[]
  if(f.home.fixtures.length<FORM_SAMPLE||f.away.fixtures.length<FORM_SAMPLE)return[]
  const homeMetrics=venueMetrics(f?.home?.fixtures,f?.home?.id,'home')
  const awayMetrics=venueMetrics(f?.away?.fixtures,f?.away?.id,'away')
  const pricedFav=favouriteSide(extractOdds(f))
  if(redFlagSkip(f,{home:homeMetrics,away:awayMetrics,favourite:pricedFav}))return[]
  const tier=tierGate(f);if(!tier.allowed)return[]
  const profiles={
    home:buildTransitionProfile(f.home.fixtures,f.home.id),
    away:buildTransitionProfile(f.away.fixtures,f.away.id)
  }
  const out=[]
  let leakRedirect=null
  for(const m of f.marketOdds||[])for(const o of m.outcomes||[]){
    const price=Number(o.odd);if(!inWindow(price))continue
    const over25=over25Gate(f,m,o);if(over25.applies&&!over25.allowed)continue
    const pair=support(f,m,o);if(!pair)continue
    const [hr,ar]=pair;if(!finite(hr)||!finite(ar))continue
    if(!over25.applies&&(hr<MIN_CONSENSUS||ar<MIN_CONSENSUS))continue
    const n=norm(o.name)
    const picksFav=(m.marketKey==='match-winner'&&((n==='home'||n==='1')&&pricedFav==='home'||(n==='away'||n==='2')&&pricedFav==='away'))
      ||(m.marketKey==='draw-no-bet'&&((n==='home'||n==='1')&&pricedFav==='home'||(n==='away'||n==='2')&&pricedFav==='away'))
    if(picksFav&&favConflict(f,homeMetrics,awayMetrics,pricedFav))continue
    const consensus=Math.min(hr,ar)
    const transition=ignoreTransition?null:transitionForMarket(f,m,o,profiles)
    if(transition&&!transition.allowed){if(transition.redirectGoals)leakRedirect=transition;continue}
    const banker=bankerSafety(f,m,o,hr,ar,price,transition)
    const pick={
      fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
      home:f.home.name,away:f.away.name,homeId:f.home?.id??null,awayId:f.away?.id??null,homeLogo:f.home.logo,awayLogo:f.away.logo,
      market:m.marketKey,marketName:m.market,selection:o.name,displaySelection:display(m,o),
      odds:+price.toFixed(2),homeConsensus:hr,awayConsensus:ar,consensus,
      earlySeason:f.earlySeason===true,earlySeasonHome:f.earlySeasonHome===true,earlySeasonAway:f.earlySeasonAway===true,currentVenueSamples:f.currentVenueSamples||null,
      homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,homeTier:tier.homeTier,awayTier:tier.awayTier,
      transitionSafety:transition||null,
      over25Filter:over25.applies?{
        grade:over25.profile?.grade||'strong',xgStatus:over25.profile?.xgStatus||'unavailable',
        checks:over25.profile?.checks||[],metrics:over25.profile?.metrics||{}
      }:null,
      bankerCandidate:Number(hr)===100&&Number(ar)===100,bankerApproved:banker.approved,bankerChecks:banker.checks,
      oddsVerified:o.verified===true,apiOdd:o.apiOdd??null,statsOdd:o.statsOdd??null
    }
    out.push(attachWhy(pick,f))

  }
  const pool=!ignoreTransition&&leakRedirect?out.filter(redirectGoalMarket):out
  return pool.sort((a,b)=>b.consensus-a.consensus||Number(b.oddsVerified)-Number(a.oddsVerified)||a.odds-b.odds).map(p=>leakRedirect&&!ignoreTransition?{...p,transitionRedirect:{reason:leakRedirect.reason,stronger:leakRedirect.stronger,weaker:leakRedirect.weaker}}:p)
}

export function buildBoard(fixtures,meta={},learningProfiles=[]){
  const learnedList=Array.isArray(learningProfiles)?learningProfiles:[]
  const raw=(fixtures||[]).flatMap(analyzeFixture)
  const all=[]
  for(const p of raw){
    const learned=learningAllows(p,learnedList)
    if(!learned.allowed)continue
    all.push({...p,learningProfile:learned.profile?{sample:learned.profile.sample,winRate:learned.profile.winRate,gate:learned.profile.gate}:null})
  }
  const best=[],seen=new Set()
  for(const p of all){if(seen.has(String(p.fixtureId)))continue;seen.add(String(p.fixtureId));best.push(p)}
  const varBoard=buildAwayFavBoard(fixtures,meta)
  const filterBoard=buildFilterBoard(fixtures,meta)
  const goalsBoard=buildGoalsBankerBoard(fixtures,meta)
  return{
    meta:{
      ...meta,
      engineVersion:ENGINE_VERSION,
      engine:'stats2pitch-consensus-v4-over25',
      minOdd:MIN_ODD,
      maxOdd:MAX_ODD,
      minConsensus:MIN_CONSENSUS,
      formSample:FORM_SAMPLE,
      qualified:all.length,
      bestPicks:best.length,
      learningProfiles:learnedList.filter(x=>x?.ready).length,
      varTipsEngine:varBoard.meta?.engine||'away-fav-streak-v1',
      varTipsCount:Array.isArray(varBoard.bestPicks)?varBoard.bestPicks.length:0,
      filterTipsEngine:filterBoard.meta?.engine||'sporty-filter-v1',
      filterTipsCount:Array.isArray(filterBoard.bestPicks)?filterBoard.bestPicks.length:0,
      goalsBankersEngine:goalsBoard.meta?.engine||'goals-bankers-v3',
      goalsBankersCount:Array.isArray(goalsBoard.bestPicks)?goalsBoard.bestPicks.length:0
    },
    priority:all,
    bestPicks:best,
    availableMarkets:[...new Set(all.map(x=>x.market))].sort(),
    varTips:varBoard.bestPicks||[],
    varTipsMeta:varBoard.meta||null,
    filterTips:filterBoard.bestPicks||[],
    filterTipsMeta:filterBoard.meta||null,
    goalsBankers:goalsBoard.bestPicks||[],
    goalsBankersMeta:goalsBoard.meta||null
  }
}
