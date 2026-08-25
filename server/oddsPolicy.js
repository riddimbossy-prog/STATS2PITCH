import { parseApiFootballRows, parseStatsRows } from './oddsV2.js'

const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const validOdd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const defaultBookOrder=['pinnacle','betfair exchange','bet365','kambi']
const MAX_RELATIVE_DIFF=Math.max(0,Number(process.env.ODDS_VERIFY_MAX_RELATIVE_DIFF||0.15))
const REQUIRE_CROSS_SOURCE=String(process.env.ODDS_REQUIRE_CROSS_SOURCE||'false').toLowerCase()==='true'

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
  if(key==='goals-streak-2')return m.has('yes')?90:0
  if(key==='draw-no-bet')return m.has('home')&&m.has('away')?100:0
  if(key==='double-chance')return ['home or draw','home or away','draw or away'].filter(k=>m.has(k)).length>=2?90:0
  if(key==='total-goals'||key==='first-half-goals'||key.includes('team-goals')){
    const pairs=pairedTotalLines(outcomes).length
    return pairs?80+pairs:0
  }
  return m.size>=2?50+m.size:0
}
function relativeDiff(a,b){
  const x=validOdd(a),y=validOdd(b)
  if(!x||!y)return null
  return Math.abs(x-y)/Math.min(x,y)
}
function groupRows(rows){
  const grouped=new Map()
  let order=0
  for(const row of rows){
    const sourceRank=Number(row?.sourceRank??9)
    const source=sourceRank===0?'thestatsapi':'api-football'
    const k=`${row.marketKey}|${sourceRank}|${norm(row.bookmaker)}`
    if(!grouped.has(k))grouped.set(k,{marketKey:row.marketKey,market:row.market,bookmaker:row.bookmaker||'Book',source,sourceRank,order:order++,outcomes:[]})
    grouped.get(k).outcomes.push(...(row.outcomes||[]))
  }
  return [...grouped.values()]
}
function chooseCandidate(candidates){
  const rows=[...candidates].sort((a,b)=>bookRank(a.bookmaker)-bookRank(b.bookmaker)||b.quality-a.quality||a.sourceRank-b.sourceRank||a.order-b.order)
  return rows[0]||null
}
function sourceMarketMap(groups,source){
  const out=new Map()
  for(const g of groups.filter(x=>x.source===source)){
    const map=outcomeMap(g.outcomes)
    const outcomes=[...map.values()].map(o=>({...o,bookmaker:g.bookmaker,source:g.source}))
    const quality=completeness(g.marketKey,outcomes)
    if(!quality)continue
    const c={...g,outcomes,quality}
    if(!out.has(g.marketKey))out.set(g.marketKey,[])
    out.get(g.marketKey).push(c)
  }
  return out
}
function verifyMarket(apiCandidate,statsCandidate){
  if(!apiCandidate&&!statsCandidate)return null
  if(!apiCandidate||!statsCandidate){
    const c=apiCandidate||statsCandidate
    if(REQUIRE_CROSS_SOURCE)return null
    return {
      marketKey:c.marketKey,market:c.market,bookmaker:c.bookmaker,source:c.source,
      verification:'single-source',outcomes:c.outcomes.map(o=>({...o,verified:false,verification:'single-source'}))
    }
  }
  const a=outcomeMap(apiCandidate.outcomes),s=outcomeMap(statsCandidate.outcomes),out=[]
  const names=new Set([...a.keys(),...s.keys()])
  for(const name of names){
    const av=a.get(name),sv=s.get(name)
    if(av&&sv){
      const diff=relativeDiff(av.odd,sv.odd)
      if(diff!==null&&diff<=MAX_RELATIVE_DIFF){
        const chosen=bookRank(apiCandidate.bookmaker)<=bookRank(statsCandidate.bookmaker)?av:sv
        out.push({
          name:chosen.name,
          odd:+((Number(av.odd)+Number(sv.odd))/2).toFixed(3),
          bookmaker:`${apiCandidate.bookmaker} + ${statsCandidate.bookmaker}`,
          source:'cross-source',
          verified:true,
          verification:'cross-source',
          apiOdd:Number(av.odd),
          statsOdd:Number(sv.odd),
          relativeDiff:+diff.toFixed(4)
        })
      }
      continue
    }
    if(!REQUIRE_CROSS_SOURCE){
      const single=av||sv
      out.push({...single,verified:false,verification:'single-source'})
    }
  }
  if(!out.length)return null
  return {
    marketKey:apiCandidate.marketKey,
    market:apiCandidate.market||statsCandidate.market,
    bookmaker:`${apiCandidate.bookmaker} / ${statsCandidate.bookmaker}`,
    source:'verified-cross-source-v2',
    verification:'mixed',
    outcomes:out
  }
}

export function buildCoherentOdds({apiPayload=[],statsPayload=null,fixture=null}={}){
  const rows=[...parseStatsRows(statsPayload,fixture),...parseApiFootballRows(apiPayload,fixture)]
  const groups=groupRows(rows)
  const apiBy=sourceMarketMap(groups,'api-football')
  const statsBy=sourceMarketMap(groups,'thestatsapi')
  const keys=new Set([...apiBy.keys(),...statsBy.keys()])
  const marketOdds=[]
  for(const key of keys){
    const api=chooseCandidate(apiBy.get(key)||[])
    const stats=chooseCandidate(statsBy.get(key)||[])
    const verified=verifyMarket(api,stats)
    if(verified)marketOdds.push(verified)
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
    bttsYes:find('both-teams-score',['Yes']),bttsNo:find('both-teams-score',['No']),
    homeO05:find('home-team-goals',['Over 0.5']),homeO15:find('home-team-goals',['Over 1.5']),
    awayO05:find('away-team-goals',['Over 0.5']),awayO15:find('away-team-goals',['Over 1.5']),
    streakYes:find('goals-streak-2',['Yes'])
  }
  return{marketOdds,canonical,policy:'verified-cross-source-v2',maxRelativeDiff:MAX_RELATIVE_DIFF,requireCrossSource:REQUIRE_CROSS_SOURCE}
}
