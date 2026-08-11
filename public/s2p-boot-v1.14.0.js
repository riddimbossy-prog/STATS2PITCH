/* Stats2Pitch v1.14.0 — boot layer (parser-blocking, runs before the app module).
 * Consolidated bundle. Segments run in the order listed below, exactly as they
 * did when they were separate files. Each segment is isolated in try/catch so a
 * failure in one cannot stop the rest.
 *
 *    1. boot-network-v1.11.7.js
 *    2. boot-resilience-v1.13.0.js
 *    3. boot-guard-v1.11.7.js
 *    4. date-board-router.v1.10.0.js
 */
'use strict';

/* ===================================================================
 * segment: boot-network-v1.11.7.js
 * =================================================================== */
try{
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
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: boot-network-v1.11.7.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: boot-resilience-v1.13.0.js
 * =================================================================== */
try{
/* Stats2Pitch UI v1.13.0 — deterministic non-blocking bootstrap + shared real board read.
 * The first legacy /api/board call may never decide whether the UI exists.
 * It receives an immediate shell board while the real request continues once
 * in the background for the modern board runtime to reuse.
 */
(()=>{
  'use strict'

  const upstreamFetch=window.fetch.bind(window)
  const CACHE_TTL_MS=6000
  const cache=new Map()
  const pending=new Map()
  let bootstrapFallbackUsed=false
  let bootstrapBoardIssued=false

  const toUrl=input=>{try{return new URL(typeof input==='string'?input:input?.url||'',location.href)}catch{return null}}
  const methodOf=init=>String(init?.method||'GET').toUpperCase()
  const authOf=init=>{
    const h=new Headers(init?.headers||{})
    return h.get('authorization')||''
  }
  const today=()=>new Date().toISOString().slice(0,10)
  const boardDate=url=>url.searchParams.get('date')||document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||today()
  const keyFor=(url,init)=>{
    if(!url||url.origin!==location.origin||methodOf(init)!=='GET')return''
    const auth=authOf(init)
    if(url.pathname==='/api/me')return auth?`me|${auth}`:''
    if(url.pathname==='/api/board')return auth?`board|${boardDate(url)}|${auth}`:''
    return''
  }
  const readCached=key=>{
    const hit=cache.get(key)
    if(!hit)return null
    if(Date.now()-hit.at>CACHE_TTL_MS){cache.delete(key);return null}
    try{return hit.response.clone()}catch{cache.delete(key);return null}
  }
  const emptyBootBoard=date=>({
    meta:{date,generatedAt:null,sourceFixtures:0,fixturesScanned:0,qualified:0,bootShellOnly:true},
    groups:{single:[],two:[],threePlus:[]},priority:[],bestPicks:[],oddsByFixture:{},availableMarkets:[]
  })
  const bootResponse=date=>new Response(JSON.stringify(emptyBootBoard(date)),{
    status:200,
    headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Stats2Pitch-Boot-Fallback':'1'}
  })

  function beginRealRead(input,init,key){
    if(pending.has(key))return pending.get(key)
    const task=(async()=>{
      const response=await upstreamFetch(input,init)
      if(response.ok){
        try{cache.set(key,{at:Date.now(),response:response.clone()})}catch{}
      }
      return response
    })()
    pending.set(key,task)
    task.finally(()=>{if(pending.get(key)===task)pending.delete(key)}).catch(()=>{})
    return task
  }

  window.fetch=async function(input,init={}){
    const url=toUrl(input),key=keyFor(url,init)
    if(!key)return upstreamFetch(input,init)

    const cached=readCached(key)
    if(cached)return cached

    // Critical v1.12.5 rule: the legacy app's first board request is only a
    // bootstrap signal. Return immediately so renderBoard() can create .app-shell,
    // while the real board read runs once in the background. As soon as the
    // modern runtime asks for the same board, it awaits/reuses that real request.
    const isBootstrapBoard=url?.pathname==='/api/board'&&!bootstrapBoardIssued
    if(isBootstrapBoard){
      bootstrapBoardIssued=true
      bootstrapFallbackUsed=true
      beginRealRead(input,init,key).catch(()=>{})
      return bootResponse(boardDate(url))
    }

    if(pending.has(key)){
      try{return (await pending.get(key)).clone()}catch(err){throw err}
    }

    try{
      return (await beginRealRead(input,init,key)).clone()
    }catch(err){
      // Once the app shell exists, real request failures belong to the modern
      // board recovery path. Never replace the entire app with another splash.
      throw err
    }
  }

  function exposeRecoveryState(){
    const host=document.getElementById('s2p-card-board')
    const state=host?.dataset?.s2pState||''
    const recovering=state==='error'
    document.documentElement.classList.toggle('s2p-recovery-visible',recovering)
    if(recovering){
      const note=host?.querySelector('.s2p-board-error span')
      if(note)note.textContent='Stats2Pitch is reconnecting automatically. Your account and saved picks are safe.'
    }
    if(state==='ready'){
      document.documentElement.classList.remove('s2p-recovery-visible')
      bootstrapFallbackUsed=false
    }
  }

  const root=document.getElementById('root')
  if(root)new MutationObserver(exposeRecoveryState).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})
  document.addEventListener('s2p:board-ready',exposeRecoveryState,{passive:true})

  setTimeout(()=>{
    const host=document.getElementById('s2p-card-board')
    if(host?.dataset?.s2pState==='error')exposeRecoveryState()
    else if(bootstrapFallbackUsed&&document.querySelector('.app-shell')&&!host){
      document.documentElement.classList.add('s2p-recovery-visible')
    }
  },16000)
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: boot-resilience-v1.13.0.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: boot-guard-v1.11.7.js
 * =================================================================== */
try{
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
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: boot-guard-v1.11.7.js',s2pSegmentError)}catch(_){}}
;

/* ===================================================================
 * segment: date-board-router.v1.10.0.js
 * =================================================================== */
try{
/* Stats2Pitch v1.10.0 — route legacy /api/board reads to the chosen fixture date. */
(()=>{
  'use strict'
  const KEY='s2p_fixture_date'
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
  const queryDate=()=>{try{const v=new URL(location.href).searchParams.get('date');return valid(v)?v:''}catch{return''}}
  const stored=()=>{const v=sessionStorage.getItem(KEY);return valid(v)?v:''}
  const initial=queryDate()||stored()||new Date().toISOString().slice(0,10)
  sessionStorage.setItem(KEY,initial)

  const nativeFetch=window.fetch.bind(window)
  window.fetch=(input,init)=>{
    try{
      const raw=typeof input==='string'?input:input?.url
      if(raw){
        const u=new URL(raw,location.origin)
        if(u.origin===location.origin&&u.pathname==='/api/board'&&!u.searchParams.has('date')){
          u.searchParams.set('date',stored()||initial)
          if(typeof input==='string')input=u.pathname+u.search
          else input=new Request(u.toString(),input)
        }
      }
    }catch{}
    return nativeFetch(input,init)
  }

  function syncInput(){const el=document.getElementById('date'),v=stored();if(el&&v&&el.value!==v)el.value=v}
  document.addEventListener('change',e=>{
    if(e.target?.id!=='date'||!valid(e.target.value))return
    const next=e.target.value
    if(next===stored())return
    sessionStorage.setItem(KEY,next)
    const u=new URL(location.href);u.searchParams.set('date',next)
    history.replaceState(null,'',u.pathname+u.search+u.hash)
    location.reload()
  },true)
  const root=document.getElementById('root')
  if(root)new MutationObserver(()=>requestAnimationFrame(syncInput)).observe(root,{childList:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncInput,{once:true});else syncInput()
})()
}catch(s2pSegmentError){try{console.error('[s2p] segment failed: date-board-router.v1.10.0.js',s2pSegmentError)}catch(_){}}
;
