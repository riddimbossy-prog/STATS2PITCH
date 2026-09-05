const VIEWS=new Set(['all','var','filter','goals','combo','bankers'])
const PICK_KEEP=new Set(['fixtureId','home','away','homeLogo','awayLogo','homeId','awayId','league','country','kickoff','market','marketName','selection','displaySelection','pick','odds','publishedAt','reasons','shortReason','homeConsensus','awayConsensus','consensus','engineRating','comboScore','rank','group','earlySeason','favourite','kind','route','family','engine','engineVersion','classification','homeSplit','awaySplit','bankerChecks','bankerApproved','currentVenueSamples','learning','learningProfile','marketWhy','oddsBook','why'])

function slimMeta(meta={}){
  return{
    date:meta.date,
    generatedAt:meta.generatedAt||null,
    storedAt:meta.storedAt||null,
    engineVersion:meta.engineVersion,
    engine:meta.engine,
    qualified:meta.qualified,
    bestPicks:meta.bestPicks,
    publishedPicks:meta.publishedPicks,
    firstPublishedAt:meta.firstPublishedAt,
    varTipsEngine:meta.varTipsEngine,
    varTipsCount:meta.varTipsCount,
    filterTipsEngine:meta.filterTipsEngine,
    filterTipsCount:meta.filterTipsCount,
    goalsBankersEngine:meta.goalsBankersEngine,
    goalsBankersCount:meta.goalsBankersCount,
    comboEngine:meta.comboEngine,
    comboCount:meta.comboCount,
    dailyBankersEngine:meta.dailyBankersEngine,
    safestBankersCount:meta.safestBankersCount,
    valueBankersCount:meta.valueBankersCount,
    bankerRulesEngine:meta.bankerRulesEngine||meta.bankerRules?.engine||null,
    bankerRulesCount:meta.bankerRulesCount??meta.diagnostics?.bankerRulePicks??null,
    requiresRefresh:meta.requiresRefresh===true,
    refresh:meta.refresh||null,
    learning:meta.learning||null
  }
}

function slimForm(rows){
  return (Array.isArray(rows)?rows:[]).slice(0,5).map(x=>({
    result:x?.result||'',
    opponent:x?.opponent||'',
    home:x?.home||'',
    away:x?.away||'',
    hs:x?.hs??null,
    as:x?.as??null,
    date:x?.date||'',
    venue:x?.venue||'',
    league:x?.league||''
  }))
}

function slimStats(s){
  if(!s||typeof s!=='object')return null
  return{
    played:s.played??null,
    winPct:s.winPct??null,
    ppg:s.ppg??null,
    gf:s.gf??null,
    ga:s.ga??null,
    btts:s.btts??null,
    over15:s.over15??null,
    over25:s.over25??null
  }
}

function slimWhy(why){
  if(!why||typeof why!=='object')return null
  const lastHome=slimForm(why.lastMatchesHome||why.last5Home)
  const lastAway=slimForm(why.lastMatchesAway||why.last5Away)
  return{
    headline:why.headline||'',
    classification:why.classification||'',
    homeStats:slimStats(why.homeStats||why.homeAvg),
    awayStats:slimStats(why.awayStats||why.awayAvg),
    lastMatchesHome:lastHome,
    lastMatchesAway:lastAway,
    last5Home:lastHome,
    last5Away:lastAway,
    h2h:slimForm(why.h2h)
  }
}

function slimPick(row){
  if(!row||typeof row!=='object')return row
  const out={}
  for(const k of PICK_KEEP) if(row[k]!==undefined) out[k]=row[k]
  if(out.why) out.why=slimWhy(out.why)
  if(Array.isArray(out.reasons)) out.reasons=out.reasons.slice(0,8)
  return out
}

function slimPicks(rows){return (Array.isArray(rows)?rows:[]).map(slimPick)}

function slimFixtures(rows){
  return (Array.isArray(rows)?rows:[]).map(f=>({
    fixtureId:f?.fixtureId??null,
    homeLogo:f?.homeLogo||null,
    awayLogo:f?.awayLogo||null
  }))
}

function slimResult(r){
  return{
    outcome:r.outcome||'pending',
    matchState:r.matchState||'pending',
    homeScore:r.homeScore??r.home?.score??null,
    awayScore:r.awayScore??r.away?.score??null,
    minute:r.minute||r.clock||null,
    status:r.status||'',
    live:r.live===true,
    finished:r.finished===true,
    postponed:r.postponed===true,
    cancelled:r.cancelled===true
  }
}
function slimResults(results,picks){
  const src=results&&typeof results==='object'?results:{}
  const keys=new Set()
  for(const p of picks||[]){
    const id=String(p?.fixtureId||'')
    if(id)keys.add(id)
    if(p?.fixtureId!=null&&p?.market)keys.add(`${p.fixtureId}|${p.market}|${String(p.selection||'').trim()}`)
  }
  const out={}
  for(const id of keys){
    const r=src[id]
    if(!r)continue
    out[id]=slimResult(r)
  }
  return out
}

