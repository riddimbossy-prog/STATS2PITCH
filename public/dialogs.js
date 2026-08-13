import {state,esc,localToday,clearSession} from './core.js'
const closeModal=()=>{document.getElementById('modal')?.remove();document.getElementById('modal-bg')?.remove()}
export function openDetails(id,market){
  const best=state.board?.bestPicks||[],all=state.board?.priority||[]
  const r=best.find(x=>String(x.fixtureId)===String(id)&&String(x.market)===String(market))
    ||best.find(x=>String(x.fixtureId)===String(id))
    ||all.find(x=>String(x.fixtureId)===String(id)&&String(x.market)===String(market))
  if(!r)return
  const saved=JSON.parse(localStorage.getItem('s2p_saved')||'[]'),isSaved=saved.some(x=>String(x.fixtureId)===String(r.fixtureId)&&x.market===r.market&&x.selection===r.selection&&Number(x.odds)===Number(r.odds))
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal-bg"></div><section class="modal" id="modal"><h2>${esc(r.home)} vs ${esc(r.away)}</h2><div class="pick">${esc(r.selection)} @ ${Number(r.odds).toFixed(2)}</div><div class="modal-grid"><div class="metric"><small>Engine rating</small><b>${esc(r.engineRating)}</b></div><div class="metric"><small>Home support</small><b>${esc(r.homeConsensus)}%</b></div><div class="metric"><small>Away support</small><b>${esc(r.awayConsensus)}%</b></div></div><h3>Why this pick</h3><ol class="reason-list">${(r.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${(r.warnings||[]).length?`<h3>Things to keep in mind</h3><ul class="reason-list warning">${r.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="close-row"><button class="secondary" id="save-pick">${isSaved?'Saved ✓':'Save to My Picks'}</button><button class="primary" id="close-modal">Close</button></div></section>`)
  document.getElementById('close-modal').onclick=closeModal;document.getElementById('modal-bg').onclick=closeModal
  document.getElementById('save-pick').onclick=()=>{
    const rows=JSON.parse(localStorage.getItem('s2p_saved')||'[]')
    const key=x=>`${x.fixtureId}|${x.market}|${x.selection}|${Number(x.odds).toFixed(2)}`
    if(!rows.some(x=>key(x)===key(r)))rows.push(r)
    localStorage.setItem('s2p_saved',JSON.stringify(rows))
    document.getElementById('save-pick').textContent='Saved ✓'
  }
}
export function openFilters({loadBoard,renderBoard}){
  const markets=['all',...(state.board?.availableMarkets||[])];document.body.insertAdjacentHTML('beforeend',`<div class="drawer-backdrop" id="drawer-bg"></div><section class="drawer" id="drawer"><div class="filters"><label>Market<select id="f-market">${markets.map(m=>`<option value="${esc(m)}" ${state.market===m?'selected':''}>${m==='all'?'All markets':esc(m)}</option>`).join('')}</select></label><label>Minimum filters<select id="f-min"><option value="1" ${state.minFilters===1?'selected':''}>1+</option><option value="2" ${state.minFilters===2?'selected':''}>2+</option><option value="3" ${state.minFilters===3?'selected':''}>3+</option></select></label><label>Fixture date<input id="f-date" type="date" value="${esc(state.date)}"></label></div><div class="filter-actions"><button class="secondary" id="drawer-close">Close</button><button class="primary" id="apply-filters">Apply</button></div></section>`)
  const close=()=>{document.getElementById('drawer')?.remove();document.getElementById('drawer-bg')?.remove()};document.getElementById('drawer-close').onclick=close;document.getElementById('drawer-bg').onclick=close
  document.getElementById('apply-filters').onclick=async()=>{state.market=document.getElementById('f-market').value;state.minFilters=Number(document.getElementById('f-min').value);const d=document.getElementById('f-date').value||localToday();if(d!==state.date){state.date=d;history.replaceState(null,'',`?date=${encodeURIComponent(d)}`);close();await loadBoard()}else{close();renderBoard()}}
}
export function openProfile(){
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal-bg"></div><section class="modal" id="modal"><h2>Profile</h2><p>${esc(state.user?.email||'Signed in')}</p><div class="close-row"><button class="secondary" id="saved-picks">My Picks</button><button class="secondary" id="signout">Sign out</button><button class="primary" id="close-modal">Close</button></div></section>`)
  document.getElementById('close-modal').onclick=closeModal;document.getElementById('modal-bg').onclick=closeModal;document.getElementById('signout').onclick=()=>{clearSession();location.reload()}
  document.getElementById('saved-picks').onclick=()=>{const rows=JSON.parse(localStorage.getItem('s2p_saved')||'[]');document.getElementById('modal').innerHTML=`<h2>My Picks</h2>${rows.length?rows.map(r=>`<div class="metric"><b>${esc(r.home)} vs ${esc(r.away)}</b><small>${esc(r.selection)} @ ${Number(r.odds).toFixed(2)}</small></div>`).join(''):'<p>No saved picks yet.</p>'}<div class="close-row"><button class="primary" id="close-modal-2">Close</button></div>`;document.getElementById('close-modal-2').onclick=closeModal}
}
