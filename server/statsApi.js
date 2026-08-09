const BASE = process.env.STATS_API_BASE_URL || 'https://api.thestatsapi.com/api'
const KEY = process.env.STATS_API_KEY || process.env.THESTATSAPI_KEY || ''
const CACHE_TTL = Number(process.env.STATS_VALUE_CACHE_TTL_SECONDS || 1800) * 1000
const MIN_INTERVAL = Math.max(0, Number(process.env.STATS_API_MIN_INTERVAL_MS || 300))
const REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.STATS_API_REQUESTS_PER_MINUTE || 40))
const MAX_COMPETITION_PAGES = Math.max(1, Number(process.env.STATS_API_COMPETITION_PAGES || 5))
const MAX_MATCH_PAGES = Math.max(1, Number(process.env.STATS_API_MAX_MATCH_PAGES || 5))
const memory = new Map()
const requestTimes = []
let lastRequestAt = 0

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const text = v => String(v ?? '').trim()
const num = v => {
  const n = Number(v)
  return Number.isFinite(n) && n > 1 ? n : null
}

function keyFor(path, params = {}) {
  return `${path}?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== '')).toString()}`
}

async function pace() {
  const now = Date.now()
  while (requestTimes.length && now - requestTimes[0] >= 60_000) requestTimes.shift()
  if (requestTimes.length >= REQUESTS_PER_MINUTE) {
    const wait = Math.max(0, 60_000 - (now - requestTimes[0]) + 25)
    if (wait) await sleep(wait)
  }
  const since = Date.now() - lastRequestAt
  if (since < MIN_INTERVAL) await sleep(MIN_INTERVAL - since)
}

export function statsApiConfigured() { return Boolean(KEY) }

