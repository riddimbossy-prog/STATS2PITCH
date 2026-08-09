/* Stats2Pitch v1.10.2 — clock sanity for lifecycle UI. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token',STATUS_KEY='s2p_match_status'
  let board=null,rowMap=new Map(),timer=0
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const selectedDate=()=>document.getElementById('date')?.value||sessionStorage.getItem('s2p_fixture_date')||new Date().toISOString().slice(0,10)
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  function rebuild(){rowMap=new Map(allRows(board).map(r=>[keyFor(r),r]))}
  async function load(){const t=token();if(!t)return null;try{const r=await fetch(`/api/board?date=${encodeURIComponent(selectedDate())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)return null;board=await r.json();rebuild();return board}catch{return null}}
  function scoreText(row){const h=row?.homeScore,a=row?.awayScore;return h!==null&&h!==undefined&&a!==null&&a!==undefined&&Number.isFinite(Number(h))&&Number.isFinite(Number(a))?`${Number(h)}–${Number(a)}`:''}
  function kickoff(row){const d=new Date(row?.kickoff||'');return Number.isNaN(d.getTime())?(row?.kickoffLocal||''):new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  function label(row){const g=row?.statusGroup||'pending',score=scoreText(row);if(g==='live')return`LIVE${Number.isFinite(Number(row?.elapsed))?` ${Number(row.elapsed)}′`:''}${score?` · ${score}`:''}`;if(g==='settled')return`${row?.statusShort||'FT'}${score?` · ${score}`:''}`;if(g==='postponed')return row?.statusShort==='CANC'?'Cancelled':row?.statusShort==='ABD'?'Abandoned':'Postponed';if(g==='pending')return'Awaiting status';return'Upcoming'}
  function installPendingOption(){const sel=document.getElementById('s2p-status');if(!sel)return;let opt=[...sel.options].find(o=>o.value==='pending');if(!opt){opt=document.createElement('option');opt.value='pending';opt.textContent='Awaiting status';sel.appendChild(opt)}const saved=sessionStorage.getItem(STATUS_KEY)||'all';if([...sel.options].some(o=>o.value===saved)&&sel.value!==saved)sel.value=saved}
  function decorate(){installPendingOption();for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null;if(!row)continue;tr.dataset.s2pStatus=row.statusGroup||'pending';const time=tr.querySelector('[data-label="Time"]');if(time){time.dataset.s2pStatus=label(row);time.dataset.s2pKickoff=kickoff(row)}}for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){const row=rowMap.get(item.dataset.priorityKey);if(!row)continue;const match=item.querySelector('.priority-compact-match');if(match){match.dataset.kickoff=kickoff(row);match.dataset.statusLabel=label(row)}}}
  async function boot(){if(!document.querySelector('.app-shell'))return;await load();requestAnimationFrame(()=>requestAnimationFrame(decorate))}
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,180)}
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true})
  document.addEventListener('change',e=>{if(['date','s2p-status'].includes(e.target?.id))schedule()},true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(decorate),{passive:true})
  window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
