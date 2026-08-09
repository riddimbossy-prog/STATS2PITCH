const text=v=>String(v??'').trim()
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>1?n:null}
const normalize=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')

function marketKey(name=''){
  const n=normalize(name).replace(/\s+/g,'')
  if(['matchwinner','winner','matchodds','1x2','matchresult','fulltimeresult'].includes(n))return'match-winner'
  if(n.includes('doublechance'))return'double-chance'
  if(n.includes('drawnobet')||n==='dnb')return'draw-no-bet'
  if(n.includes('bothteamstoscore')||n==='btts')return'both-teams-score'
  if(n.includes('firsthalf')&&(n.includes('winner')||n.includes('result')||n.includes('1x2')))return'first-half-winner'
  if(n.includes('firsthalf')&&(n.includes('total')||n.includes('overunder')||n.includes('goals')))return'first-half-goals'
  if(n.includes('teamtotal')||n.includes('teamgoals'))return'team-goals'
  if(n.includes('asianhandicap')||n==='handicap')return'handicap'
  if(n.includes('total')||n.includes('overunder')||n.includes('goals'))return'total-goals'
  return normalize(name).replace(/\s+/g,'-')||'market'
}
function marketName(key,raw=''){
  return ({'match-winner':'Match winner','double-chance':'Double chance','draw-no-bet':'Draw no bet','both-teams-score':'Both teams to score','first-half-winner':'First-half winner','first-half-goals':'First-half goals','team-goals':'Team goals','handicap':'Handicap','total-goals':'Total goals'})[key]||text(raw).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Market'
}
function sameTeam(a,b){const x=normalize(a),y=normalize(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x))}
function outcomeName(raw,fixture){
  let s=text(raw).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()
  const compact=normalize(s).replace(/\s+/g,'')
  const home=fixture?.teams?.home?.name||fixture?.home?.name||''
  const away=fixture?.teams?.away?.name||fixture?.away?.name||''
  if(compact==='home'||compact==='1'||sameTeam(s,home))return'Home'
  if(compact==='draw'||compact==='x'||compact==='tie')return'Draw'
  if(compact==='away'||compact==='2'||sameTeam(s,away))return'Away'
  if(/^yes$/i.test(s))return'Yes'
  if(/^no$/i.test(s))return'No'
  s=s.replace(/^o(?:ver)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Over $1').replace(/^u(?:nder)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Under $1')
  const dc=normalize(s)
  if(['1x','home draw','home or draw'].includes(dc))return'Home or draw'
  if(['12','home away','home or away'].includes(dc))return'Home or away'
  if(['x2','draw away','draw or away'].includes(dc))return'Draw or away'
  return s?s.replace(/\b\w/g,c=>c.toUpperCase()):'Selection'
}
function getPrice(obj){
  if(typeof obj==='number'||typeof obj==='string')return num(obj)
  if(!obj||typeof obj!=='object')return null
  for(const k of ['odd','odds','price','decimal','value','last_seen','closing','opening']){const p=num(obj[k]);if(p)return p}
  return null
}
function parseValues(values,fixture){
  if(!Array.isArray(values))return[]
  const out=[]
  for(const v of values){
    if(v==null)continue
    if(typeof v==='string'||typeof v==='number')continue
    let raw=v.name??v.label??v.selection??v.outcome??v.key??v.value
    let line=v.handicap??v.line??v.total??v.points??null
    const price=getPrice(v)
    if(!price)continue
    let name=outcomeName(raw,fixture)
    if(line!==null&&line!==undefined&&line!==''&&!/\d/.test(name)&&/over|under/i.test(String(raw)))name=`${name} ${line}`
    out.push({name,odd:price})
  }
  return out
}
function parseContainer(container,fixture){
  if(!container)return[]
  if(Array.isArray(container))return parseValues(container,fixture)
  if(typeof container!=='object')return[]
  for(const k of ['outcomes','values','selections','prices','runners','options']){
    const parsed=parseValues(container[k],fixture)
    if(parsed.length)return parsed
  }
  const out=[]
  for(const [k,v] of Object.entries(container)){
    if(/^(name|id|key|market|type|timestamp|updated|created|bookmaker|provider)$/i.test(k))continue
    const price=getPrice(v)
    if(price)out.push({name:outcomeName(k,fixture),odd:price})
  }
  return out
}

export function recoverApiFootballMarkets(payload,fixture){
  const rows=[]
  for(const item of payload||[]){
    for(const book of item?.bookmakers||[]){
      for(const bet of book?.bets||[]){
        const key=marketKey(bet?.name||bet?.market||'Market')
        const outcomes=parseContainer(bet?.values||bet?.outcomes||bet,fixture)
        if(outcomes.length)rows.push({marketKey:key,market:marketName(key,bet?.name||bet?.market),bookmaker:book?.name||'',bookmakerRank:99,outcomes})
      }
    }
  }
  return rows
}

export function recoverGenericMarkets(payload,fixture){
  const rows=[]
  const root=payload?.data??payload
  const books=Array.isArray(root?.bookmakers)?root.bookmakers:Array.isArray(root)?root:[]
  for(const book of books){
    const markets=Array.isArray(book?.markets)?book.markets:[]
    for(const m of markets){
      const raw=m?.name??m?.market??m?.key??m?.type??'Market'
      const key=marketKey(raw)
      const outcomes=parseContainer(m,fixture)
      if(outcomes.length)rows.push({marketKey:key,market:marketName(key,raw),bookmaker:book?.name||'',bookmakerRank:99,outcomes})
    }
  }
  return rows
}

export function mergeRecoveredMarkets(...lists){
  const map=new Map()
  for(const list of lists){
    for(const row of list||[]){
      const key=row.marketKey||marketKey(row.market)
      if(!map.has(key))map.set(key,{marketKey:key,market:row.market||marketName(key),outcomes:new Map()})
      const target=map.get(key)
      for(const o of row.outcomes||[]){
        const p=num(o.odd);if(!p)continue
        const ok=normalize(o.name)
        const prev=target.outcomes.get(ok)
        if(!prev||p>prev.odd)target.outcomes.set(ok,{name:o.name,odd:p})
      }
    }
  }
  return[...map.values()].map(m=>({marketKey:m.marketKey,market:m.market,outcomes:[...m.outcomes.values()].sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.market.localeCompare(b.market))
}
