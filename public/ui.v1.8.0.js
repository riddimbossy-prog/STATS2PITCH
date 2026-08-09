(()=>{
  const ACCESS_KEY='s2p_access_token'
  const STATUS_KEY='s2p_match_status'
  let board=null
  let rows=new Map()
  let status=sessionStorage.getItem(STATUS_KEY)||'all'
  let timer=0

  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const token=()=>localStorage.getItem(ACCESS_KEY)||''

  function rebuild(){rows=new Map(allRows(board).map(r=>[keyFor(r),r]))}
  async function loadBoard(){
    const t=token();if(!t)return null
    try{
      const r=await fetch('/api/board',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})
      if(!r.ok)return null
      board=await r.json();rebuild();return board
    }catch{return null}
  }

  function rowForKey(key){return rows.get(key)||null}
  function kickoff(row){
    const d=new Date(row?.kickoff||'')
    if(Number.isNaN(d.getTime()))return String(row?.kickoffLocal||'').split(',').pop()?.trim()||''
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)
  }
  function statusLabel(row){
    const group=row?.statusGroup||'upcoming'
    const score=Number.isFinite(Number(row?.homeScore))&&Number.isFinite(Number(row?.awayScore))?`${Number(row.homeScore)}–${Number(row.awayScore)}`:''
    if(group==='live')return `LIVE${Number.isFinite(Number(row?.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`
    if(group==='settled')return `${row?.statusShort||'FT'}${score?` · ${score}`:''}`
    return 'Upcoming'
  }
  function selectedLabel(row){
    if(row?.selectionLabel)return row.selectionLabel
    if(row?.market==='DNB')return `${row.selectedTeam} DNB`
    if(row?.market==='DC')return row.selectedTeam
    return''
  }
  function visible(row){return status==='all'||(row?.statusGroup||'upcoming')===status}

  function installStatusControl(){
    const grid=document.querySelector('.controls .control-grid')
    if(!grid)return
    let label=grid.querySelector('.s2p-status-control')
    if(!label){
      label=document.createElement('label')
      label.className='s2p-status-control'
      label.innerHTML='<span>Match status</span><select id="s2p-status"><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="settled">Settled</option></select>'
      const refresh=grid.querySelector('#refresh,.refresh')
      if(refresh)grid.insertBefore(label,refresh);else grid.appendChild(label)
      label.querySelector('select').addEventListener('change',e=>{
        status=e.target.value
        sessionStorage.setItem(STATUS_KEY,status)
        apply()
      })
    }
    const select=label.querySelector('select')
    if(select&&select.value!==status)select.value=status
  }

  function decorateTables(){
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){
      const btn=tr.querySelector('[data-row-key]')
      const row=btn?rowForKey(btn.dataset.rowKey):null
      if(!row)continue
      tr.dataset.s2pStatus=row.statusGroup||'upcoming'
      tr.classList.toggle('s2p-status-hidden',!visible(row))
      const time=tr.querySelector('[data-label="Time"]')
      if(time){time.dataset.s2pStatus=statusLabel(row);time.dataset.s2pKickoff=kickoff(row)}
      const prediction=tr.querySelector('[data-label="Prediction"]')
      const label=selectedLabel(row)
      if(prediction&&label){prediction.dataset.selectionLabel=label;prediction.classList.add('s2p-selection-override')}
    }
  }

  function decorateBest(){
    let visibleBest=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const row=rowForKey(item.dataset.priorityKey)
      if(!row)continue
      const match=item.querySelector('.priority-compact-match')
      if(match){
        match.dataset.kickoff=kickoff(row)
        match.dataset.statusLabel=statusLabel(row)
        const small=match.querySelector('small')
        const label=selectedLabel(row)
        if(small&&label){small.dataset.selectionLabel=label;small.classList.add('s2p-selection-override')}
      }
      const show=visible(row)
      item.classList.toggle('s2p-status-hidden',!show)
      if(show)visibleBest++
    }
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b')
    if(badge&&String(visibleBest)!==badge.textContent)badge.textContent=String(visibleBest)
  }

  function decorateTabCounts(){
    for(const [tab,selector] of [['three','.prediction-panel[data-s2p-tab-panel="three"]'],['two','.prediction-panel[data-s2p-tab-panel="two"]'],['single','.prediction-panel[data-s2p-tab-panel="single"]']]){
      const panel=document.querySelector(selector)
      if(!panel)continue
      const count=[...panel.querySelectorAll('tbody tr')].filter(tr=>!tr.classList.contains('s2p-status-hidden')).length
      const badge=document.querySelector(`.s2p-board-tab[data-s2p-tab="${tab}"] b`)
      if(badge&&badge.textContent!==String(count))badge.textContent=String(count)
    }
  }

  function apply(){
    installStatusControl()
    decorateTables()
    decorateBest()
    decorateTabCounts()
    document.documentElement.dataset.s2pStatusFilter=status
  }

  async function boot(){
    if(!document.querySelector('.app-shell'))return
    await loadBoard()
    requestAnimationFrame(()=>requestAnimationFrame(apply))
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,100)}

  // Core renders replace the app shell at #root. Observe only that boundary so
  // this layer cannot create another deep MutationObserver render loop.
  const root=document.getElementById('root')
  if(root)new MutationObserver(schedule).observe(root,{childList:true})
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(apply),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
