import {state,esc,api,localToday} from './core.js'
import {openDetails} from './dialogs.js'

const FOX_VIDEO='/assets/fox-kicking-ball.mp4?v=2.2.12'
const foxVideoMarkup=className=>`<video class="${className}" autoplay loop muted playsinline preload="auto"><source src="${FOX_VIDEO}" type="video/mp4"></video>`
const SCHEDULED=new Set(['NS','TBD']),FINISHED=new Set(['FT','AET','PEN']),ACTIVE=new Set(['1H','HT','2H','ET','BT','P','LIVE','INT','INPLAY'])
let matchStates=new Map()
const kickMs=x=>{const n=Date.parse(x?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
const byKickoff=rows=>[...(rows||[])].sort((a,b)=>kickMs(a)-kickMs(b)||String(a?.fixtureId??'').localeCompare(String(b?.fixtureId??'')))
const shortStatus=x=>String(x?.status||'NS').toUpperCase()
function statusLabel(x){
  if(x?.matchStatus)return x.matchStatus
  const s=shortStatus(x),m=x?.minute
  if(s==='NS')return'Scheduled'
  if(s==='TBD')return'Time TBD'
  if(s==='1H')return`Live · 1H${m!=null?` · ${m}'`:''}`
  if(s==='HT')return'Half Time'
  if(s==='2H')return`Live · 2H${m!=null?` · ${m}'`:''}`
  if(s==='ET')return`Extra Time${m!=null?` · ${m}'`:''}`
  if(s==='BT')return'Break Time'
  if(s==='P')return'Penalties'
  if(s==='INT')return'Interrupted'
  if(s==='SUSP')return'Suspended'
  if(s==='FT')return'Full Time'
  if(s==='AET')return'Full Time · AET'
  if(s==='PEN')return'Full Time · Pens'
  if(s==='PST')return'Postponed'
  if(s==='CANC')return'Cancelled'
  if(s==='ABD')return'Abandoned'
  if(s==='AWD')return'Awarded'
  if(s==='WO')return'Walkover'
  return s
}
function statusClass(x){const s=shortStatus(x);if(ACTIVE.has(s))return'live';if(FINISHED.has(s))return'settled';if(['PST','CANC','ABD','SUSP'].includes(s))return'interrupted';return'scheduled'}
function liveState(row){return matchStates.get(String(row?.fixtureId??''))||row||{}}
function scoreOf(x){
  const h=Number(x?.home?.score??x?.score?.home),a=Number(x?.away?.score??x?.score?.away)
  return Number.isFinite(h)&&Number.isFinite(a)?{h,a}:null
}
function selectedSide(row,stateRow){
  const id=String(row?.selectedTeamId??'')
  if(id&&id===String(stateRow?.home?.id??stateRow?.homeId??''))return'home'
  if(id&&id===String(stateRow?.away?.id??stateRow?.awayId??''))return'away'
  const sel=String(row?.selection||'').toLowerCase(),home=String(stateRow?.home?.name??stateRow?.home??'').toLowerCase(),away=String(stateRow?.away?.name??stateRow?.away??'').toLowerCase()
  if(home&&sel.includes(home))return'home';if(away&&sel.includes(away))return'away';if(/\b1x\b/i.test(row?.selection||''))return'home';if(/\bx2\b/i.test(row?.selection||''))return'away';return null
}
function settlement(row,stateRow){
  const s=shortStatus(stateRow);if(!FINISHED.has(s))return row?.settlementStatus||null
  const score=scoreOf(stateRow);if(!score)return row?.settlementStatus||null
  const {h,a}=score,total=h+a,market=String(row?.market||'').toUpperCase(),side=selectedSide(row,stateRow)
  if(market==='1X2'){if(!side)return'REVIEW';return side==='home'?(h>a?'WON':'LOST'):(a>h?'WON':'LOST')}
  if(market==='DNB'){if(!side)return'REVIEW';if(h===a)return'PUSH';return side==='home'?(h>a?'WON':'LOST'):(a>h?'WON':'LOST')}
  if(market==='DC'){if(!side)return'REVIEW';return side==='home'?(h>=a?'WON':'LOST'):(a>=h?'WON':'LOST')}
  if(market==='BTTS')return h>0&&a>0?'WON':'LOST'
  const goal=market.match(/^([OU])(1\.5|2\.5|3\.5)$/);if(goal){const line=Number(goal[2]);return goal[1]==='O'?(total>line?'WON':'LOST'):(total<line?'WON':'LOST')}
  return row?.settlementStatus||'REVIEW'
}
function statusBadge(x){return`<span class="match-status match-status--${statusClass(x)}">${esc(statusLabel(x))}</span>`}
function settlementBadge(value){return value?`<span class="settlement settlement--${String(value).toLowerCase()}">${esc(value)}</span>`:''}

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
function displaySelection(r){
  const market=String(r?.market||'').toLowerCase(),marketName=String(r?.marketName||'').toLowerCase(),selection=String(r?.selection||'')
  if(market==='first-half-goals'||marketName.includes('first-half goals'))return`1H · ${selection}`
  if(market==='first-half-winner'||marketName.includes('first-half winner'))return`1H Result · ${selection}`
  if(market==='home-team-goals'||marketName.includes('home team goals'))return`Home Team · ${selection}`
  if(market==='away-team-goals'||marketName.includes('away team goals'))return`Away Team · ${selection}`
  if(market==='team-goals'||marketName.includes('team goals'))return`Team Total · ${selection}`
  if(market==='both-teams-score'||marketName.includes('both teams to score'))return`BTTS · ${selection}`
  if(market==='double-chance'||marketName.includes('double chance'))return`Double Chance · ${selection}`
  if(market==='draw-no-bet'||marketName.includes('draw no bet'))return`DNB · ${selection}`
  if(market==='match-winner'||marketName.includes('match winner'))return`1X2 · ${selection}`
  return selection
}
function card(r){
  const m=liveState(r),score=scoreOf(m),settled=settlement(r,m)
  return`<article class="card"><div class="competition">${r.countryFlag?`<img class="flag" src="${esc(r.countryFlag)}" alt="">`:''}<div><strong>${esc(r.league)}</strong><small>${esc(r.country)}</small></div></div><div class="teams"><div class="team">${r.homeLogo?`<img class="crest" src="${esc(r.homeLogo)}" alt="">`:''}${esc(r.home)}</div><div class="team">${r.awayLogo?`<img class="crest" src="${esc(r.awayLogo)}" alt="">`:''}${esc(r.away)}</div>${score?`<div class="inline-score">${score.h} – ${score.a}</div>`:''}</div><div class="prediction"><strong>${esc(displaySelection(r))}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span>${settlementBadge(settled)}</div><div class="kick">${timeLabel(r.kickoff)}<small>${statusBadge(m)}</small></div><button class="secondary details" data-details="${esc(r.fixtureId)}" data-market="${esc(r.market)}">View details ›</button></article>`
}
const availabilityLabel=status=>({qualified:'Qualified pick','waiting-odds':'Waiting for usable odds','waiting-verified-odds':'Waiting for verified odds','insufficient-split':'Split sample not ready',priced:'No qualified pick','analysis-unavailable':'Analysis unavailable','analysis-ready':'Analysis pending',scheduled:'Scheduled'})[status]||'Scheduled'
function fixtureCard(f,pick){
  const m=liveState(f),qualified=Boolean(pick),label=availabilityLabel(f.availability),score=scoreOf(m),settled=qualified?settlement(pick,m):null
  return`<article class="card fixture-card ${qualified?'fixture-card--qualified':''}"><div class="competition">${f.countryFlag?`<img class="flag" src="${esc(f.countryFlag)}" alt="">`:''}<div><strong>${esc(f.league)}</strong><small>${esc(f.country)}</small></div></div><div class="teams"><div class="team">${f.homeLogo?`<img class="crest" src="${esc(f.homeLogo)}" alt="">`:''}${esc(f.home)}</div><div class="team">${f.awayLogo?`<img class="crest" src="${esc(f.awayLogo)}" alt="">`:''}${esc(f.away)}</div>${score?`<div class="inline-score">${score.h} – ${score.a}</div>`:''}</div>${qualified?`<div class="prediction"><strong>${esc(displaySelection(pick))}</strong><span class="odd">${Number(pick.odds).toFixed(2)}</span>${settlementBadge(settled)}</div>`:`<div class="prediction prediction--neutral"><strong>${esc(label)}</strong><span class="fixture-state">No pick forced</span></div>`}<div class="kick">${timeLabel(f.kickoff)}<small>${statusBadge(m)}</small></div>${qualified?`<button class="secondary details" data-details="${esc(pick.fixtureId)}" data-market="${esc(pick.market)}">View details ›</button>`:`<div class="fixture-note">${esc(label)}</div>`}</article>`
}

function noTipsMarkup(){return`<section class="s2p-no-tips" role="status" aria-label="No qualified tips available">${foxVideoMarkup('s2p-no-tips-video')}</section>`}

export function renderBoard(){
  if(!state.board)return
  const best=byKickoff(filteredRows(state.board.bestPicks)),remaining=byKickoff((state.board.fixtures||[]).filter(f=>SCHEDULED.has(shortStatus(liveState(f))))),three=byKickoff(filteredRows(state.board.groups?.threePlus)),rawHasQualified=Number(state.board?.meta?.qualified||0)>0||(state.board.bestPicks||[]).length>0||(state.board.priority||[]).length>0||(state.board.groups?.threePlus||[]).length>0
  document.getElementById('count-best').textContent=best.length;document.getElementById('count-upcoming').textContent=remaining.length;document.getElementById('count-three').textContent=three.length;setDateActive()
  if(state.tab==='live')return renderLiveFromCache()
  const host=document.getElementById('cards')
  if(state.tab==='upcoming'){
    const byFixture=new Map((state.board.bestPicks||[]).map(x=>[String(x.fixtureId),x]))
    document.getElementById('section-title').textContent='Remaining games';document.getElementById('section-sub').textContent=remaining.length?`${remaining.length} scheduled fixture${remaining.length===1?'':'s'} · earliest kickoff first`:'No remaining scheduled fixtures';host.innerHTML=remaining.length?remaining.map(f=>fixtureCard(f,byFixture.get(String(f.fixtureId)))).join(''):noTipsMarkup();host.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(b.dataset.details,b.dataset.market));return
  }
  const rows=state.tab==='best'?best:three,title=state.tab==='best'?'Best Picks':'3+ Filter predictions'
  document.getElementById('section-title').textContent=title;document.getElementById('section-sub').textContent=rows.length?`${rows.length} selection${rows.length===1?'':'s'} · earliest kickoff first`:rawHasQualified?'0 selections match the current filters':'No qualified predictions';host.innerHTML=rows.length?rows.map(card).join(''):rawHasQualified?`<div class="empty">No picks match the current filters. Change the market or confidence filter to see the available predictions.</div>`:noTipsMarkup();host.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(b.dataset.details,b.dataset.market))
}
export function showRefresh(job){const host=document.getElementById('refresh-status');if(!host)return;if(job?.state==='running')host.innerHTML=loadingMarkup('refresh');else if(job?.state==='failed')host.innerHTML='<div class="refreshing">We could not refresh matches right now. Your last saved board is still available.</div>';else host.innerHTML=''}
function renderLiveFromCache(){
  const host=document.getElementById('cards');if(!host)return
  document.getElementById('section-title').textContent='Match Status';document.getElementById('section-sub').textContent='Live and settled matches · earliest kickoff first'
  const rows=byKickoff([...matchStates.values()].filter(x=>!SCHEDULED.has(shortStatus(x)))),pickMap=new Map((state.board?.bestPicks||[]).map(x=>[String(x.fixtureId),x]))
  document.getElementById('count-live').textContent=rows.filter(x=>ACTIVE.has(shortStatus(x))).length
  host.innerHTML=rows.length?rows.map(x=>{const pick=pickMap.get(String(x.fixtureId)),score=scoreOf(x),settled=pick?settlement(pick,x):null;return`<article class="card live-row"><div class="competition">${x.countryFlag?`<img class="flag" src="${esc(x.countryFlag)}" alt="">`:''}<div><strong>${esc(x.league)}</strong><small>${esc(x.country)}</small></div></div><div class="teams"><div class="team">${x.home.logo?`<img class="crest" src="${esc(x.home.logo)}" alt="">`:''}${esc(x.home.name)}</div><div class="team">${x.away.logo?`<img class="crest" src="${esc(x.away.logo)}" alt="">`:''}${esc(x.away.name)}</div></div><div class="score">${score?`${score.h} : ${score.a}`:'– : –'}<small>${statusBadge(x)}</small>${settlementBadge(settled)}</div></article>`}).join(''):'<div class="empty">No live or completed matches are available for this date yet.</div>'
}
export async function refreshMatchStates(){
  const data=await api(`/api/live-scores?date=${encodeURIComponent(state.date)}`);matchStates=new Map((data.fixtures||[]).map(x=>[String(x.fixtureId),x]));if(state.tab==='live')renderLiveFromCache();else renderBoard();return data
}
export async function renderLive(){try{await refreshMatchStates()}catch{const host=document.getElementById('cards');if(host)host.innerHTML='<div class="empty">Live scores are temporarily unavailable.</div>'}}
export function stopLive(){}
