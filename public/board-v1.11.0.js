/* Stats2Pitch v1.11.0 — neon card-board replacement.
 * This layer renders a new user-facing board from the existing board API while
 * preserving the legacy DOM underneath for mature controls and detail modals.
 */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const FAV_KEY='s2p_saved_picks_v111'
  const KICKOFF_GRACE_MS=15*60*1000
  let board=null
  let active='best'
  let timer=0
  let sheet=null

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const rowKey=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const favs=()=>{try{return new Set(JSON.parse(localStorage.getItem(FAV_KEY)||'[]'))}catch{return new Set()}}
  const saveFavs=s=>localStorage.setItem(FAV_KEY,JSON.stringify([...s]))

  function effectiveGroup(row,now=Date.now()){
    const g=String(row?.statusGroup||'pending').toLowerCase()
    if(['live','settled','postponed','pending'].includes(g))return g
    if(g==='upcoming'){
      const ms=new Date(row?.kickoff||'').getTime()
      if(Number.isFinite(ms)&&now>ms+KICKOFF_GRACE_MS)return'pending'
      return'upcoming'
    }
    return'pending'
  }
  function statusLabel(row){
    const g=effectiveGroup(row)
    if(g==='live')return `LIVE${Number.isFinite(Number(row?.elapsed))?` ${Number(row.elapsed)}′`:''}`
    if(g==='settled')return row?.statusShort||'FT'
    if(g==='postponed')return row?.statusShort==='CANC'?'Cancelled':'Postponed'
    if(g==='pending')return'Awaiting status'
    return'Upcoming'
  }
  function kickoff(row){
    const d=new Date(row?.kickoff||'')
    if(Number.isNaN(d.getTime()))return String(row?.kickoffLocal||'')
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)
  }
  function prediction(row){
    if(row?.selectionLabel)return String(row.selectionLabel).replace(/(.+)(\1)$/,'$1')
    if(row?.market==='1X2')return `${row.selectedTeam} win`
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return `${row.selectedTeam} ${row?.downgradeMarket||''}`.trim()
    return ({'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}[row?.market]||row?.selectedTeam||'Prediction')
  }
  function splitTeams(row){
    const names=String(row?.match||'').split(/\s+vs\s+/i)
    return{home:names[0]||row?.selectedTeam||'Home',away:names[1]||row?.opponentTeam||'Away'}
  }
  function teamLogo(row,name){
    if(String(row?.selectedTeam||'')===String(name)&&row?.selectedTeamLogo)return row.selectedTeamLogo
    if(String(row?.opponentTeam||'')===String(name)&&row?.opponentTeamLogo)return row.opponentTeamLogo
    return''
  }
  function initials(name){return String(name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase()}
  function uniqueBest(rows){
    const out=new Map()
    for(const r of rows||[]){
      const k=String(r?.fixtureId||rowKey(r))
      if(!out.has(k))out.set(k,r)
    }
    return [...out.values()]
  }
  function rowsForMode(){
    const best=Array.isArray(board?.bestPicks)&&board.bestPicks.length?board.bestPicks:uniqueBest(allRows(board))
    if(active==='upcoming')return best.filter(r=>effectiveGroup(r)==='upcoming')
    if(active==='live')return best.filter(r=>effectiveGroup(r)==='live')
    if(active==='three')return uniqueBest(board?.groups?.threePlus||[])
    if(active==='saved'){
      const saved=favs();return best.filter(r=>saved.has(rowKey(r)))
    }
    return best
  }
  function card(row){
    const teams=splitTeams(row),homeLogo=teamLogo(row,teams.home),awayLogo=teamLogo(row,teams.away),key=rowKey(row),saved=favs().has(key),group=effectiveGroup(row),status=statusLabel(row),odd=Number.isFinite(Number(row?.odds))?Number(row.odds).toFixed(2):'—'
    const flag=row?.countryFlag?`<img src="${esc(row.countryFlag)}" alt="" loading="lazy">`:''
    const leagueLogo=row?.leagueLogo?`<img class="league-badge" src="${esc(row.leagueLogo)}" alt="" loading="lazy">`:''
    const homeBadge=homeLogo?`<img src="${esc(homeLogo)}" alt="" loading="lazy">`:`<span class="s2p-team-fallback">${esc(initials(teams.home))}</span>`
    const awayBadge=awayLogo?`<img src="${esc(awayLogo)}" alt="" loading="lazy">`:`<span class="s2p-team-fallback">${esc(initials(teams.away))}</span>`
    return `<article class="s2p-match-card" data-card-key="${esc(key)}">
      <div class="s2p-card-main">
        <div class="s2p-competition">${flag}${leagueLogo}<strong>${esc(row?.league||'Competition')}</strong>${row?.country?`<small>· ${esc(row.country)}</small>`:''}</div>
        <div class="s2p-team-stack">
          <div class="s2p-team-row">${homeBadge}<strong>${esc(teams.home)}</strong></div>
          <div class="s2p-vs">VS</div>
          <div class="s2p-team-row">${awayBadge}<strong>${esc(teams.away)}</strong></div>
        </div>
        <div class="s2p-prediction"><span class="check">✓</span>${esc(prediction(row))}</div>
      </div>
      <div class="s2p-card-side">
        <div class="s2p-kickoff ${esc(group)}"><b>${esc(kickoff(row))}</b>${esc(status)}</div>
        <div class="s2p-odd-wrap"><div class="s2p-odd-pill">${esc(odd)}</div><button class="s2p-save ${saved?'saved':''}" type="button" data-save-key="${esc(key)}" aria-label="${saved?'Remove saved pick':'Save pick'}">${saved?'★':'☆'}</button></div>
        <button class="s2p-view-details" type="button" data-detail-key="${esc(key)}">View details ›</button>
      </div>
    </article>`
  }
  function counts(){
    const best=Array.isArray(board?.bestPicks)?board.bestPicks:uniqueBest(allRows(board))
    return{best:best.length,upcoming:best.filter(r=>effectiveGroup(r)==='upcoming').length,live:best.filter(r=>effectiveGroup(r)==='live').length,three:uniqueBest(board?.groups?.threePlus||[]).length}
  }
  function titleForMode(){return active==='upcoming'?'Upcoming predictions':active==='live'?'Live predictions':active==='three'?'3+ filter picks':active==='saved'?'My saved picks':'Best picks'}
  function build(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return null
    let host=document.getElementById('s2p-card-board')
    if(!host){host=document.createElement('section');host.id='s2p-card-board';shell.prepend(host)}
    return host
  }
  function render(){
    const host=build();if(!host||!board)return
    const c=counts(),rows=rowsForMode()
    host.innerHTML=`
      <header class="s2p-new-head">
        <button id="s2p-menu" class="s2p-icon-btn" type="button" aria-label="Open filters">☰</button>
        <div class="s2p-brand-center"><img class="s2p-brand-lockup" src="/assets/brand-wordmark.png" alt="Stats2Pitch"><p>Prediction Board</p></div>
        <button id="s2p-head-alert" class="s2p-icon-btn s2p-head-alert" type="button" aria-label="Show live matches">♧</button>
      </header>
      <nav class="s2p-main-tabs" aria-label="Prediction board views">
        <button class="s2p-main-tab ${active==='best'?'active':''}" data-view="best" type="button">★ <span>Best Picks</span><b class="count">${c.best}</b></button>
        <button class="s2p-main-tab ${active==='upcoming'?'active':''}" data-view="upcoming" type="button">◷ <span>Upcoming</span><b class="count">${c.upcoming}</b></button>
        <button class="s2p-main-tab ${active==='live'?'active':''}" data-view="live" type="button">◉ <span>Live</span><b class="count">${c.live}</b></button>
        <button class="s2p-main-tab ${active==='three'?'active':''}" data-view="three" type="button">⌁ <span>3+ Filters</span><b class="count">${c.three}</b></button>
      </nav>
      <div class="s2p-board-tools"><div><h2>${esc(titleForMode())}</h2><span>${rows.length} ${rows.length===1?'selection':'selections'}</span></div><button id="s2p-mini-refresh" class="s2p-mini-refresh" type="button">↻ Refresh</button></div>
      <div class="s2p-card-list">${rows.length?rows.map(card).join(''):`<div class="s2p-empty"><strong>No matches here right now.</strong><span>Try another tab or refresh real data.</span></div>`}</div>
      <nav class="s2p-mobile-nav" aria-label="Stats2Pitch navigation">
        <button class="s2p-nav-btn ${active!=='saved'?'active':''}" data-nav="board" type="button"><span class="ico">▣</span><span>Board</span></button>
        <button class="s2p-nav-btn ${active==='saved'?'active':''}" data-nav="saved" type="button"><span class="ico">★</span><span>My Picks</span></button>
        <button class="s2p-nav-btn" data-nav="stats" type="button"><span class="ico">▥</span><span>Stats</span></button>
        <button class="s2p-nav-btn" data-nav="alerts" type="button"><span class="ico">♧</span><span>Alerts</span></button>
        <button class="s2p-nav-btn" data-nav="profile" type="button"><span class="ico">◯</span><span>Profile</span></button>
      </nav>
      <aside id="s2p-sheet" class="s2p-sheet" aria-live="polite"></aside>`
    bind()
  }
  function sourceButton(key){
    try{return document.querySelector(`[data-row-key="${CSS.escape(key)}"]`)}catch{return null}
  }
  function closeSheet(){if(sheet){sheet.classList.remove('open');sheet.innerHTML=''}}
  function openStats(){
    sheet=document.getElementById('s2p-sheet');if(!sheet)return
    const m=board?.meta||{},rows=allRows(board),live=rows.filter(r=>effectiveGroup(r)==='live').length,settled=rows.filter(r=>effectiveGroup(r)==='settled').length
    sheet.innerHTML=`<h3>Board stats</h3><p>Current board snapshot for ${esc(selectedDate())}.</p><div class="s2p-sheet-grid"><div class="s2p-sheet-stat"><span>Matches checked</span><strong>${esc(m.sourceFixtures??m.fixturesScanned??0)}</strong></div><div class="s2p-sheet-stat"><span>Qualified picks</span><strong>${esc(m.qualified??rows.length)}</strong></div><div class="s2p-sheet-stat"><span>Live</span><strong>${live}</strong></div><div class="s2p-sheet-stat"><span>Settled</span><strong>${settled}</strong></div></div><div class="s2p-sheet-actions"><button type="button" data-sheet-close>Close</button></div>`
    sheet.classList.add('open');sheet.querySelector('[data-sheet-close]')?.addEventListener('click',closeSheet)
  }
  function openProfile(){
    sheet=document.getElementById('s2p-sheet');if(!sheet)return
    const email=document.querySelector('#profile-menu span')?.textContent?.trim()||'Signed in'
    sheet.innerHTML=`<h3>Profile</h3><p>${esc(email)}</p><div class="s2p-sheet-actions"><button type="button" data-sheet-close>Close</button><button type="button" data-signout>Sign out</button></div>`
    sheet.classList.add('open');sheet.querySelector('[data-sheet-close]')?.addEventListener('click',closeSheet);sheet.querySelector('[data-signout]')?.addEventListener('click',()=>document.getElementById('signout')?.click())
  }
  function toggleControls(force){
    const next=force!==undefined?force:!document.documentElement.classList.contains('s2p-v111-controls-open')
    document.documentElement.classList.toggle('s2p-v111-controls-open',next)
  }
  function toggleFav(key){const s=favs();s.has(key)?s.delete(key):s.add(key);saveFavs(s);render()}
  function bind(){
    document.getElementById('s2p-menu')?.addEventListener('click',()=>toggleControls())
    document.getElementById('s2p-head-alert')?.addEventListener('click',()=>{active='live';render()})
    document.getElementById('s2p-mini-refresh')?.addEventListener('click',()=>document.getElementById('refresh')?.click())
    document.querySelectorAll('#s2p-card-board [data-view]').forEach(btn=>btn.addEventListener('click',()=>{active=btn.dataset.view;render()}))
    document.querySelectorAll('#s2p-card-board [data-save-key]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();toggleFav(btn.dataset.saveKey)}))
    document.querySelectorAll('#s2p-card-board [data-detail-key]').forEach(btn=>btn.addEventListener('click',()=>sourceButton(btn.dataset.detailKey)?.click()))
    document.querySelectorAll('#s2p-card-board [data-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      const n=btn.dataset.nav
      if(n==='board'){active='best';render();window.scrollTo({top:0,behavior:'smooth'})}
      else if(n==='saved'){active='saved';render();window.scrollTo({top:0,behavior:'smooth'})}
      else if(n==='stats')openStats()
      else if(n==='alerts'){active='live';render();window.scrollTo({top:0,behavior:'smooth'})}
      else if(n==='profile')openProfile()
    }))
  }
  async function load(){
    const t=token();if(!t)return null
    try{const r=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)return null;board=await r.json();return board}catch{return null}
  }
  async function boot(){
    if(!document.querySelector('.app-shell')||!token())return
    document.documentElement.classList.add('s2p-v111')
    await load();render()
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,220)}

  document.addEventListener('click',event=>{
    if(document.documentElement.classList.contains('s2p-v111-controls-open')&&!event.target.closest('.controls')&&!event.target.closest('#s2p-menu'))toggleControls(false)
  },true)
  document.addEventListener('change',event=>{if(['date','market','minf','sort','primary-rule','s2p-status'].includes(event.target?.id))schedule()},true)
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  window.addEventListener('s2p:tabchange',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
  setInterval(()=>{if(board&&document.getElementById('s2p-card-board'))render()},30*1000)
})()
