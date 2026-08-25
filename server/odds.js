import {MAX_RELATIVE_DIFF,REQUIRE_CROSS_SOURCE} from './config.js'

const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const odd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const title=s=>text(s).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
function sameTeam(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))}
function sideName(raw,fixture){
  let s=text(raw).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim(),n=norm(s)
  const h=fixture?.teams?.home?.name||'',a=fixture?.teams?.away?.name||''
  if(['home','1'].includes(n)||sameTeam(s,h))return'Home'
  if(['away','2'].includes(n)||sameTeam(s,a))return'Away'
  if(['draw','x','tie'].includes(n))return'Draw'
  if(n==='yes')return'Yes';if(n==='no')return'No'
  if(['1x','home draw','home or draw'].includes(n))return'Home or draw'
  if(['12','home away','home or away'].includes(n))return'Home or away'
  if(['x2','draw away','draw or away'].includes(n))return'Draw or away'
  s=s.replace(/^o(?:ver)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Over $1').replace(/^u(?:nder)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Under $1')
  return title(s)
}
function key(raw=''){
  const n=norm(raw).replace(/\s+/g,'')
  if(['matchwinner','winner','matchodds','1x2','matchresult','fulltimeresult','fulltime1x2'].includes(n))return'match-winner'
  if(n.includes('doublechance'))return'double-chance'
  if(n.includes('drawnobet')||n==='dnb')return'draw-no-bet'
  if(n.includes('bothteamstoscore')||n.includes('bothteamtoscore')||n==='btts')return'both-teams-score'
  if((n.includes('firsthalf')||n.startsWith('1h'))&&(n.includes('winner')||n.includes('result')||n.includes('1x2')||n.includes('matchodds')))return'first-half-winner'
  if((n.includes('firsthalf')||n.startsWith('1h'))&&(n.includes('total')||n.includes('overunder')||n.includes('goals')))return'first-half-goals'
  if(n.includes('hometeamtotal')||n.includes('hometeamgoals'))return'home-team-goals'
  if(n.includes('awayteamtotal')||n.includes('awayteamgoals'))return'away-team-goals'
  if(n.includes('teamtotal')||n.includes('teamgoals'))return'team-goals'
  if(n.includes('goalsstreak')||n.includes('goalstreak')||(n.includes('streak')&&(n.includes('2')||n.includes('consecutive'))))return'goals-streak-2'
  if(n.includes('total')||n.includes('overunder')||n==='goals'||n.includes('matchgoals'))return'total-goals'
  return null
}
function marketName(k){return ({
  'match-winner':'Match winner','double-chance':'Double chance','draw-no-bet':'Draw no bet','both-teams-score':'Both teams to score',
  'first-half-winner':'First-half winner','first-half-goals':'First-half goals','home-team-goals':'Home team goals','away-team-goals':'Away team goals',
  'team-goals':'Team goals','total-goals':'Total goals','goals-streak-2':'Goals Streak 2+'
})[k]||k}
function parseLineName(raw,line){
  const n=sideName(raw)
  if(/^(Over|Under)$/i.test(n)&&line!==undefined&&line!==null&&line!=='')return`${n} ${line}`
  return n
}
function parseApiFootball(payload,fixture){
  const rows=[]
  for(const item of payload||[])for(const book of item?.bookmakers||[])for(const bet of book?.bets||[]){
    const k=key(bet?.name||bet?.market||'');if(!k)continue
    const outcomes=[]
    for(const v of bet?.values||bet?.outcomes||[]){
      const o=odd(v?.odd??v?.odds??v?.price);if(!o)continue
      outcomes.push({name:parseLineName(v?.value??v?.name??v?.label,v?.line??v?.total??v?.handicap),odd:o})
    }
    if(outcomes.length)rows.push({marketKey:k,market:marketName(k),bookmaker:book?.name||'API-Football',source:'api-football',outcomes})
  }
  return rows
}
function flattenStats(obj,fixture,rows=[],prefix='',depth=0){
  if(!obj||typeof obj!=='object'||depth>5)return rows
  for(const [name,node] of Object.entries(obj)){
    if(!node||typeof node!=='object')continue
    const full=prefix?`${prefix} ${name}`:name,k=key(full)
    if(k){
      const outcomes=[]
      const arr=Array.isArray(node)?node:(node.outcomes||node.values||node.selections||node.prices||[])
      if(Array.isArray(arr))for(const v of arr){
        const o=odd(v?.odd??v?.odds??v?.price??v?.decimal);if(!o)continue
        outcomes.push({name:parseLineName(v?.name??v?.label??v?.selection??v?.outcome??v?.value,v?.line??v?.total??node?.line),odd:o})
      }
      if(!outcomes.length&&!Array.isArray(node))for(const [n,v] of Object.entries(node)){
        const o=odd(typeof v==='object'?(v?.odd??v?.odds??v?.price??v?.decimal):v)
        if(o)outcomes.push({name:parseLineName(n,node?.line??node?.total),odd:o})
      }
      if(outcomes.length)rows.push({marketKey:k,market:marketName(k),bookmaker:'TheStatsAPI',source:'thestatsapi',outcomes})
    }
    flattenStats(node,fixture,rows,full,depth+1)
  }
  return rows
}
function choose(rows,source,keyName){
  const candidates=rows.filter(r=>r.source===source&&r.marketKey===keyName)
  if(!candidates.length)return null
  candidates.sort((a,b)=>b.outcomes.length-a.outcomes.length)
  return candidates[0]
}
function omap(rows){const m=new Map();for(const o of rows||[]){const n=norm(o.name),p=odd(o.odd);if(n&&p&&!m.has(n))m.set(n,{name:o.name,odd:p})}return m}
function rel(a,b){return Math.abs(a-b)/Math.min(a,b)}
export function verifiedMarkets({apiPayload=[],statsPayload=null,fixture}={}){
  const rows=[...parseApiFootball(apiPayload,fixture),...flattenStats(statsPayload,fixture)]
  const keys=new Set(rows.map(r=>r.marketKey)),out=[]
  for(const k of keys){
    const a=choose(rows,'api-football',k),s=choose(rows,'thestatsapi',k)
    if(!a&&!s)continue
    if(!a||!s){
      if(REQUIRE_CROSS_SOURCE)continue
      const c=a||s
      out.push({...c,verification:'single-source',outcomes:c.outcomes.map(o=>({...o,verified:false}))})
      continue
    }
    const am=omap(a.outcomes),sm=omap(s.outcomes),merged=[]
    const names=new Set([...am.keys(),...sm.keys()])
    for(const n of names){
      const av=am.get(n),sv=sm.get(n)
      if(av&&sv){
        const d=rel(av.odd,sv.odd)
        if(d<=MAX_RELATIVE_DIFF)merged.push({name:av.name,odd:+((av.odd+sv.odd)/2).toFixed(3),verified:true,apiOdd:av.odd,statsOdd:sv.odd,relativeDiff:+d.toFixed(4)})
      }else if(!REQUIRE_CROSS_SOURCE){
        const v=av||sv;merged.push({...v,verified:false})
      }
    }
    if(merged.length)out.push({marketKey:k,market:marketName(k),bookmaker:`${a.bookmaker} + TheStatsAPI`,source:'cross-source',verification:'mixed',outcomes:merged})
  }
  return out
}
