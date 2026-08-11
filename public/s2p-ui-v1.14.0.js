/* Stats2Pitch v1.14.0 — UI layer (deferred, runs after the app module).
 * Consolidated bundle. Segments run in the order listed below, exactly as they
 * did when they were separate files. Each segment is isolated in try/catch so a
 * failure in one cannot stop the rest.
 *
 *    1. board-loading-surface-v1.13.0.js
 *    2. ui.v1.6.0.js
 *    3. ui.v1.7.0.js
 *    4. odds-ui.v1.7.2.js
 *    5. ui.v1.7.3.js
 *    6. ui.v1.7.6.js
 *    7. ui.v1.7.8.js
 *    8. ui.v1.7.9.js
 *    9. ui.v1.8.0.js
 *   10. ui.v1.10.0.js
 *   11. status-clock.v1.10.2.js
 *   12. refresh-resilience.v1.10.1.js
 *   13. status-selection-fix.v1.10.4.js
 *   14. board-runtime-v1.11.6.js
 *   15. board-responsive-v1.11.2.js
 *   16. live-scores-v1.11.3.js
 */
'use strict';

/* ===================================================================
 * segment: board-loading-surface-v1.13.0.js
 * =================================================================== */
try{
/* Stats2Pitch UI v1.13.0 — visible modern board surface while real data loads.
 * This layer never owns auth or creates .app-shell. It only ensures that once the
 * base app has rendered the authenticated shell, users immediately see the
 * current board chrome instead of a blank page while /api/board is still pending.
 */
(()=>{
  'use strict'
  const root=document.getElementById('root')
  if(!root)return
  let timer=0

  const token=()=>{try{return localStorage.getItem('s2p_access_token')||''}catch{return''}}
  const authVisible=()=>Boolean(document.querySelector('.auth-page'))
  const shell=()=>document.querySelector('.app-shell')
  const host=()=>document.getElementById('s2p-card-board')

  function loadingMarkup(){
    return `
      <header class="s2p-new-head">
        <button id="s2p-menu" class="s2p-icon-btn" type="button" aria-label="Open filters">☰</button>
        <div class="s2p-brand-center"><img class="s2p-brand-lockup" src="/assets/brand-wordmark.png" alt="Stats2Pitch"><p>Prediction Board</p></div>
        <button class="s2p-icon-btn s2p-head-alert" type="button" aria-label="Live scores">♧</button>
      </header>
      <nav class="s2p-main-tabs" aria-label="Prediction board views">
        <button class="s2p-main-tab active" type="button">★ <span>Best Picks</span><b class="count">—</b></button>
        <button class="s2p-main-tab" type="button">◷ <span>Upcoming</span><b class="count">—</b></button>
        <button class="s2p-main-tab" type="button">◉ <span>Live</span><b class="count">—</b></button>
        <button class="s2p-main-tab" type="button">⌁ <span>3+ Filters</span><b class="count">—</b></button>
      </nav>
      <div class="s2p-board-tools"><div><h2>Prediction Board</h2><span>Loading the latest saved matches…</span></div></div>
      <div class="s2p-card-list"><div class="s2p-empty"><strong>Loading matches…</strong><span>The latest board is connecting in the background.</span></div></div>
      <nav class="s2p-mobile-nav" aria-label="Stats2Pitch navigation">
        <button class="s2p-nav-btn active" type="button"><span class="ico">▣</span><span>Board</span></button>
        <button class="s2p-nav-btn" type="button"><span class="ico">★</span><span>My Picks</span></button>
        <button class="s2p-nav-btn" type="button"><span class="ico">▥</span><span>Stats</span></button>
        <button class="s2p-nav-btn" type="button"><span class="ico">♧</span><span>Alerts</span></button>
        <button class="s2p-nav-btn" type="button"><span class="ico">◯</span><span>Profile</span></button>
      </nav>`
  }

  function mount(){
    clearTimeout(timer)
    if(!token()||authVisible()||host())return false
    const app=shell()
    if(!app)return false
    const section=document.createElement('section')
    section.id='s2p-card-board'
    section.dataset.s2pState='loading'
    section.innerHTML=loadingMarkup()
    app.prepend(section)
    document.documentElement.classList.add('s2p-v111')
    // Wake the production board runtime regardless of script execution order.
    window.dispatchEvent(new Event('s2p:tabchange'))
    return true
  }

  function schedule(delay=40){
    clearTimeout(timer)
    timer=setTimeout(mount,delay)
  }

  const observer=new MutationObserver(()=>{
    if(authVisible()||host())return
    if(shell()&&token())schedule()
  })
  observer.observe(root,{childList:true,subtree:true})

  document.addEventListener('s2p:shell-ready',()=>schedule(0),{passive:true})
  window.addEventListener('pageshow',()=>schedule(0),{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(0),{once:true})
  else schedule(0)
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: board-loading-surface-v1.13.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.6.0.js
 * =================================================================== */
try{
(()=>{
  const logoSvg=`<svg viewBox="0 0 210 105" aria-hidden="true"><rect x="4" y="8" width="202" height="86" rx="2" fill="#020403" stroke="#f8faf7" stroke-width="4"/><path d="M105 8v86M4 51h33M173 51h33" stroke="#f8faf7" stroke-width="3"/><path d="M4 31h27v40H4M206 31h-27v40h27" fill="none" stroke="#f8faf7" stroke-width="3"/><circle cx="105" cy="51" r="28" fill="#020403" stroke="#f8faf7" stroke-width="4"/><text x="105" y="69" text-anchor="middle" font-size="51" font-family="Arial Black,Arial,sans-serif" font-weight="900" fill="#82e600">2</text><rect x="143" y="50" width="10" height="24" fill="#82e600"/><rect x="158" y="42" width="10" height="32" fill="#82e600"/><rect x="173" y="31" width="10" height="43" fill="#82e600"/><path d="M139 43l18-10 12 6 21-17" fill="none" stroke="#f8faf7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M185 22h7v7" fill="none" stroke="#f8faf7" stroke-width="4"/></svg>`
  const lockup=(compact=false)=>`<div class="s2p-brand-lockup">${logoSvg}<div class="s2p-wordmark">STATS<b>2</b>PITCH</div></div>`
  const seenForms=new WeakSet()
  let busyLookup=false

  function enhanceBrand(){
    const auth=document.querySelector('.auth-wrap')
    if(auth&&!auth.querySelector('.s2p-brand-lockup')){
      const old=auth.querySelector('.auth-logo')
      if(old)old.insertAdjacentHTML('afterend',lockup())
      else auth.insertAdjacentHTML('afterbegin',lockup())
    }
    const brand=document.querySelector('.brand-inline')
    if(brand&&!brand.dataset.s2p16){brand.dataset.s2p16='1';brand.innerHTML=lockup(true)}
  }

  async function maybeMoveNewUser(form){
    if(busyLookup||!form||document.querySelector('.auth-card h1')?.textContent?.toLowerCase().includes('create'))return
    const msg=document.querySelector('.auth-status.error')
    if(!msg||!/email or password is incorrect/i.test(msg.textContent||''))return
    if(msg.dataset.accountChecked==='1')return
    msg.dataset.accountChecked='1'
    const email=form.querySelector('#email')?.value?.trim()||''
    const password=form.querySelector('#password')?.value||''
    if(!email||!password)return
    busyLookup=true
    try{
      const r=await fetch('/api/auth/account-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})})
      const j=await r.json().catch(()=>({}))
      if(r.ok&&j.needsAccount){
        const switcher=document.getElementById('auth-switch')
        if(switcher){
          switcher.click()
          setTimeout(()=>{
            const e=document.getElementById('email'),p=document.getElementById('password'),status=document.getElementById('msg')
            if(e)e.value=email
            if(p)p.value=password
            if(status){status.classList.remove('error');status.classList.add('auth-handoff');status.innerHTML='<strong>New here?</strong> Your details are ready. Create your account to continue.'}
            document.getElementById('auth-submit')?.focus()
          },0)
        }
      }
    }catch{}finally{busyLookup=false}
  }

  function enhanceAuth(){
    const form=document.getElementById('auth-form')
    if(!form)return
    if(!seenForms.has(form)){
      seenForms.add(form)
      const observer=new MutationObserver(()=>maybeMoveNewUser(form))
      const msg=document.getElementById('msg')
      if(msg)observer.observe(msg,{childList:true,characterData:true,subtree:true,attributes:true})
    }
    maybeMoveNewUser(form)
  }

  function enhanceHeader(){
    const wrap=document.querySelector('.profile-wrap')
    if(!wrap||wrap.classList.contains('s2p-hidden'))return
    const email=wrap.querySelector('.profile-menu span')?.textContent?.trim()||''
    const signout=wrap.querySelector('#signout')
    if(!signout)return
    const box=document.createElement('div');box.className='top-actions-inline';box.innerHTML=`<span>${email}</span><button type="button">↪ Sign out</button>`
    box.querySelector('button').onclick=()=>signout.click()
    wrap.parentNode.insertBefore(box,wrap);wrap.classList.add('s2p-hidden')
  }

  function enhanceSummary(){
    const cards=[...document.querySelectorAll('.summary-card')]
    const names=['Fixtures scanned','Qualified picks','3+ Filters','Last refresh']
    cards.slice(0,4).forEach((c,i)=>{const s=c.querySelector('span');if(s)s.textContent=names[i]})
  }

  function enhancePriority(){
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''))
    if(!title||document.querySelector('.priority-compact'))return
    const rows=[...document.querySelectorAll('.prediction-panel tbody tr')].slice(0,12)
    if(!rows.length)return
    const panel=document.createElement('section');panel.className='priority-compact'
    panel.innerHTML=rows.map(row=>{
      const match=row.querySelector('[data-label="Match"]')?.innerText?.replace(/\n+/g,' vs ')||''
      const odd=row.querySelector('[data-label="Odds"]')?.textContent?.trim()||'—'
      const reason=row.querySelector('[data-label="Key reasons"]')?.textContent?.trim()||''
      const prediction=row.querySelector('[data-label="Prediction"]')?.textContent?.trim()||''
      return `<div class="priority-compact-row"><div class="priority-compact-match">${escapeHtml(match)} <small>· ${escapeHtml(prediction)}</small></div><div class="priority-compact-odd">${escapeHtml(odd)}</div><div class="priority-compact-reason">${escapeHtml(reason)}</div><div class="priority-compact-star">★</div></div>`
    }).join('')
    title.insertAdjacentElement('afterend',panel)
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function enhance(){enhanceBrand();enhanceAuth();enhanceHeader();enhanceSummary();enhancePriority()}
  let queued=false
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue);else queue()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.6.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.7.0.js
 * =================================================================== */
try{
(()=>{
  const ACCESS_KEY='s2p_access_token'
  let board=null
  let rowMap=new Map()
  let fetchPromise=null
  let lastFetch=0

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))
  const fmt=n=>{const v=Number(n);return Number.isFinite(v)&&v>1.001?v.toFixed(2):'—'}
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const keyFor=r=>`${r.fixtureId}|${r.market}|${r.selectedTeamId||r.selectedTeam}`

  function rebuildIndex(){
    rowMap=new Map()
    for(const r of [...allRows(board),...(board?.priority||[])]) rowMap.set(keyFor(r),r)
  }

  async function loadBoard(force=false){
    if(fetchPromise)return fetchPromise
    if(!force&&board&&Date.now()-lastFetch<15000)return board
    const t=token();if(!t)return null
    fetchPromise=fetch('/api/board',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})
      .then(async r=>r.ok?r.json():null)
      .then(j=>{if(j){board=j;lastFetch=Date.now();rebuildIndex()}return board})
      .catch(()=>board)
      .finally(()=>{fetchPromise=null})
    return fetchPromise
  }

  function names(row){
    const split=String(row?.match||'').split(' vs ')
    const home=split[0]||''
    const away=split[1]||''
    const selected=row?.market==='1X2'?(row?.selectedTeam||home):(row?.selectedTeam||'This match')
    let opponent=row?.opponentTeam||''
    if(row?.market==='1X2'&&(!opponent||opponent==='Whole match')) opponent=selected===home?away:home
    return{home,away,selected,opponent}
  }

  function namedReason(text,row){
    const s=String(text||'').trim()
    const {home,away,selected,opponent}=names(row)
    const selectedName=selected||home||'This team'
    const opponentName=opponent||away||'The opponent'
    const rules=[
      [/selected team is in the league'?s? top 3/i,`${selectedName} are in the top 3.`],
      [/selected team is in the bottom 3/i,`${selectedName} are in the bottom 3.`],
      [/selected team averages at least 2 points per game/i,`${selectedName} have a strong points record.`],
      [/selected team averages under 1 point per game/i,`${selectedName} have been struggling for points.`],
      [/selected team scores at least 2\.3 goals per game/i,`${selectedName} score very often.`],
      [/selected team scores at least 2 goals per game/i,`${selectedName} score at least 2 goals a game on average.`],
      [/selected team scores under 1 goal per game/i,`${selectedName} have been struggling to score.`],
      [/selected team concedes more than 2\.3 goals per game/i,`${selectedName} have been conceding heavily.`],
      [/selected team concedes at least 2 goals per game/i,`${selectedName} concede often.`],
      [/selected team concedes under 1 goal per game/i,`${selectedName} have been defending very well.`],
      [/selected team won at least 4 of its last 5/i,`${selectedName} have won 4 of their last 5.`],
      [/selected team won at least 3 of its last 5/i,`${selectedName} have won at least 3 of their last 5.`],
      [/selected team won fewer than 2 of its last 5/i,`${selectedName} have won fewer than 2 of their last 5.`],
      [/selected team won fewer than 3 of its last 5/i,`${selectedName} have won fewer than 3 of their last 5.`],
      [/selected team lost at least 4 of its last 5/i,`${selectedName} have lost 4 of their last 5.`],
      [/selected team lost at least 3 of its last 5/i,`${selectedName} have lost 3 of their last 5.`],
      [/opponent is in the league top 3/i,`${opponentName} are also in the top 3.`],
      [/opponent is in the bottom 3/i,`${opponentName} are in the bottom 3.`],
      [/opponent averages under 1 point per game/i,`${opponentName} have been struggling for points.`],
      [/opponent scores under 1 goal per game/i,`${opponentName} have been struggling to score.`],
      [/opponent concedes more than 2\.3 goals per game/i,`${opponentName} have been conceding heavily.`],
      [/opponent concedes at least 2 goals per game/i,`${opponentName} concede often.`],
      [/opponent concedes under 1 goal per game/i,`${opponentName} have been defending well.`],
      [/opponent lost at least 4 of its last 5/i,`${opponentName} have lost 4 of their last 5.`],
      [/opponent lost at least 3 of its last 5/i,`${opponentName} have lost 3 of their last 5.`],
      [/win price is below 1\.20/i,`The market makes ${selectedName} a very strong favourite.`],
      [/win price is 1\.55 or lower/i,`The market strongly favours ${selectedName}.`],
      [/win price is 2\.00 or lower/i,`The market favours ${selectedName}.`],
      [/win price is above 5\.00/i,`The market sees ${selectedName} as a big outsider.`],
      [/draw price is below 3\.00/i,'The draw is priced as a real possibility.'],
      [/draw price is above 5\.00/i,'The market sees a draw as unlikely.'],
      [/draw price is above 4\.00/i,'The market gives the draw a relatively low chance.']
    ]
    for(const [re,out] of rules)if(re.test(s))return out
    const g=s.match(/(Over|Under) (1\.5|2\.5|3\.5) goals landed in at least (80|60)% of the (home|away) team's recent matches/i)
    if(g){
      const team=g[4].toLowerCase()==='home'?home:away
      return `${g[1]} ${g[2]} goals has appeared in at least ${g[3]==='80'?'4 of 5':'3 of 5'} recent matches for ${team||'this team'}.`
    }
    return s
      .replace(/The selected team/gi,selectedName)
      .replace(/Selected team/gi,selectedName)
      .replace(/The opponent/gi,opponentName)
      .replace(/Opponent/gi,opponentName)
      .replace(/the home team/gi,home||'the first team')
      .replace(/the away team/gi,away||'the second team')
      .replace(/PPG/ig,'points per game')
      .replace(/hit rate/ig,'recent record')
  }

  function img(src,cls,alt=''){
    return src?`<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`:''
  }

  function competitionHtml(row){
    const flag=img(row?.countryFlag,'country-flag',row?.country||'')
    const logo=img(row?.leagueLogo,'league-logo',row?.league||'')
    return `<div class="competition-cell"><div class="competition-icons">${flag}${logo}</div><div><strong>${esc(row?.league||'Competition')}</strong>${row?.country?`<span>${esc(row.country)}</span>`:''}</div></div>`
  }

  function decorateTables(){
    for(const table of document.querySelectorAll('.pred-table')){
      const header=table.querySelector('thead tr')
      if(header&&!header.dataset.s2p17){
        header.dataset.s2p17='1'
        header.innerHTML='<th>Time</th><th>League</th><th>Match</th><th>Prediction</th><th>Odds</th><th>Confidence</th><th>Details</th>'
      }
      for(const tr of table.querySelectorAll('tbody tr')){
        const btn=tr.querySelector('[data-row-key]')
        const row=btn?rowMap.get(btn.dataset.rowKey):null
        if(!row)continue
        let league=tr.querySelector('[data-label="League"]')
        if(!league){
          league=document.createElement('td')
          league.dataset.label='League'
          const time=tr.querySelector('[data-label="Time"]')
          time?.insertAdjacentElement('afterend',league)
        }
        const competition=competitionHtml(row)
        if(league.innerHTML!==competition)league.innerHTML=competition
        const reason=tr.querySelector('[data-label="Key reasons"]')
        if(reason)reason.remove()
        const details=btn.closest('td')
        if(details)details.dataset.label='Details'
      }
    }
  }

  function rebuildPriority(){
    const old=document.querySelector('.priority-compact')
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''))
    if(!title)return

    // Best picks should be a complete, stable list. The old `.slice(0,12)` hid
    // later qualified matches and the panel was rewritten on every mutation.
    const rows=[...document.querySelectorAll('.prediction-panel tbody tr')]
    if(!rows.length){
      if(old&&old.innerHTML)old.innerHTML=''
      return
    }

    const panel=old||document.createElement('section')
    panel.className='priority-compact priority-compact-v17'
    const html=rows.map(tr=>{
      const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null
      if(!row)return''
      const match=tr.querySelector('[data-label="Match"]')?.innerText?.replace(/\n+/g,' vs ')||row.match||''
      const odd=tr.querySelector('[data-label="Odds"]')?.textContent?.trim()||fmt(row.odds)
      const prediction=tr.querySelector('[data-label="Prediction"]')?.textContent?.trim()||''
      return `<button class="priority-compact-row priority-v17-row" type="button" data-priority-key="${esc(btn.dataset.rowKey)}">
        <div class="priority-v17-competition">${competitionHtml(row)}</div>
        <div class="priority-compact-match"><strong>${esc(match)}</strong><small>${esc(prediction)}</small></div>
        <div class="priority-compact-odd">${esc(odd)}</div>
        <div class="priority-compact-star">★</div>
      </button>`
    }).join('')

    if(!old)title.insertAdjacentElement('afterend',panel)
    if(panel.dataset.s2pPriorityHtml!==html){
      panel.innerHTML=html
      panel.dataset.s2pPriorityHtml=html
      panel.querySelectorAll('[data-priority-key]').forEach(b=>b.onclick=()=>openDetails(rowMap.get(b.dataset.priorityKey)))
    }
  }

  function confidence(row){
    let score=56+Math.min(30,Number(row?.filterCount||0)*7)
    if(row?.contradiction==='MODERATE')score-=8
    if(row?.contradiction==='HIGH')score-=20
    if(Number(row?.odds)>1&&Number(row?.odds)<=1.55)score+=4
    if(Number(row?.odds)>4)score-=4
    return Math.max(50,Math.min(96,Math.round(score)))
  }
  function stars(row){
    const pct=confidence(row),filled=Math.max(1,Math.min(5,Math.round(pct/20)))
    return `<span class="stars">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</span><span class="confidence-pct">${pct}%</span>`
  }
  function predictionName(row){
    const names={'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}
    return row?.market==='1X2'?`${row.selectedTeam} win`:(names[row?.market]||row?.selectedTeam||'Prediction')
  }

  function openDetails(row){
    if(!row)return
    document.querySelector('.modal-backdrop.s2p17-modal')?.remove()
    const markets=board?.oddsByFixture?.[String(row.fixtureId)]||[]
    const reasons=(row.filters||[]).map(x=>namedReason(x,row))
    const cautions=(row.negativeSignals||[]).map(x=>namedReason(x,row))
    const overlay=document.createElement('div')
    overlay.className='modal-backdrop s2p17-modal'
    overlay.innerHTML=`<section class="detail-modal detail-modal-v17" role="dialog" aria-modal="true" aria-label="Match details">
      <header class="modal-head modal-head-v17">
        <div class="modal-competition">${competitionHtml(row)}</div>
        <button class="modal-close" type="button" aria-label="Close details">×</button>
      </header>
      <div class="detail-body">
        <div class="detail-match-title"><h2>${esc(row.match)}</h2><span>${esc(row.kickoffLocal||'')}</span></div>
        <section class="detail-summary">
          <div><span class="eyebrow">Prediction</span><h3>${esc(predictionName(row))}</h3><div class="confidence">${stars(row)}</div></div>
          <div class="detail-price"><span>Odds</span><strong>${fmt(row.odds)}</strong></div>
        </section>
        <section class="detail-section"><h3>Why this pick</h3><div class="reason-cards">${reasons.length?reasons.map((x,i)=>`<div class="reason-card"><span class="reason-number">${i+1}</span><p>${esc(x)}</p></div>`).join(''):'<div class="reason-card"><p>This match fits the filters you selected.</p></div>'}</div></section>
        ${cautions.length?`<section class="detail-section caution-section"><h3>Things to keep in mind</h3><div class="reason-cards">${cautions.map(x=>`<div class="reason-card caution-card"><p>${esc(x)}</p></div>`).join('')}</div></section>`:''}
        <section class="detail-section"><h3>Available market prices</h3>${markets.length?`<div class="market-grid">${markets.map(m=>`<article class="market-card"><h4>${esc(m.market)}</h4><div class="outcomes">${(m.outcomes||[]).map(o=>`<div class="outcome"><span>${esc(o.name)}</span><strong>${fmt(o.odd)}</strong></div>`).join('')}</div></article>`).join('')}</div>`:'<div class="reason-card"><p>No verified market price is available for this match yet.</p></div>'}</section>
      </div>
    </section>`
    document.body.appendChild(overlay)
    const close=()=>overlay.remove()
    overlay.querySelector('.modal-close').onclick=close
    overlay.onclick=e=>{if(e.target===overlay)close()}
    document.addEventListener('keydown',function key(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',key)}})
  }

  function interceptDetails(){
    document.addEventListener('click',async e=>{
      const btn=e.target.closest?.('[data-row-key]')
      if(!btn)return
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
      let row=rowMap.get(btn.dataset.rowKey)
      if(!row){await loadBoard(true);row=rowMap.get(btn.dataset.rowKey)}
      if(row)openDetails(row)
    },true)
  }

  async function enhance(force=false){
    if(!document.querySelector('.app-shell'))return
    const keys=[...document.querySelectorAll('[data-row-key]')].map(x=>x.dataset.rowKey)
    if(force||!board||keys.some(k=>!rowMap.has(k)))await loadBoard(true)
    decorateTables()
    rebuildPriority()
    document.documentElement.classList.add('s2p-v17')
  }

  interceptDetails()
  let queued=false
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await enhance(false)})}
  new MutationObserver(mutations=>{
    // Ignore our own Best-picks rewrites; otherwise the observer schedules
    // another rebuild immediately and can fight scrolling on that tab.
    if(mutations.length&&mutations.every(m=>m.target?.closest?.('.priority-compact,.s2p-board-tabs')))return
    queue()
  }).observe(document.documentElement,{childList:true,subtree:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhance(true));else enhance(true)
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.7.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: odds-ui.v1.7.2.js
 * =================================================================== */
try{
(()=>{
  const selectors=['.odds','.priority-compact-odd','.detail-price strong','.outcome strong','[data-label="Odds"]']
  function invalidDisplayedOdd(text){
    const raw=String(text??'').trim().replace(',','.')
    if(!raw)return true
    const n=Number(raw)
    return Number.isFinite(n) && n <= 1.001
  }
  function fixOdds(root=document){
    for(const el of root.querySelectorAll(selectors.join(','))){
      if(invalidDisplayedOdd(el.textContent)){
        el.textContent='—'
        el.classList.add('odds-missing')
        el.setAttribute('aria-label','Odds unavailable')
      }
    }
  }
  let queued=false
  const queue=()=>{
    if(queued)return
    queued=true
    requestAnimationFrame(()=>{queued=false;fixOdds()})
  }
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue)
  else queue()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: odds-ui.v1.7.2.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.7.3.js
 * =================================================================== */
try{
(()=>{
  let activeTab=sessionStorage.getItem('s2p_board_tab')||'best'
  let scheduled=false
  let lastTabsSignature=''

  const text=n=>String(n?.textContent||'').trim()

  function panelKey(panel){
    const title=text(panel?.querySelector('.prediction-panel-title h3')).toLowerCase()
    if(title.includes('3+'))return'three'
    if(title.includes('2 filter'))return'two'
    if(title.includes('single'))return'single'
    return''
  }
  function panelCount(panel){
    const badge=panel?.querySelector('.prediction-panel-title span')
    const n=Number(text(badge))
    return Number.isFinite(n)?n:0
  }

  function cleanDetails(){
    for(const modal of document.querySelectorAll('.detail-modal-v17,.detail-modal')){
      const priceLabel=modal.querySelector('.detail-price span')
      if(priceLabel)priceLabel.textContent='Selected odd'
      for(const section of modal.querySelectorAll('.detail-section')){
        const h=text(section.querySelector('h3')).toLowerCase()
        if(h.includes('available market prices')||h.includes('market prices'))section.remove()
      }
    }
  }

  function applyTab(shell){
    for(const el of shell.querySelectorAll('[data-s2p-tab-panel]')){
      const visible=el.dataset.s2pTabPanel===activeTab
      el.classList.toggle('s2p-tab-visible',visible)
      el.setAttribute('aria-hidden',visible?'false':'true')
    }
    shell.dataset.s2pActiveTab=activeTab
    document.documentElement.dataset.s2pActiveTab=activeTab
    window.dispatchEvent(new CustomEvent('s2p:tabchange',{detail:{tab:activeTab}}))
  }

  function bindTabButtons(tabs,shell){
    tabs.querySelectorAll('[data-s2p-tab]').forEach(btn=>{
      btn.onclick=()=>{
        const next=btn.dataset.s2pTab
        if(!next||next===activeTab)return
        activeTab=next
        sessionStorage.setItem('s2p_board_tab',activeTab)
        applyTab(shell)
        tabs.querySelectorAll('[data-s2p-tab]').forEach(x=>{
          const on=x.dataset.s2pTab===activeTab
          x.classList.toggle('is-active',on)
          x.setAttribute('aria-pressed',on?'true':'false')
        })
        // Do not call scrollIntoView here. The dashboard owns its own scroll
        // surface from v1.7.8, and scrollIntoView can move the wrong ancestor.
      }
    })
  }

  function installTabs(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    const priorityTitle=[...shell.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(text(x)))
    const priorityPanel=shell.querySelector('.priority-compact-v17,.priority-compact')
    const panels=[...shell.querySelectorAll('.prediction-panel')]
    if(!priorityTitle||!priorityPanel||!panels.length)return

    const map={three:null,two:null,single:null}
    for(const p of panels){const k=panelKey(p);if(k)map[k]=p}

    let tabs=shell.querySelector('.s2p-board-tabs')
    if(!tabs){
      tabs=document.createElement('nav')
      tabs.className='s2p-board-tabs'
      tabs.setAttribute('aria-label','Prediction groups')
      priorityTitle.insertAdjacentElement('beforebegin',tabs)
    }

    const bestCount=priorityPanel.querySelectorAll('[data-priority-key]').length
    const defs=[['best','Best picks',bestCount],['three','3+ filters',panelCount(map.three)],['two','2 filters',panelCount(map.two)],['single','Single',panelCount(map.single)]]
    const signature=JSON.stringify(defs)

    // Avoid rewriting the tabs on every MutationObserver callback. Replacing
    // innerHTML here used to generate another mutation and could keep the Best
    // picks area in a continuous render loop while the user tried to scroll.
    if(signature!==lastTabsSignature||!tabs.querySelector('[data-s2p-tab]')){
      tabs.innerHTML=defs.map(([key,label,count])=>`<button type="button" class="s2p-board-tab ${activeTab===key?'is-active':''}" data-s2p-tab="${key}" aria-pressed="${activeTab===key?'true':'false'}"><span>${label}</span><b>${count}</b></button>`).join('')
      lastTabsSignature=signature
      bindTabButtons(tabs,shell)
    }else{
      tabs.querySelectorAll('[data-s2p-tab]').forEach(x=>{
        const on=x.dataset.s2pTab===activeTab
        x.classList.toggle('is-active',on)
        x.setAttribute('aria-pressed',on?'true':'false')
      })
    }

    priorityTitle.dataset.s2pTabPanel='best'
    priorityPanel.dataset.s2pTabPanel='best'
    if(map.three)map.three.dataset.s2pTabPanel='three'
    if(map.two)map.two.dataset.s2pTabPanel='two'
    if(map.single)map.single.dataset.s2pTabPanel='single'

    applyTab(shell)
  }

  function improveControls(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    shell.querySelector('.controls')?.classList.add('s2p-controls-v173')
    shell.querySelector('.topbar')?.classList.add('s2p-topbar-v173')
    shell.classList.add('s2p-shell-v173')
  }

  function run(){
    scheduled=false
    cleanDetails()
    installTabs()
    improveControls()
  }
  function queue(mutations=[]){
    // Ignore mutations that are entirely inside the tab bar. Those are our own
    // state updates and must not schedule another full board pass.
    if(mutations.length&&mutations.every(m=>m.target?.closest?.('.s2p-board-tabs')))return
    if(scheduled)return
    scheduled=true
    requestAnimationFrame(run)
  }

  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.7.3.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.7.6.js
 * =================================================================== */
try{
(()=>{
  const ROOT_CLASS='s2p-scroll-ready'

  function unlockDocumentScroll(){
    const shell=document.querySelector('.app-shell')
    const auth=document.querySelector('.auth-page')
    if(!shell&&!auth)return

    document.documentElement.classList.add(ROOT_CLASS)
    document.body.classList.add(ROOT_CLASS)

    // Clear stale inline locks left by older UI/modal code or browser restores.
    for(const el of [document.documentElement,document.body]){
      if(!el)continue
      const style=el.style
      if(style.overflow==='hidden')style.removeProperty('overflow')
      if(style.overflowY==='hidden')style.removeProperty('overflow-y')
      if(style.height==='100vh'||style.height==='100dvh')style.removeProperty('height')
      if(style.position==='fixed'){
        style.removeProperty('position')
        style.removeProperty('top')
        style.removeProperty('left')
        style.removeProperty('right')
        style.removeProperty('width')
      }
    }
  }

  function setViewportUnit(){
    const height=window.visualViewport?.height||window.innerHeight
    if(height)document.documentElement.style.setProperty('--s2p-safe-vh',`${height*.01}px`)
  }

  function markDeviceWidth(){
    const width=Math.round(window.visualViewport?.width||window.innerWidth||document.documentElement.clientWidth||0)
    document.documentElement.dataset.s2pWidth=String(width)
    document.documentElement.classList.toggle('s2p-zfold-cover',width>0&&width<=390)
    document.documentElement.classList.toggle('s2p-mobile',width>0&&width<=600)
    document.documentElement.classList.toggle('s2p-tablet',width>600&&width<=1100)
  }

  function refresh(){
    unlockDocumentScroll()
    setViewportUnit()
    markDeviceWidth()
  }

  let raf=0
  const queue=()=>{
    if(raf)return
    raf=requestAnimationFrame(()=>{raf=0;refresh()})
  }

  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})
  window.addEventListener('resize',queue,{passive:true})
  window.addEventListener('orientationchange',queue,{passive:true})
  window.visualViewport?.addEventListener('resize',queue,{passive:true})
  window.visualViewport?.addEventListener('scroll',queue,{passive:true})

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true})
  else refresh()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.7.6.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.7.8.js
 * =================================================================== */
try{
(()=>{
  let raf=0

  function viewportHeight(){
    const vv=window.visualViewport
    return Math.max(320,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0))
  }

  function currentScrollTop(){
    const shell=document.querySelector('.app-shell')
    return shell?.scrollTop||0
  }

  function unlockShell(){
    const h=viewportHeight()
    document.documentElement.style.setProperty('--s2p-dashboard-height',`${h}px`)
    document.documentElement.classList.add('s2p-scroll-container-ready')

    const shell=document.querySelector('.app-shell')
    const auth=document.querySelector('.auth-page')

    if(shell){
      shell.style.setProperty('height',`${h}px`,'important')
      shell.style.setProperty('max-height',`${h}px`,'important')
      shell.style.setProperty('min-height','0','important')
      shell.style.setProperty('overflow-y','auto','important')
      shell.style.setProperty('overflow-x','hidden','important')
      shell.style.setProperty('-webkit-overflow-scrolling','touch','important')
      shell.style.setProperty('touch-action','pan-y pinch-zoom','important')
      shell.setAttribute('data-s2p-scroll-owner','true')
    }

    if(auth){
      auth.style.setProperty('height',`${h}px`,'important')
      auth.style.setProperty('max-height',`${h}px`,'important')
      auth.style.setProperty('min-height','0','important')
      auth.style.setProperty('overflow-y','auto','important')
      auth.style.setProperty('overflow-x','hidden','important')
      auth.style.setProperty('-webkit-overflow-scrolling','touch','important')
    }

    document.body.style.setProperty('overflow','hidden','important')
    document.documentElement.style.setProperty('overflow','hidden','important')
  }

  function verifyScrollable(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    const hasOverflow=shell.scrollHeight>shell.clientHeight+2
    shell.dataset.s2pHasOverflow=hasOverflow?'true':'false'
  }

  function refresh(){
    raf=0
    const before=currentScrollTop()
    unlockShell()
    verifyScrollable()
    const shell=document.querySelector('.app-shell')
    if(shell&&before>0&&shell.scrollTop===0)shell.scrollTop=before
  }

  function queue(){
    if(raf)return
    raf=requestAnimationFrame(refresh)
  }

  new MutationObserver(mutations=>{
    // Best-picks rows and tab buttons are managed by their own stable layer.
    // Do not repeatedly re-run viewport work for mutations entirely inside them.
    if(mutations.length&&mutations.every(m=>m.target?.closest?.('.priority-compact,.s2p-board-tabs')))return
    queue()
  }).observe(document.documentElement,{childList:true,subtree:true})

  window.addEventListener('resize',queue,{passive:true})
  window.addEventListener('orientationchange',queue,{passive:true})
  window.visualViewport?.addEventListener('resize',queue,{passive:true})
  window.addEventListener('pageshow',queue,{passive:true})
  window.addEventListener('s2p:tabchange',queue,{passive:true})

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true})
  else refresh()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.7.8.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.7.9.js
 * =================================================================== */
try{
(()=>{
  let raf=0

  function canonicalMatchForKey(key){
    if(!key)return''
    let source=null
    try{source=document.querySelector(`[data-row-key="${CSS.escape(key)}"]`)}catch{}
    const row=source?.closest('tr')
    const teams=[...(row?.querySelectorAll('.match-team span')||[])].map(x=>String(x.textContent||'').trim()).filter(Boolean)
    if(teams.length>=2)return `${teams[0]} vs ${teams[1]}`

    const matchCell=row?.querySelector('[data-label="Match"]')
    if(matchCell){
      const text=String(matchCell.textContent||'').trim().replace(/\s+/g,' ')
      // Collapse any accidental repeated separators left by older renderers.
      return text.replace(/\bvs\b(?:\s*\bvs\b)+/gi,'vs')
    }
    return''
  }

  function fixBestPickLabels(){
    raf=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const strong=item.querySelector('.priority-compact-match strong')
      if(!strong)continue
      const canonical=canonicalMatchForKey(item.dataset.priorityKey)
      if(canonical&&strong.textContent!==canonical)strong.textContent=canonical
      else if(!canonical){
        const cleaned=String(strong.textContent||'').replace(/\bvs\b(?:\s*\bvs\b)+/gi,'vs').replace(/\s+/g,' ').trim()
        if(cleaned!==strong.textContent)strong.textContent=cleaned
      }
    }
  }

  function queue(){
    if(raf)return
    raf=requestAnimationFrame(fixBestPickLabels)
  }

  new MutationObserver(mutations=>{
    if(mutations.some(m=>m.target?.closest?.('.priority-compact,.prediction-panel')))queue()
  }).observe(document.documentElement,{childList:true,subtree:true})

  window.addEventListener('s2p:tabchange',queue,{passive:true})
  window.addEventListener('pageshow',queue,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.7.9.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.8.0.js
 * =================================================================== */
try{
(()=>{
  const ACCESS_KEY='s2p_access_token'
  const STATUS_KEY='s2p_match_status'
  let board=null
  let rows=new Map()
  let status=sessionStorage.getItem(STATUS_KEY)||'all'
  let timer=0

  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||new Date().toISOString().slice(0,10)

  function rebuild(){rows=new Map(allRows(board).map(r=>[keyFor(r),r]))}
  async function loadBoard(){
    const t=token();if(!t)return null
    try{
      const r=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})
      if(!r.ok)return null
      board=await r.json();rebuild();return board
    }catch{return null}
  }

  function rowForKey(key){return rows.get(key)||null}
  function kickoff(row){
    const d=new Date(row?.kickoff||'')
    if(Number.isNaN(d.getTime()))return String(row?.kickoffLocal||'').split(',').pop()?.trim()||''
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)
  }
  function scoreText(row){
    const h=row?.homeScore,a=row?.awayScore
    return h!==null&&h!==undefined&&a!==null&&a!==undefined&&Number.isFinite(Number(h))&&Number.isFinite(Number(a))?`${Number(h)}–${Number(a)}`:''
  }
  function statusLabel(row){
    const group=row?.statusGroup||'upcoming',score=scoreText(row)
    if(group==='live')return `LIVE${row?.elapsed!==null&&row?.elapsed!==undefined&&Number.isFinite(Number(row.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`
    if(group==='settled')return `${row?.statusShort||'FT'}${score?` · ${score}`:''}`
    if(group==='postponed')return row?.statusShort==='CANC'?'Cancelled':row?.statusShort==='ABD'?'Abandoned':'Postponed'
    return 'Upcoming'
  }
  function selectedLabel(row){
    if(row?.selectionLabel)return row.selectionLabel
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return row.selectedTeam
    return''
  }
  function visible(row){return status==='all'||(row?.statusGroup||'upcoming')===status}

  function installStatusControl(){
    const grid=document.querySelector('.controls .control-grid')
    if(!grid)return
    let label=grid.querySelector('.s2p-status-control')
    if(!label){
      label=document.createElement('label')
      label.className='s2p-status-control'
      label.innerHTML='<span>Match status</span><select id="s2p-status"><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="settled">Settled</option><option value="postponed">Postponed / Cancelled</option></select>'
      const refresh=grid.querySelector('#refresh,.refresh')
      if(refresh)grid.insertBefore(label,refresh);else grid.appendChild(label)
      label.querySelector('select').addEventListener('change',e=>{
        status=e.target.value
        sessionStorage.setItem(STATUS_KEY,status)
        apply()
      })
    }
    const select=label.querySelector('select')
    if(select&&select.value!==status)select.value=status
  }

  function decorateTables(){
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){
      const btn=tr.querySelector('[data-row-key]')
      const row=btn?rowForKey(btn.dataset.rowKey):null
      if(!row)continue
      tr.dataset.s2pStatus=row.statusGroup||'upcoming'
      tr.classList.toggle('s2p-status-hidden',!visible(row))
      const time=tr.querySelector('[data-label="Time"]')
      if(time){time.dataset.s2pStatus=statusLabel(row);time.dataset.s2pKickoff=kickoff(row)}
      const prediction=tr.querySelector('[data-label="Prediction"]')
      const label=selectedLabel(row)
      if(prediction&&label){prediction.dataset.selectionLabel=label;prediction.classList.add('s2p-selection-override')}
    }
  }

  function decorateBest(){
    let visibleBest=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const row=rowForKey(item.dataset.priorityKey)
      if(!row)continue
      const match=item.querySelector('.priority-compact-match')
      if(match){
        match.dataset.kickoff=kickoff(row)
        match.dataset.statusLabel=statusLabel(row)
        const small=match.querySelector('small')
        const label=selectedLabel(row)
        if(small&&label){small.dataset.selectionLabel=label;small.classList.add('s2p-selection-override')}
      }
      const show=visible(row)
      item.classList.toggle('s2p-status-hidden',!show)
      if(show)visibleBest++
    }
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b')
    if(badge&&String(visibleBest)!==badge.textContent)badge.textContent=String(visibleBest)
  }

  function decorateTabCounts(){
    for(const [tab,selector] of [['three','.prediction-panel[data-s2p-tab-panel="three"]'],['two','.prediction-panel[data-s2p-tab-panel="two"]'],['single','.prediction-panel[data-s2p-tab-panel="single"]']]){
      const panel=document.querySelector(selector)
      if(!panel)continue
      const count=[...panel.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('s2p-status-hidden')).length
      const badge=document.querySelector(`.s2p-board-tab[data-s2p-tab="${tab}"] b`)
      if(badge&&badge.textContent!==String(count))badge.textContent=String(count)
    }
  }

  function apply(){
    installStatusControl()
    decorateTables()
    decorateBest()
    decorateTabCounts()
    document.documentElement.dataset.s2pStatusFilter=status
  }

  async function boot(){
    if(!document.querySelector('.app-shell'))return
    await loadBoard()
    requestAnimationFrame(()=>requestAnimationFrame(apply))
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,100)}

  const root=document.getElementById('root')
  if(root)new MutationObserver(schedule).observe(root,{childList:true})
  document.addEventListener('change',e=>{if(e.target?.id==='date')schedule()},true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(apply),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.8.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: ui.v1.10.0.js
 * =================================================================== */
try{
/* Stats2Pitch v1.10.0 — backend Best Picks + engine-rating integrity UI. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token',STATUS_KEY='s2p_match_status'
  let board=null,rowMap=new Map(),timer=0
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'—'
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const date=()=>document.getElementById('date')?.value||new Date().toISOString().slice(0,10)
  const status=()=>sessionStorage.getItem(STATUS_KEY)||'all'
  function index(){rowMap=new Map();for(const r of [...(board?.priority||[]),...(board?.bestPicks||[])])rowMap.set(keyFor(r),r)}
  async function load(){const t=token();if(!t)return null;try{const r=await fetch(`/api/board?date=${encodeURIComponent(date())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)return null;board=await r.json();index();return board}catch{return null}}
  const predictionName=row=>row?.selectionLabel||(row?.market==='1X2'?`${row.selectedTeam} win`:row?.market==='DNB'?`${row.selectedTeam} DNB`:row?.market==='DC'?row.selectedTeam:({'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}[row?.market]||row?.selectedTeam||'Prediction'))
  function competition(row){const flag=row?.countryFlag?`<img class="country-flag" src="${esc(row.countryFlag)}" alt="" loading="lazy">`:'',logo=row?.leagueLogo?`<img class="league-logo" src="${esc(row.leagueLogo)}" alt="" loading="lazy">`:'';return`<div class="competition-cell"><div class="competition-icons">${flag}${logo}</div><div><strong>${esc(row?.league||'Competition')}</strong>${row?.country?`<span>${esc(row.country)}</span>`:''}</div></div>`}
  function kickoff(row){const d=new Date(row?.kickoff||'');return Number.isNaN(d.getTime())?(row?.kickoffLocal||''):new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  function statusText(row){const g=row?.statusGroup||'upcoming';if(g==='live')return`LIVE${Number.isFinite(Number(row?.elapsed))?` ${row.elapsed}′`:''}`;if(g==='settled')return row?.statusShort||'FT';if(g==='postponed')return row?.statusShort==='CANC'?'Cancelled':'Postponed';return kickoff(row)}
  function currentVisibleKeys(){return new Set([...document.querySelectorAll('.prediction-panel tbody tr:not(.s2p-status-hidden) [data-row-key]')].map(x=>x.dataset.rowKey))}
  function filteredBest(){const s=status(),keys=currentVisibleKeys(),hasRenderedRows=document.querySelectorAll('.prediction-panel tbody tr').length>0;return(board?.bestPicks||[]).filter(r=>(s==='all'||(r.statusGroup||'upcoming')===s)&&(!hasRenderedRows||keys.has(keyFor(r))))}
  function rebuildBest(){
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''));if(!title||!board)return
    let panel=document.querySelector('.priority-compact');if(!panel){panel=document.createElement('section');panel.className='priority-compact priority-compact-v17';title.insertAdjacentElement('afterend',panel)}
    const best=filteredBest()
    const html=best.map(row=>`<button class="priority-compact-row priority-v17-row" type="button" data-priority-key="${esc(keyFor(row))}"><div class="priority-v17-competition">${competition(row)}</div><div class="priority-compact-match" data-kickoff="${esc(kickoff(row))}" data-status-label="${esc(statusText(row))}"><strong>${esc(row.match||'')}</strong><small>${esc(predictionName(row))}</small></div><div class="priority-compact-odd">${fmt(row.odds)}</div><div class="priority-compact-star">★</div></button>`).join('')
    if(panel.dataset.v110Html!==html){panel.innerHTML=html||'<div class="no-data">No Best Pick fits the current choices right now.</div>';panel.dataset.v110Html=html;panel.querySelectorAll('[data-priority-key]').forEach(btn=>{btn.onclick=()=>{const source=document.querySelector(`[data-row-key="${CSS.escape(btn.dataset.priorityKey)}"]`);source?.click()}})}
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b');if(badge)badge.textContent=String(best.length)
  }
  function ratingMarkup(row){const rating=Math.max(0,Math.min(100,Number(row?.engineRating||0))),filled=Math.max(1,Math.min(5,Math.round(rating/20)));return`<div class="confidence" title="Engine rating — not a measured probability"><span class="stars">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</span><span class="confidence-pct">${Math.round(rating)}/100</span></div>`}
  function decorateRatings(){
    for(const th of document.querySelectorAll('.pred-table th'))if(/^confidence$/i.test(th.textContent?.trim()||'')){th.textContent='Engine rating';th.title='Model strength score, not a measured probability.'}
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null;if(!row)continue;const cell=tr.querySelector('[data-label="Confidence"],[data-label="Engine rating"]');if(cell){cell.dataset.label='Engine rating';const html=ratingMarkup(row);if(cell.dataset.v110Rating!==html){cell.innerHTML=html;cell.dataset.v110Rating=html}}}
  }
  function decorateModal(){for(const modal of document.querySelectorAll('.detail-modal')){const match=modal.querySelector('.detail-match-title h2,.modal-head h2')?.textContent?.trim()||'',pred=modal.querySelector('.detail-summary h3')?.textContent?.trim()||'',candidates=[...(board?.priority||[])].filter(r=>String(r.match||'')===match),row=candidates.find(r=>predictionName(r)===pred)||candidates[0];if(!row)continue;const conf=modal.querySelector('.confidence');if(conf)conf.outerHTML=ratingMarkup(row)}}
  function explainRating(){const controls=document.querySelector('.controls');if(!controls||document.getElementById('s2p-rating-note'))return;const note=document.createElement('div');note.id='s2p-rating-note';note.className='selected-filter-bar';note.innerHTML='<span class="filter-glyph">◎</span><span class="selected-none">Engine rating is a model-strength score, not a historical win probability.</span>';controls.insertAdjacentElement('afterend',note)}
  function apply(){decorateRatings();rebuildBest();decorateModal();explainRating()}
  async function boot(){if(!document.querySelector('.app-shell'))return;await load();requestAnimationFrame(()=>requestAnimationFrame(apply))}
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,120)}
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true})
  new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.modal-backdrop,.detail-modal'))))requestAnimationFrame(decorateModal)}).observe(document.documentElement,{childList:true,subtree:true})
  document.addEventListener('change',e=>{if(['date','market','minf','s2p-status'].includes(e.target?.id))schedule()},true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(()=>{rebuildBest();decorateRatings()}),{passive:true});window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: ui.v1.10.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: status-clock.v1.10.2.js
 * =================================================================== */
try{
/* Stats2Pitch v1.10.2 — clock sanity for lifecycle UI. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token',STATUS_KEY='s2p_match_status'
  let board=null,rowMap=new Map(),timer=0
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  function rebuild(){rowMap=new Map(allRows(board).map(r=>[keyFor(r),r]))}
  async function load(){const t=token();if(!t)return null;try{const r=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)return null;board=await r.json();rebuild();return board}catch{return null}}
  function scoreText(row){const h=row?.homeScore,a=row?.awayScore;return h!==null&&h!==undefined&&a!==null&&a!==undefined&&Number.isFinite(Number(h))&&Number.isFinite(Number(a))?`${Number(h)}–${Number(a)}`:''}
  function kickoff(row){const d=new Date(row?.kickoff||'');return Number.isNaN(d.getTime())?(row?.kickoffLocal||''):new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  function label(row){const g=row?.statusGroup||'pending',score=scoreText(row);if(g==='live')return`LIVE${Number.isFinite(Number(row?.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`;if(g==='settled')return`${row?.statusShort||'FT'}${score?` · ${score}`:''}`;if(g==='postponed')return row?.statusShort==='CANC'?'Cancelled':row?.statusShort==='ABD'?'Abandoned':'Postponed';if(g==='pending')return'Awaiting status';return'Upcoming'}
  function installPendingOption(){const sel=document.getElementById('s2p-status');if(!sel)return;let opt=[...sel.options].find(o=>o.value==='pending');if(!opt){opt=document.createElement('option');opt.value='pending';opt.textContent='Awaiting status';sel.appendChild(opt)}const saved=sessionStorage.getItem(STATUS_KEY)||'all';if([...sel.options].some(o=>o.value===saved)&&sel.value!==saved)sel.value=saved}
  function decorate(){installPendingOption();for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null;if(!row)continue;tr.dataset.s2pStatus=row.statusGroup||'pending';const time=tr.querySelector('[data-label="Time"]');if(time){time.dataset.s2pStatus=label(row);time.dataset.s2pKickoff=kickoff(row)}}for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){const row=rowMap.get(item.dataset.priorityKey);if(!row)continue;const match=item.querySelector('.priority-compact-match');if(match){match.dataset.kickoff=kickoff(row);match.dataset.statusLabel=label(row)}}}
  async function boot(){if(!document.querySelector('.app-shell'))return;await load();requestAnimationFrame(()=>requestAnimationFrame(decorate))}
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,180)}
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  document.addEventListener('change',e=>{if(['date','s2p-status'].includes(e.target?.id))schedule()},true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(decorate),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: status-clock.v1.10.2.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: refresh-resilience.v1.10.1.js
 * =================================================================== */
try{
/* Stats2Pitch v1.10.1 — background refresh with full-screen pitch loader. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const ACTIVE_KEY='s2p_refresh_active_date'
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  let running=false
  let polling=false
  let resumedDate=''

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)

  async function request(path,opts={}){
    const r=await fetch(path,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${token()}`,'Cache-Control':'no-store'}})
    const body=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(body.error||`Refresh request failed (${r.status}).`)
    return body
  }

  function buildOverlay(){
    const overlay=document.createElement('div')
    overlay.id='s2p-refresh-loading-overlay'
    overlay.className='s2p-refresh-overlay'
    overlay.setAttribute('role','status')
    overlay.setAttribute('aria-live','polite')
    overlay.setAttribute('aria-label','Loading matches')
    overlay.innerHTML=`
      <div class="s2p-loader">
        <div class="s2p-loader-scene" aria-hidden="true">
          <div class="s2p-loader-trail"></div>
          <div class="s2p-loader-ball-track">
            <img class="s2p-loader-ball-real" src="/assets/football-real.svg" alt="">
            <div class="s2p-loader-shadow"></div>
          </div>
          <div class="s2p-loader-pitch">
            <img src="/assets/brand-mark.png" alt="">
          </div>
        </div>
        <div class="s2p-loader-text">Loading <b>matches</b>...</div>
        <div class="s2p-loader-sub">From stats to the pitch</div>
      </div>`
    return overlay
  }

  function overlay(){
    let el=document.getElementById('s2p-refresh-loading-overlay')
    if(!el){el=buildOverlay();document.body.appendChild(el)}
    return el
  }

  function scrubInternalNotices(){
    document.getElementById('s2p-refresh-progress')?.remove()
    document.getElementById('s2p-rating-note')?.remove()
    for(const el of document.querySelectorAll('.notice')){
      const text=String(el.textContent||'')
      if(/refresh|saved board|update finishes|finding priced split fixtures|candidates checked|fresh board/i.test(text))el.remove()
    }
  }

  function setLoading(active,date=''){
    running=Boolean(active)
    const el=overlay()
    el.hidden=!running
    document.body.classList.toggle('s2p-refresh-active',running)
    const root=document.getElementById('root')
    if(root)root.setAttribute('aria-busy',running?'true':'false')
    if(running&&date)sessionStorage.setItem(ACTIVE_KEY,date)
    if(!running)sessionStorage.removeItem(ACTIVE_KEY)
    const btn=document.getElementById('refresh')
    if(btn){
      btn.disabled=running
      btn.innerHTML='↻ <span>Refresh real data</span>'
    }
    scrubInternalNotices()
  }

  function toastFailure(){
    document.querySelector('.s2p-refresh-error-toast')?.remove()
    const el=document.createElement('div')
    el.className='s2p-refresh-error-toast'
    el.textContent='Fresh matches could not be loaded right now. The last saved board is still available.'
    document.body.appendChild(el)
    setTimeout(()=>el.remove(),5000)
  }

  async function poll(date){
    if(polling)return
    polling=true
    try{
      for(let i=0;i<480;i++){
        await sleep(2500)
        const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
        if(job.status==='complete'){
          setLoading(false)
          await sleep(250)
          location.reload()
          return
        }
        if(job.status==='failed'){
          setLoading(false)
          toastFailure()
          return
        }
        if(job.status==='idle'){
          setLoading(false)
          return
        }
        setLoading(true,date)
      }
      setLoading(false)
      toastFailure()
    }catch{
      setLoading(false)
      toastFailure()
    }finally{
      polling=false
    }
  }

  async function start(date){
    if(running)return
    setLoading(true,date)
    try{
      const job=await request(`/api/refresh?date=${encodeURIComponent(date)}`,{method:'POST'})
      if(job.status==='complete'){
        setLoading(false)
        location.reload()
        return
      }
      if(job.status==='failed'){
        setLoading(false)
        toastFailure()
        return
      }
      poll(date)
    }catch{
      setLoading(false)
      toastFailure()
    }
  }

  async function maybeResume(){
    if(!token())return
    const date=selectedDate()
    if(resumedDate===date)return
    resumedDate=date
    try{
      const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
      if(job.status==='running'){
        setLoading(true,date)
        poll(date)
      }else if(job.status==='complete'&&sessionStorage.getItem(ACTIVE_KEY)===date){
        setLoading(false)
        location.reload()
      }else{
        setLoading(false)
      }
    }catch{
      setLoading(false)
    }
  }

  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('#refresh')
    if(!btn)return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    start(selectedDate())
  },true)

  const root=document.getElementById('root')
  let timer=0
  const schedule=()=>{
    clearTimeout(timer)
    timer=setTimeout(()=>{
      scrubInternalNotices()
      const active=sessionStorage.getItem(ACTIVE_KEY)
      if(active&&active===selectedDate())setLoading(true,active)
      maybeResume()
    },80)
  }
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})

  function begin(){
    scrubInternalNotices()
    const active=sessionStorage.getItem(ACTIVE_KEY)
    if(active)setLoading(true,active)
    else overlay().hidden=true
    maybeResume()
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true})
  else begin()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: refresh-resilience.v1.10.1.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: status-selection-fix.v1.10.4.js
 * =================================================================== */
try{
/* Stats2Pitch v1.10.4 — final lifecycle clock + selection label authority.
 * This layer runs after the legacy board decorators so a saved provider NS/TBD
 * can never remain "Upcoming" once kickoff + 15 minutes has passed, and safer
 * DNB/DC selection labels are rendered exactly once.
 */
(()=>{
  'use strict'

  const ACCESS_KEY='s2p_access_token'
  const STATUS_KEY='s2p_match_status'
  const KICKOFF_GRACE_MS=15*60*1000
  let board=null
  let rows=new Map()
  let scheduleTimer=0
  let clockTimer=0

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const selectedStatus=()=>sessionStorage.getItem(STATUS_KEY)||'all'
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[
    ...(b?.groups?.threePlus||[]),
    ...(b?.groups?.two||[]),
    ...(b?.groups?.single||[]),
    ...(b?.priority||[]),
    ...(b?.bestPicks||[])
  ]

  function rebuild(){
    rows=new Map()
    for(const row of allRows(board)){
      const key=keyFor(row)
      if(key&&!rows.has(key))rows.set(key,row)
    }
  }

  async function load(){
    const t=token()
    if(!t)return null
    try{
      const response=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{
        headers:{Authorization:`Bearer ${t}`},
        cache:'no-store'
      })
      if(!response.ok)return null
      board=await response.json()
      rebuild()
      return board
    }catch{return null}
  }

  function kickoffMs(row){
    const ms=new Date(row?.kickoff||'').getTime()
    return Number.isFinite(ms)?ms:null
  }

  function effectiveGroup(row,now=Date.now()){
    const group=String(row?.statusGroup||'pending').toLowerCase()
    if(group==='live'||group==='settled'||group==='postponed'||group==='pending')return group
    if(group==='upcoming'){
      const kick=kickoffMs(row)
      if(kick!==null&&now>kick+KICKOFF_GRACE_MS)return'pending'
      return'upcoming'
    }
    return'pending'
  }

  function kickoffText(row){
    const d=new Date(row?.kickoff||'')
    if(Number.isNaN(d.getTime()))return String(row?.kickoffLocal||'').split(',').pop()?.trim()||''
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)
  }

  function scoreText(row){
    const h=row?.homeScore,a=row?.awayScore
    return h!==null&&h!==undefined&&a!==null&&a!==undefined&&Number.isFinite(Number(h))&&Number.isFinite(Number(a))?`${Number(h)}–${Number(a)}`:''
  }

  function statusLabel(row,now=Date.now()){
    const group=effectiveGroup(row,now),score=scoreText(row)
    if(group==='live')return `LIVE${row?.elapsed!==null&&row?.elapsed!==undefined&&Number.isFinite(Number(row.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`
    if(group==='settled')return `${row?.statusShort||'FT'}${score?` · ${score}`:''}`
    if(group==='postponed')return row?.statusShort==='CANC'?'Cancelled':row?.statusShort==='ABD'?'Abandoned':'Postponed'
    if(group==='pending')return'Awaiting status'
    return'Upcoming'
  }

  function collapseDuplicate(value){
    const text=String(value??'').replace(/\s+/g,' ').trim()
    if(!text)return''
    if(text.length%2===0){
      const half=text.length/2
      if(text.slice(0,half)===text.slice(half))return text.slice(0,half).trim()
    }
    return text
  }

  function selectionLabel(row){
    const explicit=collapseDuplicate(row?.selectionLabel)
    if(explicit)return explicit
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return `${row.selectedTeam} ${row?.downgradeMarket||''}`.trim()
    return''
  }

  function visible(row,now=Date.now()){
    const filter=selectedStatus()
    return filter==='all'||effectiveGroup(row,now)===filter
  }

  function clearLegacySelectionOverride(node,label){
    if(!node||!label)return
    if(node.textContent!==label)node.textContent=label
    node.classList.remove('s2p-selection-override')
    node.removeAttribute('data-selection-label')
  }

  function decorateTables(now){
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){
      const button=tr.querySelector('[data-row-key]')
      const row=button?rows.get(button.dataset.rowKey):null
      if(!row)continue
      const group=effectiveGroup(row,now)
      tr.dataset.s2pStatus=group
      tr.classList.toggle('s2p-status-hidden',!visible(row,now))
      const time=tr.querySelector('[data-label="Time"]')
      if(time){
        time.dataset.s2pStatus=statusLabel(row,now)
        time.dataset.s2pKickoff=kickoffText(row)
      }
      const prediction=tr.querySelector('[data-label="Prediction"]')
      clearLegacySelectionOverride(prediction,selectionLabel(row))
    }
  }

  function decorateBest(now){
    let visibleBest=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const row=rows.get(item.dataset.priorityKey)
      if(!row)continue
      const match=item.querySelector('.priority-compact-match')
      if(match){
        match.dataset.kickoff=kickoffText(row)
        match.dataset.statusLabel=statusLabel(row,now)
        clearLegacySelectionOverride(match.querySelector('small'),selectionLabel(row))
      }
      const show=visible(row,now)
      item.dataset.s2pStatus=effectiveGroup(row,now)
      item.classList.toggle('s2p-status-hidden',!show)
      if(show)visibleBest++
    }
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b')
    if(badge&&badge.textContent!==String(visibleBest))badge.textContent=String(visibleBest)
  }

  function decorateCounts(){
    for(const [tab,selector] of [['three','.prediction-panel[data-s2p-tab-panel="three"]'],['two','.prediction-panel[data-s2p-tab-panel="two"]'],['single','.prediction-panel[data-s2p-tab-panel="single"]']]){
      const panel=document.querySelector(selector)
      if(!panel)continue
      const count=[...panel.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('s2p-status-hidden')).length
      const badge=document.querySelector(`.s2p-board-tab[data-s2p-tab="${tab}"] b`)
      if(badge&&badge.textContent!==String(count))badge.textContent=String(count)
    }
  }

  function installPendingOption(){
    const select=document.getElementById('s2p-status')
    if(!select)return
    if(![...select.options].some(option=>option.value==='pending')){
      const option=document.createElement('option')
      option.value='pending'
      option.textContent='Awaiting status'
      select.appendChild(option)
    }
    const saved=selectedStatus()
    if([...select.options].some(option=>option.value===saved)&&select.value!==saved)select.value=saved
  }

  function apply(){
    if(!board)return
    const now=Date.now()
    installPendingOption()
    decorateTables(now)
    decorateBest(now)
    decorateCounts()
  }

  async function boot(){
    if(!document.querySelector('.app-shell'))return
    await load()
    requestAnimationFrame(()=>requestAnimationFrame(apply))
    if(!clockTimer)clockTimer=setInterval(apply,30*1000)
  }

  function schedule(){
    clearTimeout(scheduleTimer)
    scheduleTimer=setTimeout(boot,240)
  }

  const root=document.getElementById('root')
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  document.addEventListener('change',event=>{
    if(['date','s2p-status'].includes(event.target?.id))schedule()
  },true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(apply),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: status-selection-fix.v1.10.4.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: board-runtime-v1.11.6.js
 * =================================================================== */
try{
/* Stats2Pitch v1.11.6 — deterministic modern board runtime.
 * Mounts only after data is loaded, renders an explicit error state on failure,
 * and never observes/reboots from its own card DOM mutations.
 */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const FAV_KEY='s2p_saved_picks_v111'
  const KICKOFF_GRACE_MS=15*60*1000
  const FETCH_TIMEOUT_MS=12000
  let board=null
  let active='best'
  let bootTimer=0
  let booting=false
  let currentDate=''
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
    const raw=String(row?.selectionLabel||'').trim()
    if(raw){
      const half=raw.length/2
      if(Number.isInteger(half)&&raw.slice(0,half)===raw.slice(half))return raw.slice(0,half)
      return raw
    }
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
    for(const r of rows||[]){const k=String(r?.fixtureId||rowKey(r));if(!out.has(k))out.set(k,r)}
    return [...out.values()]
  }
  function bestRows(){return Array.isArray(board?.bestPicks)&&board.bestPicks.length?board.bestPicks:uniqueBest(allRows(board))}
  function rowsForMode(){
    const best=bestRows()
    if(active==='upcoming')return best.filter(r=>effectiveGroup(r)==='upcoming')
    if(active==='live')return best.filter(r=>effectiveGroup(r)==='live')
    if(active==='three')return uniqueBest(board?.groups?.threePlus||[])
    if(active==='saved'){const saved=favs();return best.filter(r=>saved.has(rowKey(r)))}
    return best
  }
  function counts(){
    const best=bestRows()
    return{best:best.length,upcoming:best.filter(r=>effectiveGroup(r)==='upcoming').length,live:best.filter(r=>effectiveGroup(r)==='live').length,three:uniqueBest(board?.groups?.threePlus||[]).length}
  }
  function titleForMode(){return active==='upcoming'?'Upcoming predictions':active==='live'?'Live predictions':active==='three'?'3+ filter picks':active==='saved'?'My saved picks':'Best picks'}

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

  function ensureHost(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return null
    let host=document.getElementById('s2p-card-board')
    if(!host){host=document.createElement('section');host.id='s2p-card-board';shell.prepend(host)}
    return host
  }
  function markReady(host,state='ready'){
    if(!host)return
    host.dataset.s2pState=state
    document.documentElement.classList.add('s2p-v111','s2p-ui-ready')
    document.dispatchEvent(new CustomEvent('s2p:board-ready',{detail:{state,date:currentDate}}))
  }

  function render(){
    if(!board)return false
    const host=ensureHost();if(!host)return false
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
    markReady(host,'ready')
    return true
  }

  function renderError(message='The prediction board could not load.'){
    const host=ensureHost();if(!host)return false
    host.innerHTML=`<header class="s2p-new-head"><div class="s2p-brand-center"><img class="s2p-brand-lockup" src="/assets/brand-wordmark.png" alt="Stats2Pitch"><p>Prediction Board</p></div></header>
      <div class="s2p-empty s2p-board-error"><strong>${esc(message)}</strong><span>Your account is still signed in. Retry the board without clearing anything.</span><button type="button" data-board-retry>Retry board</button></div>`
    host.querySelector('[data-board-retry]')?.addEventListener('click',()=>boot(true))
    markReady(host,'error')
    return true
  }

  function sourceButton(key){try{return document.querySelector(`[data-row-key="${CSS.escape(key)}"]`)}catch{return null}}
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

  async function loadBoard(date){
    const t=token();if(!t)throw new Error('Your session is not ready yet.')
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS)
    try{
      const r=await fetch(`/api/board?date=${encodeURIComponent(date)}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store',signal:controller.signal})
      if(r.status===401)throw new Error('Your session expired. Please sign in again.')
      if(!r.ok)throw new Error(`Board request failed (${r.status}).`)
      const data=await r.json()
      if(!data||typeof data!=='object')throw new Error('The board returned an invalid response.')
      return data
    }catch(e){
      if(e?.name==='AbortError')throw new Error('The board took too long to respond.')
      throw e
    }finally{clearTimeout(timeout)}
  }

  async function boot(force=false){
    if(booting)return
    const shell=document.querySelector('.app-shell')
    if(!shell||!token())return
    const date=selectedDate()
    if(!force&&board&&currentDate===date&&document.querySelector('#s2p-card-board[data-s2p-state="ready"]'))return
    booting=true
    document.documentElement.classList.add('s2p-v111')
    try{
      board=await loadBoard(date)
      currentDate=date
      render()
    }catch(e){
      board=null
      currentDate=date
      renderError(e?.message||'The prediction board could not load.')
    }finally{booting=false}
  }
  function schedule(force=false){clearTimeout(bootTimer);bootTimer=setTimeout(()=>boot(force),180)}

  document.addEventListener('click',event=>{
    if(document.documentElement.classList.contains('s2p-v111-controls-open')&&!event.target.closest('.controls')&&!event.target.closest('#s2p-menu'))toggleControls(false)
  },true)
  document.addEventListener('change',event=>{
    if(event.target?.id==='date'){board=null;currentDate='';schedule(true)}
    else if(['market','minf','sortby','primary-rule','s2p-status'].includes(event.target?.id))schedule(true)
  },true)

  const root=document.getElementById('root')
  if(root)new MutationObserver(()=>{
    if(document.querySelector('.auth-page'))return
    if(document.querySelector('.app-shell')&&!document.querySelector('#s2p-card-board[data-s2p-state="ready"]'))schedule(false)
  }).observe(root,{childList:true})

  window.addEventListener('pageshow',()=>schedule(false),{passive:true})
  window.addEventListener('s2p:tabchange',()=>schedule(false),{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(false),{once:true});else schedule(false)

  setInterval(()=>{
    if(board&&document.querySelector('#s2p-card-board[data-s2p-state="ready"]')&&active!=='live')render()
  },30000)
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: board-runtime-v1.11.6.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: board-responsive-v1.11.2.js
 * =================================================================== */
try{
/* Stats2Pitch v1.11.2 — device-aware board navigation.
 * Adds a desktop utility navigation without changing the mobile bottom app nav.
 */
(()=>{
  'use strict'
  let timer=0
  const mqDesktop=window.matchMedia('(min-width:1024px)')

  function syncDeviceClass(){
    document.documentElement.classList.toggle('s2p-desktop-board',mqDesktop.matches)
    document.documentElement.classList.toggle('s2p-mobile-board',!mqDesktop.matches)
  }

  function mirrorActive(nav){
    const mobile=document.querySelector('.s2p-mobile-nav')
    if(!mobile||!nav)return
    const active=mobile.querySelector('.s2p-nav-btn.active')?.dataset.nav||'board'
    nav.querySelectorAll('[data-desktop-nav]').forEach(btn=>btn.classList.toggle('active',btn.dataset.desktopNav===active))
  }

  function triggerMobileNav(name){
    const source=document.querySelector(`.s2p-mobile-nav [data-nav="${CSS.escape(name)}"]`)
    if(source)source.click()
  }

  function ensureDesktopNav(){
    syncDeviceClass()
    const host=document.getElementById('s2p-card-board')
    if(!host)return
    let nav=host.querySelector('.s2p-desktop-nav')
    if(!nav){
      nav=document.createElement('nav')
      nav.className='s2p-desktop-nav'
      nav.setAttribute('aria-label','Stats2Pitch desktop navigation')
      nav.innerHTML=`
        <button type="button" data-desktop-nav="board">▣ <span>Board</span></button>
        <button type="button" data-desktop-nav="saved">★ <span>My Picks</span></button>
        <button type="button" data-desktop-nav="stats">▥ <span>Stats</span></button>
        <button type="button" data-desktop-nav="alerts">♧ <span>Alerts</span></button>
        <button type="button" data-desktop-nav="profile">◯ <span>Profile</span></button>`
      const tabs=host.querySelector('.s2p-main-tabs')
      if(tabs)tabs.insertAdjacentElement('afterend',nav)
      else host.prepend(nav)
      nav.addEventListener('click',event=>{
        const button=event.target.closest('[data-desktop-nav]')
        if(!button)return
        triggerMobileNav(button.dataset.desktopNav)
        requestAnimationFrame(()=>mirrorActive(nav))
      })
    }
    mirrorActive(nav)
  }

  function schedule(){
    clearTimeout(timer)
    timer=setTimeout(ensureDesktopNav,120)
  }

  mqDesktop.addEventListener?.('change',schedule)
  window.addEventListener('resize',schedule,{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  window.addEventListener('s2p:tabchange',schedule,{passive:true})
  const root=document.getElementById('root')
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: board-responsive-v1.11.2.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: live-scores-v1.11.3.js
 * =================================================================== */
try{
/* Stats2Pitch v1.11.3 — provider-backed Live Scores tab. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const POLL_MS=30000
  const CLIENT_FRESH_MS=12000
  let timer=0,observerTimer=0,inFlight=false,last=null,lastDate='',lastAt=0

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const liveSelected=()=>document.querySelector('.s2p-main-tab[data-view="live"]')?.classList.contains('active')===true
  const host=()=>document.querySelector('#s2p-card-board .s2p-card-list')
  const fmtTime=value=>{const d=new Date(value||'');return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  const score=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':String(Number(v))

  function statusText(f){
    if(f.statusGroup==='live'){
      const s=String(f.statusShort||'LIVE').toUpperCase()
      if(s==='HT')return'HT'
      if(s==='ET')return f.elapsed?`ET ${f.elapsed}′`:'ET'
      if(s==='P')return'PEN'
      return Number.isFinite(Number(f.elapsed))?`LIVE ${Number(f.elapsed)}′`:'LIVE'
    }
    if(f.statusGroup==='settled')return f.statusShort||'FT'
    if(f.statusGroup==='postponed')return f.statusShort==='CANC'?'Cancelled':'Postponed'
    if(f.statusGroup==='pending')return'Awaiting status'
    return fmtTime(f.kickoff)
  }

  function badge(url,fallback,cls=''){
    return url?`<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">`:`<span class="s2p-live-badge-fallback ${cls}">${esc(String(fallback||'?').slice(0,2).toUpperCase())}</span>`
  }

  function matchRow(f){
    const live=f.statusGroup==='live',settled=f.statusGroup==='settled'
    return `<article class="s2p-live-row ${esc(f.statusGroup||'pending')}" data-live-fixture="${esc(f.fixtureId)}">
      <div class="s2p-live-league">
        <div class="s2p-live-league-icons">${badge(f.league?.flag,f.league?.country,'flag')}${badge(f.league?.logo,f.league?.name,'league')}</div>
        <div><strong>${esc(f.league?.name||'Competition')}</strong><span>${esc(f.league?.country||f.league?.round||'')}</span></div>
      </div>
      <div class="s2p-live-teams">
        <div class="s2p-live-team">${badge(f.home?.logo,f.home?.name,'team')}<strong>${esc(f.home?.name||'Home')}</strong></div>
        <div class="s2p-live-team">${badge(f.away?.logo,f.away?.name,'team')}<strong>${esc(f.away?.name||'Away')}</strong></div>
      </div>
      <div class="s2p-live-scorebox">
        <div class="s2p-live-score"><strong>${score(f.homeScore)}</strong><span>:</span><strong>${score(f.awayScore)}</strong></div>
        <div class="s2p-live-state ${live?'is-live':settled?'is-ft':''}">${live?'<i></i>':''}${esc(statusText(f))}</div>
      </div>
      <div class="s2p-live-meta"><span>${esc(fmtTime(f.kickoff))}</span>${f.venue?`<small>${esc(f.venue)}</small>`:''}</div>
    </article>`
  }

  function fallbackRows(data){
    const fixtures=Array.isArray(data?.fixtures)?data.fixtures:[]
    const settled=fixtures.filter(f=>f.statusGroup==='settled').sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,6)
    const upcoming=fixtures.filter(f=>f.statusGroup==='upcoming').sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,6)
    return [...settled,...upcoming]
  }

  function syncLegacyTools(liveCount){
    const tools=document.querySelector('#s2p-card-board .s2p-board-tools')
    if(!tools)return
    const h2=tools.querySelector('h2'),meta=tools.querySelector('span')
    if(h2&&h2.textContent!=='Live Scores')h2.textContent='Live Scores'
    const value=`${liveCount} live now`
    if(meta&&meta.textContent!==value)meta.textContent=value
  }

  function render(data){
    if(!liveSelected())return
    const target=host();if(!target)return
    const fixtures=Array.isArray(data?.fixtures)?data.fixtures:[]
    const live=fixtures.filter(f=>f.statusGroup==='live')
    const rows=live.length?live:fallbackRows(data)
    const liveTab=document.querySelector('.s2p-main-tab[data-view="live"]')
    const count=liveTab?.querySelector('.count');if(count&&count.textContent!==String(data?.counts?.live??live.length))count.textContent=String(data?.counts?.live??live.length)
    const label=liveTab?.querySelector('span');if(label&&label.textContent!=='Live Scores')label.textContent='Live Scores'
    syncLegacyTools(Number(data?.counts?.live??live.length))

    const updated=data?.generatedAt?new Date(data.generatedAt):null
    const updatedText=updated&&!Number.isNaN(updated.getTime())?new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(updated):''
    const stamp=`${data?.generatedAt||''}|${rows.map(r=>`${r.fixtureId}:${r.statusShort}:${r.elapsed}:${r.homeScore}:${r.awayScore}`).join(',')}`
    if(target.dataset.s2pLiveStamp!==stamp){
      target.innerHTML=`<section class="s2p-live-scoreboard">
        <header class="s2p-live-head">
          <div><h2>${live.length?'Live now':'Live scores'}</h2><p>${live.length?`${live.length} match${live.length===1?'':'es'} live now`:'No match is live right now. Showing the latest results and next fixtures for today.'}</p></div>
          <div class="s2p-live-freshness"><span class="s2p-live-provider-dot"></span><span>API-Football</span>${updatedText?`<small>Updated ${esc(updatedText)}</small>`:''}</div>
        </header>
        <div class="s2p-live-summary">
          <span><b>${esc(data?.counts?.live??0)}</b> Live</span>
          <span><b>${esc(data?.counts?.settled??0)}</b> FT</span>
          <span><b>${esc(data?.counts?.upcoming??0)}</b> Upcoming</span>
          <button type="button" data-live-refresh>↻ Update scores</button>
        </div>
        <div class="s2p-live-list">${rows.length?rows.map(matchRow).join(''):'<div class="s2p-live-empty"><strong>No fixtures found for this date.</strong><span>Choose another fixture date or try again shortly.</span></div>'}</div>
      </section>`
      target.dataset.s2pLiveStamp=stamp
      target.querySelector('[data-live-refresh]')?.addEventListener('click',()=>load(true))
    }
    document.documentElement.classList.add('s2p-live-score-mode')
  }

  async function load(force=false){
    if(!liveSelected()||inFlight||!token())return
    const date=selectedDate()
    if(!force&&last&&lastDate===date&&Date.now()-lastAt<CLIENT_FRESH_MS){render(last);return}
    inFlight=true
    try{
      const r=await fetch(`/api/live-scores?date=${encodeURIComponent(date)}${force?'&fresh=1':''}`,{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'})
      if(!r.ok)throw new Error(`Live scores ${r.status}`)
      last=await r.json();lastDate=date;lastAt=Date.now();render(last)
    }catch{
      const target=host();if(target&&liveSelected()&&!target.querySelector('.s2p-live-scoreboard'))target.innerHTML='<div class="s2p-live-empty"><strong>Live scores are temporarily unavailable.</strong><span>Stats2Pitch will retry automatically.</span></div>'
    }finally{inFlight=false}
  }

  function sync(){
    if(liveSelected()){
      document.documentElement.classList.add('s2p-live-score-mode')
      if(last&&lastDate===selectedDate())render(last)
      if(!last||lastDate!==selectedDate()||Date.now()-lastAt>=CLIENT_FRESH_MS)load(false)
    }else document.documentElement.classList.remove('s2p-live-score-mode')
  }
  function schedule(){clearTimeout(observerTimer);observerTimer=setTimeout(sync,120)}

  document.addEventListener('click',event=>{
    const tab=event.target.closest?.('.s2p-main-tab[data-view="live"]')
    if(tab)setTimeout(sync,0)
    const refresh=event.target.closest?.('#s2p-mini-refresh')
    if(refresh&&liveSelected()){
      event.preventDefault();event.stopImmediatePropagation();load(true)
    }
  },true)
  document.addEventListener('change',event=>{if(event.target?.id==='date'){last=null;lastDate='';lastAt=0;schedule()}},true)
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  timer=setInterval(()=>{if(liveSelected())load(false)},POLL_MS)
  window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: live-scores-v1.11.3.js',s2pSegmentError)}catch(_){}}
;
