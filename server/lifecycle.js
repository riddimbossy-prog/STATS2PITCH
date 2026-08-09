import { comparePicks, oneBestPerFixture } from './engine.js'

const LIVE_STATUSES=new Set(['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'])
const SETTLED_STATUSES=new Set(['FT','AET','PEN','AWD','WO'])
const UPCOMING_STATUSES=new Set(['NS','TBD'])
const POSTPONED_STATUSES=new Set(['PST','CANC','ABD'])
export function statusGroup(short){const s=String(short||'').toUpperCase();if(LIVE_STATUSES.has(s))return'live';if(SETTLED_STATUSES.has(s))return'settled';if(POSTPONED_STATUSES.has(s))return'postponed';if(UPCOMING_STATUSES.has(s))return'upcoming';return'upcoming'}
export function fixtureLifecycle(fixture){const short=String(fixture?.fixture?.status?.short||'NS').toUpperCase(),elapsedRaw=fixture?.fixture?.status?.elapsed,h=fixture?.goals?.home,a=fixture?.goals?.away;return{statusShort:short,statusGroup:statusGroup(short),statusLong:fixture?.fixture?.status?.long||'',elapsed:elapsedRaw!==null&&elapsedRaw!==undefined&&Number.isFinite(Number(elapsedRaw))?Number(elapsedRaw):null,homeScore:h!==null&&h!==undefined&&Number.isFinite(Number(h))?Number(h):null,awayScore:a!==null&&a!==undefined&&Number.isFinite(Number(a))?Number(a):null}}
export function buildLifecycleMap(fixtures){const out={};for(const f of Array.isArray(fixtures)?fixtures:[]){const id=f?.fixture?.id;if(id!==undefined&&id!==null)out[String(id)]=fixtureLifecycle(f)}return out}
const allRows=board=>[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]
const key=row=>`${row?.fixtureId}|${row?.market}|${row?.selectedTeamId??row?.selectedTeam??''}|${row?.selectionLabel??''}`
function applyLifecycle(row,map){const life=map?.[String(row?.fixtureId)]||null;return life?{...row,...life}:{...row,statusGroup:row?.statusGroup||'upcoming',statusShort:row?.statusShort||'NS'}}
export function mergeLifecycleBoard(current,previous,lifecycleMap){
  const rows=new Map();for(const r of allRows(current))rows.set(key(r),applyLifecycle(r,lifecycleMap))
  for(const r of allRows(previous)){const life=lifecycleMap?.[String(r?.fixtureId)];if(!life||life.statusGroup==='upcoming'||life.statusGroup==='postponed')continue;const k=key(r);if(!rows.has(k))rows.set(k,applyLifecycle(r,lifecycleMap))}
  const qualified=[...rows.values()].filter(r=>Number.isFinite(Number(r?.odds))&&Number(r.odds)>1.001).sort(comparePicks)
  const groups={single:qualified.filter(r=>Number(r.filterCount)===1),two:qualified.filter(r=>Number(r.filterCount)===2),threePlus:qualified.filter(r=>Number(r.filterCount)>=3)}
  const statusCounts={upcoming:0,live:0,settled:0,postponed:0};for(const r of qualified){const g=r.statusGroup||'upcoming';if(g in statusCounts)statusCounts[g]++}
  return{...current,meta:{...current?.meta,qualified:qualified.length,statusCounts},groups,priority:qualified,bestPicks:oneBestPerFixture(qualified)}
}
