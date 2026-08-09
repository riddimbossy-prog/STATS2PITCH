import { comparePicks, oneBestPerFixture } from './engine.js'

const LIVE_STATUSES=new Set(['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'])
const SETTLED_STATUSES=new Set(['FT','AET','PEN','AWD','WO'])
const UPCOMING_STATUSES=new Set(['NS','TBD'])
const POSTPONED_STATUSES=new Set(['PST','CANC','ABD'])
export const KICKOFF_STATUS_GRACE_MS=15*60*1000

function kickoffTime(value){
  const ms=new Date(value||'').getTime()
  return Number.isFinite(ms)?ms:null
}

/**
 * Provider status remains authoritative for Live/Settled/Postponed states.
 * For NS/TBD only, the scheduled kickoff clock is a hard sanity guard:
 * after a short grace period the fixture can no longer be called Upcoming.
 * We deliberately use "pending" rather than guessing Live because the provider
 * may be late, the fixture may be delayed, or another lifecycle event may be pending.
 */
export function statusGroup(short,kickoff=null,now=Date.now()){
  const s=String(short||'').toUpperCase()
  if(LIVE_STATUSES.has(s))return'live'
  if(SETTLED_STATUSES.has(s))return'settled'
  if(POSTPONED_STATUSES.has(s))return'postponed'
  if(UPCOMING_STATUSES.has(s)){
    const kick=kickoffTime(kickoff)
    if(kick!==null&&Number(now)>kick+KICKOFF_STATUS_GRACE_MS)return'pending'
    return'upcoming'
  }
  return'pending'
}

export function fixtureLifecycle(fixture,{now=Date.now()}={}){
  const short=String(fixture?.fixture?.status?.short||'NS').toUpperCase()
  const elapsedRaw=fixture?.fixture?.status?.elapsed
  const h=fixture?.goals?.home,a=fixture?.goals?.away
  const kickoff=fixture?.fixture?.date||null
  const group=statusGroup(short,kickoff,now)
  return{
    statusShort:short,
    statusGroup:group,
    statusLong:fixture?.fixture?.status?.long||'',
    statusDerived:group==='pending'&&UPCOMING_STATUSES.has(short)?'kickoff-passed-provider-pending':null,
    elapsed:elapsedRaw!==null&&elapsedRaw!==undefined&&Number.isFinite(Number(elapsedRaw))?Number(elapsedRaw):null,
    homeScore:h!==null&&h!==undefined&&Number.isFinite(Number(h))?Number(h):null,
    awayScore:a!==null&&a!==undefined&&Number.isFinite(Number(a))?Number(a):null
  }
}

export function buildLifecycleMap(fixtures,opts={}){
  const out={}
  for(const f of Array.isArray(fixtures)?fixtures:[]){
    const id=f?.fixture?.id
    if(id!==undefined&&id!==null)out[String(id)]=fixtureLifecycle(f,opts)
  }
  return out
}

const allRows=board=>[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]
const key=row=>`${row?.fixtureId}|${row?.market}|${row?.selectedTeamId??row?.selectedTeam??''}|${row?.selectionLabel??''}`
function applyLifecycle(row,map){
  const life=map?.[String(row?.fixtureId)]||null
  if(life)return{...row,...life}
  const short=row?.statusShort||'NS'
  return{...row,statusGroup:statusGroup(short,row?.kickoff),statusShort:short}
}

export function mergeLifecycleBoard(current,previous,lifecycleMap){
  const rows=new Map()
  for(const r of allRows(current))rows.set(key(r),applyLifecycle(r,lifecycleMap))
  for(const r of allRows(previous)){
    const life=lifecycleMap?.[String(r?.fixtureId)]
    if(!life||life.statusGroup==='upcoming'||life.statusGroup==='postponed')continue
    const k=key(r)
    if(!rows.has(k))rows.set(k,applyLifecycle(r,lifecycleMap))
  }
  const qualified=[...rows.values()].filter(r=>Number.isFinite(Number(r?.odds))&&Number(r.odds)>1.001).sort(comparePicks)
  const groups={single:qualified.filter(r=>Number(r.filterCount)===1),two:qualified.filter(r=>Number(r.filterCount)===2),threePlus:qualified.filter(r=>Number(r.filterCount)>=3)}
  const statusCounts={upcoming:0,live:0,settled:0,postponed:0,pending:0}
  for(const r of qualified){const g=r.statusGroup||'pending';if(g in statusCounts)statusCounts[g]++}
  return{...current,meta:{...current?.meta,qualified:qualified.length,statusCounts},groups,priority:qualified,bestPicks:oneBestPerFixture(qualified)}
}
