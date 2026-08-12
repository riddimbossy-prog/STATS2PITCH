import {state,esc,api,localToday} from './core.js'
import {openDetails} from './dialogs.js'
export function loadingMarkup(kind='refresh'){return`<div class="s2p-loader s2p-loader--${esc(kind)}" role="status" aria-live="polite"><div class="s2p-loader-scene" aria-hidden="true"><div class="s2p-loader-trail"></div><div class="s2p-loader-ball-track"><img class="s2p-loader-ball-real" src="/assets/football-real.svg?v=2.0.1" alt=""><div class="s2p-loader-shadow"></div></div><div class="s2p-loader-pitch"><img src="/assets/brand-mark.png?v=2.0.1" alt=""></div></div><div class="s2p-loader-text">Loading <b>matches...</b></div><div class="s2p-loader-sub">FROM STATS TO THE PITCH</div></div>`}
export function shell({openFilters,openProfile,manualRefresh,switchTab}){
  const app=document.getElementById('app');app.innerHTML=`<main class="shell auth-stadium dashboard-stadium"><header class="topbar"><button class="icon-btn" id="menu" aria-label="Filters">☰</button><div class="brand"><div class="logo">STATS<span>2</span>PITCH</div><small>Prediction Board</small></div><button class="icon-btn" id="profile" aria-label="Profile"><span class="status-dot"></span></button></header><nav class="tabs"><button class="tab active" data-tab="best">★ Best Picks <span id="count-best">0</span></button><button class="tab" data-tab="upcoming">◷ Upcoming <span id="count-upcoming">0</span></button><button class="tab" data-tab="live">◉ Live <span id="count-live">0</span></button><button class="tab" data-tab="three">⌁ 3+ Filters <span id="count-three">0</span></button></nav><section class="section-head"><div><h2 id="section-title">Best Picks</h2><p id="section-sub">0 selections</p></div><div class="tools"><button class="secondary" id="refresh"><span>↻ </span>Refresh</button></div></section><div id="refresh-status"></div><section id="cards" class="cards"></section></main>`
  document.getElementById('menu').onclick=openFilters;document.getElementById('profile').onclick=openProfile;document.getElementById('refresh').onclick=manualRefresh;document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab))
}
export function setTabActive(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab))}
const filteredRows=rows=>(rows||[]).filter(r=>(state.market==='all'||r.market===state.market)&&Number(r.filterCount||0)>=Number(state.minFilters||1))
const timeLabel=iso=>{if(!iso)return'—';try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function card(r){return`<article class="card"><div class="competition">${r.countryFlag?`<img class="flag" src="${esc(r.countryFlag)}" alt="">`:''}<div><strong>${esc(r.league)}</strong><small>${esc(r.country)}</small></div></div><div class="teams"><div class="team">${r.homeLogo?`<img class="crest" src="${esc(r.homeLogo)}" alt="">`:''}${esc(r.home)}</div><div class="team">${r.awayLogo?`<img class="crest" src="${esc(r.awayLogo)}" alt="">`:''}${esc(r.away)}</div></div><div class="prediction"><strong>${esc(r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="kick">${timeLabel(r.kickoff)}<small>Upcoming</small></div><button class="secondary details" data-details="${esc(r.fixtureId)}" data-market="${esc(r.market)}">View details ›</button></article>`}

function noTipsMarkup(){
  const today=state.date===localToday(),dayLabel=today?'TODAY':'THIS DATE'
  return`<section class="s2p-no-tips" role="status" aria-live="polite">
    <div class="s2p-no-tips-scene" aria-hidden="true">
      <div class="s2p-no-tips-light s2p-no-tips-light--a"></div><div class="s2p-no-tips-light s2p-no-tips-light--b"></div>
      <div class="s2p-no-tips-pitch-lines"></div>
      <div class="s2p-no-tips-logo"><img src="/assets/brand-mark.png?v=2.0.1" alt=""></div>
      <svg class="s2p-no-tips-fox" viewBox="0 0 520 430" focusable="false">
        <g class="s2p-fox-bob">
          <path class="s2p-fox-tail" d="M140 285c-62 40-108 19-96-24 9-32 54-31 91-11 28 16 37 24 48 36-11 5-27 5-43-1Z"/>
          <path class="s2p-fox-tail-tip" d="M61 240c-20 6-28 19-18 32 12 15 36 11 58-4-8-15-20-24-40-28Z"/>
          <path class="s2p-fox-body" d="M210 218c18-19 74-21 97 2 17 17 24 79 10 112-13 28-93 29-111 0-15-26-13-95 4-114Z"/>
          <path class="s2p-fox-jersey-trim" d="M212 225c24 12 70 12 92 0l7 21c-27 13-79 13-106 0l7-21Z"/>
          <ellipse class="s2p-fox-head" cx="256" cy="154" rx="83" ry="70"/>
          <path class="s2p-fox-ear" d="M190 118 203 48l51 62Z"/><path class="s2p-fox-ear" d="m313 110 39-61 14 73Z"/>
          <path class="s2p-fox-ear-inner" d="m205 98 5-30 23 34Z"/><path class="s2p-fox-ear-inner" d="m328 99 20-31 6 39Z"/>
          <path class="s2p-fox-muzzle" d="M204 171c17-29 47-27 52-13 6-14 38-17 57 13-3 33-24 50-57 50-31 0-50-17-52-50Z"/>
          <ellipse class="s2p-fox-eye" cx="229" cy="148" rx="15" ry="20"/><ellipse class="s2p-fox-eye" cx="282" cy="148" rx="15" ry="20"/>
          <circle class="s2p-fox-pupil" cx="234" cy="152" r="6"/><circle class="s2p-fox-pupil" cx="287" cy="152" r="6"/>
          <path class="s2p-fox-nose" d="M247 174c6-6 16-6 22 0-1 10-8 15-11 15-4 0-10-5-11-15Z"/>
          <path class="s2p-fox-smile" d="M235 192c14 13 31 13 45 0"/>
          <path class="s2p-fox-arm s2p-fox-arm--left" d="M210 244c-28 3-47 17-58 36l20 12c14-17 28-23 48-23Z"/>
          <path class="s2p-fox-arm s2p-fox-arm--right" d="M307 244c28-1 49 10 63 26l-17 16c-15-13-28-18-48-16Z"/>
          <path class="s2p-fox-leg s2p-fox-leg--plant" d="M228 326c-8 32-8 53-1 72l29-2c-4-27-2-45 5-68Z"/>
          <g class="s2p-fox-kick-leg"><path class="s2p-fox-leg" d="M286 325c11 18 31 32 57 43l14-24c-23-16-37-30-47-49Z"/><path class="s2p-fox-boot" d="M340 348c18 4 35 11 50 21-4 18-16 25-34 20l-29-14 13-27Z"/></g>
          <path class="s2p-fox-boot" d="M213 389c13-3 28-4 44-1l2 23c-19 8-40 8-55-1l9-21Z"/>
          <text class="s2p-fox-shirt-two" x="258" y="304" text-anchor="middle">2</text>
        </g>
      </svg>
      <img class="s2p-no-tips-ball" src="/assets/football-real.svg?v=2.0.1" alt="">
      <div class="s2p-no-tips-ball-shadow"></div>
      <div class="s2p-no-tips-spark s2p-no-tips-spark--1"></div><div class="s2p-no-tips-spark s2p-no-tips-spark--2"></div><div class="s2p-no-tips-spark s2p-no-tips-spark--3"></div>
    </div>
    <div class="s2p-no-tips-panel">
      <div class="s2p-no-tips-status"><span></span> ENGINE STATUS · SAFE SKIP</div>
      <h3><span>NO TIPS</span><em>FOR ${dayLabel}</em></h3>
      <p>No prediction cleared the Stats2Pitch quality filters. We do not force a pick just to fill the board.</p>
      <div class="s2p-no-tips-rule">✓ Better no tip than a bad tip.</div>
      <div class="s2p-no-tips-scan"><b>↻</b> Check back later — the board keeps scanning.</div>
    </div>
  </section>`
}

export function renderBoard(){
  if(!state.board)return;const best=filteredRows(state.board.bestPicks),upcoming=filteredRows(state.board.priority),three=filteredRows(state.board.groups?.threePlus),rawHasQualified=Number(state.board?.meta?.qualified||0)>0||(state.board.bestPicks||[]).length>0||(state.board.priority||[]).length>0||(state.board.groups?.threePlus||[]).length>0
  document.getElementById('count-best').textContent=best.length;document.getElementById('count-upcoming').textContent=upcoming.length;document.getElementById('count-three').textContent=three.length
  if(state.tab==='live')return renderLive()
  const rows=state.tab==='best'?best:state.tab==='three'?three:upcoming,title=state.tab==='best'?'Best Picks':state.tab==='three'?'3+ Filter predictions':'Upcoming predictions'
  document.getElementById('section-title').textContent=title;document.getElementById('section-sub').textContent=rows.length?`${rows.length} selection${rows.length===1?'':'s'}`:rawHasQualified?'0 selections match the current filters':'No qualified predictions';const host=document.getElementById('cards');host.innerHTML=rows.length?rows.map(card).join(''):rawHasQualified?`<div class="empty">No picks match the current filters. Change the market or confidence filter to see the available predictions.</div>`:noTipsMarkup();host.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(b.dataset.details,b.dataset.market))
}
export function showRefresh(job){const host=document.getElementById('refresh-status');if(!host)return;if(job?.state==='running')host.innerHTML=loadingMarkup('refresh');else if(job?.state==='failed')host.innerHTML='<div class="refreshing">We could not refresh matches right now. Your last saved board is still available.</div>';else host.innerHTML=''}
export async function renderLive(){
  const host=document.getElementById('cards');document.getElementById('section-title').textContent='Live Scores';document.getElementById('section-sub').textContent='Real match status for the selected day'
  try{const data=await api(`/api/live-scores?date=${encodeURIComponent(state.date)}`),rows=(data.fixtures||[]).filter(x=>!['NS','TBD'].includes(x.status));document.getElementById('count-live').textContent=rows.filter(x=>!['FT','AET','PEN','PST','CANC','ABD'].includes(x.status)).length;host.innerHTML=rows.length?rows.map(x=>`<article class="card live-row"><div class="competition">${x.countryFlag?`<img class="flag" src="${esc(x.countryFlag)}" alt="">`:''}<div><strong>${esc(x.league)}</strong><small>${esc(x.country)}</small></div></div><div class="teams"><div class="team">${x.home.logo?`<img class="crest" src="${esc(x.home.logo)}" alt="">`:''}${esc(x.home.name)}</div><div class="team">${x.away.logo?`<img class="crest" src="${esc(x.away.logo)}" alt="">`:''}${esc(x.away.name)}</div></div><div class="score">${x.home.score??'–'} : ${x.away.score??'–'}<small class="live"> ${esc(x.minute??x.status)}</small></div></article>`).join(''):'<div class="empty">No live or completed matches are available for this date yet.</div>';if(!state.liveTimer)state.liveTimer=setInterval(()=>state.tab==='live'&&renderLive(),30000)}catch{host.innerHTML='<div class="empty">Live scores are temporarily unavailable.</div>'}
}
export function stopLive(){clearInterval(state.liveTimer);state.liveTimer=null}
