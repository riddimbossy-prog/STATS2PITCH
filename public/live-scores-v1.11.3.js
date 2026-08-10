/* Stats2Pitch v1.11.3 — provider-backed Live Scores tab. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token'
  const POLL_MS=30000
  const CLIENT_FRESH_MS=12000
  let timer=0,observerTimer=0,inFlight=false,last=null,lastDate='',lastAt=0

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const liveSelected=()=>document.querySelector('.s2p-main-tab[data-view="live"]')?.classList.contains('active')===true
  const host=()=>document.querySelector('#s2p-card-board .s2p-card-list')
  const fmtTime=value=>{const d=new Date(value||'');return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  const score=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':String(Number(v))

  function statusText(f){
    if(f.statusGroup==='live'){
      const s=String(f.statusShort||'LIVE').toUpperCase()
      if(s==='HT')return'HT'
      if(s==='ET')return f.elapsed?`ET ${f.elapsed}′`:'ET'
      if(s==='P')return'PEN'
      return Number.isFinite(Number(f.elapsed))?`LIVE ${Number(f.elapsed)}′`:'LIVE'
    }
    if(f.statusGroup==='settled')return f.statusShort||'FT'
    if(f.statusGroup==='postponed')return f.statusShort==='CANC'?'Cancelled':'Postponed'
    if(f.statusGroup==='pending')return'Awaiting status'
    return fmtTime(f.kickoff)
  }

  function badge(url,fallback,cls=''){
    return url?`<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">`:`<span class="s2p-live-badge-fallback ${cls}">${esc(String(fallback||'?').slice(0,2).toUpperCase())}</span>`
  }

  function matchRow(f){
    const live=f.statusGroup==='live',settled=f.statusGroup==='settled'
    return `<article class="s2p-live-row ${esc(f.statusGroup||'pending')}" data-live-fixture="${esc(f.fixtureId)}">
      <div class="s2p-live-league">
        <div class="s2p-live-league-icons">${badge(f.league?.flag,f.league?.country,'flag')}${badge(f.league?.logo,f.league?.name,'league')}</div>
        <div><strong>${esc(f.league?.name||'Competition')}</strong><span>${esc(f.league?.country||f.league?.round||'')}</span></div>
      </div>
      <div class="s2p-live-teams">
        <div class="s2p-live-team">${badge(f.home?.logo,f.home?.name,'team')}<strong>${esc(f.home?.name||'Home')}</strong></div>
        <div class="s2p-live-team">${badge(f.away?.logo,f.away?.name,'team')}<strong>${esc(f.away?.name||'Away')}</strong></div>
      </div>
      <div class="s2p-live-scorebox">
        <div class="s2p-live-score"><strong>${score(f.homeScore)}</strong><span>:</span><strong>${score(f.awayScore)}</strong></div>
        <div class="s2p-live-state ${live?'is-live':settled?'is-ft':''}">${live?'<i></i>':''}${esc(statusText(f))}</div>
      </div>
      <div class="s2p-live-meta"><span>${esc(fmtTime(f.kickoff))}</span>${f.venue?`<small>${esc(f.venue)}</small>`:''}</div>
    </article>`
  }

  function fallbackRows(data){
    const fixtures=Array.isArray(data?.fixtures)?data.fixtures:[]
    const settled=fixtures.filter(f=>f.statusGroup==='settled').sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,6)
    const upcoming=fixtures.filter(f=>f.statusGroup==='upcoming').sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,6)
    return [...settled,...upcoming]
  }

  function syncLegacyTools(liveCount){
    const tools=document.querySelector('#s2p-card-board .s2p-board-tools')
    if(!tools)return
    const h2=tools.querySelector('h2'),meta=tools.querySelector('span')
    if(h2&&h2.textContent!=='Live Scores')h2.textContent='Live Scores'
    const value=`${liveCount} live now`
    if(meta&&meta.textContent!==value)meta.textContent=value
  }

  function render(data){
    if(!liveSelected())return
    const target=host();if(!target)return
    const fixtures=Array.isArray(data?.fixtures)?data.fixtures:[]
    const live=fixtures.filter(f=>f.statusGroup==='live')
    const rows=live.length?live:fallbackRows(data)
    const liveTab=document.querySelector('.s2p-main-tab[data-view="live"]')
    const count=liveTab?.querySelector('.count');if(count&&count.textContent!==String(data?.counts?.live??live.length))count.textContent=String(data?.counts?.live??live.length)
    const label=liveTab?.querySelector('span');if(label&&label.textContent!=='Live Scores')label.textContent='Live Scores'
    syncLegacyTools(Number(data?.counts?.live??live.length))

    const updated=data?.generatedAt?new Date(data.generatedAt):null
    const updatedText=updated&&!Number.isNaN(updated.getTime())?new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(updated):''
    const stamp=`${data?.generatedAt||''}|${rows.map(r=>`${r.fixtureId}:${r.statusShort}:${r.elapsed}:${r.homeScore}:${r.awayScore}`).join(',')}`
    if(target.dataset.s2pLiveStamp!==stamp){
      target.innerHTML=`<section class="s2p-live-scoreboard">
        <header class="s2p-live-head">
          <div><h2>${live.length?'Live now':'Live scores'}</h2><p>${live.length?`${live.length} match${live.length===1?'':'es'} live now`:'No match is live right now. Showing the latest results and next fixtures for today.'}</p></div>
          <div class="s2p-live-freshness"><span class="s2p-live-provider-dot"></span><span>API-Football</span>${updatedText?`<small>Updated ${esc(updatedText)}</small>`:''}</div>
        </header>
        <div class="s2p-live-summary">
          <span><b>${esc(data?.counts?.live??0)}</b> Live</span>
          <span><b>${esc(data?.counts?.settled??0)}</b> FT</span>
          <span><b>${esc(data?.counts?.upcoming??0)}</b> Upcoming</span>
          <button type="button" data-live-refresh>↻ Update scores</button>
        </div>
        <div class="s2p-live-list">${rows.length?rows.map(matchRow).join(''):'<div class="s2p-live-empty"><strong>No fixtures found for this date.</strong><span>Choose another fixture date or try again shortly.</span></div>'}</div>
      </section>`
      target.dataset.s2pLiveStamp=stamp
      target.querySelector('[data-live-refresh]')?.addEventListener('click',()=>load(true))
    }
    document.documentElement.classList.add('s2p-live-score-mode')
  }

  async function load(force=false){
    if(!liveSelected()||inFlight||!token())return
    const date=selectedDate()
    if(!force&&last&&lastDate===date&&Date.now()-lastAt<CLIENT_FRESH_MS){render(last);return}
    inFlight=true
    try{
      const r=await fetch(`/api/live-scores?date=${encodeURIComponent(date)}${force?'&fresh=1':''}`,{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'})
      if(!r.ok)throw new Error(`Live scores ${r.status}`)
      last=await r.json();lastDate=date;lastAt=Date.now();render(last)
    }catch{
      const target=host();if(target&&liveSelected()&&!target.querySelector('.s2p-live-scoreboard'))target.innerHTML='<div class="s2p-live-empty"><strong>Live scores are temporarily unavailable.</strong><span>Stats2Pitch will retry automatically.</span></div>'
    }finally{inFlight=false}
  }

  function sync(){
    if(liveSelected()){
      document.documentElement.classList.add('s2p-live-score-mode')
      if(last&&lastDate===selectedDate())render(last)
      if(!last||lastDate!==selectedDate()||Date.now()-lastAt>=CLIENT_FRESH_MS)load(false)
    }else document.documentElement.classList.remove('s2p-live-score-mode')
  }
  function schedule(){clearTimeout(observerTimer);observerTimer=setTimeout(sync,120)}

  document.addEventListener('click',event=>{
    const tab=event.target.closest?.('.s2p-main-tab[data-view="live"]')
    if(tab)setTimeout(sync,0)
    const refresh=event.target.closest?.('#s2p-mini-refresh')
    if(refresh&&liveSelected()){
      event.preventDefault();event.stopImmediatePropagation();load(true)
    }
  },true)
  document.addEventListener('change',event=>{if(event.target?.id==='date'){last=null;lastDate='';lastAt=0;schedule()}},true)
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  timer=setInterval(()=>{if(liveSelected())load(false)},POLL_MS)
  window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
