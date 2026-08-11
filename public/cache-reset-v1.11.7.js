/* Stats2Pitch v1.11.7 — one-time UI cache cleanup without a service-worker boot dependency. */
(()=>{
  'use strict'
  const BUILD='1.13.2'
  const BUILD_KEY='s2p_ui_build'
  const KEEP_LOCAL=new Set(['s2p_access_token','s2p_refresh_token','s2p_saved_picks_v111'])

  document.documentElement.classList.add('s2p-ui-current')
  if(!document.documentElement.dataset.s2pUiBuild)document.documentElement.dataset.s2pUiBuild=BUILD

  let changed=true
  try{changed=localStorage.getItem(BUILD_KEY)!==BUILD}catch{}
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

  if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{})
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(reg=>reg.unregister().catch(()=>false)))).catch(()=>{})
  }
})()
