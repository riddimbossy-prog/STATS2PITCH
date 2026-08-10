/* Stats2Pitch v1.11.7 — bounded startup fetch timeouts + automatic board recovery. */
(()=>{
  'use strict'
  const nativeFetch=window.fetch.bind(window)
  const STARTUP_PATHS=new Set(['/api/config','/api/me','/api/board'])

  const sleep=ms=>new Promise(r=>setTimeout(r,ms))
  const toUrl=input=>{try{return new URL(typeof input==='string'?input:input?.url||'',location.href)}catch{return null}}

  async function timedFetch(input,init={},timeoutMs=9000){
    const externalSignal=init?.signal
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out','AbortError')),timeoutMs)
    if(externalSignal){
      if(externalSignal.aborted)controller.abort(externalSignal.reason)
      else externalSignal.addEventListener('abort',()=>controller.abort(externalSignal.reason),{once:true})
    }
    try{return await nativeFetch(input,{...init,signal:controller.signal})}
    finally{clearTimeout(timer)}
  }

  window.fetch=async function(input,init={}){
    const url=toUrl(input)
    const method=String(init?.method||'GET').toUpperCase()
    const startup=method==='GET'&&url&&url.origin===location.origin&&STARTUP_PATHS.has(url.pathname)
    if(!startup)return nativeFetch(input,init)

    let lastError=null
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await timedFetch(input,init,9000)
        if(response.status<500&&response.status!==429)return response
        if(attempt===2)return response
      }catch(err){
        lastError=err
        if(attempt===2)throw err
      }
      await sleep(700*(attempt+1))
    }
    if(lastError)throw lastError
    return nativeFetch(input,init)
  }

  let recoveryTimer=0,recoveryAttempt=0
  function scheduleBoardRecovery(){
    clearTimeout(recoveryTimer)
    const host=document.getElementById('s2p-card-board')
    if(host?.dataset?.s2pState!=='error'){
      if(host?.dataset?.s2pState==='ready')recoveryAttempt=0
      return
    }

    /* Error is internal only: keep the football-pitch loader visible to users. */
    document.documentElement.classList.remove('s2p-ui-ready')
    recoveryAttempt++
    const delay=Math.min(15000,1800*Math.max(1,recoveryAttempt))
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
