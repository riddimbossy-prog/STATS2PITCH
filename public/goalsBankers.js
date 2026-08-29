import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'
import {whySectionHtml,bindWhyModal} from './whyPopup.js'
import {api,readBoardCache,writeBoardCache,warmNeighbors,scrollDateStrip,hasRemainingTips,nextDateWithTips,isSrlPick,bootDone} from './net.js'

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"': '"',"'":'&#39;'}[c]))
const REQUIRED_ENGINES=new Set(['goals-bankers-v3','goals-bankers-v4'])
const BOARD_VIEW='goals'
const SLIP_KEY='s2p-goals-slip'
const PUBLISHED_ROUTES=new Set(['FAV_WIN','FAV_2PLUS','OVER_2.5','GG'])
const MARKET_CHIPS=[{id:'all',label:'All'},{id:'FAV_WIN',label:'Win'},{id:'FAV_2PLUS',label:'2+'},{id:'OVER_2.5',label:'Over 2.5'},{id:'GG',label:'GG'}]
const state={date:new URLSearchParams(location.search).get('date')||new Date().toISOString().slice(0,10),board:null,results:null,status:'upcoming',country:'all',league:'all',market:'all',route:'all',slip:loadSlip(),timer:null,note:''}

function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function team(name,img,side){return`<div class="team team-${side}"><span class="crest-wrap"><img class="team-crest" src="${esc(img)}" alt="${esc(name)} crest" loading="lazy"></span><span class="team-name">${esc(name)}</span></div>`}
function matchMid(r,score){const live=stateFor(r)==='live',o=resultFor(r)?.outcome;if(o==='postponed')return`<span class="versus">VS</span><b class="match-mid-score postponed">P/P</b>`;if(score)return`<span class="versus">${live?'LIVE':'VS'}</span><b class="match-mid-score">${esc(score.home)}–${esc(score.away)}</b>`;return`<span class="versus">VS</span><b class="match-mid-clock">${esc(kickClock(r.kickoff))}</b>`}
function matchup(r,score){const fx=fixtureCrests(state.board);return`<div class="teams crest-matchup">${team(r.home,crestSrc(r,'home',fx),'home')}<div class="match-mid">${matchMid(r,score)}</div>${team(r.away,crestSrc(r,'away',fx),'away')}</div>`}
function kickoffMs(r){const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function formatDateTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function kickClock(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return'TBC';return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function oddStr(r){const n=Number(r.odds);return Number.isFinite(n)?n.toFixed(2):'—'}
function dates(){const a=[];for(let i=-6;i<=6;i++){const d=new Date();d.setUTCDate(d.getUTCDate()+i);a.push(d.toISOString().slice(0,10))}return a}
function renderDates(){const host=$('#dates');if(!host)return;const ds=dates(),today=new Date().toISOString().slice(0,10),stamp=`${state.date}|${ds[0]}|${ds[ds.length-1]}`;if(host.dataset.stamp===stamp)return;host.dataset.stamp=stamp;host.innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('');host.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()});requestAnimationFrame(()=>scrollDateStrip(host))}
function boardReady(board){const meta=board?.goalsBankersMeta||{},engine=String(meta.engine||board?.meta?.goalsBankersEngine||'');return REQUIRED_ENGINES.has(engine)&&Array.isArray(board?.goalsBankers)}
function decided(o){return ['won','lost','void','postponed'].includes(String(o||''))}
function outcomeLabel(o){return({won:'WON',lost:'LOST',void:'VOID',postponed:'POSTPONED'})[o]||'SETTLED'}
function resultFor(r){const live=(state.results?.goalsBankers||[]).find(x=>String(x.fixtureId)===String(r.fixtureId))?.result||null,stored=state.board?.results?.[String(r.fixtureId)]||null;if(live&&decided(live.outcome))return live;if(live&&live.matchState==='live')return live;if(stored&&decided(stored.outcome))return stored;return live||stored}
function stateFor(r){const x=resultFor(r);if(x?.matchState)return x.matchState;if(decided(x?.outcome))return'settled';return kickoffMs(r)>Date.now()?'upcoming':'pending'}
function scoreFor(r){const s=stateFor(r);if(s!=='live'&&s!=='settled')return null;if(resultFor(r)?.outcome==='postponed')return null;const x=resultFor(r);const h=x?.homeScore??x?.home?.score,a=x?.awayScore??x?.away?.score;return h!==null&&h!==undefined&&a!==null&&a!==undefined?{home:h,away:a}:null}
function statusBadge(r){const x=resultFor(r),s=stateFor(r);if(s==='live')return`<span class="match-badge live">LIVE${x?.minute?` · ${esc(x.minute)}′`:''}</span>`;if(s==='settled'){const o=x?.outcome||'pending';return`<span class="match-badge ${esc(o)}">${outcomeLabel(o)}</span>`}return`<span class="match-badge upcoming">UPCOMING</span>`}
function pickResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="pick-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function topResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="m-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function pickLabel(r){return String(r.displaySelection||r.pick||r.selection||'Selection')}
function marketName(r){const m=String(r.market||'');if(m==='both-teams-score')return'Both Teams To Score';if(m==='match-winner')return'Match winner';if(m==='away-team-goals')return'Away team goals';if(m==='home-team-goals')return'Home team goals';if(m==='total-goals')return'Total goals';return m.replaceAll('-',' ')||'Market'}
function routeLabel(r){return({FAV_WIN:'WIN',FAV_2PLUS:'2+','OVER_2.5':'O2.5',GG:'GG'})[r.route]||'PICK'}
function uniq(xs){return[...new Set(xs.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b))}
function options(el,values,current,label,fmt=v=>v){if(!el)return'all';const valid=current==='all'||values.includes(current)?current:'all';el.innerHTML=`<option value="all">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${fmt(v)}</option>`).join('');return valid}
function allRows(){return boardReady(state.board)?(state.board.goalsBankers||[]).filter(r=>!isSrlPick(r)):[]}
function filtered(rows){return rows.filter(r=>{const s=stateFor(r);if(state.status!=='all'&&s!==state.status)return false;if(state.country!=='all'&&String(r.country)!==state.country)return false;if(state.league!=='all'&&String(r.league)!==state.league)return false;if(state.market!=='all'&&String(r.market)!==state.market)return false;if(state.route!=='all'&&String(r.route)!==state.route)return false;return true}).sort((a,b)=>kickoffMs(a)-kickoffMs(b)||String(a.league).localeCompare(String(b.league)))}
function renderHero(rows){const el=$('#goalsHeroCount');if(el)el.textContent=String(rows.length)}
function renderMarkets(rows){
  const host=$('#goalsMarkets');if(!host)return
  const counts={all:rows.length,FAV_WIN:0,FAV_2PLUS:0,'OVER_2.5':0,GG:0}
  for(const r of rows){if(counts[r.route]!==undefined)counts[r.route]++}
  host.innerHTML=MARKET_CHIPS.map(chip=>`<button type="button" class="goals-market ${state.route===chip.id?'active':''}" data-route="${esc(chip.id)}">${esc(chip.label)}<b>${counts[chip.id]||0}</b></button>`).join('')
  host.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{state.route=b.dataset.route;state.market='all';if($('#market'))$('#market').value='all';render()})
}
function renderCountryChips(rows){const host=$('#countryChips');if(!host)return;const countries=uniq(rows.map(r=>r.country));host.innerHTML=`<button class="country-chip ${state.country==='all'?'active':''}" data-country="all" title="All countries">🌍</button>`+countries.map(c=>`<button class="country-chip ${state.country===c?'active':''}" data-country="${esc(c)}" title="${esc(c)}" aria-label="${esc(c)}">${flag(c)}</button>`).join('');$$('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.league='all';render()})}
function renderStats(rows){const host=$('#goalsStats');if(!host)return;const counts={upcoming:0,live:0,settled:0,total:rows.length};for(const r of rows){const s=stateFor(r);if(counts[s]!==undefined)counts[s]++}host.innerHTML=`<button data-stat="all"><small>Goals Bankers</small><b>${counts.total}</b></button><button data-stat="upcoming"><small>Upcoming</small><b>${counts.upcoming}</b></button><button data-stat="live"><small>Live</small><b>${counts.live}</b></button><button data-stat="settled"><small>Settled</small><b>${counts.settled}</b></button>`;$$('[data-stat]').forEach(b=>b.onclick=()=>{state.status=b.dataset.stat;if($('#statusFilter'))$('#statusFilter').value=state.status;render()})}

function loadSlip(){try{const raw=JSON.parse(sessionStorage.getItem(SLIP_KEY)||'[]');return Array.isArray(raw)?raw:[]}catch{return[]}}
function saveSlip(){sessionStorage.setItem(SLIP_KEY,JSON.stringify(state.slip));renderSlip()}
function onSlip(id){return state.slip.some(x=>String(x.fixtureId)===String(id))}
function canAddAccaLeg(slip,pick){
  const legs=Array.isArray(slip)?slip:[]
  if(!pick||!PUBLISHED_ROUTES.has(pick.route))return{ok:false,reason:'no-pick'}
  if(legs.length>=3)return{ok:false,reason:'max-3'}
  if(legs.some(row=>String(row.fixtureId)===String(pick.fixtureId)))return{ok:false,reason:'same-match'}
  const next=[...legs,pick]
  if(next.filter(row=>row.route==='FAV_WIN').length>1)return{ok:false,reason:'max-1-fav-win'}
  if(next.length===3&&!next.some(row=>row.route==='OVER_2.5'||row.route==='GG'))return{ok:false,reason:'need-goals-leg'}
  const hasLean=legs.some(row=>row.classification==='LEAN'||row.borderline===true)
  if(hasLean&&(pick.classification==='LEAN'||pick.borderline===true||pick.classification==='STRONG'))return{ok:false,reason:'borderline-lean'}
  return{ok:true,reason:null}
}
function slipCopy(code){return({
  'max-3':'Slip is full — max 3 legs.',
  'max-1-fav-win':'Only one favourite-win leg is allowed.',
  'need-goals-leg':'A 3-leg slip needs Over 2.5 or GG.',
  'borderline-lean':'A lean pick cannot sit with another lean or strong pick.',
  'same-match':'That match is already on the slip.',
  'no-pick':'This pick cannot go on the slip.'
})[code]||'Cannot add this pick.'}
function toggleSlip(r){
  if(onSlip(r.fixtureId)){state.slip=state.slip.filter(x=>String(x.fixtureId)!==String(r.fixtureId));state.note='';saveSlip();render();return}
  const check=canAddAccaLeg(state.slip,r)
  if(!check.ok){state.note=slipCopy(check.reason);renderSlip();return}
  state.slip=[...state.slip,{fixtureId:r.fixtureId,home:r.home,away:r.away,displaySelection:pickLabel(r),odds:r.odds,route:r.route,classification:r.classification,borderline:r.borderline===true,market:r.market}]
  state.note=''
  saveSlip();render()
}
function renderSlip(){
  const host=$('#accaSlip');if(!host)return
  host.hidden=!state.slip.length&&!state.note
  $('#accaMeta').textContent=`${state.slip.length} leg${state.slip.length===1?'':'s'}`
  $('#accaLegs').innerHTML=state.slip.map(leg=>`<li><span>${esc(leg.home)} vs ${esc(leg.away)} · ${esc(leg.displaySelection)}</span><b>${Number(leg.odds).toFixed(2)}</b><button type="button" data-drop="${esc(leg.fixtureId)}" aria-label="Remove">×</button></li>`).join('')
  $$('[data-drop]').forEach(b=>b.onclick=()=>{state.slip=state.slip.filter(x=>String(x.fixtureId)!==String(b.dataset.drop));state.note='';saveSlip();render()})
  const combined=state.slip.length?state.slip.reduce((n,leg)=>n*Number(leg.odds||1),1):0
  $('#accaOdds').textContent=combined?combined.toFixed(2):'—'
  $('#accaNote').textContent=state.note||''
}

function card(r,i){
  const score=scoreFor(r),on=onSlip(r.fixtureId),odds=oddStr(r)
  return`<article class="card ${stateFor(r)} ${decided(resultFor(r)?.outcome)?esc(resultFor(r).outcome):''}" data-i="${i}" role="button" tabindex="0" aria-label="Why ${esc(r.home)} vs ${esc(r.away)} was chosen"><div class="m-card-top"><span class="m-board-tag goals">GOALS · V4</span><span class="m-fav-tag">${esc(routeLabel(r))}</span>${topResult(r)||`<span class="m-kick-row">${esc(kickClock(r.kickoff))}</span>`}</div><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${statusBadge(r)}<span class="goals-badge">GOALS</span><span class="route-badge">${esc(routeLabel(r))}</span>${matchup(r,score)}<div class="pick"><div class="pick-copy"><span class="pick-kicker">PICK</span><strong>${esc(pickLabel(r))}</strong>${pickResult(r)}</div><span class="odd">${odds}</span></div><div class="m-footer"><div class="m-ev"><span>${esc(marketName(r))}</span></div><span class="odd odd-stack"><span class="odd-kicker">ODDS</span>${odds}</span></div><div class="time"><b>${esc(marketName(r))}</b> · ${formatDateTime(r.kickoff)}</div><button class="details" data-i="${i}" type="button">Why this pick?</button><button class="slip-add ${on?'on-slip':''}" data-slip="${i}" type="button">${on?'On slip':'Add to slip'}</button><div class="m-why-row">Why this pick ›</div></article>`
}
function open(r){const score=scoreFor(r),x=resultFor(r),modal=$('#modal');if(!modal)return;modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-label="Why this pick was chosen"><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${statusBadge(r)}${matchup(r,score)}<div class="pick"><strong>${esc(pickLabel(r))}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time"><b>${esc(marketName(r))}</b> · ${formatDateTime(r.kickoff)}</div>${x?.matchState==='settled'?`<div class="settled-summary ${esc(x.outcome||'')}">${esc(outcomeLabel(x.outcome||'settled'))}${score?` · ${score.home}–${score.away}`:''}</div>`:''}${whySectionHtml(r)}${r.publishedAt?`<div class="proof-line">✓ Original published tip preserved</div>`:''}<button class="close" type="button">Close</button></div>`;bindCrestFallbacks(modal);bindWhyModal(modal)}
function render(){
  renderDates()
  const ready=boardReady(state.board),base=allRows()
  const countries=uniq(base.map(x=>x.country))
  state.country=options($('#countryFilter'),countries,state.country,'All countries',c=>`${flag(c)} ${c}`)
  const countryRows=state.country==='all'?base:base.filter(x=>x.country===state.country),leagues=uniq(countryRows.map(x=>x.league))
  state.league=options($('#leagueFilter'),leagues,state.league,'All leagues')
  const leagueRows=state.league==='all'?countryRows:countryRows.filter(x=>x.league===state.league),markets=uniq(leagueRows.map(x=>x.market))
  state.market=options($('#market'),markets,state.market,'All markets',m=>esc(marketName({market:m})))
  if($('#statusFilter'))$('#statusFilter').value=state.status
  renderCountryChips(base)
  renderHero(base)
  renderMarkets(base)
  renderStats(base)
  renderSlip()
  const rows=filtered(base)
  if(!ready){
    $('#status').textContent='Waiting for a refreshed board'
    $('#cards').innerHTML='<div class="empty">Goals Bankers will appear here after the next board refresh.</div>'
    return
  }
  $('#status').textContent=`${rows.length} Goals Banker${rows.length===1?'':'s'}`
  $('#cards').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">No Goals Bankers match these filters yet.</div>'
  bindCrestFallbacks($('#cards'))
  $$('article[data-i]').forEach(el=>{const go=()=>open(rows[Number(el.dataset.i)]);el.onclick=e=>{if(e.target.closest('.details')||e.target.closest('.slip-add'))return;go()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}})
  $$('button.details').forEach(el=>el.onclick=e=>{e.stopPropagation();open(rows[Number(el.dataset.i)])})
  $$('button.slip-add').forEach(el=>el.onclick=e=>{e.stopPropagation();toggleSlip(rows[Number(el.dataset.slip)])})
}

function skeleton(){const host=$('#cards');if(host)host.innerHTML=Array.from({length:6},()=>'<div class="card skeleton"><div></div><div></div><div></div><div></div></div>').join('')}
function pickRows(board){return (board?.goalsBankers||[]).filter(r=>!isSrlPick(r))}
async function hopIfEmpty(){
  if(state.status!=='upcoming')return false
  if(hasRemainingTips(pickRows(state.board)))return false
  const hop=await nextDateWithTips(state.date,BOARD_VIEW,pickRows)
  if(!hop)return false
  state.date=hop.date
  state.board=hop.board
  writeBoardCache(hop.date,BOARD_VIEW,hop.board)
  history.replaceState(null,'',`?date=${encodeURIComponent(hop.date)}`)
  state.results=await api(`/results?date=${encodeURIComponent(hop.date)}`).catch(()=>null)
  return true
}
function startPolling(){clearInterval(state.timer);const today=new Date().toISOString().slice(0,10);if(state.date!==today)return;state.timer=setInterval(async()=>{try{state.results=await api(`/results?date=${encodeURIComponent(state.date)}`);if(await hopIfEmpty()){render();startPolling();warmNeighbors(state.date,BOARD_VIEW);return}render()}catch{}},30000)}
async function load(){
  renderDates()
  const cached=readBoardCache(state.date,BOARD_VIEW)
  if(cached){state.board=cached;render();bootDone()}
  else{skeleton();$('#status').textContent='Loading…'}
  try{
    const [board,res]=await Promise.all([
      api(`/board?date=${encodeURIComponent(state.date)}&view=${BOARD_VIEW}`,{cache:'default'}),
      api(`/results?date=${encodeURIComponent(state.date)}`).catch(()=>null)
    ])
    state.board=board;state.results=res
    writeBoardCache(state.date,BOARD_VIEW,board)
    await hopIfEmpty()
    render();startPolling();warmNeighbors(state.date,BOARD_VIEW)
    bootDone()
  }catch(e){
    if(cached)return
    $('#status').textContent='Unavailable';$('#cards').innerHTML=`<div class="empty">${esc(e.message)}</div>`
    bootDone()
  }
}
$('#statusFilter')?.addEventListener('change',e=>{state.status=e.target.value;render()})
$('#countryFilter')?.addEventListener('change',e=>{state.country=e.target.value;state.league='all';render()})
$('#leagueFilter')?.addEventListener('change',e=>{state.league=e.target.value;render()})
$('#market')?.addEventListener('change',e=>{state.market=e.target.value;render()})
$('#clearFilters')?.addEventListener('click',()=>{state.status='upcoming';state.country=state.league=state.market=state.route='all';render()})
$('#accaClear')?.addEventListener('click',()=>{state.slip=[];state.note='';saveSlip();render()})
$('#refresh')?.addEventListener('click',load)
$('#notifyBell')?.addEventListener('click',load)
$('#profileBtn')?.addEventListener('click',()=>document.body.classList.toggle('filters-open'))
load()
window.addEventListener('beforeunload',()=>clearInterval(state.timer))
