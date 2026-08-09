const root = document.getElementById('root')

const state = {
  config: null,
  session: null,
  user: null,
  board: null,
  market: 'ALL',
  minFilters: 1,
  date: new Date().toISOString().slice(0, 10),
  authMode: 'signin'
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]))
const fmt = n => Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—'

const ACCESS_KEY = 's2p_access_token'
const REFRESH_KEY = 's2p_refresh_token'

// Seamless local migration from the pre-Stats2Pitch build.
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
    throw new Error('Supabase is not configured on Render yet.')
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
  if (!r.ok) throw new Error(j.msg || j.message || j.error_description || j.error || `Supabase ${r.status}`)
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
  if (!r.ok) throw new Error(j.error || `Signup failed (${r.status})`)
  // The Render server creates the Supabase user as already confirmed.
  // Password sign-in can therefore happen immediately with no verification email.
  await signIn(email, password)
  return j
}

async function signOut() {
  const t = token()
  try {
    if (t) await supa('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
  } catch (_) {
    // Clear the local session even if the remote session is already expired.
  }
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

function absorbOAuthHash() {
  const hash = new URLSearchParams(location.hash.slice(1))
  const query = new URLSearchParams(location.search)
  const oauthError = hash.get('error_description') || query.get('error_description')
  if (oauthError) throw new Error(oauthError)

  if (hash.get('access_token')) {
    saveSession({
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token')
    })
    history.replaceState({}, '', location.pathname)
  }
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
        <p class="eyebrow">FOOTBALL INTELLIGENCE</p>
        <h1>${creating ? 'Create your account' : 'Welcome back'}</h1>
        <p class="muted">From stats to the pitch. Real fixtures, enriched team data and strict modular prediction filters.</p>

        ${canSignup ? `<div class="auth-tabs" role="tablist" aria-label="Authentication mode">
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

        ${state.config?.enableGithubLogin !== false ? `<div class="or"><span>or</span></div><button id="github" class="github" type="button">Continue with GitHub</button>` : ''}
        <p class="login-note">${creating ? 'Instant access is enabled. Stats2Pitch creates your account as confirmed — no verification email is required.' : 'The prediction board is protected. You must be signed in to access it. • Stats2Pitch v1.1.1'}</p>
        <p id="msg" class="status-msg">${esc(message)}</p>
        <p class="build-stamp">Stats2Pitch.com • build v1.1.1</p>
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
    msg.textContent = creating ? 'Creating account…' : 'Signing in…'
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value

    try {
      if (creating) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      await showDashboard()
    } catch (err) {
      msg.textContent = err.message
    }
  }

  const github = document.getElementById('github')
  if (github) {
    github.onclick = () => {
      const redirect = encodeURIComponent(location.origin)
      location.href = `${state.config.supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${redirect}`
    }
  }
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token()}` }
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j
}

function groupRows(rows) {
  return (rows || []).filter(r =>
    r.filterCount >= state.minFilters &&
    (state.market === 'ALL' || r.market === state.market)
  )
}

function table(title, subtitle, rows) {
  rows = groupRows(rows)
  return `<section class="panel">
    <header class="panel-head">
      <div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
      <span class="count">${rows.length}</span>
    </header>
    ${rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Match</th><th>League</th><th>Selected</th><th>Opponent</th><th>Odds</th><th>Draw</th><th>Filters</th><th>Reason</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(r.match)}</strong><small>${esc(r.kickoffLocal)}</small></td>
        <td><div class="entity">${r.countryFlag ? `<img src="${esc(r.countryFlag)}" alt="" loading="lazy">` : ''}<span>${esc(r.league)}<small>${esc(r.country)}</small></span></div></td>
        <td><div class="entity">${r.selectedTeamLogo ? `<img src="${esc(r.selectedTeamLogo)}" alt="" loading="lazy">` : ''}<span>${esc(r.selectedTeam)} <span class="chip">#${esc(r.selectedPosition ?? '—')}</span></span></div></td>
        <td><div class="entity">${r.opponentTeamLogo ? `<img src="${esc(r.opponentTeamLogo)}" alt="" loading="lazy">` : ''}<span>${esc(r.opponentTeam)} <span class="chip">#${esc(r.opponentPosition ?? '—')}</span></span></div></td>
        <td class="num">${fmt(r.odds)}</td>
        <td class="num">${fmt(r.drawOdds)}</td>
        <td><strong>${r.filterCount}</strong><small>${esc(r.contradiction)} contradiction</small></td>
        <td class="reason">${esc(r.shortReason)}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">No fixtures currently qualify.</div>'}
  </section>`
}

function renderBoard() {
  const b = state.board || { meta: {}, groups: {}, priority: [] }
  const priority = groupRows(b.priority).slice(0, 12)
  const userLabel = state.user?.email || 'Authenticated'

  root.innerHTML = `<main class="app-shell">
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-plate header-brand"><img src="/assets/stats2pitch-logo.png" alt="Stats2Pitch" /></div>
        <div><p class="eyebrow">STATS2PITCH INTELLIGENCE</p><h1>Prediction Board</h1></div>
      </div>
      <div class="top-actions"><span class="user-pill">${esc(userLabel)}</span><button id="signout">Sign out</button></div>
    </header>

    <section class="toolbar">
      <div><label>Market<select id="market">${['ALL', '1X2', 'O1.5', 'U1.5', 'O2.5', 'U2.5', 'O3.5', 'U3.5'].map(x => `<option ${x === state.market ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <div><label>Minimum filters<select id="minf">${[1, 2, 3, 5].map(x => `<option value="${x}" ${x === state.minFilters ? 'selected' : ''}>${x}+</option>`).join('')}</select></label></div>
      <div><label>Fixture date<input id="date" type="date" value="${esc(state.date)}"></label></div>
      <div class="toolbar-spacer"></div>
      <button id="reload">Reload snapshot</button>
      <button id="refresh" class="primary compact">Refresh real data</button>
    </section>

    ${b.meta?.stale ? '<div class="warning-banner">Showing the last known good Stats2Pitch snapshot because the latest API refresh failed.</div>' : ''}

    <section class="metrics">
      <article><span>Fixtures scanned</span><strong>${b.meta?.fixturesScanned ?? 0}</strong></article>
      <article><span>Qualified picks</span><strong>${b.meta?.qualified ?? 0}</strong></article>
      <article><span>3+ filters</span><strong>${b.groups?.threePlus?.length ?? 0}</strong></article>
      <article><span>Last refresh</span><strong class="small-strong">${b.meta?.generatedAt ? new Date(b.meta.generatedAt).toLocaleString() : 'No snapshot yet'}</strong></article>
    </section>

    <section class="panel">
      <header class="panel-head"><div><h2>Priority Prediction List</h2><p>Best to worst after contradiction checks</p></div></header>
      <div class="priority-grid">${priority.map((r, i) => `<article class="pick-card">
        <div class="rank">#${i + 1}</div>
        <div><small>${esc(r.league)}</small><h3>${esc(r.selectedTeam)}</h3><p>${esc(r.match)}</p></div>
        <div class="pick-stats"><strong>${fmt(r.odds)}</strong><span>${r.filterCount} filters</span><span>${esc(r.priorityLabel)}</span></div>
      </article>`).join('') || '<div class="empty">No priority picks for these filters.</div>'}</div>
    </section>

    ${table('3+ Filters', 'Highest priority', b.groups?.threePlus)}
    ${table('2 Filters', 'Strong combinations', b.groups?.two)}
    ${table('Single Filter', 'Watchlist', b.groups?.single)}

    <footer class="footnote"><img src="/assets/stats2pitch-icon-192.png" alt="" /> Stats2Pitch.com uses verified API values only. Missing data is skipped, never guessed. Successful boards are persisted in Supabase.</footer>
  </main>`

  document.getElementById('signout').onclick = async () => { await signOut(); loginView() }
  document.getElementById('market').onchange = e => { state.market = e.target.value; renderBoard() }
  document.getElementById('minf').onchange = e => { state.minFilters = Number(e.target.value); renderBoard() }
  document.getElementById('date').onchange = e => { state.date = e.target.value }
  document.getElementById('reload').onclick = () => loadBoard()
  document.getElementById('refresh').onclick = () => refreshBoard()
}

async function loadBoard() {
  try {
    state.board = await api('/api/board')
    renderBoard()
  } catch (e) {
    if (/Authentication/i.test(e.message)) {
      clearSession()
      loginView(e.message)
    } else {
      alert(e.message)
    }
  }
}

async function refreshBoard() {
  const btn = document.getElementById('refresh')
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…' }
  try {
    state.board = await api(`/api/refresh?date=${encodeURIComponent(state.date)}`, { method: 'POST' })
    renderBoard()
  } catch (e) {
    alert(e.message)
    renderBoard()
  }
}

async function showDashboard() {
  root.innerHTML = '<div class="splash"><img src="/assets/stats2pitch-icon-192.png" alt="" /><span>Loading Stats2Pitch…</span></div>'
  await validate()
  await loadBoard()
}

;(async () => {
  try {
    await loadConfig()
    absorbOAuthHash()
    if (await validate()) await showDashboard()
    else loginView()
  } catch (e) {
    loginView(e.message)
  }
})()
