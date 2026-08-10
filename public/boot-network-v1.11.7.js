/* Stats2Pitch UI v1.12.2 — fast bounded startup + non-blocking automatic board recovery. */
(()=>{
  'use strict'
  const nativeFetch=window.fetch.bind(window)
  const STARTUP_TIMEOUTS=new Map([
    ['/api/config',4500],
    ['/api/me',4500],
    ['/api/board',7500]
  ])

  const toUrl=input=>{try{return new URL(typeof input==='string'?input:input?.url||'',location.href)}catch{return null}}

  async function timedFetch(input,init={},timeoutMs=6000){
    const externalSignal=init?.signal
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out','AbortError')),timeoutMs)
    const onAbort=()=>controller.abort(externalSignal?.reason)
    if(externalSignal){
      if(externalSignal.aborted)controller.abort(externalSignal.reason)
      else externalSignal.addEventListener('abort',onAbort,{once:true})
    }
    try{return await nativeFetch(input,{...init,signal:controller.signal})}
    finally{
      clearTimeout(timer)
      if(externalSignal)externalSignal.removeEventListener?.('abort',onAbort)
    }
  }

  window.fetch=function(input,init={}){
    const url=toUrl(input)
    const method=String(init?.method||'GET').toUpperCase()
    const timeout=url&&url.origin===location.origin&&method==='GET'?STARTUP_TIMEOUTS.get(url.pathname):null
    return timeout?timedFetch(input,init,timeout):nativeFetch(input,init)
  }

  let recoveryTimer=0,recoveryAttempt=0
  function scheduleBoardRecovery(){
    clearTimeout(recoveryTimer)
    const host=document.getElementById('s2p-card-board')
    const state=host?.dataset?.s2pState||''
    if(state==='ready'){
      recoveryAttempt=0
      document.documentElement.classList.add('s2p-ui-ready')
      return
    }
    if(state!=='error')return

    // Recovery happens behind the visible app. Never put the full-screen loader
    // back on top of the UI after the initial splash has finished.
    recoveryAttempt++
    const delay=Math.min(15000,2200*Math.max(1,recoveryAttempt))
    recoveryTimer=setTimeout(()=>{
      const current=document.getElementById('s2p-card-board')
      if(current?.dataset?.s2pState!=='error')return
      const retry=current.querySelector('[data-board-retry]')
      if(retry){retry.click();return}
      document.dispatchEvent(new CustomEvent('s2p:board-recover'))
    },delay)
  }

  const root=document.getElementById('root')
  if(root)new MutationObserver(scheduleBoardRecovery).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})
  document.addEventListener('s2p:board-ready',scheduleBoardRecovery,{passive:true})
})()
