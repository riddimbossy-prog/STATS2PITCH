const $=q=>document.querySelector(q),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={date:new Date().toISOString().slice(0,10),board:null,market:'all'}
function dates(){const a=[];for(let i=0;i<7;i++){const d=new Date(Date.now()+i*86400000);a.push(d.toISOString().slice(0,10))}return a}
function renderDates(){$('#dates').innerHTML=dates().map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===dates()[0]?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('');document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;load()})}
function render(){
  renderDates()
  const b=state.board||{},rows=(b.bestPicks||[]).filter(x=>state.market==='all'||x.market===state.market)
  const markets=['all',...(b.availableMarkets||[])]
  $('#market').innerHTML=markets.map(m=>`<option ${m===state.market?'selected':''} value="${esc(m)}">${m==='all'?'All markets':esc(m)}</option>`).join('')
  $('#status').textContent=`${rows.length} best pick${rows.length===1?'':'s'}`
  $('#cards').innerHTML=rows.length?rows.map((r,i)=>`<article class="card"><div class="league">${esc(r.league)} · ${esc(r.country)}</div><div class="teams">${esc(r.home)} vs ${esc(r.away)}</div><div class="pick"><strong>${esc(r.displaySelection||r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="support"><span>Home ${r.homeConsensus}%</span><span>Away ${r.awayConsensus}%</span></div><div class="${r.oddsVerified?'verified':'single'}">${r.oddsVerified?'✓ Cross-source odds verified':'Single-source odds'}</div><div class="time">${new Date(r.kickoff).toLocaleString()}</div><button class="details" data-i="${i}">View details</button></article>`).join(''):'<div class="empty">No market passed both the odds gate and strict 80/80 consensus.</div>'
  document.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>open(rows[Number(btn.dataset.i)]))
}
function open(r){$('#modal').classList.remove('hidden');$('#modal').innerHTML=`<div class="dialog"><h2>${esc(r.home)} vs ${esc(r.away)}</h2><div class="pick"><strong>${esc(r.displaySelection||r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="metrics"><div class="metric"><small>Consensus</small><b>${r.consensus}%</b></div><div class="metric"><small>Home</small><b>${r.homeConsensus}%</b></div><div class="metric"><small>Away</small><b>${r.awayConsensus}%</b></div></div><p>${esc(r.reason)}</p>${r.apiOdd&&r.statsOdd?`<p>API-Football ${r.apiOdd} · TheStatsAPI ${r.statsOdd}</p>`:''}<button class="close">Close</button></div>`;$('.close').onclick=()=>$('#modal').classList.add('hidden')}
async function load(){
  $('#status').textContent='Loading…'
  state.board=await fetch(`/api/board?date=${encodeURIComponent(state.date)}`,{cache:'no-store'}).then(r=>r.json())
  render()
  if(state.board?.meta?.refresh?.state==='running'||!state.board?.meta?.generatedAt){poll()}
}
async function poll(){for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,3000));const j=await fetch(`/api/refresh-status?date=${encodeURIComponent(state.date)}`,{cache:'no-store'}).then(r=>r.json());$('#status').textContent=j.state==='running'?'Refreshing…':j.state;if(j.state==='complete'){return load()}if(j.state==='failed')return}}
$('#market').onchange=e=>{state.market=e.target.value;render()}
$('#refresh').onclick=async()=>{await fetch('/api/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:state.date})});poll()}
renderDates();load()
