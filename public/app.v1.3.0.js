const root = document.getElementById('root')

const state = {
  config: null,
  session: null,
  user: null,
  board: null,
  market: 'ALL',
  minReasons: 1,
  sortBy: 'BEST',
  ruleMode: 'ANY',
  selectedRules: new Set(),
  showRules: false,
  date: new Date().toISOString().slice(0, 10),
  authMode: 'signin'
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]))
const fmt = n => Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—'

const ACCESS_KEY = 's2p_access_token'
const REFRESH_KEY = 's2p_refresh_token'

if (!localStorage.getItem(ACCESS_KEY) && localStorage.getItem('mfa_access_token')) {
  localStorage.setItem(ACCESS_KEY, localStorage.getItem('mfa_access_token'))
}
if (!localStorage.getItem(REFRESH_KEY) && localStorage.getItem('mfa_refresh_token')) {
  localStorage.setItem(REFRESH_KEY, localStorage.getItem('mfa_refresh_token'))
}

const token = () => state.session?.access_token || localStorage.getItem(ACCESS_KEY) || ''

async function loadConfig() {
  state.config = await fetch('/api/config').then(r => r.json())
  if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) {
    throw new Error('Stats2Pitch is temporarily unavailable. Please try again shortly.')
  }
}

function saveSession(s) {
  state.session = s
  if (s?.access_token) localStorage.setItem(ACCESS_KEY, s.access_token)
  if (s?.refresh_token) localStorage.setItem(REFRESH_KEY, s.refresh_token)
}

function clearSession() {
  state.session = null
  state.user = null
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem('mfa_access_token')
  localStorage.removeItem('mfa_refresh_token')
}

async function supa(path, opts = {}) {
  const r = await fetch(state.config.supabaseUrl + path, {
    ...opts,
    headers: {
      apikey: state.config.supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.msg || j.message || j.error_description || j.error || 'Sign-in could not be completed.')
  return j
}

async function signIn(email, password) {
  const j = await supa('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  saveSession(j)
  return j
}

async function signUp(email, password) {
  const r = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Account could not be created.')
  await signIn(email, password)
  return j
}

async function signOut() {
  const t = token()
  try {
    if (t) await supa('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
  } catch (_) {}
  clearSession()
}

async function refreshSession() {
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return null
  try {
    const j = await supa('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: rt })
    })
    saveSession(j)
    return j
  } catch {
    clearSession()
    return null
  }
}

async function validate() {
  const t = token()
  if (!t) return false

  let r = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } })
  if (r.ok) {
    state.user = await r.json().catch(() => null)
    return true
  }

  const renewed = await refreshSession()
  if (!renewed) return false

  r = await fetch('/api/me', { headers: { Authorization: `Bearer ${token()}` } })
  if (!r.ok) return false
  state.user = await r.json().catch(() => null)
  return true
}

function setAuthMode(mode) {
  state.authMode = mode
  loginView()
}

