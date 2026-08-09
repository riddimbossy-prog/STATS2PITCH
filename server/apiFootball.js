const BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io'
const KEY = process.env.API_FOOTBALL_KEY
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000
const memory = new Map()

function cacheKey(path, params){ return `${path}?${new URLSearchParams(params).toString()}` }

export async function football(path, params={}) {
  if (!KEY) throw new Error('API_FOOTBALL_KEY is not configured on the server.')
  const key = cacheKey(path, params)
  const cached = memory.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  const url = new URL(`${BASE}${path}`)
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  const response = await fetch(url, { headers: { 'x-apisports-key': KEY } })
  const body = await response.json().catch(()=>null)
  if (!response.ok) throw new Error(`API-Football ${response.status}: ${body?.message || response.statusText}`)
  if (!body || !Array.isArray(body.response)) throw new Error('API-Football returned an unexpected response.')
  memory.set(key, { at: Date.now(), data: body.response })
  return body.response
}

export async function getFixturesByDate(date) {
  return football('/fixtures', { date, timezone: process.env.APP_TIMEZONE || 'UTC' })
}

export async function getStandings(league, season) {
  const rows = await football('/standings', { league, season })
  return rows?.[0]?.league?.standings?.[0] || []
}

export async function getRecent(team) {
  return football('/fixtures', { team, last: 10, status: 'FT', timezone: process.env.APP_TIMEZONE || 'UTC' })
}

export async function getFixtureOdds(fixture) {
  return football('/odds', { fixture })
}
