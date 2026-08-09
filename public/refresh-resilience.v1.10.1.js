/* Stats2Pitch v1.10.1 — background refresh with full-screen pitch loader. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const ACTIVE_KEY='s2p_refresh_active_date'
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  let running=false
  let polling=false
  let resumedDate=''

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)

  async function request(path,opts={}){
    const r=await fetch(path,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${token()}`,'Cache-Control':'no-store'}})
    const body=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(body.error||`Refresh request failed (${r.status}).`)
    return body
  }

  function buildOverlay(){
    const overlay=document.createElement('div')
    overlay.id='s2p-refresh-loading-overlay'
    overlay.className='s2p-refresh-overlay'
    overlay.setAttribute('role','status')
    overlay.setAttribute('aria-live','polite')
    overlay.setAttribute('aria-label','Loading matches')
    overlay.innerHTML=`
      <div class="s2p-loader">
        <div class="s2p-loader-scene" aria-hidden="true">
          <div class="s2p-loader-trail"></div>
          <div class="s2p-loader-ball-track">
            <div class="s2p-loader-ball"></div>
            <div class="s2p-loader-shadow"></div>
          </div>
          <div class="s2p-loader-pitch">
            <img src="/assets/brand-mark.png" alt="">
          </div>
        </div>
        <div class="s2p-loader-text">Loading <b>matches</b>...</div>
        <div class="s2p-loader-sub">From stats to the pitch</div>
      </div>`
    return overlay
  }

  function overlay(){
    let el=document.getElementById('s2p-refresh-loading-overlay')
    if(!el){el=buildOverlay();document.body.appendChild(el)}
    return el
  }

  function scrubInternalNotices(){
    document.getElementById('s2p-refresh-progress')?.remove()
    document.getElementById('s2p-rating-note')?.remove()
    for(const el of document.querySelectorAll('.notice')){
      const text=String(el.textContent||'')
      if(/refresh|saved board|update finishes|finding priced split fixtures|candidates checked|fresh board/i.test(text))el.remove()
    }
  }

  function setLoading(active,date=''){
    running=Boolean(active)
    const el=overlay()
    el.hidden=!running
    document.body.classList.toggle('s2p-refresh-active',running)
    const root=document.getElementById('root')
    if(root)root.setAttribute('aria-busy',running?'true':'false')
    if(running&&date)sessionStorage.setItem(ACTIVE_KEY,date)
    if(!running)sessionStorage.removeItem(ACTIVE_KEY)
    const btn=document.getElementById('refresh')
    if(btn){
      btn.disabled=running
      btn.innerHTML='↻ <span>Refresh real data</span>'
    }
    scrubInternalNotices()
  }

  function toastFailure(){
    document.querySelector('.s2p-refresh-error-toast')?.remove()
    const el=document.createElement('div')
    el.className='s2p-refresh-error-toast'
    el.textContent='Fresh matches could not be loaded right now. The last saved board is still available.'
    document.body.appendChild(el)
    setTimeout(()=>el.remove(),5000)
  }

  async function poll(date){
    if(polling)return
    polling=true
    try{
      for(let i=0;i<480;i++){
        await sleep(2500)
        const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
        if(job.status==='complete'){
          setLoading(false)
          await sleep(250)
          location.reload()
          return
        }
        if(job.status==='failed'){
          setLoading(false)
          toastFailure()
          return
        }
        if(job.status==='idle'){
          setLoading(false)
          return
        }
        setLoading(true,date)
      }
      setLoading(false)
      toastFailure()
    }catch{
      setLoading(false)
      toastFailure()
    }finally{
      polling=false
    }
  }

  async function start(date){
    if(running)return
    setLoading(true,date)
    try{
      const job=await request(`/api/refresh?date=${encodeURIComponent(date)}`,{method:'POST'})
      if(job.status==='complete'){
        setLoading(false)
        location.reload()
        return
      }
      if(job.status==='failed'){
        setLoading(false)
        toastFailure()
        return
      }
      poll(date)
    }catch{
      setLoading(false)
      toastFailure()
    }
  }

  async function maybeResume(){
    if(!token())return
    const date=selectedDate()
    if(resumedDate===date)return
    resumedDate=date
    try{
      const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
      if(job.status==='running'){
        setLoading(true,date)
        poll(date)
      }else if(job.status==='complete'&&sessionStorage.getItem(ACTIVE_KEY)===date){
        setLoading(false)
        location.reload()
      }else{
        setLoading(false)
      }
    }catch{
      setLoading(false)
    }
  }

  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('#refresh')
    if(!btn)return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    start(selectedDate())
  },true)

  const root=document.getElementById('root')
  let timer=0
  const schedule=()=>{
    clearTimeout(timer)
    timer=setTimeout(()=>{
      scrubInternalNotices()
      const active=sessionStorage.getItem(ACTIVE_KEY)
      if(active&&active===selectedDate())setLoading(true,active)
      maybeResume()
    },80)
  }
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})

  function begin(){
    scrubInternalNotices()
    const active=sessionStorage.getItem(ACTIVE_KEY)
    if(active)setLoading(true,active)
    else overlay().hidden=true
    maybeResume()
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true})
  else begin()
})()
