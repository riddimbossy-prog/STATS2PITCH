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
