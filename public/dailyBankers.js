import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'
import {whySectionHtml,bindWhyModal,learningChipHtml} from './whyPopup.js?v=5.16.0'
import {readBoardCache,writeBoardCache,dateStrip,isoToday,scrollDateStrip,bootDone,api,hasRemainingTips} from './net.js'

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const VIEW='bankers'
const cfg=window.__STATS2PITCH_CONFIG__||{}
const base=String(cfg.supabaseUrl||'').replace(/\/+$/,'')
const anon=String(cfg.supabaseAnonKey||'')
const state={date:new URLSearchParams(location.search).get('date')||isoToday(),board:null,resultData:null,status:'all',kind:'all',country:'all',league:'all',market:'all',timer:null}

function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function team(name,img,side){return`<div class="team team-${side}"><span class="crest-wrap"><img class="team-crest" src="${esc(img)}" alt="${esc(name)} crest" loading="lazy"></span><span class="team-name">${esc(name)}</span></div>`}
function matchMid(r,score){const live=stateFor(r)==='live',o=resultFor(r)?.outcome;if(o==='postponed')return`<span class="versus">VS</span><b class="match-mid-score postponed">P/P</b>`;if(score)return`<span class="versus">${live?'LIVE':'VS'}</span><b class="match-mid-score">${esc(score.home)}–${esc(score.away)}</b>`;return`<span class="versus">VS</span><b class="match-mid-clock">${esc(kickClock(r.kickoff))}</b>`}
function matchup(r,score){const fx=fixtureCrests(state.board);return`<div class="teams crest-matchup">${team(r.home,crestSrc(r,'home',fx),'home')}<div class="match-mid">${matchMid(r,score)}</div>${team(r.away,crestSrc(r,'away',fx),'away')}</div>`}
function kickoffMs(r){const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function formatDateTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function kickClock(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return'TBC';return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function oddStr(r){const n=Number(r.odds);return Number.isFinite(n)?n.toFixed(2):'—'}
function decided(o){return ['won','lost','void','postponed'].includes(String(o||''))}
function outcomeLabel(o){return({won:'WON',lost:'LOST',void:'VOID',postponed:'POSTPONED'})[o]||'SETTLED'}
function liveResultRow(r){const id=String(r.fixtureId);for(const bag of ['dailyBankers','bankers','picks']){const hit=(state.resultData?.[bag]||[]).find(x=>String(x.fixtureId)===id);if(hit?.result)return hit.result}return null}
function resultFor(r){const live=liveResultRow(r),stored=state.board?.results?.[String(r.fixtureId)]||null;if(live&&decided(live.outcome))return live;if(live&&live.matchState==='live')return live;if(stored&&decided(stored.outcome))return stored;return live||stored}
function stateFor(r){const x=resultFor(r);if(x?.matchState)return x.matchState;if(x?.live===true||String(x?.status||'').toUpperCase()==='LIVE')return'live';if(decided(x?.outcome)||x?.finished)return'settled';return kickoffMs(r)>Date.now()?'upcoming':'pending'}
function scoreFor(r){const s=stateFor(r);if(s!=='live'&&s!=='settled')return null;if(resultFor(r)?.outcome==='postponed')return null;const x=resultFor(r);const h=x?.homeScore??x?.home?.score,a=x?.awayScore??x?.away?.score;return h!==null&&h!==undefined&&a!==null&&a!==undefined?{home:h,away:a}:null}
function clockText(x){const clock=String(x?.minute||x?.clock||'').trim();if(clock)return clock;const st=String(x?.status||x?.statusLong||'').trim().toUpperCase();if(st==='1H'||st==='H1')return'H1';if(st==='HT')return'HT';if(st==='2H'||st==='H2')return'2H';return''}
function statusBadge(r){const x=resultFor(r),s=stateFor(r);if(s==='live'){const clock=clockText(x);return`<span class="match-badge live">${clock?esc(clock):'LIVE'}</span>`}if(s==='settled'){const o=x?.outcome||'pending';return`<span class="match-badge ${esc(o)}">${outcomeLabel(o)}</span>`}return`<span class="match-badge upcoming">UPCOMING</span>`}
function pickResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="pick-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function topStatus(r){const s=stateFor(r),x=resultFor(r);if(s==='live'){const clock=clockText(x);return `<span class="m-result live">${clock?esc(clock):'LIVE'}</span>`}if(decided(x?.outcome))return topResult(r);return `<span class="m-kick-row">${esc(kickClock(r.kickoff))}</span>`}
function topResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="m-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function pickLabel(r){return String(r.displaySelection||r.pick||r.selection||'Selection')}
function marketName(r){if(r.marketName)return String(r.marketName);const m=String(r.market||'');if(m==='both-teams-score')return'Both Teams To Score';if(m==='match-winner')return'Match winner';if(m==='double-chance')return'Double chance';return m.replaceAll('-',' ')||'Market'}
function kindLabel(r){return r.kind==='value'?'VALUE':'SAFEST'}
function uniq(xs){return[...new Set(xs.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b))}
function options(el,values,current,label,fmt=v=>v){if(!el)return'all';const valid=current==='all'||values.includes(current)?current:'all';el.innerHTML=`<option value="all">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${fmt(v)}</option>`).join('');return valid}

function whyList(r){
  if(Array.isArray(r?.reasons)&&r.reasons.length)return r.reasons
  if(Array.isArray(r?.why)&&r.why.length)return r.why
  if(r?.whyText)return[r.whyText]
  return[]
}
function asRow(r,kind){
  const reasons=whyList(r)
  return {...r,kind,reasons,why:r.why&&!Array.isArray(r.why)?r.why:{reasons}}
}
function allRows(){
  const safe=(Array.isArray(state.board?.safestBankers)?state.board.safestBankers:[]).map(r=>asRow(r,'safest'))
  const value=(Array.isArray(state.board?.valueBankers)?state.board.valueBankers:[]).map(r=>asRow(r,'value'))
  return [...safe,...value]
}
function pickRows(board){
  return [...(Array.isArray(board?.safestBankers)?board.safestBankers:[]),...(Array.isArray(board?.valueBankers)?board.valueBankers:[])]
}
function filtered(rows){
  return rows.filter(r=>{
    const s=stateFor(r)
    if(state.status!=='all'&&s!==state.status)return false
    if(state.kind!=='all'&&r.kind!==state.kind)return false
    if(state.country!=='all'&&String(r.country)!==state.country)return false
    if(state.league!=='all'&&String(r.league)!==state.league)return false
    if(state.market!=='all'&&String(r.market)!==state.market)return false
    return true
  }).sort((a,b)=>kickoffMs(a)-kickoffMs(b)||String(a.league).localeCompare(String(b.league)))
}

async function bankerApi(date){
  if(base&&anon){
    try{
      const res=await fetch(`${base}/functions/v1/stats2pitch-bankers?date=${encodeURIComponent(date)}`,{headers:{apikey:anon,Authorization:`Bearer ${anon}`},cache:'default'})
      const body=await res.json().catch(()=>null)
      if(res.ok&&body)return body
    }catch{}
  }
  return api(`/board?date=${encodeURIComponent(date)}&view=${VIEW}`,{cache:'default'})
}

function renderDates(){
  const host=$('#dates');if(!host)return
  const today=isoToday(),ds=dateStrip(today)
  const stamp=`${state.date}|${ds[0]}|${ds[ds.length-1]}`
  if(host.dataset.stamp===stamp)return
  host.dataset.stamp=stamp
  host.innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('')
  host.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()})
  requestAnimationFrame(()=>scrollDateStrip(host))
}

