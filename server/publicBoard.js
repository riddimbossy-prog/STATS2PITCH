const VIEWS=new Set(['all','var','filter','goals','bankers'])

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
    dailyBankersEngine:meta.dailyBankersEngine,
    safestBankersCount:meta.safestBankersCount,
    valueBankersCount:meta.valueBankersCount,
    requiresRefresh:meta.requiresRefresh===true,
    refresh:meta.refresh||null
  }
}

export function publicBoard(board={},view='all'){
  const v=VIEWS.has(String(view||''))?String(view):'all'
  const empty={
    meta:slimMeta(board?.meta||{}),
    fixtures:Array.isArray(board?.fixtures)?board.fixtures:[],
    availableMarkets:[],
    results:board?.results&&typeof board.results==='object'?board.results:{},
    bestPicks:[],
    varTips:[],
    filterTips:[],
    goalsBankers:[],
    dailyBankers:[],
    safestBankers:[],
    valueBankers:[],
    priority:[],
    bankers:[]
  }
  const markets=rows=>[...new Set((rows||[]).map(x=>x?.market).filter(Boolean))].sort()
  if(v==='var'){
    empty.varTips=Array.isArray(board?.varTips)?board.varTips:[]
    empty.varTipsMeta=board?.varTipsMeta||null
    empty.availableMarkets=markets(empty.varTips)
    return empty
  }
  if(v==='filter'){
    empty.filterTips=Array.isArray(board?.filterTips)?board.filterTips:[]
    empty.filterTipsMeta=board?.filterTipsMeta||null
    empty.availableMarkets=markets(empty.filterTips)
    return empty
  }
  if(v==='goals'){
    empty.goalsBankers=Array.isArray(board?.goalsBankers)?board.goalsBankers:[]
    empty.goalsBankersMeta=board?.goalsBankersMeta||null
    empty.availableMarkets=markets(empty.goalsBankers)
    return empty
  }
  if(v==='bankers'){
    empty.dailyBankers=Array.isArray(board?.dailyBankers)?board.dailyBankers:[]
    empty.safestBankers=Array.isArray(board?.safestBankers)?board.safestBankers:[]
    empty.valueBankers=Array.isArray(board?.valueBankers)?board.valueBankers:[]
    empty.dailyBankersMeta=board?.dailyBankersMeta||null
    empty.availableMarkets=markets(empty.dailyBankers)
    return empty
  }
  empty.bestPicks=Array.isArray(board?.bestPicks)?board.bestPicks:[]
  empty.availableMarkets=Array.isArray(board?.availableMarkets)&&board.availableMarkets.length?board.availableMarkets:markets(empty.bestPicks)
  return empty
}

export function compactResultRows(rows){
  return (Array.isArray(rows)?rows:[]).map(p=>({fixtureId:p?.fixtureId??null,result:p?.result||null}))
}
