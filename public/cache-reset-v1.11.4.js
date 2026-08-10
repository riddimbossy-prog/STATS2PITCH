/* Stats2Pitch v1.11.4 — stale UI/cache purge.
 * Preserves authentication + saved picks, removes stale UI/session state,
 * replaces any old service worker, clears CacheStorage, and defeats BFCache restores.
 */
(()=>{
  'use strict'
  const BUILD='1.11.4'
  const BUILD_KEY='s2p_ui_build'
  const KEEP_LOCAL=new Set(['s2p_access_token','s2p_refresh_token','s2p_saved_picks_v111'])

  document.documentElement.classList.add('s2p-ui-current')
  document.documentElement.dataset.s2pUiBuild=BUILD

  function clearOldState(){
    try{
      if(localStorage.getItem(BUILD_KEY)!==BUILD){
        for(let i=localStorage.length-1;i>=0;i--){
          const key=localStorage.key(i)
          if(key&&key.startsWith('s2p_')&&!KEEP_LOCAL.has(key)&&key!==BUILD_KEY)localStorage.removeItem(key)
        }
        for(let i=sessionStorage.length-1;i>=0;i--){
          const key=sessionStorage.key(i)
          if(key&&key.startsWith('s2p_'))sessionStorage.removeItem(key)
        }
        localStorage.setItem(BUILD_KEY,BUILD)
      }
    }catch{}
  }

  async function clearCaches(){
    if(!('caches' in window))return
    try{for(const key of await caches.keys())await caches.delete(key)}catch{}
  }

  async function replaceServiceWorker(){
    if(!('serviceWorker' in navigator))return
    try{
      const regs=await navigator.serviceWorker.getRegistrations()
      for(const reg of regs)await reg.unregister().catch(()=>false)
      const reg=await navigator.serviceWorker.register(`/sw.js?v=${BUILD}`,{scope:'/',updateViaCache:'none'})
      await reg.update().catch(()=>{})
    }catch{}
  }

  clearOldState()
  clearCaches()
  replaceServiceWorker()

  window.addEventListener('pageshow',event=>{
    if(event.persisted){
      try{location.reload()}catch{}
    }
  })
})()
