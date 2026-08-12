import {state,esc,api,localToday} from './core.js'
import {openDetails} from './dialogs.js'

const FOX_VIDEO='/assets/fox-kicking-ball.mp4?v=2.2.12'
const foxVideoMarkup=className=>`<video class="${className}" autoplay loop muted playsinline preload="auto"><source src="${FOX_VIDEO}" type="video/mp4"></video>`

export function loadingMarkup(kind='refresh'){return`<div class="s2p-loader s2p-loader--${esc(kind)}" role="status" aria-label="Loading Stats2Pitch">${foxVideoMarkup('s2p-loader-video')}</div>`}
function weekDates(){
  const today=localToday(),base=new Date(`${today}T12:00:00Z`),day=base.getUTCDay(),count=day===0?1:8-day
  return Array.from({length:count},(_,i)=>{const d=new Date(base.getTime()+i*86_400_000);return d.toISOString().slice(0,10)})
}
function weekStripMarkup(){
  const today=localToday()
  return`<nav class="week-strip" id="week-strip" aria-label="This week's remaining boards">${weekDates().map(date=>{const d=new Date(`${date}T12:00:00Z`),primary=date===today?'Today':d.toLocaleDateString([],{weekday:'short'}),secondary=d.toLocaleDateString([],{day:'numeric',month:'short'});return`<button class="week-day ${date===state.date?'active':''}" data-date="${date}" type="button"><strong>${esc(primary)}</strong><small>${esc(secondary)}</small></button>`}).join('')}</nav>`
}
export function shell({openFilters,openProfile,manualRefresh,switchTab,selectDate}){
  const app=document.getElementById('app');app.innerHTML=`<main class="shell auth-stadium dashboard-stadium"><header class="topbar"><button class="icon-btn" id="menu" aria-label="Filters">☰</button><div class="brand"><div class="logo">STATS<span>2</span>PITCH</div><small>Prediction Board</small></div><button class="icon-btn" id="profile" aria-label="Profile"><span class="status-dot"></span></button></header><nav class="tabs"><button class="tab active" data-tab="best">★ Best Picks <span id="count-best">0</span></button><button class="tab" data-tab="upcoming">◷ Upcoming <span id="count-upcoming">0</span></button><button class="tab" data-tab="live">◉ Live <span id="count-live">0</span></button><button class="tab" data-tab="three">⌁ 3+ Filters <span id="count-three">0</span></button></nav>${weekStripMarkup()}<section class="section-head"><div><h2 id="section-title">Best Picks</h2><p id="section-sub">0 selections</p></div><div class="tools"><button class="secondary" id="refresh"><span>↻ </span>Refresh</button></div></section><div id="refresh-status"></div><section id="cards" class="cards"></section></main>`
  document.getElementById('menu').onclick=openFilters;document.getElementById('profile').onclick=openProfile;document.getElementById('refresh').onclick=manualRefresh;document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>selectDate(b.dataset.date))
}
export function setTabActive(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab))}
export function setDateActive(){document.querySelectorAll('.week-day').forEach(b=>b.classList.toggle('active',b.dataset.date===state.date))}
const filteredRows=rows=>(rows||[]).filter(r=>(state.market==='all'||r.market===state.market)&&Number(r.filterCount||0)>=Number(state.minFilters||1))
const timeLabel=iso=>{if(!iso)return'—';try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function card(r){return`<article class="card"><div class="competition">${r.countryFlag?`<img class="flag" src="${esc(r.countryFlag)}" alt="">`:''}<div><strong>${esc(r.league)}</strong><small>${esc(r.country)}</small></div></div><div class="teams"><div class="team">${r.homeLogo?`<img class="crest" src="${esc(r.homeLogo)}" alt="">`:''}${esc(r.home)}</div><div class="team">${r.awayLogo?`<img class="crest" src="${esc(r.awayLogo)}" alt="">`:''}${esc(r.away)}</div></div><div class="prediction"><strong>${esc(r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="kick">${timeLabel(r.kickoff)}<small>Upcoming</small></div><button class="secondary details" data-details="${esc(r.fixtureId)}" data-market="${esc(r.market)}">View details ›</button></article>`}
const availabilityLabel=status=>({qualified:'Qualified pick','waiting-odds':'Waiting for usable odds','insufficient-split':'Split sample not ready',priced:'No qualified pick','analysis-unavailable':'Analysis unavailable','analysis-ready':'Analysis pending',scheduled:'Scheduled'})[status]||'Scheduled'
function fixtureCard(f,pick){
  const qualified=Boolean(pick),label=availabilityLabel(f.availability)
  return`<article class="card fixture-card ${qualified?'fixture-card--qualified':''}"><div class="competition">${f.countryFlag?`<img class="flag" src="${esc(f.countryFlag)}" alt="">`:''}<div><strong>${esc(f.league)}</strong><small>${esc(f.country)}</small></div></div><div class="teams"><div class="team">${f.homeLogo?`<img class="crest" src="${esc(f.homeLogo)}" alt="">`:''}${esc(f.home)}</div><div class="team">${f.awayLogo?`<img class="crest" src="${esc(f.awayLogo)}" alt="">`:''}${esc(f.away)}</div></div>${qualified?`<div class="prediction"><strong>${esc(pick.selection)}</strong><span class="odd">${Number(pick.odds).toFixed(2)}</span></div>`:`<div class="prediction prediction--neutral"><strong>${esc(label)}</strong><span class="fixture-state">No pick forced</span></div>`}<div class="kick">${timeLabel(f.kickoff)}<small>Upcoming</small></div>${qualified?`<button class="secondary details" data-details="${esc(pick.fixtureId)}" data-market="${esc(pick.market)}">View details ›</button>`:`<div class="fixture-note">${esc(label)}</div>`}</article>`
}

function noTipsMarkup(){return`<section class="s2p-no-tips" role="status" aria-label="No qualified tips available">${foxVideoMarkup('s2p-no-tips-video')}</section>`}

export function renderBoard(){
  if(!state.board)return;const best=filteredRows(state.board.bestPicks),remaining=state.board.fixtures||[],three=filteredRows(state.board.groups?.threePlus),rawHasQualified=Number(state.board?.meta?.qualified||0)>0||(state.board.bestPicks||[]).length>0||(state.board.priority||[]).length>0||(state.board.groups?.threePlus||[]).length>0
  document.getElementById('count-best').textContent=best.length;document.getElementById('count-upcoming').textContent=remaining.length;document.getElementById('count-three').textContent=three.length;setDateActive()
  if(state.tab==='live')return renderLive()
  const host=document.getElementById('cards')
  if(state.tab==='upcoming'){
    const byFixture=new Map((state.board.bestPicks||[]).map(x=>[String(x.fixtureId),x]))
    document.getElementById('section-title').textContent='Remaining games';document.getElementById('section-sub').textContent=remaining.length?`${remaining.length} scheduled fixture${remaining.length===1?'':'s'} on this board`:'No remaining scheduled fixtures';host.innerHTML=remaining.length?remaining.map(f=>fixtureCard(f,byFixture.get(String(f.fixtureId)))).join(''):noTipsMarkup();host.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(b.dataset.details,b.dataset.market));return
  }
  const rows=state.tab==='best'?best:three,title=state.tab==='best'?'Best Picks':'3+ Filter predictions'
  document.getElementById('section-title').textContent=title;document.getElementById('section-sub').textContent=rows.length?`${rows.length} selection${rows.length===1?'':'s'}`:rawHasQualified?'0 selections match the current filters':'No qualified predictions';host.innerHTML=rows.length?rows.map(card).join(''):rawHasQualified?`<div class="empty">No picks match the current filters. Change the market or confidence filter to see the available predictions.</div>`:noTipsMarkup();host.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(b.dataset.details,b.dataset.market))
}
export function showRefresh(job){const host=document.getElementById('refresh-status');if(!host)return;if(job?.state==='running')host.innerHTML=loadingMarkup('refresh');else if(job?.state==='failed')host.innerHTML='<div class="refreshing">We could not refresh matches right now. Your last saved board is still available.</div>';else host.innerHTML=''}
export async function renderLive(){
  const host=document.getElementById('cards');document.getElementById('section-title').textContent='Live Scores';document.getElementById('section-sub').textContent='Real match status for the selected day'
  try{const data=await api(`/api/live-scores?date=${encodeURIComponent(state.date)}`),rows=(data.fixtures||[]).filter(x=>!['NS','TBD'].includes(x.status));document.getElementById('count-live').textContent=rows.filter(x=>!['FT','AET','PEN','PST','CANC','ABD'].includes(x.status)).length;host.innerHTML=rows.length?rows.map(x=>`<article class="card live-row"><div class="competition">${x.countryFlag?`<img class="flag" src="${esc(x.countryFlag)}" alt="">`:''}<div><strong>${esc(x.league)}</strong><small>${esc(x.country)}</small></div></div><div class="teams"><div class="team">${x.home.logo?`<img class="crest" src="${esc(x.home.logo)}" alt="">`:''}${esc(x.home.name)}</div><div class="team">${x.away.logo?`<img class="crest" src="${esc(x.away.logo)}" alt="">`:''}${esc(x.away.name)}</div></div><div class="score">${x.home.score??'–'} : ${x.away.score??'–'}<small class="live"> ${esc(x.minute??x.status)}</small></div></article>`).join(''):'<div class="empty">No live or completed matches are available for this date yet.</div>';if(!state.liveTimer)state.liveTimer=setInterval(()=>state.tab==='live'&&renderLive(),30000)}catch{host.innerHTML='<div class="empty">Live scores are temporarily unavailable.</div>'}
}
export function stopLive(){clearInterval(state.liveTimer);state.liveTimer=null}
