// Filter Tips now runs Perfect Split v1.
// A market publishes only when both venue sides post a 5/5 split.
import {ENGINE_VERSION,FINISHED,FORM_SAMPLE} from './config.js'
import {learningAllows, stampLearning} from './learning.js'
import {attachWhy,last5Form,last5Overall,fixtureHasStats} from './pickWhy.js'
import {isSrlMatch,isEarlySeason} from './redFlags.js'
import {
  extractFilterOdds,
  isCupCompetition
} from './filterEngineV2.js'
import {
  ENGINE_ID,
  MARKETS,
  SPLIT_SAMPLE,
  diagnoseFixture,
  profileOf
} from './perfectSplit.js'

export {ENGINE_ID, extractFilterOdds, isCupCompetition}
export const FILTER_RULE_VERSION = 'perfect-split-v1'
export const FILTER_VERSION = 'perfect-split-v1'

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
const num = v => finite(v) ? Number(v) : null
const text = v => String(v ?? '').trim()
const norm = s => text(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()
const done = f => FINISHED.has(String(f?.fixture?.status?.short || '').toUpperCase())
const atVenue = (f, id, venue) => venue === 'home'
  ? String(f?.teams?.home?.id) === String(id)
  : String(f?.teams?.away?.id) === String(id)
const DOMESTIC_CUP = /\b(cup|copa|coppa|pokal|fa cup|league cup|knockout|play[- ]?offs?|qualification|qualifier|trophy|super cup|community shield|elimination)\b/i
const EUROPE_COMP = /\b(champions league|europa league|conference league)\b/i
const KNOCKOUT_STAGE = /\b(qualif(?:ication|ier|ying)?|play[- ]?offs?|round of|last 16|last 32|1 8|1 16|quarter(?:final)?|semi(?:final)?|final|knockout|elimination)\b/i

function shouldSkipCupFixture(fixture){
  const league = norm(fixture?.league)
  if (EUROPE_COMP.test(league)) {
    const stage = norm(fixture?.round || fixture?.stage || fixture?.leagueRound || fixture?.fixture?.round || '')
    return KNOCKOUT_STAGE.test(`${league} ${stage}`)
  }
  return DOMESTIC_CUP.test(league)
}

function venueGames(fixtures, teamId, venue, limit = SPLIT_SAMPLE){
  return (fixtures || [])
    .filter(f => done(f) && atVenue(f, teamId, venue))
    .sort((a, b) => Date.parse(b?.fixture?.date || 0) - Date.parse(a?.fixture?.date || 0))
    .slice(0, limit)
    .map(f => {
      const homeId = String(f?.teams?.home?.id)
      const isHome = homeId === String(teamId)
      const gf = num(isHome ? f?.goals?.home : f?.goals?.away)
      const ga = num(isHome ? f?.goals?.away : f?.goals?.home)
      const opp = isHome ? f?.teams?.away : f?.teams?.home
      return {
        opponent: opp?.name || '',
        opponentShort: text(opp?.name).slice(0, 3).toUpperCase(),
        date: f?.fixture?.date || '',
        gf: gf ?? 0,
        ga: ga ?? 0
      }
    })
    .filter(g => Number.isFinite(g.gf) && Number.isFinite(g.ga))
}

function oddOf(markets, key, names){
  for (const market of markets || []) {
    if (market?.marketKey !== key) continue
    for (const name of names) {
      const hit = (market.outcomes || []).find(o => norm(o?.name) === norm(name))
      const price = num(hit?.odd)
      if (price) return price
    }
  }
  return null
}

function oddsForMarket(fixture, market){
  const book = extractFilterOdds(fixture)
  const mapped = {
    'home-win': book.homeWin,
    'away-win': book.awayWin,
    'over-25': book.over25,
    'under-25': book.under25,
    'btts-yes': book.ggYes,
    'over-15': book.over15,
    'under-35': book.under35,
    'home-over-15': book.homeO15,
    'away-over-15': book.awayO15,
    'home-score': book.homeO05,
    'away-score': book.awayO05
  }
  if (mapped[market.id] != null) return mapped[market.id]
  if (market.id === 'btts-no') return oddOf(fixture?.marketOdds, 'both-teams-score', ['No'])
  if (market.id === 'dc-1x') return oddOf(fixture?.marketOdds, 'double-chance', ['1X', 'Home or Draw', '1 or X'])
  if (market.id === 'dc-x2') return oddOf(fixture?.marketOdds, 'double-chance', ['X2', 'Draw or Away', 'X or 2'])
  return oddOf(fixture?.marketOdds, market.marketKey, [market.selection, market.display])
}

function toEngineFixture(fixture){
  const homeForm = venueGames(fixture?.home?.fixtures, fixture?.home?.id, 'home')
  const awayForm = venueGames(fixture?.away?.fixtures, fixture?.away?.id, 'away')
  const odds = {}
  for (const market of MARKETS) {
    const price = oddsForMarket(fixture, market)
    if (price != null) odds[market.id] = price
  }
  return {
    id: fixture.fixtureId,
    kickoff: fixture.kickoff,
    league: fixture.league,
    country: fixture.country,
    countryCode: fixture.countryCode || '',
    home: {
      id: fixture.home?.id,
      name: fixture.home?.name,
      short: text(fixture.home?.name).slice(0, 3).toUpperCase(),
      logo: fixture.home?.logo || null,
      form: homeForm
    },
    away: {
      id: fixture.away?.id,
      name: fixture.away?.name,
      short: text(fixture.away?.name).slice(0, 3).toUpperCase(),
      logo: fixture.away?.logo || null,
      form: awayForm
    },
    odds,
    status: 'upcoming'
  }
}

function packPick(fixture, diagnosis){
  const pick = diagnosis.pick
  const market = MARKETS.find(m => m.id === pick.marketId)
  const homeProfile = diagnosis.homeProfile
  const awayProfile = diagnosis.awayProfile
  const lastMatchesHome = last5Overall(fixture?.home?.lastMatches || fixture?.home?.fixtures, fixture?.home?.id)
  const lastMatchesAway = last5Overall(fixture?.away?.lastMatches || fixture?.away?.fixtures, fixture?.away?.id)
  const last5Home = last5Form(fixture?.home?.fixtures, fixture?.home?.id, 'home')
  const last5Away = last5Form(fixture?.away?.fixtures, fixture?.away?.id, 'away')
  const price = finite(pick.odds) ? +Number(pick.odds).toFixed(2) : null
  const row = {
    fixtureId: fixture.fixtureId,
    league: fixture.league,
    country: fixture.country,
    kickoff: fixture.kickoff,
    home: fixture.home?.name,
    away: fixture.away?.name,
    homeId: fixture.home?.id ?? null,
    awayId: fixture.away?.id ?? null,
    homeLogo: fixture.home?.logo || null,
    awayLogo: fixture.away?.logo || null,
    market: market.marketKey,
    marketName: market.display,
    selection: market.selection,
    displaySelection: market.display,
    pick: market.display,
    odds: price,
    engine: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    route: market.route,
    marketId: market.id,
    favourite: market.favourite,
    homeConsensus: 100,
    awayConsensus: 100,
    consensus: 100,
    recentConsensus: 100,
    filterScore: 100,
    rawFilterScore: 100,
    displayScore: 100,
    capability: 100,
    split: {
      sample: SPLIT_SAMPLE,
      homeForm: homeProfile.form,
      awayForm: awayProfile.form,
      homeHits: pick.consents.find(c => c.id === market.id)?.homeHits ?? SPLIT_SAMPLE,
      awayHits: pick.consents.find(c => c.id === market.id)?.awayHits ?? SPLIT_SAMPLE
    },
    consents: pick.consents,
    homeProfile,
    awayProfile,
    homeSplit: fixture.homeSplit || null,
    awaySplit: fixture.awaySplit || null,
    oddsBook: extractFilterOdds(fixture),
    earlySeason: fixture.earlySeason === true,
    sportyEventId: fixture.sportyEventId || null,
    filterFlags: ['PERFECT_SPLIT'],
    filterReasons: pick.why
  }
  return attachWhy(row, fixture, {
    reasons: pick.why,
    last5Home,
    last5Away,
    lastMatchesHome,
    lastMatchesAway
  })
}

export function diagnoseFilterFixture(fixture, learningState = null){
  if (isSrlMatch(fixture)) return {pick: null, skip: 'srl'}
  if (!fixtureHasStats(fixture)) return {pick: null, skip: 'no-stats'}
  if (fixture?.earlySeason === true || isEarlySeason(fixture)) return {pick: null, skip: 'early-season'}
  if (shouldSkipCupFixture(fixture)) return {pick: null, skip: 'cup'}

  const engineFixture = toEngineFixture(fixture)
  const diagnosis = diagnoseFixture(engineFixture)
  if (!diagnosis.pick) {
    return {
      pick: null,
      skip: diagnosis.skip,
      homeProfile: diagnosis.homeProfile,
      awayProfile: diagnosis.awayProfile,
      consents: diagnosis.consents
    }
  }

  const packed = packPick(fixture, diagnosis)
  const learned = learningAllows(packed, learningState, {board: 'filter'})
  if (!learned.allowed) {
    return {
      pick: null,
      skip: learned.action === 'drop' ? 'learning-drop' : 'learning-tighten',
      homeProfile: diagnosis.homeProfile,
      awayProfile: diagnosis.awayProfile,
      consents: diagnosis.consents,
      learning: learned
    }
  }

  return {
    pick: stampLearning(packed, learned),
    skip: null,
    homeProfile: diagnosis.homeProfile,
    awayProfile: diagnosis.awayProfile,
    consents: diagnosis.consents,
    learning: learned
  }
}

export function evaluateFilterFixture(fixture, learningState = null){
  return diagnoseFilterFixture(fixture, learningState).pick
}

export function buildFilterBoard(fixtures, meta = {}, learningState = null){
  const diagnosed = (fixtures || []).map(fixture => ({fixture, result: diagnoseFilterFixture(fixture, learningState)}))
  const qualified = diagnosed.map(row => row.result.pick).filter(Boolean)
    .sort((a, b) => Date.parse(a.kickoff || 0) - Date.parse(b.kickoff || 0) || String(a.league).localeCompare(String(b.league)))
  const skipped = diagnosed.filter(row => !row.result.pick).reduce((map, row) => {
    const key = row.result.skip || 'unknown'
    map[key] = (map[key] || 0) + 1
    return map
  }, {})
  return {
    meta: {
      ...meta,
      engineVersion: ENGINE_VERSION,
      engine: ENGINE_ID,
      filterVersion: FILTER_VERSION,
      formSample: FORM_SAMPLE || SPLIT_SAMPLE,
      splitSample: SPLIT_SAMPLE,
      qualified: qualified.length,
      bestPicks: qualified.length,
      skipped
    },
    priority: qualified,
    bestPicks: qualified,
    availableMarkets: [...new Set(qualified.map(row => row.market))].sort()
  }
}

export {profileOf, diagnoseFixture}