function loginView(message = '') {
  const canSignup = state.config?.allowPublicSignup !== false
  if (!canSignup) state.authMode = 'signin'
  const creating = state.authMode === 'signup'

  root.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <div class="brand-plate login-brand">
          <img src="/assets/stats2pitch-logo.png" alt="Stats2Pitch" />
        </div>
        <p class="eyebrow">FOOTBALL PICKS MADE SIMPLE</p>
        <h1>${creating ? 'Create your account' : 'Welcome back'}</h1>
        <p class="muted">Turn football form, league position, goals and prices into clear match picks.</p>

        ${canSignup ? `<div class="auth-tabs" role="tablist" aria-label="Account options">
          <button id="tab-signin" class="auth-tab ${creating ? '' : 'active'}" type="button">Sign in</button>
          <button id="tab-signup" class="auth-tab ${creating ? 'active' : ''}" type="button">Create account</button>
        </div>` : ''}

        <form id="auth-form">
          <label>Email
            <input id="email" type="email" required autocomplete="email" placeholder="you@example.com" />
          </label>
          <label>Password
            <input id="password" type="password" minlength="6" required autocomplete="${creating ? 'new-password' : 'current-password'}" placeholder="6+ characters" />
          </label>
          <button class="primary" type="submit">${creating ? 'Create account & enter' : 'Sign in'}</button>
        </form>

        <p class="login-note">${creating ? 'Your account opens immediately. No email verification is needed.' : 'Sign in to open your Stats2Pitch prediction board.'}</p>
        <p id="msg" class="status-msg">${esc(message)}</p>
      </section>
    </main>`

  if (canSignup) {
    document.getElementById('tab-signin').onclick = () => setAuthMode('signin')
    document.getElementById('tab-signup').onclick = () => setAuthMode('signup')
  }

  const form = document.getElementById('auth-form')
  const msg = document.getElementById('msg')

  form.onsubmit = async e => {
    e.preventDefault()
    msg.textContent = creating ? 'Creating your account…' : 'Signing you in…'
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value

    try {
      if (creating) await signUp(email, password)
      else await signIn(email, password)
      await showDashboard()
    } catch (err) {
      msg.textContent = err.message
    }
  }
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token()}` }
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.')
  return j
}

const MARKET_NAMES = {
  ALL: 'All picks',
  '1X2': 'Match winner',
  'O1.5': 'Over 1.5 goals',
  'U1.5': 'Under 1.5 goals',
  'O2.5': 'Over 2.5 goals',
  'U2.5': 'Under 2.5 goals',
  'O3.5': 'Over 3.5 goals',
  'U3.5': 'Under 3.5 goals'
}

const RULE_GROUPS = [
  {
    title: 'League position',
    rules: [
      ['TOP3', 'Selected team is in the top 3'],
      ['BOTTOM3', 'Selected team is in the bottom 3'],
      ['OPP_TOP3', 'Opponent is in the top 3'],
      ['OPP_BOTTOM3', 'Opponent is in the bottom 3']
    ]
  },
  {
    title: 'Points and scoring',
    rules: [
      ['PPG_HIGH', 'Selected team averages 2+ points per game'],
      ['PPG_LOW', 'Selected team averages under 1 point per game'],
      ['OPP_PPG_LOW', 'Opponent averages under 1 point per game'],
      ['GS_23', 'Selected team scores 2.3+ goals per game'],
      ['GS_20', 'Selected team scores 2+ goals per game'],
      ['GS_LOW', 'Selected team scores under 1 goal per game'],
      ['OPP_GS_LOW', 'Opponent scores under 1 goal per game']
    ]
  },
  {
    title: 'Defending',
    rules: [
      ['GC_LOW', 'Selected team concedes under 1 goal per game'],
      ['GC_20', 'Selected team concedes 2+ goals per game'],
      ['GC_23', 'Selected team concedes more than 2.3 goals per game'],
      ['OPP_GC_LOW', 'Opponent concedes under 1 goal per game'],
      ['OPP_GC_20', 'Opponent concedes 2+ goals per game'],
      ['OPP_GC_23', 'Opponent concedes more than 2.3 goals per game']
    ]
  },
  {
    title: 'Last 5 matches',
    rules: [
      ['WIN80', 'Selected team won at least 4 of the last 5'],
      ['WIN60', 'Selected team won at least 3 of the last 5'],
      ['WIN_LT40', 'Selected team won fewer than 2 of the last 5'],
      ['WIN_LT60', 'Selected team won fewer than 3 of the last 5'],
      ['LOSS80', 'Selected team lost at least 4 of the last 5'],
      ['LOSS60', 'Selected team lost at least 3 of the last 5'],
      ['OPP_LOSS80', 'Opponent lost at least 4 of the last 5'],
      ['OPP_LOSS60', 'Opponent lost at least 3 of the last 5']
    ]
  },
  {
    title: 'Prices',
    rules: [
      ['ODDS_120', 'Win price is below 1.20'],
      ['ODDS_155', 'Win price is 1.55 or lower'],
      ['ODDS_200', 'Win price is 2.00 or lower'],
      ['ODDS_500', 'Win price is above 5.00'],
      ['DRAW_LT3', 'Draw price is below 3.00'],
      ['DRAW_GT4', 'Draw price is above 4.00'],
      ['DRAW_GT5', 'Draw price is above 5.00']
    ]
  },
  {
    title: 'Recent goal patterns',
    rules: [
      ['GOAL_O15_80', 'Over 1.5 goals landed in 80%+ of recent matches'],
      ['GOAL_O15_60', 'Over 1.5 goals landed in 60%+ of recent matches'],
      ['GOAL_U15_80', 'Under 1.5 goals landed in 80%+ of recent matches'],
      ['GOAL_U15_60', 'Under 1.5 goals landed in 60%+ of recent matches'],
      ['GOAL_O25_80', 'Over 2.5 goals landed in 80%+ of recent matches'],
      ['GOAL_O25_60', 'Over 2.5 goals landed in 60%+ of recent matches'],
      ['GOAL_U25_80', 'Under 2.5 goals landed in 80%+ of recent matches'],
      ['GOAL_U25_60', 'Under 2.5 goals landed in 60%+ of recent matches'],
      ['GOAL_O35_80', 'Over 3.5 goals landed in 80%+ of recent matches'],
      ['GOAL_O35_60', 'Over 3.5 goals landed in 60%+ of recent matches'],
      ['GOAL_U35_80', 'Under 3.5 goals landed in 80%+ of recent matches'],
      ['GOAL_U35_60', 'Under 3.5 goals landed in 60%+ of recent matches']
    ]
  }
]

