const $=q=>document.querySelector(q),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]))
const cfg=window.__STATS2PITCH_CONFIG__||{},base=String(cfg.supabaseUrl||'').replace(/\/+$/,''),anon=String(cfg.supabaseAnonKey||''),apiFn=String(cfg.functionName||'stats2pitch-api')
const token=()=>localStorage.getItem('s2p_admin_access_token')||''
function apiUrl(path){return`${base}/functions/v1/${apiFn}${path}`}
function authUrl(path){return`${base}/functions/v1/stats2pitch-auth${path}`}
async function edge(url,opts={}){const headers={apikey:anon,...(opts.headers||{})};if(token())headers.Authorization=`Bearer ${token()}`;if(opts.body&&!headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(url,{...opts,headers,cache:'no-store'}),b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||'Request failed');return b}
async function login(email,password){const b=await edge(authUrl('/login'),{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem('s2p_admin_access_token',b.access_token||'');localStorage.setItem('s2p_admin_refresh_token',b.refresh_token||'');return b}
function showLogin(message=''){document.body.innerHTML=`<div class="admin-shell"><div class="admin-login admin-card"><img class="brand-img" src="/assets/stats2pitch-logo-v2.png" alt="Stats2Pitch"><h2>Admin</h2>${message?`<p>${esc(message)}</p>`:''}<label>Email<input id="adminEmail" type="email" autocomplete="username" value="stats2pitch@gmail.com"></label><label>Password<input id="adminPassword" type="password" autocomplete="current-password"></label><button id="adminLogin">Sign in</button></div></div>`;$('#adminLogin').onclick=async()=>{const btn=$('#adminLogin');btn.disabled=true;btn.textContent='Signing in…';try{await login($('#adminEmail').value,$('#adminPassword').value);location.reload()}catch(e){showLogin(e.message)} }}
function fmtMins(sec){const n=Math.max(0,Number(sec)||0);if(n<60)return`${n}s`;const m=Math.round(n/60);if(m<60)return`${m}m`;const h=Math.floor(m/60),r=m%60;return r?`${h}h ${r}m`:`${h}h`}
function flag(code){const c=String(code||'').toLowerCase();if(!/^[a-z]{2}$/.test(c))return'';return`<img class="s2p-flag" src="https://flagcdn.com/24x18/${c}.png" alt="" width="20" height="14">`}
function statusCell(v){return v.online?`<span class="s2p-online"><i class="s2p-dot"></i>Online</span>`:`<span class="s2p-offline">Offline</span>`}
function visitorRows(rows,q=''){const needle=q.trim().toLowerCase();const list=(rows||[]).filter(v=>{if(!needle)return true;return[v.email,v.name,v.country,v.countryName,v.city,v.device].join(' ').toLowerCase().includes(needle)});if(!list.length)return'<p>No signed-in users yet. They appear after someone opens the public boards.</p>';return list.map(v=>`<div class="admin-row s2p-user-row"><strong>${esc(v.name||v.email||'User')}<small>${esc(v.email||'')}</small></strong><span>${flag(v.country)}${esc(v.countryName||v.country||'—')}${v.city?` · ${esc(v.city)}`:''}</span><span>${v.loginCount||0}</span><span>${fmtMins(v.avgSessionSeconds)}</span><span>${statusCell(v)}</span></div>`).join('')}
function learningRows(rows){return(rows||[]).slice(0,20).map(r=>`<div class="admin-row"><strong>${esc(r.label||`${r.country||''} · ${r.league||''} · ${String(r.market||'').replaceAll('-',' ')}`)}</strong><span>${r.sample}</span><span>${Number(r.winRate).toFixed(1)}%</span><span>${esc(r.action||r.gate||'')}</span><span>${r.ready?'Active':'Learning'}</span></div>`).join('')||'<p>No learning profiles yet.</p>'}
async function render(){try{const d=await edge(apiUrl('/admin/overview'));const s=d.performance?.summary||{};const visitors=d.visitors||[];document.body.innerHTML=`<div class="admin-shell"><header><div class="brand-block"><img class="brand-img" src="/assets/stats2pitch-logo-v2.png" alt="Stats2Pitch"><small>Private Admin</small></div><div class="header-actions"><button id="runRefresh">Run board refresh</button><button id="adminLogout">Sign out</button></div></header>
<section class="admin-card">
  <h2>Live users</h2>
  <p class="s2p-lead">Country, logins, average time on site, and online status for everyone who signs in to Stats2Pitch.</p>
  <div class="admin-grid s2p-kpis">
    <div><small>Users</small><b>${d.users||visitors.length||0}</b></div>
    <div><small>Countries</small><b>${d.countries||0}</b></div>
    <div><small>Online now</small><b>${d.online||0}</b></div>
    <div><small>Avg session</small><b>${fmtMins(d.avgSession||0)}</b></div>
    <div><small>Logins</small><b>${d.logins||0}</b></div>
  </div>
  <input id="userSearch" class="s2p-search" type="search" placeholder="Search email, country, city…">
  <div class="admin-row s2p-user-row s2p-head"><b>User</b><b>Country</b><b>Logins</b><b>Avg time</b><b>Status</b></div>
  <div class="admin-table" id="userTable">${visitorRows(visitors)}</div>
</section>
<section class="admin-card"><h2>System overview</h2><div class="admin-grid"><div><small>Saved boards</small><b>${d.snapshots||0}</b></div><div><small>30-day picks</small><b>${s.picks||0}</b></div><div><small>Settled wins</small><b>${s.won||0}</b></div><div><small>Success rate</small><b>${Number(s.winRate||0).toFixed(1)}%</b></div></div></section>
<section class="admin-card"><h2>Data health</h2><div class="admin-grid"><div><small>Football data</small><b>${d.health?.footballData?'OK':'OFF'}</b></div><div><small>Source fixtures</small><b>${d.health?.sourceFixtures||0}</b></div><div><small>Analyzed</small><b>${d.health?.analyzedFixtures||0}</b></div><div><small>Verified fixtures</small><b>${d.health?.statsVerifiedFixtures||0}</b></div></div></section>
<section class="admin-card"><h2>Latest raw support</h2><div class="admin-row"><b>Match / Pick</b><b>Home %</b><b>Away %</b><b>Odds</b><b>Banker</b></div><div class="admin-table">${(d.latestPicks||[]).map(p=>`<div class="admin-row"><strong>${esc(p.home)} vs ${esc(p.away)} · ${esc(p.displaySelection||p.selection)}</strong><span>${p.homeConsensus}%</span><span>${p.awayConsensus}%</span><span>${Number(p.odds).toFixed(2)}</span><span>${p.bankerApproved?'Yes':'No'}</span></div>`).join('')||'<p>No picks on the latest board.</p>'}</div></section>
<section class="admin-card"><h2>Learning profiles</h2><div class="admin-row"><b>Profile</b><b>Sample</b><b>Win %</b><b>Gate</b><b>Status</b></div><div class="admin-table">${learningRows(d.learning)}</div></section>
<section class="admin-card"><h2>Latest board</h2><pre>${esc(JSON.stringify({date:d.latest?.snapshot_date,generatedAt:d.latest?.generated_at,picks:d.latest?.payload?.bestPicks?.length||0,resultSummary:d.latest?.payload?.resultSummary||{}},null,2))}</pre><p id="adminStatus"></p></section></div>`;
$('#adminLogout').onclick=()=>{localStorage.removeItem('s2p_admin_access_token');localStorage.removeItem('s2p_admin_refresh_token');location.reload()}
$('#runRefresh').onclick=async()=>{const b=$('#runRefresh'),s=$('#adminStatus');b.disabled=true;b.textContent='Requesting…';try{const r=await edge(apiUrl('/admin/refresh'),{method:'POST',body:'{}'});s.textContent=r.message||'Refresh requested.'}catch(e){s.textContent=e.message}finally{b.disabled=false;b.textContent='Run board refresh'}}
const box=$('#userSearch'),table=$('#userTable')
if(box&&table){box.oninput=()=>{table.innerHTML=visitorRows(visitors,box.value)}}
}catch(e){showLogin(e.message==='Admin access required'?'This account does not have admin access.':e.message)}}
if(!base||!anon)showLogin('Admin service is not configured.');else if(!token())showLogin();else render()
