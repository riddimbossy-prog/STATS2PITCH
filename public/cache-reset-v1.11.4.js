/* Compatibility shim for stale v1.11.4 HTML.
 * Do not unregister workers or navigate the page. The current v1.11.5 worker
 * owns cache cleanup safely and this file exists only to rescue old tabs.
 */
(()=>{
  'use strict'
  document.documentElement.classList.add('s2p-ui-current')
  try{
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{})
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js?v=1.11.5',{scope:'/',updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{})
    }
  }catch{}
})()