const RULE_LABELS = new Map(RULE_GROUPS.flatMap(g => g.rules))

function inferCodes(row) {
  const codes = []
  const all = [...(row.filters || []), ...(row.negativeSignals || [])].map(x => String(x))
  for (const text of all) {
    const s = text.toLowerCase()
    const opp = s.startsWith('opponent ')
    if (opp && s.includes('top 3')) codes.push('OPP_TOP3')
    else if (opp && s.includes('bottom 3')) codes.push('OPP_BOTTOM3')
    else if (!opp && s === 'top 3') codes.push('TOP3')
    else if (!opp && s === 'bottom 3') codes.push('BOTTOM3')

    if (opp && s.includes('ppg < 1.0')) codes.push('OPP_PPG_LOW')
    else if (!opp && s.includes('ppg ≥ 2.0')) codes.push('PPG_HIGH')
    else if (!opp && s.includes('ppg < 1.0')) codes.push('PPG_LOW')

    if (opp && s.includes('goals scored < 1.0')) codes.push('OPP_GS_LOW')
    else if (!opp && s.includes('goals scored ≥ 2.3')) codes.push('GS_23')
    else if (!opp && s.includes('goals scored ≥ 2.0')) codes.push('GS_20')
    else if (!opp && s.includes('goals scored < 1.0')) codes.push('GS_LOW')

    if (opp && s.includes('goals conceded > 2.3')) codes.push('OPP_GC_23')
    else if (opp && s.includes('goals conceded ≥ 2.0')) codes.push('OPP_GC_20')
    else if (opp && s.includes('goals conceded < 1.0')) codes.push('OPP_GC_LOW')
    else if (!opp && s.includes('goals conceded > 2.3')) codes.push('GC_23')
    else if (!opp && s.includes('goals conceded ≥ 2.0')) codes.push('GC_20')
    else if (!opp && s.includes('goals conceded < 1.0')) codes.push('GC_LOW')

    if (opp && s.includes('loss rate ≥ 80%')) codes.push('OPP_LOSS80')
    else if (opp && s.includes('loss rate ≥ 60%')) codes.push('OPP_LOSS60')
    else if (!opp && s.includes('win rate ≥ 80%')) codes.push('WIN80')
    else if (!opp && s.includes('win rate ≥ 60%')) codes.push('WIN60')
    else if (!opp && s.includes('win rate < 40%')) codes.push('WIN_LT40')
    else if (!opp && s.includes('win rate < 60%')) codes.push('WIN_LT60')
    else if (!opp && s.includes('loss rate ≥ 80%')) codes.push('LOSS80')
    else if (!opp && s.includes('loss rate ≥ 60%')) codes.push('LOSS60')

    if (s.includes('odds < 1.20')) codes.push('ODDS_120')
    else if (s.includes('odds ≤ 1.55')) codes.push('ODDS_155')
    else if (s.includes('odds ≤ 2.00')) codes.push('ODDS_200')
    else if (s.includes('odds > 5.00')) codes.push('ODDS_500')
    if (s.includes('draw odds < 3.00')) codes.push('DRAW_LT3')
    else if (s.includes('draw odds > 5.00')) codes.push('DRAW_GT5')
    else if (s.includes('draw odds > 4.00')) codes.push('DRAW_GT4')

    const gm = text.match(/\b([OU])(1\.5|2\.5|3\.5) hit rate ≥ (80|60)%/i)
    if (gm) codes.push(`GOAL_${gm[1].toUpperCase()}${gm[2].replace('.','')}_${gm[3]}`)
  }
  return [...new Set(codes)]
}

