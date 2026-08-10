/* Stats2Pitch v1.11.5 — safe one-time stale UI/cache cleanup.
 * Preserves authentication + saved picks. Never unregisters/re-registers the
 * service worker on every page load and never forces navigation loops.
 */
(()=>{
  'use strict'
  const BUILD='1.11.5'
  const BUILD_KEY='s2p_ui_build'
  const KEEP_LOCAL=new Set(['s2p_access_token','s2p_refresh_token','s2p_saved_picks_v111'])

  document.documentElement.classList.add('s2p-ui-current')
  document.documentElement.dataset.s2pUiBuild=BUILD

  let previous=''
  try{previous=localStorage.getItem(BUILD_KEY)||''}catch{}
  const changed=previous!==BUILD

  function clearOldState(){
    if(!changed)return
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i)
        if(key&&key.startsWith('s2p_')&&!KEEP_LOCAL.has(key)&&key!==BUILD_KEY)localStorage.removeItem(key)
      }
      for(let i=sessionStorage.length-1;i>=0;i--){
        const key=sessionStorage.key(i)
        if(key&&key.startsWith('s2p_'))sessionStorage.removeItem(key)
      }
      localStorage.setItem(BUILD_KEY,BUILD)
    }catch{}
  }

  async function clearCaches(){
    if(!changed||!('caches' in window))return
    try{await Promise.all((await caches.keys()).map(key=>caches.delete(key)))}catch{}
  }

  async function ensureServiceWorker(){
    if(!('serviceWorker' in navigator))return
    try{
      const reg=await navigator.serviceWorker.register(`/sw.js?v=${BUILD}`,{scope:'/',updateViaCache:'none'})
      if(changed){
        await reg.update().catch(()=>{})
        const worker=reg.active||reg.waiting||reg.installing
        worker?.postMessage?.('PURGE_S2P_CACHES')
      }
    }catch{}
  }

  clearOldState()
  if(changed)clearCaches()
  ensureServiceWorker()
})()
