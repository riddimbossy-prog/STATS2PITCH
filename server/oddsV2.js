const text=v=>String(v??'').trim()
const validOdd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const slug=s=>norm(s).replace(/\s+/g,'-')||'market'

function sameTeam(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))}
function fixtureTeam(fixture,side){return fixture?.teams?.[side]?.name??fixture?.[side]?.name??''}

function priceFrom(v){
  if(typeof v==='number'||typeof v==='string')return validOdd(v)
  if(!v||typeof v!=='object')return null
  for(const k of ['last_seen','closing','current','price','odd','odds','decimal','decimal_odds','opening']){
    const raw=v[k]
    const direct=validOdd(raw)
    if(direct)return direct
    if(raw&&typeof raw==='object'){
      for(const child of ['decimal','price','odd','odds','value']){const p=validOdd(raw[child]);if(p)return p}
    }
  }
  if(!('line'in v)&&!('total'in v)&&!('handicap'in v)&&!('points'in v)&&!('name'in v)&&!('label'in v)&&!('selection'in v)&&!('outcome'in v))return validOdd(v.value)
  return null
}

function outcomeName(raw,fixture){
  let s=text(raw).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()
  const compact=norm(s).replace(/\s+/g,'')
  const home=fixtureTeam(fixture,'home'),away=fixtureTeam(fixture,'away')
  if(compact==='home'||compact==='1'||sameTeam(s,home))return'Home'
  if(compact==='draw'||compact==='x'||compact==='tie')return'Draw'
  if(compact==='away'||compact==='2'||sameTeam(s,away))return'Away'
  if(/^yes$/i.test(s))return'Yes'
  if(/^no$/i.test(s))return'No'
  const dc=norm(s)
  if(['1x','home draw','home or draw'].includes(dc))return'Home or draw'
  if(['12','home away','home or away'].includes(dc))return'Home or away'
  if(['x2','draw away','draw or away'].includes(dc))return'Draw or away'
  s=s.replace(/^o(?:ver)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Over $1').replace(/^u(?:nder)?\s*([0-9]+(?:\.[0-9]+)?)$/i,'Under $1')
  return s?s.replace(/\b\w/g,c=>c.toUpperCase()):'Selection'
}

function marketKey(raw=''){
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
  if(n.includes('asianhandicap')||n==='handicap'||n.includes('spread'))return'handicap'
  if(n.includes('total')||n.includes('overunder')||n==='goals'||n.includes('matchgoals'))return'total-goals'
  return slug(raw)
}
function marketName(key,raw=''){
  return ({
    'match-winner':'Match winner','double-chance':'Double chance','draw-no-bet':'Draw no bet','both-teams-score':'Both teams to score',
    'first-half-winner':'First-half winner','first-half-goals':'First-half goals','home-team-goals':'Home team goals','away-team-goals':'Away team goals',
    'team-goals':'Team goals','handicap':'Handicap','total-goals':'Total goals'
  })[key]||text(raw).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Market'
}

function dedupe(outcomes){
  const map=new Map()
  for(const o of outcomes||[]){const odd=validOdd(o?.odd),name=outcomeName(o?.name);if(!odd||!name)continue;const k=norm(name);if(!map.has(k))map.set(k,{name,odd})}
  return[...map.values()]
}

function parseArray(arr,fixture,lineHint=null){
  const out=[]
  for(const item of arr||[]){
    if(!item||typeof item!=='object')continue
    let raw=item.name??item.label??item.selection??item.outcome??item.runner??item.key??item.value
    const odd=priceFrom(item)
    if(!odd||raw===undefined||raw===null)continue
    let name=outcomeName(raw,fixture)
    const line=item.line??item.total??item.points??item.threshold??item.handicap??lineHint
    if(line!==null&&line!==undefined&&line!==''&&/^(Over|Under)$/i.test(name))name=`${name} ${line}`
    out.push({name,odd})
  }
  return out
}

function parseSimple(container,fixture){
  if(!container)return[]
  if(Array.isArray(container))return parseArray(container,fixture)
  if(typeof container!=='object')return[]
  for(const k of ['outcomes','values','selections','prices','runners','options','choices']){
    if(Array.isArray(container[k])){const got=parseArray(container[k],fixture,container.line??container.total??null);if(got.length)return got}
  }
  const out=[]
  for(const [k,v] of Object.entries(container)){
    if(/^(name|id|key|market|type|timestamp|updated|updated_at|created|created_at|bookmaker|provider|line|total|points|threshold)$/i.test(k))continue
    const odd=priceFrom(v)
    if(odd)out.push({name:outcomeName(k,fixture),odd})
  }
  return out
}

function lineFromKey(k){
  const s=text(k).toLowerCase().replace(/_/g,'.').replace(/[^0-9.]/g,'')
  const n=Number(s)
  return Number.isFinite(n)&&n>0&&n<20?String(n):null
}
function parseTotals(container,fixture){
  const out=[]
  const add=(side,line,node)=>{const odd=priceFrom(node);if(odd&&line)out.push({name:`${side} ${line}`,odd})}
  const parseLine=(line,node)=>{
    if(!node||typeof node!=='object'||!line)return
    if('over'in node)add('Over',line,node.over)
    if('under'in node)add('Under',line,node.under)
    if('o'in node)add('Over',line,node.o)
    if('u'in node)add('Under',line,node.u)
    for(const k of ['outcomes','values','selections','prices','runners'])if(Array.isArray(node[k]))out.push(...parseArray(node[k],fixture,line))
  }
  if(Array.isArray(container))out.push(...parseArray(container,fixture))
  else if(container&&typeof container==='object'){
    if(container.lines&&typeof container.lines==='object')for(const [k,v] of Object.entries(container.lines))parseLine(lineFromKey(k)||k,v)
    if(container.line!==undefined&&container.line!==null)parseLine(String(container.line),container)
    for(const [k,v] of Object.entries(container)){
      if(k==='lines')continue
      const m=k.match(/^(over|under|o|u)[_\s-]*([0-9]+(?:[_\.][0-9]+)?)$/i)
      if(m){const line=String(m[2]).replace('_','.');add(/^o|over/i.test(m[1])?'Over':'Under',line,v);continue}
      const line=lineFromKey(k)
      if(line&&v&&typeof v==='object'){parseLine(line,v);continue}
    }
    out.push(...parseSimple(container,fixture).filter(o=>/^(Over|Under)\s+\d/i.test(o.name)))
  }
  return dedupe(out)
}

function bookmakerName(book,fallback='Book'){return text(book?.bookmaker?.name??book?.bookmaker??book?.name??book?.title??book?.key??fallback)||fallback}
function statsBooks(payload){
  const data=payload?.data??payload??{}
  const raw=data?.bookmakers??payload?.bookmakers??[]
  if(Array.isArray(raw))return raw
  if(raw&&typeof raw==='object')return Object.entries(raw).map(([name,body])=>({bookmaker:name,...(body&&typeof body==='object'?body:{})}))
  return[]
}

function push(rows,raw,container,fixture,bookmaker,sourceRank){
  if(!container)return
  const key=marketKey(raw)
  const totalLike=['total-goals','first-half-goals','home-team-goals','away-team-goals','team-goals'].includes(key)
  const outcomes=totalLike?parseTotals(container,fixture):parseSimple(container,fixture)
  if(outcomes.length)rows.push({marketKey:key,market:marketName(key,raw),bookmaker,sourceRank,outcomes})
}
function walkStatsMarkets(rows,obj,fixture,bookmaker,sourceRank,prefix='',depth=0){
  if(!obj||typeof obj!=='object'||depth>4)return
  for(const [raw,container] of Object.entries(obj)){
    if(['name','bookmaker','title','key','id','timestamp','updated_at','created_at','provider'].includes(raw))continue
    if(!container||typeof container!=='object')continue
    if(raw==='first_half'||raw==='1h'){
      walkStatsMarkets(rows,container,fixture,bookmaker,sourceRank,'First half ',depth+1)
      continue
    }
    const full=`${prefix}${raw}`
    const before=rows.length
    push(rows,full,container,fixture,bookmaker,sourceRank)
    if(rows.length===before&&depth<3)walkStatsMarkets(rows,container,fixture,bookmaker,sourceRank,prefix,depth+1)
  }
}

export function parseStatsRows(payload,fixture){
  const rows=[]
  for(const book of statsBooks(payload)){
    const bookmaker=bookmakerName(book)
    const root=book?.markets??book?.odds??book
    walkStatsMarkets(rows,root,fixture,bookmaker,0)
  }
  return rows
}

export function parseApiFootballRows(payload,fixture){
  const rows=[]
  for(const item of payload||[])for(const book of item?.bookmakers||[])for(const bet of book?.bets||[]){
    const bookmaker=book?.name||'Book'
    const raw=bet?.name||bet?.market||bet?.key||'Market'
    const key=marketKey(raw)
    const totalLike=['total-goals','first-half-goals','home-team-goals','away-team-goals','team-goals'].includes(key)
    const outcomes=totalLike?parseTotals(bet?.values||bet?.outcomes||bet,fixture):parseSimple(bet?.values||bet?.outcomes||bet,fixture)
    if(outcomes.length)rows.push({marketKey:key,market:marketName(key,raw),bookmaker,sourceRank:1,outcomes})
  }
  return rows
}

const defaultBookOrder=['pinnacle','betfair exchange','bet365','kambi']
function bookRank(name){
  const n=norm(name)
  const preferred=norm(process.env.ODDS_PREFERRED_BOOKMAKER||'')
  if(preferred&&(n===preferred||n.includes(preferred)||preferred.includes(n)))return-100
  const i=defaultBookOrder.indexOf(n)
  return i<0?50:i
}

function mergeRows(rows){
  const markets=new Map()
  let order=0
  for(const row of rows||[]){
    const key=row.marketKey
    if(!markets.has(key))markets.set(key,{marketKey:key,market:row.market,books:new Map()})
    const m=markets.get(key)
    const bk=norm(row.bookmaker)||`book-${order}`
    if(!m.books.has(bk))m.books.set(bk,{bookmaker:row.bookmaker||'Book',rank:bookRank(row.bookmaker),sourceRank:row.sourceRank??9,order:order++,outcomes:new Map()})
    const b=m.books.get(bk)
    b.rank=Math.min(b.rank,bookRank(row.bookmaker));b.sourceRank=Math.min(b.sourceRank,row.sourceRank??9)
    for(const o of row.outcomes||[]){
      const odd=validOdd(o.odd),name=outcomeName(o.name)
      if(!odd||!name)continue
      const ok=norm(name),prev=b.outcomes.get(ok)
      if(!prev||(row.sourceRank??9)<prev.sourceRank)b.outcomes.set(ok,{name,odd,sourceRank:row.sourceRank??9})
    }
  }
  const out=[]
  for(const m of markets.values()){
    const books=[...m.books.values()].sort((a,b)=>a.rank-b.rank||b.outcomes.size-a.outcomes.size||a.sourceRank-b.sourceRank||a.order-b.order)
    if(!books.length)continue
    const chosen=new Map()
    for(const b of books){
      for(const [ok,o] of b.outcomes)if(!chosen.has(ok))chosen.set(ok,{name:o.name,odd:o.odd,bookmaker:b.bookmaker})
    }
    const primary=books[0]
    out.push({marketKey:m.marketKey,market:m.market,bookmaker:primary.bookmaker,outcomes:[...chosen.values()].map(({name,odd})=>({name,odd})).sort((a,b)=>a.name.localeCompare(b.name))})
  }
  return out.sort((a,b)=>a.market.localeCompare(b.market))
}

function findOutcome(markets,key,names){
  const m=(markets||[]).find(x=>x.marketKey===key)
  if(!m)return null
  for(const wanted of names){const w=norm(wanted),hit=(m.outcomes||[]).find(o=>norm(o.name)===w);if(hit?.odd)return hit.odd}
  return null
}
export function canonicalOdds(markets){
  return{
    home:findOutcome(markets,'match-winner',['Home','1']),draw:findOutcome(markets,'match-winner',['Draw','X']),away:findOutcome(markets,'match-winner',['Away','2']),
    over15:findOutcome(markets,'total-goals',['Over 1.5']),under15:findOutcome(markets,'total-goals',['Under 1.5']),
    over25:findOutcome(markets,'total-goals',['Over 2.5']),under25:findOutcome(markets,'total-goals',['Under 2.5']),
    over35:findOutcome(markets,'total-goals',['Over 3.5']),under35:findOutcome(markets,'total-goals',['Under 3.5']),
    bttsYes:findOutcome(markets,'both-teams-score',['Yes']),bttsNo:findOutcome(markets,'both-teams-score',['No'])
  }
}

export function buildVerifiedOdds({apiPayload=[],statsPayload=null,fixture=null}={}){
  const stats=parseStatsRows(statsPayload,fixture)
  const api=parseApiFootballRows(apiPayload,fixture)
  const marketOdds=mergeRows([...stats,...api])
  return{marketOdds,canonical:canonicalOdds(marketOdds)}
}