function rowCodes(row) {
  return [...new Set([
    ...(row.filterCodes || []),
    ...(row.negativeSignalCodes || []),
    ...inferCodes(row)
  ])]
}

function selectedRuleMatchCount(row) {
  if (!state.selectedRules.size) return 0
  const codes = new Set(rowCodes(row))
  let count = 0
  for (const id of state.selectedRules) if (codes.has(id)) count++
  return count
}

function rowPassesRules(row) {
  if (!state.selectedRules.size) return true
  const count = selectedRuleMatchCount(row)
  return state.ruleMode === 'ALL' ? count === state.selectedRules.size : count > 0
}

function compareRows(a, b) {
  if (state.sortBy === 'FILTER_MATCH') {
    return selectedRuleMatchCount(b) - selectedRuleMatchCount(a) || b.filterCount - a.filterCount || (a.odds ?? 99) - (b.odds ?? 99)
  }
  if (state.sortBy === 'MOST_REASONS') return b.filterCount - a.filterCount || (a.odds ?? 99) - (b.odds ?? 99)
  if (state.sortBy === 'LOW_PRICE') return (a.odds ?? 99) - (b.odds ?? 99) || b.filterCount - a.filterCount
  if (state.sortBy === 'KICKOFF') return new Date(a.kickoff || 0) - new Date(b.kickoff || 0)
  if (state.sortBy === 'TEAM') return String(a.selectedTeam || '').localeCompare(String(b.selectedTeam || ''))
  return b.filterCount - a.filterCount || warningRank(a.contradiction) - warningRank(b.contradiction) || Number(b.score || 0) - Number(a.score || 0) || (a.odds ?? 99) - (b.odds ?? 99)
}

function groupRows(rows) {
  return (rows || []).filter(r =>
    r.filterCount >= state.minReasons &&
    (state.market === 'ALL' || r.market === state.market) &&
    rowPassesRules(r)
  ).sort(compareRows)
}

function warningRank(x) { return x === 'LOW' ? 0 : x === 'MODERATE' ? 1 : 2 }

function strengthLabel(label) {
  return ({
    ELITE: 'Top pick',
    'VERY HIGH': 'Very strong',
    HIGH: 'Strong',
    MEDIUM: 'Good',
    WATCHLIST: 'Caution'
  })[label] || 'Pick'
}

function warningLabel(x) {
  return x === 'HIGH' ? 'Mixed signs' : x === 'MODERATE' ? 'Some warning signs' : 'Clear picture'
}

