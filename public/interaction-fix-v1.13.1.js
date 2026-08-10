/* Stats2Pitch UI v1.13.1 — modern-board interaction ownership.
 * Fixes View details and makes every mobile/desktop navigation action visible
 * without depending on hidden legacy board rows.
 */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const FAV_KEY='s2p_saved_picks_v111'
  let boardCache=null
  let boardCacheDate=''
  let boardCacheAt=0
  let detailTimer=0

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))
  const token=()=>{try{return localStorage.getItem(ACCESS_KEY)||''}catch{return''}}
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const rowKey=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const bestRows=b=>Array.isArray(b?.bestPicks)&&b.bestPicks.length?b.bestPicks:[...new Map(allRows(b).map(r=>[String(r?.fixtureId||rowKey(r)),r])).values()]
  const favs=()=>{try{return new Set(JSON.parse(localStorage.getItem(FAV_KEY)||'[]'))}catch{return new Set()}}
  const saveFavs=s=>{try{localStorage.setItem(FAV_KEY,JSON.stringify([...s]))}catch{}}
  const prediction=row=>{
    const raw=String(row?.selectionLabel||'').trim()
    if(raw)return raw
    if(row?.market==='1X2')return `${row.selectedTeam} win`
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return `${row.selectedTeam} ${row?.downgradeMarket||''}`.trim()
    return ({'GG':'GG — Both teams to score','BTTS':'GG — Both teams to score','O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}[row?.market]||row?.selectedTeam||'Prediction')
  }

  async function getBoard(force=false){
    const date=selectedDate(),t=token()
    if(!t)return null
    if(!force&&boardCache&&boardCacheDate===date&&Date.now()-boardCacheAt<12000)return boardCache
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000)
    try{
      const r=await fetch(`/api/board?date=${encodeURIComponent(date)}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store',signal:controller.signal})
      if(!r.ok)return null
      const data=await r.json()
      if(data&&typeof data==='object'){boardCache=data;boardCacheDate=date;boardCacheAt=Date.now();return data}
      return null
    }catch{return null}
    finally{clearTimeout(timeout)}
  }

  function ensureSheet(){
    const host=document.getElementById('s2p-card-board')
    if(!host)return null
    let sheet=host.querySelector('#s2p-sheet')
    if(!sheet){sheet=document.createElement('aside');sheet.id='s2p-sheet';sheet.className='s2p-sheet';sheet.setAttribute('aria-live','polite');host.appendChild(sheet)}
    return sheet
  }
  function closeSheet(){const sheet=document.getElementById('s2p-sheet');if(sheet){sheet.classList.remove('open');sheet.innerHTML=''}document.querySelectorAll('.s2p-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav==='board'))}
  function openSheet(title,body){
    const sheet=ensureSheet();if(!sheet)return null
    sheet.innerHTML=`<div class="s2p-interaction-sheet-head"><h3>${esc(title)}</h3><button type="button" data-s2p-sheet-close aria-label="Close">×</button></div>${body}`
    sheet.classList.add('open')
    sheet.querySelector('[data-s2p-sheet-close]')?.addEventListener('click',closeSheet)
    return sheet
  }
  function activateNav(name){document.querySelectorAll('.s2p-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===name))}

  function openDetails(key){
    if(!key)return
    // ui.v1.7.0 already owns the rich Why-this-pick modal. Feed it a proxy
    // data-row-key directly instead of trying to click a hidden legacy row.
    const proxy=document.createElement('button')
    proxy.type='button';proxy.hidden=true;proxy.dataset.rowKey=key
    document.body.appendChild(proxy)
    proxy.click()
    setTimeout(()=>proxy.remove(),1500)
    decorateDetailsWhenReady(key)
  }

  function decorateDetailsWhenReady(key){
    clearInterval(detailTimer)
    let tries=0
    detailTimer=setInterval(()=>{
      const modal=document.querySelector('.modal-backdrop.s2p17-modal')
      if(!modal){if(++tries>60)clearInterval(detailTimer);return}
      clearInterval(detailTimer)
      if(modal.dataset.s2pInteractionReady==='1')return
      modal.dataset.s2pInteractionReady='1'
      const summary=modal.querySelector('.detail-summary')
      if(!summary)return
      const actions=document.createElement('div')
      actions.className='s2p-detail-actions'
      const button=document.createElement('button')
      button.type='button';button.className='s2p-detail-save'
      const sync=()=>{const saved=favs().has(key);button.textContent=saved?'★ Saved to My Picks':'☆ Save to My Picks';button.classList.toggle('saved',saved)}
      button.addEventListener('click',()=>{const s=favs();s.has(key)?s.delete(key):s.add(key);saveFavs(s);sync()})
      sync();actions.appendChild(button);summary.appendChild(actions)
    },80)
  }

  async function openSaved(){
    activateNav('saved')
    const sheet=openSheet('My Picks','<p class="s2p-sheet-loading">Loading your saved picks…</p>')
    if(!sheet)return
    const saved=favs(),data=await getBoard(false),rows=data?bestRows(data).filter(r=>saved.has(rowKey(r))):[]
    if(!sheet.classList.contains('open'))return
    if(!saved.size){sheet.innerHTML=sheet.innerHTML.replace('<p class="s2p-sheet-loading">Loading your saved picks…</p>','<div class="s2p-saved-empty"><strong>No saved picks yet.</strong><span>Open any match with View details and choose “Save to My Picks”.</span></div>');return}
    const html=rows.length?`<div class="s2p-saved-list">${rows.map(r=>`<button type="button" class="s2p-saved-row" data-saved-detail="${esc(rowKey(r))}"><span><strong>${esc(r.match||'Match')}</strong><small>${esc(prediction(r))}</small></span><b>${Number.isFinite(Number(r.odds))?Number(r.odds).toFixed(2):'—'}</b></button>`).join('')}</div>`:'<div class="s2p-saved-empty"><strong>Saved picks are reconnecting.</strong><span>Your saved list is safe and will appear when the board finishes syncing.</span></div>'
    sheet.innerHTML=sheet.innerHTML.replace('<p class="s2p-sheet-loading">Loading your saved picks…</p>',html)
    sheet.querySelectorAll('[data-saved-detail]').forEach(btn=>btn.addEventListener('click',()=>openDetails(btn.dataset.savedDetail)))
  }

  function openStats(){
    activateNav('stats')
    const value=view=>document.querySelector(`.s2p-main-tab[data-view="${view}"] .count`)?.textContent?.trim()||'0'
    openSheet('Board Stats',`<p>Current prediction-board snapshot.</p><div class="s2p-sheet-grid"><div class="s2p-sheet-stat"><span>Best Picks</span><strong>${esc(value('best'))}</strong></div><div class="s2p-sheet-stat"><span>Upcoming</span><strong>${esc(value('upcoming'))}</strong></div><div class="s2p-sheet-stat"><span>Live</span><strong>${esc(value('live'))}</strong></div><div class="s2p-sheet-stat"><span>3+ Filters</span><strong>${esc(value('three'))}</strong></div></div>`)
  }

  function openProfile(){
    activateNav('profile')
    const email=document.querySelector('#profile-menu span')?.textContent?.trim()||'Signed in to Stats2Pitch'
    const sheet=openSheet('Profile',`<p>${esc(email)}</p><div class="s2p-sheet-actions"><button type="button" data-s2p-signout>Sign out</button></div>`)
    sheet?.querySelector('[data-s2p-signout]')?.addEventListener('click',()=>document.getElementById('signout')?.click())
  }

  function goToView(view){
    closeSheet()
    const tab=document.querySelector(`.s2p-main-tab[data-view="${view}"]`)
    if(tab){tab.click();window.scrollTo({top:0,behavior:'smooth'})}
  }

  document.addEventListener('click',event=>{
    const details=event.target.closest?.('#s2p-card-board [data-detail-key]')
    if(details){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()
      openDetails(details.dataset.detailKey)
      return
    }
    const nav=event.target.closest?.('#s2p-card-board [data-nav]')
    if(!nav)return
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()
    const name=nav.dataset.nav
    if(name==='board')goToView('best')
    else if(name==='saved')openSaved()
    else if(name==='stats')openStats()
    else if(name==='alerts')goToView('live')
    else if(name==='profile')openProfile()
  },true)

  document.addEventListener('change',event=>{if(event.target?.id==='date'){boardCache=null;boardCacheDate='';boardCacheAt=0}},true)
})()
