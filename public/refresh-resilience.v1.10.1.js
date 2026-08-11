/* Stats2Pitch v1.13.2 — background refresh + automatic current-day population. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const ACTIVE_KEY='s2p_refresh_active_date'
  const AUTO_KEY='s2p_today_auto_refresh_date'
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  const pad=n=>String(n).padStart(2,'0')
  const browserToday=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  let running=false
  let polling=false
  let resumedDate=''
  let autoCheckedDate=''

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||browserToday()

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
            <img class="s2p-loader-ball-real" src="/assets/football-real.svg" alt="">
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
          sessionStorage.removeItem(AUTO_KEY)
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

  async function start(date,{auto=false}={}){
    if(running)return
    if(auto)sessionStorage.setItem(AUTO_KEY,date)
    setLoading(true,date)
    try{
      const job=await request(`/api/refresh?date=${encodeURIComponent(date)}`,{method:'POST'})
      if(job.status==='complete'){
        setLoading(false)
        sessionStorage.removeItem(AUTO_KEY)
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
        sessionStorage.removeItem(AUTO_KEY)
        location.reload()
      }else{
        setLoading(false)
      }
    }catch{
      setLoading(false)
    }
  }

  async function realBoardFor(date){
    // v1.13 may intentionally return one boot-shell board while the real read starts.
    // Never mistake that shell response for a genuine empty current-day snapshot.
    for(let i=0;i<3;i++){
      const data=await request(`/api/board?date=${encodeURIComponent(date)}`)
      if(!data?.meta?.bootShellOnly)return data
      await sleep(300)
    }
    return null
  }

  async function maybeAutoPopulateToday(){
    if(!token())return
    const date=selectedDate(),today=browserToday()
    if(date!==today||autoCheckedDate===date)return
    autoCheckedDate=date
    try{
      const board=await realBoardFor(date)
      if(!board)return
      const meta=board.meta||{}
      const sourceFixtures=Number(meta.sourceFixtures??meta.fixturesScanned??0)
      const needsFresh=meta.noSnapshot===true||meta.stale===true||sourceFixtures===0
      if(!needsFresh)return

      const prior=sessionStorage.getItem(AUTO_KEY)
      if(prior===date){
        const job=await request(`/api/refresh-status?date=${encodeURIComponent(date)}`)
        if(job.status==='running'){setLoading(true,date);poll(date)}
        else if(job.status==='complete'){sessionStorage.removeItem(AUTO_KEY);location.reload()}
        return
      }
      await start(date,{auto:true})
    }catch{
      // The visible board remains available. Manual refresh is still a fallback.
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
      maybeAutoPopulateToday()
    },120)
  }
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})

  function begin(){
    scrubInternalNotices()
    const active=sessionStorage.getItem(ACTIVE_KEY)
    if(active)setLoading(true,active)
    else overlay().hidden=true
    maybeResume()
    setTimeout(maybeAutoPopulateToday,350)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true})
  else begin()
})()
