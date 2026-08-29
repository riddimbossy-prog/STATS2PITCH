import {api,readBoardCache,writeBoardCache,dateStrip,isoToday,scrollDateStrip,bootDone} from './net.js'
import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'

const $=q=>document.querySelector(q)
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={date:new URLSearchParams(location.search).get('date')||isoToday(),board:null}
const VIEW='bankers'

function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function fmtDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function resultFor(row){return state.board?.results?.[String(row.fixtureId)]||null}
function resultChip(row){const r=resultFor(row);if(!r)return'';const o=String(r.outcome||'');if(!['won','lost','void','postponed'].includes(o))return'';return`<span class="result-chip ${esc(o)}">${esc(o.toUpperCase())}</span>`}
function metric(label,value,suffix=''){return`<div class="metric"><span>${esc(label)}</span><b>${value===null||value===undefined?'—':esc(value)}${suffix}</b></div>`}
function reasons(row){const list=Array.isArray(row.why)?row.why:row.whyText?[row.whyText]:[];return list.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}

function card(row,kind){
  const crests=fixtureCrests(state.board)
  const safe=kind==='safest'
  const edge=Number(row.valueEdge)
  return`<article class="banker-card ${safe?'safe':'value'}">
    <div class="banker-top">
      <span class="banker-type ${safe?'safe':'value'}">${safe?'◆ SAFEST BANKER':'◆ VALUE BANKER'}</span>
      <span class="league-line">${flag(row.country)} ${esc(row.league||row.country||'Football')}</span>
    </div>
    <div class="match-row">
      <div class="banker-team"><img class="team-crest" src="${esc(crestSrc(row,'home',crests))}" alt=""><b>${esc(row.home)}</b></div>
      <span class="vs">VS</span>
      <div class="banker-team away"><b>${esc(row.away)}</b><img class="team-crest" src="${esc(crestSrc(row,'away',crests))}" alt=""></div>
    </div>
    <div class="pick-box"><div><small>PICK</small><strong>${esc(row.displaySelection||row.pick||row.selection)}</strong></div><span class="price">${Number(row.odds).toFixed(2)}</span></div>
    <div class="banker-metrics">
      ${metric('BANKER SCORE',row.bankerScore,'')}
      ${metric('VENUE SUPPORT',row.capability,'%')}
      ${metric(safe?'RECENT SUPPORT':'VALUE EDGE',safe?row.recentConsensus:(Number.isFinite(edge)?edge.toFixed(1):null),safe?'%':' pts')}
    </div>
    <div class="why-title"><b>Why this pick</b></div>
    <ul class="why-list">${reasons(row)}</ul>
    <div class="kickoff"><span>${esc(fmtDate(row.kickoff))}</span>${resultChip(row)}</div>
  </article>`
}

function renderDates(){
  const host=$('#bankerDates');if(!host)return
  const today=isoToday(),dates=dateStrip(today)
  host.innerHTML=dates.map(d=>`<button class="${d===state.date?'active':''}" data-date="${d}">${d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('')
  host.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{state.date=b.dataset.date;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()})
  requestAnimationFrame(()=>scrollDateStrip(host))
}

function render(){
  renderDates()
  const safe=Array.isArray(state.board?.safestBankers)?state.board.safestBankers:[]
  const value=Array.isArray(state.board?.valueBankers)?state.board.valueBankers:[]
  const safeHost=$('#safeGrid'),valueHost=$('#valueGrid')
  $('#safeCount').textContent=String(safe.length)
  $('#valueCount').textContent=String(value.length)
  const engine=state.board?.dailyBankersMeta?.engine||state.board?.meta?.dailyBankersEngine||'daily-bankers-v1'
  $('#engineChip').textContent=engine
  safeHost.innerHTML=safe.length?safe.map(r=>card(r,'safest')).join(''):'<div class="empty-bankers">No Safest Banker cleared every rule for this date.</div>'
  valueHost.innerHTML=value.length?value.map(r=>card(r,'value')).join(''):'<div class="empty-bankers">No Value Banker has enough statistical edge for this date.</div>'
  bindCrestFallbacks(document)
}

async function load(){
  renderDates()
  const cached=readBoardCache(state.date,VIEW)
  if(cached){state.board=cached;render();bootDone()}
  else{$('#safeGrid').innerHTML='<div class="empty-bankers">Loading bankers…</div>';$('#valueGrid').innerHTML='<div class="empty-bankers">Loading bankers…</div>'}
  try{
    const board=await api(`/board?date=${encodeURIComponent(state.date)}&view=${VIEW}`,{cache:'default'})
    state.board=board
    writeBoardCache(state.date,VIEW,board)
    render();bootDone()
  }catch(e){
    if(!cached){$('#safeGrid').innerHTML='<div class="empty-bankers">Bankers are unavailable right now.</div>';$('#valueGrid').innerHTML='';bootDone()}
  }
}

load()