function plainReason(text) {
  let s = String(text || '')
  const replacements = [
    [/^Top 3$/i, "Selected team is in the league's top 3"],
    [/^Bottom 3$/i, 'Selected team is in the bottom 3'],
    [/^PPG ≥ 2\.0$/i, 'Selected team averages at least 2 points per game'],
    [/^PPG < 1\.0$/i, 'Selected team averages under 1 point per game'],
    [/^Goals scored ≥ 2\.3$/i, 'Selected team scores at least 2.3 goals per game'],
    [/^Goals scored ≥ 2\.0$/i, 'Selected team scores at least 2 goals per game'],
    [/^Goals scored < 1\.0$/i, 'Selected team scores under 1 goal per game'],
    [/^Goals conceded > 2\.3$/i, 'Selected team concedes more than 2.3 goals per game'],
    [/^Goals conceded ≥ 2\.0$/i, 'Selected team concedes at least 2 goals per game'],
    [/^Goals conceded < 1\.0$/i, 'Selected team concedes under 1 goal per game'],
    [/^Last 5 win rate ≥ 80%$/i, 'Selected team won at least 4 of its last 5'],
    [/^Last 5 win rate ≥ 60%$/i, 'Selected team won at least 3 of its last 5'],
    [/^Last 5 win rate < 40%$/i, 'Selected team won fewer than 2 of its last 5'],
    [/^Last 5 win rate < 60%$/i, 'Selected team won fewer than 3 of its last 5'],
    [/^Last 5 loss rate ≥ 80%$/i, 'Selected team lost at least 4 of its last 5'],
    [/^Last 5 loss rate ≥ 60%$/i, 'Selected team lost at least 3 of its last 5'],
    [/^Odds < 1\.20$/i, 'Win price is below 1.20'],
    [/^Odds ≤ 1\.55$/i, 'Win price is 1.55 or lower'],
    [/^Odds ≤ 2\.00$/i, 'Win price is 2.00 or lower'],
    [/^Odds > 5\.00$/i, 'Win price is above 5.00'],
    [/^Draw odds < 3\.00$/i, 'Draw price is below 3.00'],
    [/^Draw odds > 4\.00$/i, 'Draw price is above 4.00'],
    [/^Draw odds > 5\.00$/i, 'Draw price is above 5.00'],
    [/^Opponent top 3$/i, 'Opponent is in the league top 3'],
    [/^Opponent bottom 3$/i, 'Opponent is in the bottom 3'],
    [/^Opponent PPG < 1\.0$/i, 'Opponent averages under 1 point per game'],
    [/^Opponent goals scored < 1\.0$/i, 'Opponent scores under 1 goal per game'],
    [/^Opponent goals conceded > 2\.3$/i, 'Opponent concedes more than 2.3 goals per game'],
    [/^Opponent goals conceded ≥ 2\.0$/i, 'Opponent concedes at least 2 goals per game'],
    [/^Opponent goals conceded < 1\.0$/i, 'Opponent concedes under 1 goal per game'],
    [/^Opponent last 5 loss rate ≥ 80%$/i, 'Opponent lost at least 4 of its last 5'],
    [/^Opponent last 5 loss rate ≥ 60%$/i, 'Opponent lost at least 3 of its last 5']
  ]
  for (const [re, out] of replacements) if (re.test(s)) return out

  const goal = s.match(/^(Home|Away) ([OU])(1\.5|2\.5|3\.5) hit rate ≥ (80|60)%/i)
  if (goal) {
    const side = goal[1].toLowerCase()
    const direction = goal[2].toUpperCase() === 'O' ? 'Over' : 'Under'
    return `${direction} ${goal[3]} goals landed in at least ${goal[4]}% of the ${side} team's recent matches`
  }
  return s
}


function marketsForFixture(fixtureId) {
  return state.board?.oddsByFixture?.[String(fixtureId)] || []
}

function marketButton(row) {
  const count = marketsForFixture(row.fixtureId).length
  if (!count) return '<span class="no-price">No extra prices</span>'
  return `<button type="button" class="market-link" data-markets="${esc(row.fixtureId)}" data-match="${esc(row.match)}">See ${count} ${count === 1 ? 'market' : 'markets'}</button>`
}