function finalize(empty){
  const bags=['bestPicks','varTips','filterTips','goalsBankers','comboPicks','dailyBankers','safestBankers','valueBankers','bankers','priority']
  const picks=[]
  for(const k of bags){
    if(Array.isArray(empty[k])){
      empty[k]=slimPicks(empty[k])
      picks.push(...empty[k])
    }
  }
  empty.fixtures=slimFixtures(empty.fixtures)
  empty.results=slimResults(empty.results,picks)
  return empty
}

export function isComboBoardPick(r){
  const m=String(r?.market||'')
  const engine=String(r?.engineVersion||r?.engine||'')
  return m.startsWith('combo-')||engine.startsWith('combo-')
}

export function splitGoalsAndCombo(board={}){
  const rawGoals=Array.isArray(board?.goalsBankers)?board.goalsBankers:[]
  const dedicated=Array.isArray(board?.comboPicks)?board.comboPicks.filter(isComboBoardPick):[]
  const fromGoals=rawGoals.filter(isComboBoardPick)
  return{
    goalsBankers:rawGoals.filter(r=>!isComboBoardPick(r)),
    comboPicks:dedicated.length?dedicated:fromGoals
  }
}

export function sanitizeGoalsAndCombo(board={}){
  const split=splitGoalsAndCombo(board)
  return{
    ...board,
    goalsBankers:split.goalsBankers,
    comboPicks:split.comboPicks,
    meta:{
      ...(board.meta||{}),
      goalsBankersCount:split.goalsBankers.length,
      comboCount:split.comboPicks.length,
      comboEngine:board?.meta?.comboEngine||board?.comboMeta?.engine||null
    }
  }
}

export function publicBoard(board={},view='all'){
  const v=VIEWS.has(String(view||''))?String(view):'all'
  const split=splitGoalsAndCombo(board)
  const empty={
    meta:slimMeta(board?.meta||{}),
    fixtures:Array.isArray(board?.fixtures)?board.fixtures:[],
    availableMarkets:[],
    results:board?.results&&typeof board.results==='object'?board.results:{},
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    comboPicks:[],
    dailyBankers:[],
    safestBankers:[],
    valueBankers:[],
    priority:[],
    bankers:[]
  }
  if(board?.learning)empty.learning=board.learning
  const markets=rows=>[...new Set((rows||[]).map(x=>x?.market).filter(Boolean))].sort()
  if(v==='var'){
    empty.varTips=Array.isArray(board?.varTips)?board.varTips:[]
    empty.varTipsMeta=board?.varTipsMeta||null
    empty.availableMarkets=markets(empty.varTips)
    return finalize(empty)
  }
  if(v==='filter'){
    empty.filterTips=Array.isArray(board?.filterTips)?board.filterTips:[]
    empty.filterTipsMeta=board?.filterTipsMeta||null
    empty.availableMarkets=markets(empty.filterTips)
    return finalize(empty)
  }
  if(v==='goals'){
    empty.goalsBankers=split.goalsBankers
    empty.goalsBankersMeta=board?.goalsBankersMeta||null
    empty.availableMarkets=markets(empty.goalsBankers)
    return finalize(empty)
  }
  if(v==='combo'){
    empty.comboPicks=split.comboPicks
    empty.comboMeta=board?.comboMeta||null
    empty.availableMarkets=markets(empty.comboPicks)
    return finalize(empty)
  }
  if(v==='bankers'){
    empty.bankers=Array.isArray(board?.bankers)?board.bankers:[]
    empty.bankerRulesMeta=board?.bankerRulesMeta||null
    empty.dailyBankers=Array.isArray(board?.dailyBankers)?board.dailyBankers:[]
    empty.safestBankers=Array.isArray(board?.safestBankers)?board.safestBankers:[]
    empty.valueBankers=Array.isArray(board?.valueBankers)?board.valueBankers:[]
    empty.dailyBankersMeta=board?.dailyBankersMeta||null
    empty.availableMarkets=markets([...empty.bankers,...empty.safestBankers,...empty.valueBankers,...empty.dailyBankers])
    return finalize(empty)
  }
  empty.bestPicks=Array.isArray(board?.bestPicks)?board.bestPicks:[]
  empty.bankers=Array.isArray(board?.bankers)?board.bankers:[]
  empty.availableMarkets=Array.isArray(board?.availableMarkets)&&board.availableMarkets.length?board.availableMarkets:markets(empty.bestPicks)
  return finalize(empty)
}

export function compactResultRows(rows){
  return (Array.isArray(rows)?rows:[]).map(p=>({
    fixtureId:p?.fixtureId??null,
    market:p?.market||null,
    selection:p?.selection||null,
    result:p?.result||null
  }))
}
