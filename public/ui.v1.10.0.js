/* Stats2Pitch v1.10.0 — backend Best Picks + engine-rating integrity UI. */
(()=>{
  'use strict'
  const ACCESS_KEY='s2p_access_token',STATUS_KEY='s2p_match_status'
  let board=null,rowMap=new Map(),timer=0
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'—'
  const keyFor=r=>`${r?.fixtureId}|${r?.market}|${r?.selectedTeamId||r?.selectedTeam}`
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const date=()=>document.getElementById('date')?.value||new Date().toISOString().slice(0,10)
  const status=()=>sessionStorage.getItem(STATUS_KEY)||'all'
  function index(){rowMap=new Map();for(const r of [...(board?.priority||[]),...(board?.bestPicks||[])])rowMap.set(keyFor(r),r)}
  async function load(){const t=token();if(!t)return null;try{const r=await fetch(`/api/board?date=${encodeURIComponent(date())}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok)return null;board=await r.json();index();return board}catch{return null}}
  const predictionName=row=>row?.selectionLabel||(row?.market==='1X2'?`${row.selectedTeam} win`:row?.market==='DNB'?`${row.selectedTeam} DNB`:row?.market==='DC'?row.selectedTeam:({'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}[row?.market]||row?.selectedTeam||'Prediction'))
  function competition(row){const flag=row?.countryFlag?`<img class="country-flag" src="${esc(row.countryFlag)}" alt="" loading="lazy">`:'',logo=row?.leagueLogo?`<img class="league-logo" src="${esc(row.leagueLogo)}" alt="" loading="lazy">`:'';return`<div class="competition-cell"><div class="competition-icons">${flag}${logo}</div><div><strong>${esc(row?.league||'Competition')}</strong>${row?.country?`<span>${esc(row.country)}</span>`:''}</div></div>`}
  function kickoff(row){const d=new Date(row?.kickoff||'');return Number.isNaN(d.getTime())?(row?.kickoffLocal||''):new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d)}
  function statusText(row){const g=row?.statusGroup||'upcoming';if(g==='live')return`LIVE${Number.isFinite(Number(row?.elapsed))?` ${row.elapsed}′`:''}`;if(g==='settled')return row?.statusShort||'FT';if(g==='postponed')return row?.statusShort==='CANC'?'Cancelled':'Postponed';return kickoff(row)}
  function currentVisibleKeys(){return new Set([...document.querySelectorAll('.prediction-panel tbody tr:not(.s2p-status-hidden) [data-row-key]')].map(x=>x.dataset.rowKey))}
  function filteredBest(){const s=status(),keys=currentVisibleKeys(),hasRenderedRows=document.querySelectorAll('.prediction-panel tbody tr').length>0;return(board?.bestPicks||[]).filter(r=>(s==='all'||(r.statusGroup||'upcoming')===s)&&(!hasRenderedRows||keys.has(keyFor(r))))}
  function rebuildBest(){
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''));if(!title||!board)return
    let panel=document.querySelector('.priority-compact');if(!panel){panel=document.createElement('section');panel.className='priority-compact priority-compact-v17';title.insertAdjacentElement('afterend',panel)}
    const best=filteredBest()
    const html=best.map(row=>`<button class="priority-compact-row priority-v17-row" type="button" data-priority-key="${esc(keyFor(row))}"><div class="priority-v17-competition">${competition(row)}</div><div class="priority-compact-match" data-kickoff="${esc(kickoff(row))}" data-status-label="${esc(statusText(row))}"><strong>${esc(row.match||'')}</strong><small>${esc(predictionName(row))}</small></div><div class="priority-compact-odd">${fmt(row.odds)}</div><div class="priority-compact-star">★</div></button>`).join('')
    if(panel.dataset.v110Html!==html){panel.innerHTML=html||'<div class="no-data">No Best Pick fits the current choices right now.</div>';panel.dataset.v110Html=html;panel.querySelectorAll('[data-priority-key]').forEach(btn=>{btn.onclick=()=>{const source=document.querySelector(`[data-row-key="${CSS.escape(btn.dataset.priorityKey)}"]`);source?.click()}})}
    const badge=document.querySelector('.s2p-board-tab[data-s2p-tab="best"] b');if(badge)badge.textContent=String(best.length)
  }
  function ratingMarkup(row){const rating=Math.max(0,Math.min(100,Number(row?.engineRating||0))),filled=Math.max(1,Math.min(5,Math.round(rating/20)));return`<div class="confidence" title="Engine rating — not a measured probability"><span class="stars">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</span><span class="confidence-pct">${Math.round(rating)}/100</span></div>`}
  function decorateRatings(){
    for(const th of document.querySelectorAll('.pred-table th'))if(/^confidence$/i.test(th.textContent?.trim()||'')){th.textContent='Engine rating';th.title='Model strength score, not a measured probability.'}
    for(const tr of document.querySelectorAll('.prediction-panel tbody tr')){const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null;if(!row)continue;const cell=tr.querySelector('[data-label="Confidence"],[data-label="Engine rating"]');if(cell){cell.dataset.label='Engine rating';const html=ratingMarkup(row);if(cell.dataset.v110Rating!==html){cell.innerHTML=html;cell.dataset.v110Rating=html}}}
  }
  function decorateModal(){for(const modal of document.querySelectorAll('.detail-modal')){const match=modal.querySelector('.detail-match-title h2,.modal-head h2')?.textContent?.trim()||'',pred=modal.querySelector('.detail-summary h3')?.textContent?.trim()||'',candidates=[...(board?.priority||[])].filter(r=>String(r.match||'')===match),row=candidates.find(r=>predictionName(r)===pred)||candidates[0];if(!row)continue;const conf=modal.querySelector('.confidence');if(conf)conf.outerHTML=ratingMarkup(row)}}
  function explainRating(){const controls=document.querySelector('.controls');if(!controls||document.getElementById('s2p-rating-note'))return;const note=document.createElement('div');note.id='s2p-rating-note';note.className='selected-filter-bar';note.innerHTML='<span class="filter-glyph">◎</span><span class="selected-none">Engine rating is a model-strength score, not a historical win probability.</span>';controls.insertAdjacentElement('afterend',note)}
  function apply(){decorateRatings();rebuildBest();decorateModal();explainRating()}
  async function boot(){if(!document.querySelector('.app-shell'))return;await load();requestAnimationFrame(()=>requestAnimationFrame(apply))}
  function schedule(){clearTimeout(timer);timer=setTimeout(boot,120)}
  const root=document.getElementById('root');if(root)new MutationObserver(schedule).observe(root,{childList:true})
  new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.modal-backdrop,.detail-modal'))))requestAnimationFrame(decorateModal)}).observe(document.documentElement,{childList:true,subtree:true})
  document.addEventListener('change',e=>{if(['date','market','minf','s2p-status'].includes(e.target?.id))schedule()},true)
  window.addEventListener('s2p:tabchange',()=>requestAnimationFrame(()=>{rebuildBest();decorateRatings()}),{passive:true});window.addEventListener('pageshow',schedule,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
})()