function openMarketPrices(fixtureId, match) {
  const markets = marketsForFixture(fixtureId)
  const old = document.getElementById('market-modal')
  if (old) old.remove()
  const overlay = document.createElement('div')
  overlay.id = 'market-modal'
  overlay.className = 'modal-backdrop'
  overlay.innerHTML = `<section class="market-modal" role="dialog" aria-modal="true" aria-label="Available prices">
    <header class="market-modal-head">
      <div><p class="eyebrow">AVAILABLE PRICES</p><h2>${esc(match)}</h2><p>Best available price found for each choice.</p></div>
      <button type="button" class="modal-close" aria-label="Close">×</button>
    </header>
    <div class="market-list">${markets.length ? markets.map(m => `<article class="market-card">
      <h3>${esc(m.market)}</h3>
      <div class="outcome-grid">${(m.outcomes || []).map(o => `<div class="outcome"><span>${esc(o.name)}</span><strong>${fmt(o.odd)}</strong></div>`).join('')}</div>
    </article>`).join('') : '<div class="empty">No extra prices are available for this match yet.</div>'}</div>
  </section>`
  document.body.appendChild(overlay)
  const close = () => overlay.remove()
  overlay.querySelector('.modal-close').onclick = close
  overlay.onclick = e => { if (e.target === overlay) close() }
  document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',onKey) } })
}

