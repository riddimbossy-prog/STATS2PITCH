const text=v=>String(v??'').trim()
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>1&&n<1000?n:null}
const normalize=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')

function marketKey(name=''){
  const n=normalize(name).replace(/\s+/g,'')
  if(['matchwinner','winner','matchodds','1x2','matchresult','fulltimeresult','fulltime1x2'].includes(n))return'match-winner'
  if(n.includes('doublechance'))return'double-chance'
  if(n.includes('drawnobet')||n==='dnb')return'draw-no-bet'
  if(n.includes('bothteamstoscore')||n.includes('bothteamtoscore')||n==='btts')return'both-teams-score'
  if((n.includes('firsthalf')||n.startsWith('1h'))&&(n.includes('winner')||n.includes('result')||n.includes('1x2')))return'first-half-winner'
  if((n.includes('firsthalf')||n.startsWith('1h'))&&(n.includes('total')||n.includes('overunder')||n.includes('goals')))return'first-half-goals'
  if(n.includes('teamtotal')||n.includes('teamgoals'))return'team-goals'
  if(n.includes('asianhandicap')||n==='handicap'||n.includes('spread'))return'handicap'
  if(n.includes('total')||n.includes('overunder')||n==='goals'||n.includes('matchgoals'))return'total-goals'
  return normalize(name).replace(/\s+/g,'-')||'market'
}
function marketName(key,raw=''){
  return ({'match-winner':'Match winner','double-chance':'Double chance','draw-no-bet':'Draw no bet','both-teams-score':'Both teams to score','first-half-winner':'First-half winner','first-half-goals':'First-half goals','team-goals':'Team goals','handicap':'Handicap','total-goals':'Total goals'})[key]||text(raw).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Market'
}
function sameTeam(a,b){const x=normalize(a),y=normalize(b);return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>4&&(x.includes(y)||y.includes(x))))}
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
  for(const k of ['odd','odds','price','decimal','decimal_odds','value','last_seen','closing','opening','last','current']){const p=num(obj[k]);if(p)return p}
  return null
}
function parseValues(values,fixture){
  if(!Array.isArray(values))return[]
  const out=[]
  for(const v of values){
    if(v==null||typeof v==='string'||typeof v==='number')continue
    const raw=v.name??v.label??v.selection??v.outcome??v.runner??v.key??v.value
    const line=v.handicap??v.line??v.total??v.points??v.threshold??null
    const price=getPrice(v)
    if(!price||raw===undefined||raw===null)continue
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
  for(const k of ['outcomes','values','selections','prices','runners','options','choices']){
    const parsed=parseValues(container[k],fixture)
    if(parsed.length)return parsed
  }
  const out=[]
  for(const [k,v] of Object.entries(container)){
    if(/^(name|id|key|market|type|timestamp|updated|created|bookmaker|provider|status|fixture|match)$/i.test(k))continue
    const price=getPrice(v)
    if(price)out.push({name:outcomeName(k,fixture),odd:price})
  }
  return out
}
function pushMarket(rows,raw,container,fixture,book=''){
  if(!raw)return
  const outcomes=parseContainer(container,fixture)
  if(!outcomes.length)return
  const key=marketKey(raw)
  rows.push({marketKey:key,market:marketName(key,raw),bookmaker:book,bookmakerRank:99,outcomes})
}

export function recoverApiFootballMarkets(payload,fixture){
  const rows=[]
  for(const item of payload||[]){
    for(const book of item?.bookmakers||[]){
      for(const bet of book?.bets||[]){
        pushMarket(rows,bet?.name||bet?.market||bet?.key||'Market',bet?.values||bet?.outcomes||bet,fixture,book?.name||'')
      }
    }
  }
  return rows
}

function walk(node,fixture,rows,book='',depth=0,seen=new Set()){
  if(!node||typeof node!=='object'||depth>8||seen.has(node))return
  seen.add(node)
  if(Array.isArray(node)){
    for(const child of node)walk(child,fixture,rows,book,depth+1,seen)
    return
  }
  const namedBook=node.bookmaker?.name??node.sportsbook?.name??node.provider?.name??(typeof node.bookmaker==='string'?node.bookmaker:null)??(typeof node.provider==='string'?node.provider:null)??(node.markets&&typeof node.name==='string'?node.name:null)??book
  const nextBook=text(namedBook)||book
  const rawMarket=node.market?.name??node.market_name??node.market??node.bet_name??node.bet??node.key??node.type
  if(rawMarket && (node.outcomes||node.values||node.selections||node.prices||node.runners||node.options||node.choices)){
    pushMarket(rows,typeof rawMarket==='object'?(rawMarket.name||rawMarket.key||'Market'):rawMarket,node,fixture,nextBook)
  }
  const markets=node.markets
  if(Array.isArray(markets)){
    for(const m of markets){const raw=m?.name??m?.market??m?.market_name??m?.key??m?.type??'Market';pushMarket(rows,raw,m,fixture,nextBook)}
  }else if(markets&&typeof markets==='object'){
    for(const [raw,m] of Object.entries(markets))pushMarket(rows,raw,m,fixture,nextBook)
  }
  const bets=node.bets
  if(Array.isArray(bets)){
    for(const b of bets){const raw=b?.name??b?.market??b?.key??b?.type??'Market';pushMarket(rows,raw,b,fixture,nextBook)}
  }
  const known=['match_odds','match_winner','match_result','1x2','full_time_result','total_goals','totals','over_under','btts','both_teams_to_score','double_chance','draw_no_bet','asian_handicap','handicap','team_totals','team_goals','first_half_result','first_half_totals']
  for(const k of known)if(node[k]&&typeof node[k]==='object')pushMarket(rows,k,node[k],fixture,nextBook)
  for(const [k,v] of Object.entries(node)){
    if(['markets','bets',...known].includes(k))continue
    if(v&&typeof v==='object')walk(v,fixture,rows,nextBook,depth+1,seen)
  }
}

export function recoverGenericMarkets(payload,fixture){
  const rows=[]
  walk(payload?.data??payload,fixture,rows)
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
        if(!ok)continue
        const prev=target.outcomes.get(ok)
        if(!prev||p>prev.odd)target.outcomes.set(ok,{name:outcomeName(o.name),odd:p})
      }
    }
  }
  return[...map.values()].map(m=>({marketKey:m.marketKey,market:m.market,outcomes:[...m.outcomes.values()].sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.market.localeCompare(b.market))
}
