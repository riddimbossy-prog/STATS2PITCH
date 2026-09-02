let deferredInstall=null
const button=document.getElementById('installApp')
const SW_VER='5.14.0'
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(button)button.hidden=false})
button?.addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;button.hidden=true})

;(function refreshWorker(){
  if(!('serviceWorker'in navigator))return
  const flag='s2p-sw-'+SW_VER
  const go=async()=>{
    try{
      if(window.caches){
        const keys=await caches.keys()
        await Promise.all(keys.filter(k=>k!=='stats2pitch-shell-v'+SW_VER).map(k=>caches.delete(k)))
      }
      const regs=await navigator.serviceWorker.getRegistrations()
      let stale=false
      for(const r of regs){
        const url=(r.active&&r.active.scriptURL)||(r.waiting&&r.waiting.scriptURL)||(r.installing&&r.installing.scriptURL)||''
        if(!String(url).includes('v='+SW_VER)){
          stale=true
          await r.unregister()
        }
      }
      const reg=await navigator.serviceWorker.register('/sw.js?v='+SW_VER,{updateViaCache:'none'})
      if(reg.waiting)reg.waiting.postMessage('SKIP_WAITING')
      if(stale&&sessionStorage.getItem(flag)!=='1'){
        sessionStorage.setItem(flag,'1')
        location.reload()
      }
    }catch{}
  }
  go()
})()

const root=document.documentElement
let scrollNavTimer=null
const markScrolling=()=>{
  root.classList.add('is-scrolling')
  clearTimeout(scrollNavTimer)
  scrollNavTimer=setTimeout(()=>root.classList.remove('is-scrolling'),450)
}
window.addEventListener('scroll',markScrolling,{passive:true})
window.addEventListener('touchmove',markScrolling,{passive:true})
window.addEventListener('touchend',()=>{
  if(!root.classList.contains('is-scrolling'))return
  clearTimeout(scrollNavTimer)
  scrollNavTimer=setTimeout(()=>root.classList.remove('is-scrolling'),450)
},{passive:true})

const nav=document.querySelector('.mobile-nav')
if(nav){
  let sx=0,sy=0,moved=false
  nav.addEventListener('touchstart',e=>{
    const t=e.changedTouches[0]
    sx=t.clientX;sy=t.clientY;moved=false
  },{passive:true})
  nav.addEventListener('touchmove',e=>{
    const t=e.changedTouches[0]
    if(Math.abs(t.clientX-sx)>8||Math.abs(t.clientY-sy)>8){
      moved=true
      markScrolling()
    }
  },{passive:true})
  const blockNavNav=e=>{
    if(moved||root.classList.contains('is-scrolling')){
      e.preventDefault()
      e.stopPropagation()
    }
  }
  nav.addEventListener('click',blockNavNav,true)
  nav.addEventListener('touchend',blockNavNav,true)
}

;(function bootAuthGate(){
  if(document.querySelector('script[data-s2p-gate]'))return
  if(!document.querySelector('link[href*="auth.css"]')){
    const link=document.createElement('link')
    link.rel='stylesheet'
    link.href='/auth.css?v=5.14.0'
    document.head.appendChild(link)
  }
  if(!document.querySelector('script[src*="gate.js"]')){
    const s=document.createElement('script')
    s.type='module'
    s.src='/gate.js?v=5.14.0'
    s.dataset.s2pGate='1'
    document.head.appendChild(s)
  }
})()