function table(title, subtitle, rows) {
  rows = groupRows(rows)
  return `<section class="panel">
    <header class="panel-head">
      <div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
      <span class="count">${rows.length}</span>
    </header>
    ${rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Match</th><th>Competition</th><th>Pick</th><th>Against</th><th>Pick price</th><th>Draw price</th><th>Why it qualifies</th><th>More prices</th></tr></thead>
      <tbody>${rows.map(r => {
        const reasons = (r.filters || []).map(plainReason)
        const isWinner = r.market === '1X2'
        return `<tr>
          <td><strong>${esc(r.match)}</strong><small>${esc(r.kickoffLocal)}</small></td>
          <td><div class="entity">${r.countryFlag ? `<img src="${esc(r.countryFlag)}" alt="" loading="lazy">` : ''}<span>${esc(r.league)}<small>${esc(r.country)}</small></span></div></td>
          <td><div class="entity">${isWinner && r.selectedTeamLogo ? `<img src="${esc(r.selectedTeamLogo)}" alt="" loading="lazy">` : ''}<span><strong>${esc(isWinner ? r.selectedTeam : MARKET_NAMES[r.market] || r.selectedTeam)}</strong>${isWinner && r.selectedPosition ? `<small>League position: ${esc(r.selectedPosition)}</small>` : ''}</span></div></td>
          <td><div class="entity">${isWinner && r.opponentTeamLogo ? `<img src="${esc(r.opponentTeamLogo)}" alt="" loading="lazy">` : ''}<span>${esc(isWinner ? r.opponentTeam : 'Whole match')}${isWinner && r.opponentPosition ? `<small>League position: ${esc(r.opponentPosition)}</small>` : ''}</span></div></td>
          <td class="num">${fmt(r.odds)}</td>
          <td class="num">${fmt(r.drawOdds)}</td>
          <td class="reason-cell"><div class="reason-top"><strong>${r.filterCount} ${r.filterCount === 1 ? 'reason' : 'reasons'}</strong><span class="clarity ${String(r.contradiction || '').toLowerCase()}">${esc(warningLabel(r.contradiction))}</span></div><div class="reason-list">${reasons.slice(0,4).map(x => `<span>${esc(x)}</span>`).join('')}${reasons.length > 4 ? `<span>+${reasons.length - 4} more</span>` : ''}</div></td>
          <td>${marketButton(r)}</td>
        </tr>`
      }).join('')}</tbody>
    </table></div>` : '<div class="empty">No matches fit these choices right now.</div>'}
  </section>`
}

function renderRulePanel() {
  if (!state.showRules) return ''
  return `<section class="rule-panel">
    <div class="rule-panel-head">
      <div><h2>Choose the filters you want</h2><p>Pick one or more conditions. You can show matches that meet any selected condition or only matches that meet them all.</p></div>
      <button id="clear-rules" class="ghost compact" ${state.selectedRules.size ? '' : 'disabled'}>Clear all</button>
    </div>
    <div class="rule-mode">
      <span>When more than one is selected:</span>
      <label><input type="radio" name="rulemode" value="ANY" ${state.ruleMode === 'ANY' ? 'checked' : ''}> Match any</label>
      <label><input type="radio" name="rulemode" value="ALL" ${state.ruleMode === 'ALL' ? 'checked' : ''}> Match all</label>
    </div>
    <div class="rule-groups">
      ${RULE_GROUPS.map((g, i) => `<details class="rule-group" ${i < 2 ? 'open' : ''}>
        <summary>${esc(g.title)}</summary>
        <div class="rule-chips">${g.rules.map(([id, label]) => `<button type="button" class="rule-chip ${state.selectedRules.has(id) ? 'active' : ''}" data-rule="${esc(id)}"><span class="rule-check">${state.selectedRules.has(id) ? '✓' : '+'}</span>${esc(label)}</button>`).join('')}</div>
      </details>`).join('')}
    </div>
  </section>`
}

function allVisibleRows(board) {
  return [...(board?.groups?.threePlus || []), ...(board?.groups?.two || []), ...(board?.groups?.single || [])]
}

function renderBoard() {
  const b = state.board || { meta: {}, groups: {}, priority: [] }
  const priority = groupRows(b.priority).slice(0, 12)
  const visible = groupRows(allVisibleRows(b))
  const strongVisible = groupRows(b.groups?.threePlus || []).length
  const userLabel = state.user?.email || 'Signed in'

  root.innerHTML = `<main class="app-shell">
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-plate header-brand"><img src="/assets/stats2pitch-logo.png" alt="Stats2Pitch" /></div>
        <div><p class="eyebrow">STATS2PITCH</p><h1>Match Picks</h1></div>
      </div>
      <div class="top-actions"><span class="user-pill">${esc(userLabel)}</span><button id="signout">Sign out</button></div>
    </header>

    <section class="toolbar">
      <div><label>Prediction type<select id="market">${Object.entries(MARKET_NAMES).map(([value, label]) => `<option value="${value}" ${value === state.market ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label></div>
      <div><label>Minimum reasons<select id="minf">${[1, 2, 3, 5].map(x => `<option value="${x}" ${x === state.minReasons ? 'selected' : ''}>${x}+ ${x === 1 ? 'reason' : 'reasons'}</option>`).join('')}</select></label></div>
      <div><label>Order matches<select id="sortby">
        <option value="BEST" ${state.sortBy === 'BEST' ? 'selected' : ''}>Best matches first</option>
        <option value="FILTER_MATCH" ${state.sortBy === 'FILTER_MATCH' ? 'selected' : ''}>Selected filters first</option>
        <option value="MOST_REASONS" ${state.sortBy === 'MOST_REASONS' ? 'selected' : ''}>Most reasons first</option>
        <option value="LOW_PRICE" ${state.sortBy === 'LOW_PRICE' ? 'selected' : ''}>Lowest win price first</option>
        <option value="KICKOFF" ${state.sortBy === 'KICKOFF' ? 'selected' : ''}>Earliest kickoff first</option>
        <option value="TEAM" ${state.sortBy === 'TEAM' ? 'selected' : ''}>Team name A–Z</option>
      </select></label></div>
      <div><label>Match date<input id="date" type="date" value="${esc(state.date)}"></label></div>
      <button id="toggle-rules" class="filter-button ${state.selectedRules.size ? 'active' : ''}"><span>Choose filters</span><b>${state.selectedRules.size || 'All'}</b></button>
      <button id="refresh" class="primary compact">Update matches</button>
    </section>

    ${renderRulePanel()}

    ${b.meta?.stale ? '<div class="warning-banner">We could not update the matches just now, so you are seeing the most recent available picks.</div>' : ''}

    <section class="summary-strip">
      <article><span>Matches shown</span><strong>${visible.length}</strong></article>
      <article><span>Strong matches</span><strong>${strongVisible}</strong></article>
      <article><span>Filters selected</span><strong>${state.selectedRules.size || 'All'}</strong></article>
    </section>

    <section class="panel priority-panel">
      <header class="panel-head"><div><h2>Best Picks</h2><p>The clearest matches from your current choices.</p></div></header>
      <div class="priority-grid">${priority.map((r, i) => `<article class="pick-card">
        <div class="rank">#${i + 1}</div>
        <div><small>${esc(r.league)}</small><h3>${esc(r.market === '1X2' ? r.selectedTeam : MARKET_NAMES[r.market] || r.selectedTeam)}</h3><p>${esc(r.match)}</p></div>
        <div class="pick-stats"><strong>${r.odds ? fmt(r.odds) : strengthLabel(r.priorityLabel)}</strong><span>${r.filterCount} ${r.filterCount === 1 ? 'reason' : 'reasons'}</span><span>${esc(strengthLabel(r.priorityLabel))}</span></div>
      </article>`).join('') || '<div class="empty">No picks fit these choices right now.</div>'}</div>
    </section>

    ${table('Strong Matches', 'Three or more clear reasons support the pick.', b.groups?.threePlus)}
    ${table('Good Matches', 'Two clear reasons support the pick.', b.groups?.two)}
    ${table('One Clear Reason', 'One condition is pointing in this direction.', b.groups?.single)}

    <footer class="footnote"><img src="/assets/stats2pitch-icon-192.png" alt="" /> Stats2Pitch.com · From stats to the pitch.</footer>
  </main>`

  document.getElementById('signout').onclick = async () => { await signOut(); loginView() }
  document.getElementById('market').onchange = e => { state.market = e.target.value; renderBoard() }
  document.getElementById('minf').onchange = e => { state.minReasons = Number(e.target.value); renderBoard() }
  document.getElementById('sortby').onchange = e => { state.sortBy = e.target.value; renderBoard() }
  document.getElementById('date').onchange = e => { state.date = e.target.value }
  document.getElementById('toggle-rules').onclick = () => { state.showRules = !state.showRules; renderBoard() }
  document.getElementById('refresh').onclick = () => refreshBoard()

  document.querySelectorAll('[data-markets]').forEach(btn => {
    btn.onclick = () => openMarketPrices(btn.dataset.markets, btn.dataset.match || 'Match prices')
  })

  if (state.showRules) {
    document.querySelectorAll('.rule-chip').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.rule
        if (state.selectedRules.has(id)) state.selectedRules.delete(id)
        else state.selectedRules.add(id)
        if (state.selectedRules.size && state.sortBy === 'BEST') state.sortBy = 'FILTER_MATCH'
        renderBoard()
      }
    })
    document.querySelectorAll('input[name="rulemode"]').forEach(input => {
      input.onchange = () => { state.ruleMode = input.value; renderBoard() }
    })
    const clear = document.getElementById('clear-rules')
    if (clear) clear.onclick = () => { state.selectedRules.clear(); state.sortBy = 'BEST'; renderBoard() }
  }
}

async function loadBoard() {
  try {
    state.board = await api('/api/board')
    renderBoard()
  } catch (e) {
    if (/Authentication/i.test(e.message)) {
      clearSession()
      loginView('Please sign in again.')
    } else {
      alert(e.message)
    }
  }
}

async function refreshBoard() {
  const btn = document.getElementById('refresh')
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…' }
  try {
    state.board = await api(`/api/refresh?date=${encodeURIComponent(state.date)}`, { method: 'POST' })
    renderBoard()
  } catch (e) {
    alert(e.message)
    renderBoard()
  }
}

async function showDashboard() {
  root.innerHTML = '<div class="splash"><img src="/assets/stats2pitch-icon-192.png" alt="" /><span>Opening Stats2Pitch…</span></div>'
  await validate()
  await loadBoard()
}

;(async () => {
  try {
    await loadConfig()
    if (await validate()) await showDashboard()
    else loginView()
  } catch (e) {
    loginView(e.message)
  }
})()