export async function statsApi(path, params = {}) {
  if (!KEY) return null
  const cacheKey = keyFor(path, params)
  const cached = memory.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  await pace()
  const url = new URL(`${BASE}${path}`)
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' } })
  lastRequestAt = Date.now()
  requestTimes.push(lastRequestAt)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Stats API ${response.status}`)
  memory.set(cacheKey, { at: Date.now(), data: body })
  return body
}

function normalize(s) {
  return text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
}

function looseSame(a,b) {
  const x = normalize(a), y = normalize(b)
  if (!x || !y) return false
  if (x === y) return true
  if (Math.min(x.length,y.length) >= 5 && (x.includes(y) || y.includes(x))) return true
  const xa = new Set(x.split(' ')), ya = new Set(y.split(' '))
  const common = [...xa].filter(t => t.length > 2 && ya.has(t)).length
  return common >= Math.min(2, Math.min(xa.size, ya.size))
}

function unwrapArray(body, keys = []) {
  for (const k of keys) if (Array.isArray(body?.[k])) return body[k]
  if (Array.isArray(body?.data)) return body.data
  if (Array.isArray(body)) return body
  return []
}

let competitionCache = null
async function competitions() {
  if (competitionCache && Date.now() - competitionCache.at < CACHE_TTL) return competitionCache.rows
  const rows = []
  for (let page=1; page<=MAX_COMPETITION_PAGES; page++) {
    const body = await statsApi('/football/competitions', { per_page:100, page })
    const part = unwrapArray(body, ['competitions'])
    rows.push(...part)
    if (part.length < 100) break
  }
  competitionCache = { at:Date.now(), rows }
  return rows
}

function competitionId(c) { return c?.id ?? c?.competition_id ?? c?.comp_id ?? null }
function competitionName(c) { return c?.name ?? c?.competition ?? c?.title ?? '' }
function competitionCountry(c) { return c?.country?.name ?? c?.country_name ?? c?.country ?? '' }

async function findCompetition(leagueName, countryName) {
  const rows = await competitions()
  const league = normalize(leagueName), country = normalize(countryName)
  const scored = rows.map(c => {
    const name = normalize(competitionName(c)), ctry = normalize(competitionCountry(c))
    let score = 0
    if (name === league) score += 100
    else if (name && league && (name.includes(league) || league.includes(name))) score += 60
    if (country && ctry === country) score += 20
    return { c, score }
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score)
  return scored[0]?.c || null
}

const matchListCache = new Map()
async function competitionMatches(compId, season) {
  const k = `${compId}:${season}`
  const cached = matchListCache.get(k)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.rows
  const rows = []
  for (let page=1; page<=MAX_MATCH_PAGES; page++) {
    const body = await statsApi('/football/matches', { competition_id:compId, season, per_page:100, page })
    const part = unwrapArray(body, ['matches'])
    rows.push(...part)
    if (part.length < 100) break
  }
  matchListCache.set(k,{at:Date.now(),rows})
  return rows
}

function teamName(m, side) {
  const snake = `${side}_team`
  const candidates = [
    m?.[snake]?.name, m?.[snake]?.team_name, m?.[snake],
    m?.[side]?.name, m?.[side]?.team_name, m?.[side],
    m?.teams?.[side]?.name, m?.teams?.[side]?.team_name,
    m?.match?.[snake]?.name, m?.match?.[side]?.name,
    m?.participants?.[side]?.name
  ]
  return text(candidates.find(v => typeof v === 'string' && v.trim()) || '')
}
function matchId(m) { return m?.id ?? m?.match_id ?? m?.mt_id ?? m?.match?.id ?? null }
function matchDate(m) { return m?.date ?? m?.start_date ?? m?.kickoff ?? m?.starts_at ?? m?.start_time ?? m?.match?.date ?? m?.match?.start_date ?? null }

function timeDistanceHours(a,b) {
  const x = new Date(a).getTime(), y = new Date(b).getTime()
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x-y)/3_600_000 : null
}

export async function findStatsMatch(fixture) {
  if (!KEY) return null
  const comp = await findCompetition(fixture?.league?.name || fixture?.league || '', fixture?.league?.country || fixture?.country || '')
  const cid = competitionId(comp)
  if (!cid) return null
  const season = fixture?.league?.season ?? fixture?.season ?? new Date(fixture?.fixture?.date || fixture?.kickoff || Date.now()).getUTCFullYear()
  const rows = await competitionMatches(cid, season)
  const home = fixture?.teams?.home?.name ?? fixture?.home?.name ?? ''
  const away = fixture?.teams?.away?.name ?? fixture?.away?.name ?? ''
  const kickoff = fixture?.fixture?.date ?? fixture?.kickoff ?? null
  const candidates = rows.filter(m => looseSame(teamName(m,'home'),home) && looseSame(teamName(m,'away'),away))
  if (!candidates.length) return null
  candidates.sort((a,b) => {
    const ad = timeDistanceHours(matchDate(a),kickoff)
    const bd = timeDistanceHours(matchDate(b),kickoff)
    return (ad ?? 9999) - (bd ?? 9999)
  })
  const best = candidates[0]
  const gap = timeDistanceHours(matchDate(best),kickoff)
  if (gap !== null && gap > 36) return null
  return { id:matchId(best), row:best, competitionId:cid }
}

export async function getStatsOddsForFixture(fixture) {
  if (!KEY) return null
  const matched = await findStatsMatch(fixture)
  if (!matched?.id) return null
  const payload = await statsApi(`/football/matches/${matched.id}/odds`)
  return { matchId:matched.id, payload }
}

function cleanName(raw) {
  return text(raw).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\b1x2\b/i,'Match winner').replace(/\bbtts\b/ig,'Both teams to score').replace(/\bvs\b/ig,'vs').trim()
}

function canonicalMarketKey(raw) {
  const n = normalize(raw).replace(/\s+/g,'')
  if (['matchwinner','winner','matchodds','1x2','matchresult','fulltimeresult'].includes(n)) return 'match-winner'
  if (['doublechance','doublechancefulltime'].includes(n)) return 'double-chance'
  if (['drawnobet','dnb'].includes(n)) return 'draw-no-bet'
  if (['totalgoals','totals','overunder','matchtotals'].includes(n)) return 'total-goals'
  if (['btts','bothteamstoscore','bothteamtoscore'].includes(n)) return 'both-teams-score'
  if (n.includes('firsthalf') && (n.includes('winner') || n.includes('result') || n.includes('1x2'))) return 'first-half-winner'
  if (n.includes('firsthalf') && (n.includes('total') || n.includes('overunder'))) return 'first-half-goals'
  if (n.includes('teamtotal') || n.includes('teamgoals')) return 'team-goals'
  if (n.includes('asianhandicap') || n === 'handicap') return 'handicap'
  return normalize(raw).replace(/\s+/g,'-') || 'market'
}

function displayMarketName(raw, key = canonicalMarketKey(raw)) {
  const map = {
    'match-winner':'Match winner',
    'double-chance':'Double chance',
    'draw-no-bet':'Draw no bet',
    'total-goals':'Total goals',
    'both-teams-score':'Both teams to score',
    'first-half-winner':'First-half winner',
    'first-half-goals':'First-half goals',
    'team-goals':'Team goals',
    'handicap':'Handicap'
  }
  return map[key] || cleanName(raw).replace(/\b\w/g, c => c.toUpperCase())
}

function priceFrom(v) {
  if (typeof v === 'number' || typeof v === 'string') return num(v)
  if (!v || typeof v !== 'object') return null
  for (const key of ['last_seen','closing','opening','price','odd','odds','decimal','value']) {
    const p = num(v[key])
    if (p) return p
  }
  return null
}

function outcomeName(raw) {
  let s = cleanName(raw)
  const compact = normalize(s).replace(/\s+/g,'')
  if (compact === 'home' || compact === '1') return 'Home'
  if (compact === 'draw' || compact === 'x') return 'Draw'
  if (compact === 'away' || compact === '2') return 'Away'
  s = s.replace(/^over\s*([0-9]+(?:\.[0-9]+)?)$/i,'Over $1').replace(/^under\s*([0-9]+(?:\.[0-9]+)?)$/i,'Under $1')
  s = s.replace(/^over\s*([0-9]+)[_\s]+([0-9]+)$/i,'Over $1.$2').replace(/^under\s*([0-9]+)[_\s]+([0-9]+)$/i,'Under $1.$2')
  if (/^yes$/i.test(s)) return 'Yes'
  if (/^no$/i.test(s)) return 'No'
  const choices={
    'home or draw':'Home or draw','home or away':'Home or away','draw or away':'Draw or away',
    'home draw':'Home or draw','home away':'Home or away','draw away':'Draw or away'
  }
  if (choices[s.toLowerCase()]) return choices[s.toLowerCase()]
  return s ? s.replace(/\b\w/g,c=>c.toUpperCase()) : 'Selection'
}

function parseOutcomeArray(arr) {
  const out = []
  for (const item of arr || []) {
    if (typeof item === 'number' || typeof item === 'string') continue
    const name = outcomeName(item?.name ?? item?.label ?? item?.selection ?? item?.value ?? item?.outcome ?? item?.key)
    const odd = priceFrom(item)
    if (name && odd) out.push({name,odd})
  }
  return out
}

function parseContainer(container) {
  if (!container) return []
  if (Array.isArray(container)) return parseOutcomeArray(container)
  if (typeof container !== 'object') return []
  for (const key of ['outcomes','values','selections','prices','runners']) {
    if (Array.isArray(container[key])) {
      const parsed = parseOutcomeArray(container[key])
      if (parsed.length) return parsed
    }
  }
  const out=[]
  for (const [k,v] of Object.entries(container)) {
    if (/^(name|id|key|market|type|timestamp|updated|created|bookmaker|provider)$/i.test(k)) continue
    const odd=priceFrom(v)
    if (odd) out.push({name:outcomeName(k),odd})
  }
  return out
}

function bookmakerName(book, fallback='Book') { return text(book?.name ?? book?.bookmaker ?? book?.title ?? book?.key ?? fallback) || fallback }

function bookmakersFrom(payload) {
  const data = payload?.data ?? payload ?? {}
  const raw = data?.bookmakers ?? payload?.bookmakers ?? []
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') return Object.entries(raw).map(([name,body]) => ({name,...(body && typeof body==='object'?body:{})}))
  return []
}

function marketsFromBook(book) {
  const result=[]
  const explicit = book?.markets
  if (Array.isArray(explicit)) {
    for (const m of explicit) {
      const rawName = m?.name ?? m?.market ?? m?.key ?? m?.type ?? 'Market'
      const outcomes = parseContainer(m)
      if (outcomes.length) result.push({rawName,outcomes})
    }
  } else if (explicit && typeof explicit === 'object') {
    for (const [rawName,container] of Object.entries(explicit)) {
      const outcomes=parseContainer(container)
      if (outcomes.length) result.push({rawName,outcomes})
    }
  }

  const knownKeys = ['match_odds','1x2','match_result','match_winner','total_goals','totals','over_under','btts','both_teams_to_score','double_chance','draw_no_bet','asian_handicap','handicap','team_totals','team_goals','first_half','first_half_result','first_half_totals']
  for (const key of knownKeys) {
    if (!(key in (book||{}))) continue
    const outcomes=parseContainer(book[key])
    if (outcomes.length) result.push({rawName:key,outcomes})
  }

  // Preserve additional market-shaped containers so the site can show every market returned.
  for (const [rawName,container] of Object.entries(book||{})) {
    if (['name','bookmaker','title','key','id','timestamp','updated_at','created_at','markets',...knownKeys].includes(rawName)) continue
    if (!container || typeof container !== 'object') continue
    const outcomes=parseContainer(container)
    if (outcomes.length >= 2) result.push({rawName,outcomes})
  }
  return result
}

export function parseStatsApiMarkets(payload) {
  const books = bookmakersFrom(payload)
  const priority = ['pinnacle','betfair exchange','bet365','kambi']
  const rows=[]
  for (const book of books) {
    const bookName=bookmakerName(book)
    const rank=priority.indexOf(normalize(bookName))
    for (const m of marketsFromBook(book)) {
      const marketKey=canonicalMarketKey(m.rawName)
      rows.push({marketKey,market:displayMarketName(m.rawName,marketKey),bookmaker:bookName,bookmakerRank:rank<0?99:rank,outcomes:m.outcomes})
    }
  }
  return rows
}

export function parseApiFootballMarkets(payload) {
  const rows=[]
  for (const item of payload || []) for (const book of item?.bookmakers || []) for (const bet of book?.bets || []) {
    const marketKey=canonicalMarketKey(bet?.name || 'Market')
    const outcomes=(bet?.values || []).map(v=>({name:outcomeName(v?.value),odd:num(v?.odd)})).filter(x=>x.name&&x.odd)
    if (outcomes.length) rows.push({marketKey,market:displayMarketName(bet?.name,marketKey),bookmaker:book?.name||'Book',bookmakerRank:99,outcomes})
  }
  return rows
}

export function mergeMarkets(...lists) {
  const marketMap=new Map()
  for (const list of lists) for (const row of list || []) {
    const key=row.marketKey||canonicalMarketKey(row.market)
    if (!marketMap.has(key)) marketMap.set(key,{marketKey:key,market:row.market||displayMarketName(key,key),outcomes:new Map()})
    const target=marketMap.get(key)
    if (target.market === key && row.market) target.market=row.market
    for (const o of row.outcomes || []) {
      const ok=normalize(o.name)
      const odd=num(o.odd)
      if (!ok||!odd) continue
      const prev=target.outcomes.get(ok)
      if (!prev || odd > prev.odd || (odd===prev.odd && (row.bookmakerRank??99)<(prev.bookmakerRank??99))) {
        target.outcomes.set(ok,{name:outcomeName(o.name),odd,bookmaker:row.bookmaker||'',bookmakerRank:row.bookmakerRank??99})
      }
    }
  }
  return [...marketMap.values()].map(m=>({marketKey:m.marketKey,market:m.market,outcomes:[...m.outcomes.values()].map(({name,odd})=>({name,odd})).sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.market.localeCompare(b.market))
}

function findOutcome(markets,key,names) {
  const m=(markets||[]).find(x=>x.marketKey===key)
  if (!m) return null
  for (const wanted of names) {
    const w=normalize(wanted)
    const hit=(m.outcomes||[]).find(o=>normalize(o.name)===w)
    if (hit?.odd) return hit.odd
  }
  return null
}

export function canonicalOddsFromMarkets(markets) {
  return {
    home:findOutcome(markets,'match-winner',['Home','1']),
    draw:findOutcome(markets,'match-winner',['Draw','X']),
    away:findOutcome(markets,'match-winner',['Away','2']),
    over15:findOutcome(markets,'total-goals',['Over 1.5']),
    under15:findOutcome(markets,'total-goals',['Under 1.5']),
    over25:findOutcome(markets,'total-goals',['Over 2.5']),
    under25:findOutcome(markets,'total-goals',['Under 2.5']),
    over35:findOutcome(markets,'total-goals',['Over 3.5']),
    under35:findOutcome(markets,'total-goals',['Under 3.5']),
    bttsYes:findOutcome(markets,'both-teams-score',['Yes']),
    bttsNo:findOutcome(markets,'both-teams-score',['No'])
  }
}
