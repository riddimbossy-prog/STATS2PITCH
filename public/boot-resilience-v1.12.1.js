/* Stats2Pitch UI v1.12.1 — startup de-duplication and loader escape hatch.
 * Keeps the prediction engine untouched. This layer only coordinates browser boot.
 */
(()=>{
  'use strict'

  const upstreamFetch=window.fetch.bind(window)
  const CACHE_TTL_MS=6000
  const cache=new Map()
  const pending=new Map()
  let bootstrapFallbackUsed=false

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

  window.fetch=async function(input,init={}){
    const url=toUrl(input),key=keyFor(url,init)
    if(!key)return upstreamFetch(input,init)

    const cached=readCached(key)
    if(cached)return cached

    if(pending.has(key)){
      try{return (await pending.get(key)).clone()}catch{}
    }

    const task=(async()=>{
      try{
        const response=await upstreamFetch(input,init)
        if(response.ok){
          try{cache.set(key,{at:Date.now(),response:response.clone()})}catch{}
        }
        // The legacy app must be allowed to create .app-shell even if its first
        // board request hits a temporary 5xx. The modern runtime immediately
        // performs/reuses the real board read after the shell exists.
        if(url?.pathname==='/api/board'&&response.status>=500&&!document.querySelector('.app-shell')){
          bootstrapFallbackUsed=true
          return new Response(JSON.stringify(emptyBootBoard(boardDate(url))),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Stats2Pitch-Boot-Fallback':'1'}})
        }
        return response
      }catch(err){
        if(url?.pathname==='/api/board'&&!document.querySelector('.app-shell')){
          bootstrapFallbackUsed=true
          return new Response(JSON.stringify(emptyBootBoard(boardDate(url))),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Stats2Pitch-Boot-Fallback':'1'}})
        }
        throw err
      }
    })()

    pending.set(key,task)
    try{return (await task).clone()}
    finally{pending.delete(key)}
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

  // A real board request has its own bounded timeout. If it reaches an error,
  // show that state instead of trapping the user behind the football loader.
  setTimeout(()=>{
    const host=document.getElementById('s2p-card-board')
    if(host?.dataset?.s2pState==='error')exposeRecoveryState()
    else if(bootstrapFallbackUsed&&document.querySelector('.app-shell')&&!host){
      document.documentElement.classList.add('s2p-recovery-visible')
    }
  },16000)
})()
