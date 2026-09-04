import {fetchJson} from './http.js'
import {parseSportyBet} from './odds.js'

const COUNTRY=String(process.env.SPORTYBET_COUNTRY||'gh').replace(/[^a-z]/gi,'').toLowerCase()||'gh'
const BASE=String(process.env.SPORTYBET_BASE||'https://www.sportybet.com').replace(/\/+$/,'')
const TIMEOUT=Math.max(5000,Number(process.env.SPORTYBET_TIMEOUT_MS||20000))
const cache=new Map()

const headers=()=>({
  Accept:'application/json, text/plain, */*',Origin:BASE,Referer:`${BASE}/${COUNTRY}/sport/football/today`,Clientid:'web',Platform:'web',
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
})
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const looksCombo=m=>{
  const n=norm(m?.name||m?.desc||'')
  const first=/\b(home(?: team)?|draw|away(?: team)?) or\b/.test(n)
  const second=/\b(over 2\.5|under 2\.5|gg|any clean sheet|clean sheet)\b/.test(n)||/both teams.*score/.test(n)
  return first&&second
}
const hasThresholdMarkets=markets=>{
  const keys=new Set(parseSportyBet(markets||[]).map(r=>r.marketKey))
  const hasHome=keys.has('home-team-goals')||keys.has('team-goals')
  const hasAway=keys.has('away-team-goals')||keys.has('team-goals')
  return keys.has('match-winner')&&hasHome&&hasAway
}
const eventQuery=f=>{
  const eventId=String(f?.sporty?.eventId||'').trim(),gameId=String(f?.sporty?.gameId||'').trim()
  if(eventId)return /^\d+$/.test(eventId)?{gameId:eventId}:{eventId}
  if(gameId)return{gameId}
  return null
}
async function mapLimit(items,limit,fn){
  if(!items.length)return[]
  let i=0
  async function worker(){while(true){const x=i++;if(x>=items.length)return;await fn(items[x],x)}}
  await Promise.all(Array.from({length:Math.min(Math.max(1,limit),items.length)},worker))
  return items
}
async function detail(f){
  const q=eventQuery(f);if(!q)return null
  const key=JSON.stringify(q)
  if(cache.has(key))return cache.get(key)
  const job=(async()=>{
    const url=new URL(`${BASE}/api/${COUNTRY}/factsCenter/event`)
    for(const [k,v] of Object.entries(q))url.searchParams.set(k,String(v))
    const body=await fetchJson(url,{headers:headers()},TIMEOUT,{retries:Number(process.env.SPORTYBET_RETRIES||2),baseDelayMs:650})
    if(body?.bizCode!==10000)throw new Error(body?.innerMsg||body?.message||`SportyBet ${body?.bizCode}`)
    return body?.data||null
  })()
  cache.set(key,job)
  return job
}
function marketBag(ev){
  if(Array.isArray(ev?.markets))return ev.markets
  if(Array.isArray(ev?.event?.markets))return ev.event.markets
  if(Array.isArray(ev?.sport?.event?.markets))return ev.sport.event.markets
  return[]
}
function mergeMarkets(a=[],b=[]){
  const out=[],seen=new Set()
  for(const m of [...a,...b]){
    const key=`${m?.id??''}|${norm(m?.name||m?.desc||'')}`
    if(seen.has(key))continue
    seen.add(key);out.push(m)
  }
  return out
}

export async function hydrateSportyComboMarkets(fixtures,{concurrency=3}={}){
  const rows=Array.isArray(fixtures)?fixtures:[]
  const missing=rows.filter(f=>{
    const markets=f?.sporty?.markets||[]
    return !markets.some(looksCombo)||!hasThresholdMarkets(markets)
  })
  await mapLimit(missing,concurrency,async f=>{
    try{
      const ev=await detail(f),markets=marketBag(ev)
      if(!f.sporty)f.sporty={}
      if(markets.length)f.sporty.markets=mergeMarkets(f.sporty.markets||[],markets)
    }catch(error){
      console.warn(`Combo markets ${f?.fixture?.id||'unknown'}: ${error?.message||error}`)
    }
  })
  return rows
}
