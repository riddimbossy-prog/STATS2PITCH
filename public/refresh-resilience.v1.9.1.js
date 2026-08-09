/* Stats2Pitch v1.9.1 — resilient background refresh UI. */
(function(){
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  let running=false
  let polling=false
  let lastJob=null
  let resumedDate=''

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||new Date().toISOString().slice(0,10)

  async function request(path,opts={}){
    const r=await fetch(path,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${token()}`,'Cache-Control':'no-store'}})
    const body=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(body.error||`Refresh request failed (${r.status}).`)
    return body
  }

  function notice(){
    let el=document.getElementById('s2p-refresh-progress')
    if(el&&document.body.contains(el))return el
    const existing=[...document.querySelectorAll('.notice')].find(x=>/saved board|refresh|update/i.test(x.textContent||''))
    if(existing){existing.id='s2p-refresh-progress';return existing}
    const summary=document.querySelector('.summary-grid')
    if(!summary)return null
    el=document.createElement('div')
    el.id='s2p-refresh-progress'
    el.className='notice'
    summary.insertAdjacentElement('beforebegin',el)
    return el
  }

  function describe(job){
    if(!job)return''
    if(job.status==='failed')return `Refresh failed: ${job.error||'the data provider did not complete the update.'} The previous saved board is still shown.`
    if(job.status==='complete')return'Fresh board saved. Reloading the latest predictions…'
    const p=job.progress||{}
    const count=Number.isFinite(Number(p.current))&&Number.isFinite(Number(p.total))&&Number(p.total)>0?` ${p.current}/${p.total}`:''
    return `${p.message||'Refreshing real data…'}${count}`
  }

  function applyUi(){
    const btn=document.getElementById('refresh')
    if(btn){
      btn.disabled=running
      btn.innerHTML=running?'↻ <span>Refreshing in background…</span>':'↻ <span>Refresh real data</span>'
    }
    const el=notice()
    if(el){
      if(running||lastJob?.status==='failed'||lastJob?.status==='complete'){
        el.textContent=describe(lastJob)||'Refreshing real data…'
        el.hidden=false
      }else if(/most recent saved board is being shown while today/i.test(el.textContent||'')){
        el.textContent='The last refresh failed or was interrupted. The previous saved board is still shown. Press Refresh real data to retry.'
      }
    }
  }

  async function poll(date){
    if(polling)return
    polling=true
    try{
      for(let i=0;i<480;i++){
        await sleep(2500)
        const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
        lastJob=job
        running=job.status==='running'
        applyUi()
        if(job.status==='complete'){
          running=false
          applyUi()
          await sleep(500)
          location.reload()
          return
        }
        if(job.status==='failed'){
          running=false
          applyUi()
          return
        }
        if(job.status==='idle'){
          running=false
          applyUi()
          return
        }
      }
      running=false
      lastJob={status:'failed',error:'The refresh is taking longer than 20 minutes. It may still be running on the server.'}
      applyUi()
    }catch(error){
      running=false
      lastJob={status:'failed',error:error.message}
      applyUi()
    }finally{
      polling=false
    }
  }

  async function start(date){
    if(running)return
    try{
      running=true
      lastJob={status:'running',progress:{message:'Starting real-data refresh…'}}
      applyUi()
      const job=await request(`/api/refresh?date=${encodeURIComponent(date)}`,{method:'POST'})
      lastJob=job
      running=job.status==='running'
      applyUi()
      if(job.status==='complete')location.reload()
      else if(job.status==='running')poll(date)
    }catch(error){
      running=false
      lastJob={status:'failed',error:error.message}
      applyUi()
    }
  }

  async function maybeResume(){
    const btn=document.getElementById('refresh')
    if(!btn||!token())return
    const date=selectedDate()
    if(resumedDate===date)return
    resumedDate=date
    try{
      const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
      if(job.status==='running'){
        lastJob=job
        running=true
        applyUi()
        poll(date)
      }else{
        const stale=[...document.querySelectorAll('.notice')].find(x=>/most recent saved board is being shown while today/i.test(x.textContent||''))
        if(stale){stale.id='s2p-refresh-progress';applyUi()}
      }
    }catch{}
  }

  document.addEventListener('click',event=>{
    const btn=event.target&&event.target.closest?event.target.closest('#refresh'):null
    if(!btn)return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    start(selectedDate())
  },true)

  const observer=new MutationObserver(()=>{
    applyUi()
    maybeResume()
  })
  const begin=()=>{
    observer.observe(document.body,{childList:true,subtree:true})
    applyUi()
    maybeResume()
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true})
  else begin()
})()
