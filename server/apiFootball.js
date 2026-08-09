const BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io'
const KEY = process.env.API_FOOTBALL_KEY
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000
const ODDS_MAX_PAGES = Math.max(1, Number(process.env.API_FOOTBALL_ODDS_MAX_PAGES || 10))
const memory = new Map()

function cacheKey(path, params){ return `${path}?${new URLSearchParams(params).toString()}` }

async function request(path, params={}, opts={}) {
  if (!KEY) throw new Error('API_FOOTBALL_KEY is not configured on the server.')
  const key = cacheKey(path, params)
  const cached = memory.get(key)
  if (!opts.bypassCache && cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  const url = new URL(`${BASE}${path}`)
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  const response = await fetch(url, { headers: { 'x-apisports-key': KEY } })
  const body = await response.json().catch(()=>null)
  if (!response.ok) throw new Error(`API-Football ${response.status}: ${body?.message || response.statusText}`)
  if (!body || !Array.isArray(body.response)) throw new Error('API-Football returned an unexpected response.')
  const data={response:body.response,paging:body.paging||{current:1,total:1}}
  memory.set(key, { at: Date.now(), data })
  return data
}

export async function football(path, params={}) {
  return (await request(path,params)).response
}

export async function getFixturesByDate(date) {
  return football('/fixtures', { date, timezone: process.env.APP_TIMEZONE || 'UTC' })
}

export async function getFixturesByDateFresh(date) {
  return (await request('/fixtures', { date, timezone: process.env.APP_TIMEZONE || 'UTC' }, {bypassCache:true})).response
}

export async function getStandings(league, season) {
  const rows = await football('/standings', { league, season })
  return rows?.[0]?.league?.standings?.[0] || []
}

// Legacy overall form helper retained for compatibility only.
export async function getRecent(team) {
  return football('/fixtures', { team, last: 10, status: 'FT', timezone: process.env.APP_TIMEZONE || 'UTC' })
}

/**
 * Strict split-form source. We request a larger league/season-specific pool and
 * then keep only the requested venue. This avoids cup/friendly contamination
 * and guarantees that 'last 5 home' really means five home league matches.
 */
export async function getRecentLeagueVenue(team, league, season, venue, limit=10) {
  if(!['home','away'].includes(venue))throw new Error('Venue must be home or away')
  const rows=await football('/fixtures', {
    team,
    league,
    season,
    last: 30,
    status: 'FT',
    timezone: process.env.APP_TIMEZONE || 'UTC'
  })
  return rows
    .filter(f=>venue==='home'?String(f?.teams?.home?.id)===String(team):String(f?.teams?.away?.id)===String(team))
    .sort((a,b)=>new Date(b?.fixture?.date)-new Date(a?.fixture?.date))
    .slice(0,Math.max(1,Number(limit||10)))
}

export async function getFixtureOdds(fixture) {
  const rows=[]
  let page=1
  let total=1
  do {
    const body=await request('/odds',{fixture,page})
    rows.push(...(body.response||[]))
    total=Math.max(1,Number(body.paging?.total||1))
    page++
  } while(page<=total && page<=ODDS_MAX_PAGES)
  return rows
}
