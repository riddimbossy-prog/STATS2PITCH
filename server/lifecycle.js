const LIVE_STATUSES=new Set(['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'])
const SETTLED_STATUSES=new Set(['FT','AET','PEN','AWD','WO'])
const UPCOMING_STATUSES=new Set(['NS','TBD','PST','CANC'])

export function statusGroup(short){
  const s=String(short||'').toUpperCase()
  if(LIVE_STATUSES.has(s))return'live'
  if(SETTLED_STATUSES.has(s))return'settled'
  if(UPCOMING_STATUSES.has(s))return'upcoming'
  return'upcoming'
}

export function fixtureLifecycle(fixture){
  const short=String(fixture?.fixture?.status?.short||'NS').toUpperCase()
  return{
    statusShort:short,
    statusGroup:statusGroup(short),
    statusLong:fixture?.fixture?.status?.long||'',
    elapsed:Number.isFinite(Number(fixture?.fixture?.status?.elapsed))?Number(fixture.fixture.status.elapsed):null,
    homeScore:Number.isFinite(Number(fixture?.goals?.home))?Number(fixture.goals.home):null,
    awayScore:Number.isFinite(Number(fixture?.goals?.away))?Number(fixture.goals.away):null
  }
}

export function buildLifecycleMap(fixtures){
  const out={}
  for(const f of Array.isArray(fixtures)?fixtures:[]){
    const id=f?.fixture?.id
    if(id!==undefined&&id!==null)out[String(id)]=fixtureLifecycle(f)
  }
  return out
}

function allRows(board){return[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]}
function key(row){return`${row?.fixtureId}|${row?.market}|${row?.selectedTeamId??row?.selectedTeam??''}|${row?.selectionLabel??''}`}
function contradictionRank(x){return x==='LOW'?0:x==='MODERATE'?1:2}
function sortPicks(a,b){return Number(b.filterCount||0)-Number(a.filterCount||0)||contradictionRank(a.contradiction)-contradictionRank(b.contradiction)||Number(b.score||0)-Number(a.score||0)||(Number(a.odds)||99)-(Number(b.odds)||99)}

function applyLifecycle(row,map){
  const life=map?.[String(row?.fixtureId)]||null
  if(!life)return{...row,statusGroup:row?.statusGroup||'upcoming',statusShort:row?.statusShort||'NS'}
  return{...row,...life}
}

export function mergeLifecycleBoard(current,previous,lifecycleMap){
  const rows=new Map()
  for(const r of allRows(current))rows.set(key(r),applyLifecycle(r,lifecycleMap))

  // Preserve only picks that were already published before kickoff. Never invent
  // a new live/settled prediction after a match has started.
  for(const r of allRows(previous)){
    const life=lifecycleMap?.[String(r?.fixtureId)]
    if(!life||life.statusGroup==='upcoming')continue
    const k=key(r)
    if(!rows.has(k))rows.set(k,applyLifecycle(r,lifecycleMap))
  }

  const qualified=[...rows.values()].filter(r=>Number.isFinite(Number(r?.odds))&&Number(r.odds)>1.001)
  const groups={
    single:qualified.filter(r=>Number(r.filterCount)===1).sort(sortPicks),
    two:qualified.filter(r=>Number(r.filterCount)===2).sort(sortPicks),
    threePlus:qualified.filter(r=>Number(r.filterCount)>=3).sort(sortPicks)
  }
  const statusCounts={upcoming:0,live:0,settled:0}
  for(const r of qualified){const g=r.statusGroup||'upcoming';if(g in statusCounts)statusCounts[g]++}

  return{
    ...current,
    meta:{...current?.meta,qualified:qualified.length,statusCounts},
    groups,
    priority:[...qualified].sort(sortPicks)
  }
}