function renderCountryChips(rows){
  const host=$('#countryChips');if(!host)return
  const countries=uniq(rows.map(r=>r.country))
  host.innerHTML=`<button class="country-chip ${state.country==='all'?'active':''}" data-country="all" title="All countries">🌍</button>`+countries.map(c=>`<button class="country-chip ${state.country===c?'active':''}" data-country="${esc(c)}" title="${esc(c)}" aria-label="${esc(c)}">${flag(c)}</button>`).join('')
  $$('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.league='all';render()})
}

function renderStats(rows){
  const host=$('#varStats');if(!host)return
  const counts={upcoming:0,safest:0,value:0,total:rows.length}
  for(const r of rows){
    if(r.kind==='safest')counts.safest++
    if(r.kind==='value')counts.value++
    if(stateFor(r)==='upcoming')counts.upcoming++
  }
  host.innerHTML=`<button type="button" data-reset="1" class="${state.kind==='all'&&state.status==='all'?'is-on':''}"><small>Daily Bankers</small><b>${counts.total}</b></button><button type="button" data-kind="safest" class="${state.kind==='safest'?'is-on':''}"><small>Safest</small><b>${counts.safest}</b></button><button type="button" data-kind="value" class="${state.kind==='value'?'is-on':''}"><small>Value</small><b>${counts.value}</b></button><button type="button" data-stat="upcoming" class="${state.status==='upcoming'?'is-on':''}"><small>Upcoming</small><b>${counts.upcoming}</b></button>`
  host.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    if(b.dataset.reset){state.kind='all';state.status='all'}
    else if(b.dataset.kind){state.kind=b.dataset.kind;state.status='all'}
    else if(b.dataset.stat){state.status=b.dataset.stat;state.kind='all'}
    if($('#statusFilter'))$('#statusFilter').value=state.status
    render()
  })
}

