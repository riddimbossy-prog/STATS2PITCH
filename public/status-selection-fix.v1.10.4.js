/* Stats2Pitch v1.10.4 — final lifecycle clock + selection label authority.
 * This layer runs after the legacy board decorators so a saved provider NS/TBD
 * can never remain "Upcoming" once kickoff + 15 minutes has passed, and safer
 * DNB/DC selection labels are rendered exactly once.
 */
(()=>{
  'use strict'

  const ACCESS_KEY='s2p_access_token'
  const STATUS_KEY='s2p_match_status'
  const KICKOFF_GRACE_MS=15*60*1000
  let board=null
  let rows=new Map()
  let scheduleTimer=0
  let clockTimer=0

  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const selectedStatus=()=>sessionStorage.getItem(STATUS_KEY)||'all'
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[
    ...(b?.groups?.threePlus||[]),
    ...(b?.groups?.two||[]),
    ...(b?.groups?.single||[]),
    ...(b?.priority||[]),
    ...(b?.bestPicks||[])
  ]

  function rebuild(){
    rows=new Map()
    for(const row of allRows(board)){
      const key=keyFor(row)
      if(key&&!rows.has(key))rows.set(key,row)
    }
  }

  async function load(){
    const t=token()
    if(!t)return null
    try{
      const response=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{
        headers:{Authorization:`Bearer ${t}`},
        cache:'no-store'
      })
      if(!response.ok)return null
      board=await response.json()
      rebuild()
      return board
    }catch{return null}
  }

  function kickoffMs(row){
    const ms=new Date(row?.kickoff||'').getTime()
    return Number.isFinite(ms)?ms:null
  }

  function effectiveGroup(row,now=Date.now()){
    const group=String(row?.statusGroup||'pending').toLowerCase()
    if(group==='live'||group==='settled'||group==='postponed'||group==='pending')return group
    if(group==='upcoming'){
      const kick=kickoffMs(row)
      if(kick!==null&&now>kick+KICKOFF_GRACE_MS)return'pending'
      return'upcoming'
    }
    return'pending'
  }

  function kickoffText(row){
    const d=new Date(row?.kickoff||'')
    if(Number.isNaN(d.getTime()))return String(row?.kickoffLocal||'').split(',').pop()?.trim()||''
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)
  }

  function scoreText(row){
    const h=row?.homeScore,a=row?.awayScore
    return h!==null&&h!==undefined&&a!==null&&a!==undefined&&Number.isFinite(Number(h))&&Number.isFinite(Number(a))?`${Number(h)}–${Number(a)}`:''
  }

  function statusLabel(row,now=Date.now()){
    const group=effectiveGroup(row,now),score=scoreText(row)
    if(group==='live')return `LIVE${row?.elapsed!==null&&row?.elapsed!==undefined&&Number.isFinite(Number(row.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`
    if(group==='settled')return `${row?.statusShort||'FT'}${score?` · ${score}`:''}`
    if(group==='postponed')return row?.statusShort==='CANC'?'Cancelled':row?.statusShort==='ABD'?'Abandoned':'Postponed'
    if(group==='pending')return'Awaiting status'
    return'Upcoming'
  }

  function collapseDuplicate(value){
    const text=String(value??'').replace(/\s+/g,' ').trim()
    if(!text)return''
    if(text.length%2===0){
      const half=text.length/2
      if(text.slice(0,half)===text.slice(half))return text.slice(0,half).trim()
    }
    return text
  }

  function selectionLabel(row){
    const explicit=collapseDuplicate(row?.selectionLabel)
    if(explicit)return explicit
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return `${row.selectedTeam} ${row?.downgradeMarket||''}`.trim()
    return''
  }

  function visible(row,now=Date.now()){
    const filter=selectedStatus()
    return filter==='all'||effectiveGroup(row,now)===filter
  }

  function clearLegacySelectionOverride(node,label){
    if(!node||!label)return
    if(node.textContent!==label)node.textContent=label
    node.classList.remove('s2p-selection-override')
    node.removeAttribute('data-selection-label')
  }

  function decorateTables(now){
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){
      const button=tr.querySelector('[data-row-key]')
      const row=button?rows.get(button.dataset.rowKey):null
      if(!row)continue
      const group=effectiveGroup(row,now)
      tr.dataset.s2pStatus=group
      tr.classList.toggle('s2p-status-hidden',!visible(row,now))
      const time=tr.querySelector('[data-label="Time"]')
      if(time){
        time.dataset.s2pStatus=statusLabel(row,now)
        time.dataset.s2pKickoff=kickoffText(row)
      }
      const prediction=tr.querySelector('[data-label="Prediction"]')
      clearLegacySelectionOverride(prediction,selectionLabel(row))
    }
  }

  function decorateBest(now){
    let visibleBest=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const row=rows.get(item.dataset.priorityKey)
      if(!row)continue
      const match=item.querySelector('.priority-compact-match')
      if(match){
        match.dataset.kickoff=kickoffText(row)
        match.dataset.statusLabel=statusLabel(row,now)
        clearLegacySelectionOverride(match.querySelector('small'),selectionLabel(row))
      }
      const show=visible(row,now)
      item.dataset.s2pStatus=effectiveGroup(row,now)
      item.classList.toggle('s2p-status-hidden',!show)
      if(show)visibleBest++
    }
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b')
    if(badge&&badge.textContent!==String(visibleBest))badge.textContent=String(visibleBest)
  }

  function decorateCounts(){
    for(const [tab,selector] of [['three','.prediction-panel[data-s2p-tab-panel="three"]'],['two','.prediction-panel[data-s2p-tab-panel="two"]'],['single','.prediction-panel[data-s2p-tab-panel="single"]']]){
      const panel=document.querySelector(selector)
      if(!panel)continue
      const count=[...panel.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('s2p-status-hidden')).length
      const badge=document.querySelector(`.s2p-board-tab[data-s2p-tab="${tab}"] b`)
      if(badge&&badge.textContent!==String(count))badge.textContent=String(count)
    }
  }

  function installPendingOption(){
    const select=document.getElementById('s2p-status')
    if(!select)return
    if(![...select.options].some(option=>option.value==='pending')){
      const option=document.createElement('option')
      option.value='pending'
      option.textContent='Awaiting status'
      select.appendChild(option)
    }
    const saved=selectedStatus()
    if([...select.options].some(option=>option.value===saved)&&select.value!==saved)select.value=saved
  }

  function apply(){
    if(!board)return
    const now=Date.now()
    installPendingOption()
    decorateTables(now)
    decorateBest(now)
    decorateCounts()
  }

  async function boot(){
    if(!document.querySelector('.app-shell'))return
    await load()
    requestAnimationFrame(()=>requestAnimationFrame(apply))
    if(!clockTimer)clockTimer=setInterval(apply,30*1000)
  }

  function schedule(){
    clearTimeout(scheduleTimer)
    scheduleTimer=setTimeout(boot,240)
  }

  const root=document.getElementById('root')
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  document.addEventListener('change',event=>{
    if(['date','s2p-status'].includes(event.target?.id))schedule()
  },true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(apply),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
