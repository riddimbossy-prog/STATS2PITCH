/* Stats2Pitch UI v1.12.2 — football animation is a splash, never a blocking gate. */
(()=>{
  'use strict'
  let observer=null,minTimer=0,maxTimer=0
  let minElapsed=false,finished=false
  const MIN_SPLASH_MS=650
  const MAX_SPLASH_MS=5500

  const guard=()=>document.getElementById('s2p-boot-guard')
  const hasUsableSurface=()=>Boolean(
    document.querySelector('.auth-page')||
    document.querySelector('.app-shell')||
    document.getElementById('s2p-card-board')
  )

  function finish(force=false){
    if(finished)return true
    if(!force&&(!minElapsed||!hasUsableSurface()))return false
    finished=true
    document.documentElement.classList.add('s2p-ui-ready')
    document.documentElement.classList.remove('s2p-recovery-visible')
    clearTimeout(minTimer);clearTimeout(maxTimer)
    observer?.disconnect()
    return true
  }

  function start(){
    const root=document.getElementById('root'),g=guard()
    if(!root||!g)return

    minTimer=setTimeout(()=>{
      minElapsed=true
      finish(false)
    },MIN_SPLASH_MS)

    observer=new MutationObserver(()=>finish(false))
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})
    document.addEventListener('s2p:board-ready',()=>finish(false),{passive:true})

    // Absolute safety rail: the pitch animation can never cover the site forever.
    maxTimer=setTimeout(()=>{
      finish(true)
      // If the app bootstrap itself has not painted anything useful yet, leave a
      // lightweight visible connection surface behind. The real app will replace
      // it automatically when config/auth finishes.
      if(!hasUsableSurface()){
        root.innerHTML='<div class="splash"><img src="/assets/brand-mark.png" alt=""><span>Connecting to Stats2Pitch…</span></div>'
      }
    },MAX_SPLASH_MS)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
})()
