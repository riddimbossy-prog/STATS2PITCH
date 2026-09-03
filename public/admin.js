const $ = (q, el = document) => el.querySelector(q)
function esc(s){const t=String(s??'');return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
const cfg = window.__STATS2PITCH_CONFIG__ || {}
const base = String(cfg.supabaseUrl || "").replace(/\/+$/, "")
const anon = String(cfg.supabaseAnonKey || "")
const apiFn = String(cfg.functionName || "stats2pitch-api")
const token = () => localStorage.getItem("s2p_admin_access_token") || ""
const GEO = { AF:[33,66], AL:[41,20], DZ:[28,3], AO:[-12,18], AR:[-38,-64], AU:[-25,134], AT:[47.5,14.5], BD:[24,90], BE:[50.5,4.5], BJ:[9.3,2.3], BR:[-10,-55], BF:[12,-1.5], BI:[-3.4,30], CM:[5.7,12.7], CA:[56,-106], TD:[15,19], CL:[-35,-71], CN:[35,104], CO:[4,-74], CD:[-4,22], CI:[8,-5.5], EG:[26,30], ET:[9,39], FR:[46,2], GA:[-0.8,11.8], DE:[51,10], GH:[7.95,-1.02], GN:[11,-10], IN:[21,78], ID:[-2,118], IE:[53,-8], IL:[31,35], IT:[43,12], JP:[36,138], KE:[0.5,38], LS:[-29.5,28.5], LR:[6.4,-9.4], LY:[27,17], MG:[-20,47], MW:[-13,34], ML:[17,-4], MR:[20,-10], MX:[23,-102], MA:[32,-6], MZ:[-18,35], NA:[-22,17], NL:[52,5.5], NE:[16,8], NG:[9.1,8.7], PK:[30,70], PH:[13,122], PL:[52,20], PT:[39.5,-8], QA:[25,51], RO:[46,25], RU:[61,99], RW:[-2,30], SA:[24,45], SN:[14,-14], SL:[8.5,-12], SO:[5,46], ZA:[-29,24], SS:[7,30], ES:[40,-4], SD:[16,30], SE:[63,16], TZ:[-6,35], TG:[8,1.2], TN:[34,9], TR:[39,35], UG:[1,32], AE:[24,54], GB:[54,-2], US:[39.8,-98.5], UY:[-33,-56], VE:[8,-66], VN:[16,108], ZM:[-13,28], ZW:[-19,29] }
const PALS = [
  "linear-gradient(135deg,#0b3d32,#3ddc84)",
  "linear-gradient(135deg,#1a1c22,#3a4150)",
  "linear-gradient(135deg,#10243a,#3b82f6)",
  "linear-gradient(135deg,#2a1208,#ff7a1a)"
]

const state = { view: "overview", data: null, selected: null, query: "", map: null, timer: null }

function apiUrl(path) { return `${base}/functions/v1/${apiFn}${path}` }
function authUrl(path) { return `${base}/functions/v1/stats2pitch-auth${path}` }
async function edge(url, opts = {}) {
  const headers = { apikey: anon, ...(opts.headers || {}) }
  if (token()) headers.Authorization = `Bearer ${token()}`
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json"
  const r = await fetch(url, { ...opts, headers, cache: "no-store" })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b?.error || "Request failed")
  return b
}
async function login(email, password) {
  const b = await edge(authUrl("/login"), { method: "POST", body: JSON.stringify({ email, password }) })
  localStorage.setItem("s2p_admin_access_token", b.access_token || "")
  localStorage.setItem("s2p_admin_refresh_token", b.refresh_token || "")
  return b
}
function logout() {
  localStorage.removeItem("s2p_admin_access_token")
  localStorage.removeItem("s2p_admin_refresh_token")
  location.reload()
}
function fmtMins(sec) {
  const n = Math.max(0, Number(sec) || 0)
  if (n < 60) return `${n}s`
  const m = Math.round(n / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}
function greet() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", hour: "numeric", hour12: false }).format(new Date()))
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}
function flag(code) {
  const c = String(code || "").toLowerCase()
  if (!/^[a-z]{2}$/.test(c)) return ""
  return `<img class="flag" src="https://flagcdn.com/24x18/${c}.png" alt="" width="18" height="13">`
}
function pal(id, online) {
  if (online) return PALS[0]
  let n = 0
  for (const ch of String(id || "")) n += ch.charCodeAt(0)
  return PALS[(n % 3) + 1]
}
function status(v) {
  return v.online ? `<span class="online"><i class="dot"></i>Online</span>` : `<span class="offline">Offline</span>`
}
function icon(name) {
  const p = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  if (name === "home") return `<svg viewBox="0 0 24 24" ${p}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>`
  if (name === "users") return `<svg viewBox="0 0 24 24" ${p}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16.5 3.13a4 4 0 0 1 0 7.75"/></svg>`
  if (name === "globe") return `<svg viewBox="0 0 24 24" ${p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`
  if (name === "board") return `<svg viewBox="0 0 24 24" ${p}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>`
  return `<svg viewBox="0 0 24 24" ${p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`
}
function visitors() { return state.data?.visitors || [] }
function filtered() {
  const q = state.query.trim().toLowerCase()
  return visitors().filter(v => {
    if (!q) return true
    return [v.email, v.name, v.country, v.countryName, v.city, v.device].join(" ").toLowerCase().includes(q)
  })
}
function selected() {
  const list = filtered()
  return list.find(v => v.id === state.selected) || list.find(v => v.online) || list[0] || null
}
function countries() {
  const map = {}
  for (const v of visitors()) {
    const code = String(v.country || "").toUpperCase()
    if (!code || code === "—") continue
    map[code] = map[code] || { code, name: v.countryName || code, count: 0, online: 0, seconds: 0 }
    map[code].count += 1
    map[code].seconds += Number(v.avgSessionSeconds || 0)
    if (v.online) map[code].online += 1
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
}

function showLogin(message = "") {
  $("#app").innerHTML = `<div class="login-wrap"><div class="login-card">
    <img src="/assets/stats2pitch-logo-v2.png" alt="Stats2Pitch">
    <h2>Admin</h2>
    <p>${message ? esc(message) : "Private Stats2Pitch console"}</p>
    <label>Email<input id="adminEmail" type="email" autocomplete="username" value="stats2pitch@gmail.com"></label>
    <label>Password<input id="adminPassword" type="password" autocomplete="current-password"></label>
    <button id="adminLogin">Sign in</button>
  </div></div>`
  $("#adminLogin").onclick = async () => {
    const btn = $("#adminLogin")
    btn.disabled = true
    btn.textContent = "Signing in…"
    try {
      await login($("#adminEmail").value, $("#adminPassword").value)
      await boot()
    } catch (e) {
      showLogin(e.message)
    }
  }
}

function rail(view) {
  const item = (id, label, ic) => `<button class="nav ${view === id ? "active" : ""}" data-view="${id}">${icon(ic)}<span>${label}</span></button>`
  return `<aside class="rail">
    <img class="rail-logo" src="/assets/s2p-pitch-mark.svg" alt="">
    ${item("overview", "Home", "home")}
    ${item("users", "Users", "users")}
    ${item("countries", "Map", "globe")}
    ${item("boards", "Boards", "board")}
    <div class="rail-spacer"></div>
    <button class="nav rail-out" id="signout">${icon("out")}<span>Sign out</span></button>
  </aside>`
}

function topbar(title, subtitle) {
  const email = state.data?.user?.email || "Admin"
  const name = email.split("@")[0]
  return `<header class="top">
    <div>
      <div class="crumb">${esc(title)}</div>
      <h1>${greet()}, ${esc(name)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
    <div class="top-actions">
      <button class="btn" id="refresh">Refresh</button>
      <div class="who"><span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span>${esc(email)}</div>
    </div>
  </header>`
}

function kpis() {
  const d = state.data || {}
  return `<section class="kpis">
    <div class="kpi"><small>Users</small><b>${d.users || visitors().length || 0}</b><em>Signed in</em></div>
    <div class="kpi"><small>Countries</small><b>${d.countries || countries().length || 0}</b><em>Live origin</em></div>
    <div class="kpi"><small>Online now</small><b>${d.online || 0}</b><em>Last 2 minutes</em></div>
    <div class="kpi"><small>Avg time</small><b>${fmtMins(d.avgSession || 0)}</b><em>${d.logins || 0} logins</em></div>
  </section>`
}

function userRow(v, compact = false) {
  const on = selected()?.id === v.id
  return `<div class="user-row ${on ? "on" : ""}" data-id="${esc(v.id)}">
    <div class="mini" style="background:${pal(v.id, v.online)}"><b>${esc(v.country || "S2P")}</b><small>${esc((v.name || "user").slice(0, 10))}</small></div>
    <div><strong>${esc(v.name || v.email || "User")}</strong><span class="mail">${esc(v.email || "")}</span></div>
    ${compact ? "" : `<div class="num">${flag(v.country)}${esc(v.countryName || v.country || "—")}</div>
    <div class="num">${v.loginCount || 0} logins · ${fmtMins(v.avgSessionSeconds)}</div>`}
    <div>${status(v)}</div>
  </div>`
}

function bars() {
  const rows = countries()
  const max = Math.max(1, ...rows.map(r => r.count))
  if (!rows.length) return `<p class="empty">Countries appear after users open the public boards.</p>`
  return `<div class="bars">${rows.slice(0, 8).map(r => `<div class="bar"><span>${flag(r.code)}${esc(r.code)}</span><div class="track"><i style="width:${Math.max(8, (r.count / max) * 100)}%"></i></div><b>${r.count}</b></div>`).join("")}</div>`
}

function detail(v) {
  if (!v) return `<div class="card detail"><h2>User details</h2><p class="empty">Select a user.</p></div>`
  return `<div class="card detail">
    <h2>User details</h2>
    <p class="sub">${esc(v.email || "")}</p>
    <div class="mini" style="width:100%;height:92px;background:${pal(v.id, v.online)};padding:12px 14px">
      <b style="font-size:13px">STATS2PITCH</b>
      <div style="font-size:18px;font-weight:800;letter-spacing:.08em">${esc(v.country || "—")} · ${(v.loginCount || 0)} LOGINS</div>
      <small>${esc(v.name || "")}</small>
    </div>
    <div class="hero">${status(v)}</div>
    <dt>Country</dt><dd>${flag(v.country)}${esc(v.countryName || v.country || "Unknown")}${v.city ? " · " + esc(v.city) : ""}</dd>
    <dt>Logins</dt><dd>${v.loginCount || 0}</dd>
    <dt>Average time on site</dt><dd>${fmtMins(v.avgSessionSeconds)}</dd>
    <dt>Device</dt><dd>${esc(v.device || "—")}</dd>
    <dt>Last path</dt><dd>${esc(v.lastPath || "/")}</dd>
    <dt>Last seen</dt><dd>${v.lastSeenAt ? esc(new Date(v.lastSeenAt).toLocaleString()) : "Not yet"}</dd>
  </div>`
}

function overview() {
  const list = visitors().slice(0, 7)
  return `${topbar("Overview", "Live visitors, countries, and time on Stats2Pitch.")}
    ${kpis()}
    <section class="grid-2">
      <div class="card">
        <h2>Live users</h2>
        <p class="sub">Newest activity first</p>
        ${list.length ? list.map(v => userRow(v, true)).join("") : `<p class="empty">No signed-in users yet.</p>`}
      </div>
      <div class="card">
        <h2>Users by country</h2>
        <p class="sub">Where people open the boards</p>
        ${bars()}
      </div>
    </section>
    <section class="grid-map">
      <div class="card">
        <h2>Global users</h2>
        <p class="sub">Pins are live visitor countries</p>
        <div id="map"></div>
      </div>
      ${detail(selected())}
    </section>`
}

function usersView() {
  const list = filtered()
  return `${topbar("Users", "Country, login count, average time, and online status.")}
    ${kpis()}
    <section class="users-layout">
      <div class="card">
        <h2>Your users</h2>
        <p class="sub">Tap a row for full details</p>
        <input class="search" id="userSearch" type="search" placeholder="Search email, country, city…" value="${esc(state.query)}">
        ${list.length ? list.map(v => userRow(v)).join("") : `<p class="empty">No matching users.</p>`}
      </div>
      ${detail(selected())}
    </section>`
}

function countriesView() {
  const rows = countries()
  return `${topbar("Map", "Every country your users are coming from.")}
    ${kpis()}
    <div class="card" style="margin-bottom:12px">
      <h2>Global users</h2>
      <p class="sub">Click a pin for the user count</p>
      <div id="mapFull"></div>
    </div>
    <div class="card">
      <div class="board-row table-head"><b>Country</b><b>Users</b><b>Online</b><b>Avg time</b><b></b></div>
      ${rows.length ? rows.map(r => `<div class="board-row"><strong>${flag(r.code)}${esc(r.name)}</strong><span>${r.count}</span><span>${r.online}</span><span>${fmtMins(r.count ? r.seconds / r.count : 0)}</span><span></span></div>`).join("") : `<p class="empty">No country data yet. Open the public site while signed in.</p>`}
    </div>`
}

function boardsView() {
  const d = state.data || {}
  const s = d.performance?.summary || {}
  const picks = d.latestPicks || []
  const learning = d.learning || []
  return `${topbar("Boards", "Picks engine, data health, and refresh.")}
    <section class="kpis">
      <div class="kpi"><small>Saved boards</small><b>${d.snapshots || 0}</b></div>
      <div class="kpi"><small>30-day picks</small><b>${s.picks || 0}</b></div>
      <div class="kpi"><small>Settled wins</small><b>${s.won || 0}</b></div>
      <div class="kpi"><small>Success rate</small><b>${Number(s.winRate || 0).toFixed(1)}%</b></div>
    </section>
    <section class="kpis">
      <div class="kpi"><small>Football data</small><b>${d.health?.footballData ? "OK" : "OFF"}</b></div>
      <div class="kpi"><small>Source fixtures</small><b>${d.health?.sourceFixtures || 0}</b></div>
      <div class="kpi"><small>Analyzed</small><b>${d.health?.analyzedFixtures || 0}</b></div>
      <div class="kpi"><small>Verified</small><b>${d.health?.statsVerifiedFixtures || 0}</b></div>
    </section>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div><h2>Board refresh</h2><p class="sub" id="adminStatus">Run a new snapshot when the slate looks stale.</p></div>
        <button class="btn btn-mint" id="runRefresh">Run board refresh</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <h2>Latest picks</h2>
      <div class="board-row table-head"><b>Match / Pick</b><b>Home %</b><b>Away %</b><b>Odds</b><b>Banker</b></div>
      ${picks.length ? picks.map(p => `<div class="board-row"><strong>${esc(p.home)} vs ${esc(p.away)} · ${esc(p.displaySelection || p.selection)}</strong><span>${p.homeConsensus}%</span><span>${p.awayConsensus}%</span><span>${Number(p.odds).toFixed(2)}</span><span>${p.bankerApproved ? "Yes" : "No"}</span></div>`).join("") : `<p class="empty">No picks on the latest board.</p>`}
    </div>
    <div class="card">
      <h2>Learning profiles</h2>
      <div class="board-row table-head"><b>Profile</b><b>Sample</b><b>Win %</b><b>Gate</b><b>Status</b></div>
      ${learning.length ? learning.slice(0, 20).map(r => `<div class="board-row"><strong>${esc(r.label || `${r.country || ""} · ${r.league || ""} · ${String(r.market || "").replaceAll("-", " ")}`)}</strong><span>${r.sample}</span><span>${Number(r.winRate).toFixed(1)}%</span><span>${esc(r.action || r.gate || "")}</span><span>${r.ready ? "Active" : "Learning"}</span></div>`).join("") : `<p class="empty">No learning profiles yet.</p>`}
    </div>`
}

function mountMap(id) {
  if (!window.L) return
  const el = document.getElementById(id)
  if (!el) return
  if (state.map) { try { state.map.remove() } catch {} state.map = null }
  const map = window.L.map(id, { attributionControl: false, worldCopyJump: true, zoomControl: true }).setView([6, 12], 3)
  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 7 }).addTo(map)
  const pts = []
  for (const row of countries()) {
    const pos = GEO[row.code]
    if (!pos) continue
    pts.push(pos)
    window.L.circleMarker(pos, {
      radius: Math.min(16, 6 + row.count),
      color: "#3ddc84",
      fillColor: "#3ddc84",
      fillOpacity: 0.85,
      weight: 2
    }).addTo(map).bindPopup(`${esc(row.name)} · ${row.count} user${row.count === 1 ? "" : "s"}${row.online ? ` · ${row.online} online` : ""}`)
  }
  if (pts.length) map.fitBounds(pts, { padding: [36, 36], maxZoom: 4 })
  state.map = map
  requestAnimationFrame(() => map.invalidateSize())
}

