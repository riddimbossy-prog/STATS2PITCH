import { parseApiFootballRows, parseStatsRows } from './oddsV2.js'

const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const validOdd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const defaultBookOrder=['pinnacle','betfair exchange','bet365','kambi']

function bookRank(name){
  const n=norm(name)
  const preferred=norm(process.env.ODDS_PREFERRED_BOOKMAKER||'')
  if(preferred&&(n===preferred||n.includes(preferred)||preferred.includes(n)))return-100
  const i=defaultBookOrder.indexOf(n)
  return i<0?50:i
}
function outcomeMap(outcomes){
  const m=new Map()
  for(const o of outcomes||[]){const p=validOdd(o?.odd),n=norm(o?.name);if(p&&n&&!m.has(n))m.set(n,{name:o.name,odd:p})}
  return m
}
function pairedTotalLines(outcomes){
  const m=outcomeMap(outcomes),lines=[]
  for(const key of m.keys()){
    const hit=key.match(/^over\s+([0-9]+(?:\.[0-9]+)?)$/)
    if(!hit)continue
    if(m.has(`under ${hit[1]}`))lines.push(hit[1])
  }
  return lines
}
function completeness(key,outcomes){
  const m=outcomeMap(outcomes)
  if(key==='match-winner')return ['home','draw','away'].every(k=>m.has(k))?100:0
  if(key==='both-teams-score')return ['yes','no'].every(k=>m.has(k))?100:0
  if(key==='draw-no-bet')return m.has('home')&&m.has('away')?100:0
  if(key==='double-chance')return ['home or draw','home or away','draw or away'].filter(k=>m.has(k)).length>=2?90:0
  if(key==='total-goals'||key==='first-half-goals'||key.includes('team-goals')){
    const pairs=pairedTotalLines(outcomes).length
    return pairs?80+pairs:0
  }
  return m.size>=2?50+m.size:0
}

export function buildCoherentOdds({apiPayload=[],statsPayload=null,fixture=null}={}){
  const rows=[...parseStatsRows(statsPayload,fixture),...parseApiFootballRows(apiPayload,fixture)]
  const grouped=new Map()
  let order=0
  for(const row of rows){
    const sourceRank=Number(row?.sourceRank??9)
    const source=sourceRank===0?'thestatsapi':'api-football'
    const k=`${row.marketKey}|${sourceRank}|${norm(row.bookmaker)}`
    if(!grouped.has(k))grouped.set(k,{marketKey:row.marketKey,market:row.market,bookmaker:row.bookmaker||'Book',source,sourceRank,order:order++,outcomes:[]})
    grouped.get(k).outcomes.push(...(row.outcomes||[]))
  }
  const byMarket=new Map()
  for(const g of grouped.values()){
    const map=outcomeMap(g.outcomes)
    const outcomes=[...map.values()].map(o=>({...o,bookmaker:g.bookmaker,source:g.source}))
    const quality=completeness(g.marketKey,outcomes)
    if(!quality)continue
    const candidate={...g,outcomes,quality}
    if(!byMarket.has(g.marketKey))byMarket.set(g.marketKey,[])
    byMarket.get(g.marketKey).push(candidate)
  }
  const marketOdds=[]
  for(const candidates of byMarket.values()){
    candidates.sort((a,b)=>bookRank(a.bookmaker)-bookRank(b.bookmaker)||b.quality-a.quality||a.sourceRank-b.sourceRank||a.order-b.order)
    const c=candidates[0]
    marketOdds.push({marketKey:c.marketKey,market:c.market,bookmaker:c.bookmaker,source:c.source,outcomes:c.outcomes})
  }
  marketOdds.sort((a,b)=>a.market.localeCompare(b.market))
  const find=(key,names)=>{
    const m=marketOdds.find(x=>x.marketKey===key);if(!m)return null
    for(const n of names){const hit=m.outcomes.find(o=>norm(o.name)===norm(n));if(hit)return validOdd(hit.odd)}
    return null
  }
  const canonical={
    home:find('match-winner',['Home','1']),draw:find('match-winner',['Draw','X']),away:find('match-winner',['Away','2']),
    over15:find('total-goals',['Over 1.5']),under15:find('total-goals',['Under 1.5']),
    over25:find('total-goals',['Over 2.5']),under25:find('total-goals',['Under 2.5']),
    over35:find('total-goals',['Over 3.5']),under35:find('total-goals',['Under 3.5']),
    bttsYes:find('both-teams-score',['Yes']),bttsNo:find('both-teams-score',['No'])
  }
  return{marketOdds,canonical,policy:'single-bookmaker-coherent-v1'}
}