function renderKindTabs(rows){
  const host=$('#kindTabs'); if(!host)return
  const safest=rows.filter(r=>r.kind==='safest').length
  const value=rows.filter(r=>r.kind==='value').length
  const labels={all:`All <em>${rows.length}</em>`,safest:`Safest <em>${safest}</em>`,value:`Value <em>${value}</em>`}
  host.querySelectorAll('[data-kind]').forEach(b=>{
    const on=b.dataset.kind===state.kind
    b.classList.toggle('active',on)
    b.setAttribute('aria-selected',on?'true':'false')
    if(labels[b.dataset.kind]) b.innerHTML=labels[b.dataset.kind]
  })
}

function card(r,i){
  const score=scoreFor(r),fav=String(r.favourite||'')==='home'?'HOME FAV':String(r.favourite||'')==='away'?'AWAY FAV':'',odds=oddStr(r),tag=kindLabel(r),kindClass=r.kind==='value'?'value':'safest'
  return`<article class="card ${stateFor(r)} ${decided(resultFor(r)?.outcome)?esc(resultFor(r).outcome):''}" data-i="${i}" role="button" tabindex="0" aria-label="Why ${esc(r.home)} vs ${esc(r.away)} was chosen"><div class="m-card-top"><span class="m-board-tag ${kindClass}">${tag}</span>${fav?`<span class="m-fav-tag ${esc(r.favourite)}">${fav}</span>`:''}${topStatus(r)}</div><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${statusBadge(r)}<span class="var-badge ${kindClass}">${tag}</span>${fav?`<span class="fav-badge ${esc(r.favourite)}">${fav}</span>`:''}${matchup(r,score)}<div class="pick"><div class="pick-copy"><span class="pick-kicker">PICK</span><strong>${esc(pickLabel(r))}</strong>${pickResult(r)}</div><span class="odd">${odds}</span></div>${learningChipHtml(r,esc)}<div class="m-footer"><div class="m-ev"><span>${esc(marketName(r))}</span></div><span class="odd odd-stack"><span class="odd-kicker">ODDS</span>${odds}</span></div><div class="time"><b>${esc(marketName(r))}</b> · ${formatDateTime(r.kickoff)}</div><button class="details" data-i="${i}" type="button">Why this pick?</button><div class="m-why-row">Why this pick ›</div></article>`
}

function metricsHtml(r){
  const edge=Number(r.valueEdge)
  const third=r.kind==='value'?(Number.isFinite(edge)?`${edge.toFixed(1)} pts`:'—'):(r.recentConsensus==null?'—':`${esc(r.recentConsensus)}%`)
  return`<div class="banker-metrics-row"><div><small>Banker score</small><b>${r.bankerScore??'—'}</b></div><div><small>Venue support</small><b>${r.capability==null?'—':`${esc(r.capability)}%`}</b></div><div><small>${r.kind==='value'?'Value edge':'Recent support'}</small><b>${third}</b></div></div>`
}