function bind() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => { state.view = btn.dataset.view; render() }
  })
  $("#signout")?.addEventListener("click", logout)
  $("#refresh")?.addEventListener("click", () => load(true))
  $("#runRefresh")?.addEventListener("click", async () => {
    const b = $("#runRefresh"), s = $("#adminStatus")
    if (b) { b.disabled = true; b.textContent = "Requesting…" }
    try {
      const r = await edge(apiUrl("/admin/refresh"), { method: "POST", body: "{}" })
      if (s) s.textContent = r.message || "Refresh requested."
    } catch (e) {
      if (s) s.textContent = e.message
    } finally {
      if (b) { b.disabled = false; b.textContent = "Run board refresh" }
    }
  })
  document.querySelectorAll(".user-row[data-id]").forEach(row => {
    row.onclick = () => { state.selected = row.dataset.id; render() }
  })
  const box = $("#userSearch")
  if (box) {
    box.oninput = () => { state.query = box.value; render() }
    const end = box.value.length
    box.focus()
    box.setSelectionRange(end, end)
  }
}

function render() {
  const view = state.view
  const body = view === "users" ? usersView() : view === "countries" ? countriesView() : view === "boards" ? boardsView() : overview()
  $("#app").innerHTML = `<div class="shell">${rail(view)}<main class="main">${body}</main></div>`
  bind()
  if (view === "overview") mountMap("map")
  if (view === "countries") mountMap("mapFull")
}

async function load(force) {
  if (!force && document.activeElement && document.activeElement.id === "userSearch") return
  const d = await edge(apiUrl("/admin/overview"))
  state.data = d
  if (!state.selected && d.visitors?.[0]) state.selected = d.visitors[0].id
  render()
}

async function boot() {
  try {
    await load(true)
    clearInterval(state.timer)
    state.timer = setInterval(() => load(false), 20000)
  } catch (e) {
    showLogin(e.message === "Admin access required" ? "This account does not have admin access." : e.message)
  }
}

if (!base || !anon) showLogin("Admin service is not configured.")
else if (!token()) showLogin()
else boot()
