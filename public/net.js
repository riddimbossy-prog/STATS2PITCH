const cfg=(typeof window!=='undefined'&&window.__STATS2PITCH_CONFIG__)||{}
const base=String(cfg.supabaseUrl||'').replace(/\/+$/,'')
const anon=String(cfg.supabaseAnonKey||'')
const fn=String(cfg.functionName||'stats2pitch-api')
const BOARD_CACHE_MS=12*60*1000

export function endpoint(path){
  if(!base)throw new Error('Service unavailable')
  return `${base}/functions/v1/${fn}${path}`
}

export async function api(path,options={}){
  const {cache='no-store',...rest}=options
  const res=await fetch(endpoint(path),{
    ...rest,
    headers:{apikey:anon,Authorization:`Bearer ${anon}`,...(rest.headers||{})},
    cache
  })
  const body=await res.json().catch(()=>null)
  if(!res.ok)throw new Error('Unable to load this right now')
  return body
}

function cacheKey(date,view){return `s2p-board:${view||'all'}:${date}`}

export function readBoardCache(date,view='all'){
  try{
    const raw=sessionStorage.getItem(cacheKey(date,view))
    if(!raw)return null
    const row=JSON.parse(raw)
    if(!row?.data||Date.now()-Number(row.at||0)>BOARD_CACHE_MS)return null
    return row.data
  }catch{return null}
}

export function writeBoardCache(date,view,data){
  if(!data)return
  try{sessionStorage.setItem(cacheKey(date,view),JSON.stringify({at:Date.now(),data}))}catch{}
}

export function addDays(iso,n){
  const d=new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate()+n)
  return d.toISOString().slice(0,10)
}

export function isoToday(){
  return new Date().toISOString().slice(0,10)
}

export function dateStrip(today=isoToday()){
  return Array.from({length:13},(_,i)=>addDays(today,i-6))
}

export function isSrlPick(row){
  const blob=[row?.league,row?.country,row?.home?.name||row?.home,row?.away?.name||row?.away,row?.match].map(v=>String(v||'')).join(' ')
  return /\b(srl|simulated reality)\b/i.test(blob)
}

export function hasRemainingTips(rows,now=Date.now()){
  return(rows||[]).some(r=>{
    const k=Date.parse(r?.kickoff||'')
    return Number.isFinite(k)&&k>now
  })
}

export function firstOpenDate(from,boards={},today=isoToday(),now=Date.now()){
  if(!from||from<today)return null
  const start=dateStrip(today).indexOf(from)
  if(start<0)return null
  for(const date of dateStrip(today).slice(start+1)){
    if(hasRemainingTips(boards[date],now))return date
  }
  return null
}

export function prefetchBoard(date,view='all'){
  api(`/board?date=${encodeURIComponent(date)}&view=${encodeURIComponent(view)}`,{cache:'default'})
    .then(board=>{if(board)writeBoardCache(date,view,board)})
    .catch(()=>{})
}

export function warmNeighbors(date,view='all'){
  const run=()=>{prefetchBoard(addDays(date,1),view);prefetchBoard(addDays(date,-1),view)}
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:2500})
  else setTimeout(run,400)
}

export async function nextDateWithTips(from,view,rowsOf){
  const today=isoToday()
  if(!from||from<today)return null
  const start=dateStrip(today).indexOf(from)
  if(start<0)return null
  for(const date of dateStrip(today).slice(start+1)){
    let board=readBoardCache(date,view)
    if(!board){
      try{
        board=await api(`/board?date=${encodeURIComponent(date)}&view=${encodeURIComponent(view)}`,{cache:'default'})
        if(board)writeBoardCache(date,view,board)
      }catch{continue}
    }
    const rows=typeof rowsOf==='function'?rowsOf(board):(board?.bestPicks||[])
    if(hasRemainingTips(rows))return{date,board}
  }
  return null
}

export function scrollDateStrip(host){
  const active=host?.querySelector?.('.date.active')
  if(!host||!active)return
  const left=active.offsetLeft-(host.clientWidth-active.offsetWidth)/2
  if(typeof host.scrollTo==='function')host.scrollTo({left:Math.max(0,left),behavior:'instant'})
  else host.scrollLeft=Math.max(0,left)
}

export function bootDone(){try{window.s2pBootDone?.()}catch{}}