function open(r){
  const score=scoreFor(r),x=resultFor(r),modal=$('#modal')
  if(!modal)return
  modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-label="Why this pick was chosen"><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${statusBadge(r)}${matchup(r,score)}<div class="pick"><strong>${esc(pickLabel(r))}</strong><span class="odd">${oddStr(r)}</span></div><div class="time"><b>${esc(marketName(r))}</b> · ${formatDateTime(r.kickoff)}</div>${x&&decided(x.outcome)?`<div class="settled-summary ${esc(x.outcome||'')}">${esc(outcomeLabel(x.outcome||'settled'))}${score?` · ${score.home}–${score.away}`:''}</div>`:''}${metricsHtml(r)}${whySectionHtml(r,esc,{banker:true})}<button class="close" type="button">Close</button></div>`
  bindCrestFallbacks(modal)
  bindWhyModal(modal)
}

function render(){
  renderDates()
  const baseRows=allRows()
  const countries=uniq(baseRows.map(x=>x.country))
  state.country=options($('#countryFilter'),countries,state.country,'All countries',c=>`${flag(c)} ${c}`)
  const countryRows=state.country==='all'?baseRows:baseRows.filter(x=>x.country===state.country)
  const leagues=uniq(countryRows.map(x=>x.league))
  state.league=options($('#leagueFilter'),leagues,state.league,'All leagues')
  const leagueRows=state.league==='all'?countryRows:countryRows.filter(x=>x.league===state.league)
  const markets=uniq(leagueRows.map(x=>x.market))
  state.market=options($('#market'),markets,state.market,'All markets',m=>esc(marketName({market:m})))
  if($('#statusFilter'))$('#statusFilter').value=state.status
  renderKindTabs(baseRows)
  renderCountryChips(baseRows)
  renderStats(baseRows)
  const rows=filtered(baseRows)
  const engine=state.board?.dailyBankersMeta?.engine||state.board?.meta?.dailyBankersEngine||'daily-bankers-v2'
  if(!state.board){
    $('#status').textContent='Loading…'
    return
  }
  $('#status').textContent=`${rows.length} banker${rows.length===1?'':'s'} · ${engine}`
  $('#cards').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">No Daily Bankers match these filters yet.</div>'
  bindCrestFallbacks($('#cards'))
  $$('article[data-i]').forEach(el=>{const go=()=>open(rows[Number(el.dataset.i)]);el.onclick=e=>{if(e.target.closest('.details'))return;go()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}})
  $$('button.details').forEach(el=>el.onclick=e=>{e.stopPropagation();open(rows[Number(el.dataset.i)])})
}

function skeleton(){const host=$('#cards');if(host)host.innerHTML=Array.from({length:6},()=>'<div class="card skeleton"><div></div><div></div><div></div><div></div></div>').join('')}

async function hopIfEmpty(){
  if(pickRows(state.board).length)return false
  const today=isoToday()
  if(state.date<today)return false
  const dates=dateStrip(today)
  const start=Math.max(0,dates.indexOf(state.date))
  for(const date of dates.slice(start+1)){
    if(date<today)continue
    let board=readBoardCache(date,VIEW)
    if(!board){
      try{
        board=await bankerApi(date)
        if(board)writeBoardCache(date,VIEW,board)
      }catch{continue}
    }
    if(hasRemainingTips(pickRows(board))||pickRows(board).length){
      state.date=date
      state.board=board
      history.replaceState(null,'',`?date=${encodeURIComponent(date)}`)
      return true
    }
  }
  return false
}

function startPolling(){clearInterval(state.timer);if(state.date!==isoToday())return;state.timer=setInterval(async()=>{try{state.resultData=await api(`/results?date=${encodeURIComponent(state.date)}`);render()}catch{}},20000)}
async function load(){
  renderDates()
  const cached=readBoardCache(state.date,VIEW)
  if(cached){state.board=cached;render();bootDone()}
  else{skeleton();$('#status').textContent='Loading…'}
  try{
    const [board,res]=await Promise.all([bankerApi(state.date), api(`/results?date=${encodeURIComponent(state.date)}`).catch(()=>null)])
    state.board=board
    state.resultData=res
    writeBoardCache(state.date,VIEW,board)
    const loadedDate=state.date
    await hopIfEmpty()
    if(state.date!==loadedDate){state.resultData=await api(`/results?date=${encodeURIComponent(state.date)}`).catch(()=>null)}
    render();startPolling();bootDone()
  }catch(e){
    if(cached)return
    $('#status').textContent='Unavailable'
    $('#cards').innerHTML=`<div class="empty">${esc(e.message||'Bankers are unavailable right now.')}</div>`
    bootDone()
  }
}

$('#kindTabs')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-kind]')
  if(!b)return
  state.kind=b.dataset.kind
  render()
})
$('#statusFilter')?.addEventListener('change',e=>{state.status=e.target.value;render()})
$('#countryFilter')?.addEventListener('change',e=>{state.country=e.target.value;state.league='all';render()})
$('#leagueFilter')?.addEventListener('change',e=>{state.league=e.target.value;render()})
$('#market')?.addEventListener('change',e=>{state.market=e.target.value;render()})
$('#clearFilters')?.addEventListener('click',()=>{state.status='all';state.kind=state.country=state.league=state.market='all';render()})
$('#refresh')?.addEventListener('click',load)
$('#notifyBell')?.addEventListener('click',load)
$('#profileBtn')?.addEventListener('click',()=>document.body.classList.toggle('filters-open'))
load()
window.addEventListener('beforeunload',()=>clearInterval(state.timer))
