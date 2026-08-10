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
