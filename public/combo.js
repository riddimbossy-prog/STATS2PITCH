import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'
import {whySectionHtml,bindWhyModal,learningChipHtml} from './whyPopup.js?v=5.16.0'
import {api,readBoardCache,writeBoardCache,scrollDateStrip,isSrlPick,bootDone} from './net.js'

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)]
const ESC={amp:"&"+"amp;",lt:"&"+"lt;",gt:"&"+"gt;",quot:"&"+"quot;",apos:"&"+"#39;"}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":ESC.amp,"<":ESC.lt,">":ESC.gt,'"':ESC.quot,"'":ESC.apos}[c]))
const VIEW='combo-v3.2'
const state={date:new URLSearchParams(location.search).get('date')||new Date().toISOString().slice(0,10),board:null,results:null,status:'all',country:'all',league:'all',family:'all',timer:null}

function flag(c){return typeof window.countryFlag==='function'?window.countryFlag(c):'🌍'}
function pickKey(r){return `${r.fixtureId}|${r.market}|${String(r.selection||'').trim()}`}
function isComboBoardPick(r){const m=String(r?.market||'');return m.startsWith('combo-')||String(r?.engineVersion||r?.engine||'').startsWith('combo-')}
function comboRowsOf(board){
  const dedicated=(board?.comboPicks||[]).filter(isComboBoardPick)
  if(dedicated.length)return dedicated
  return []
}
function rows(){return comboRowsOf(state.board).filter(r=>Number(r?.odds)>=1.20&&!isSrlPick(r))}
function kickoffMs(r){const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function familyLabel(v){return v==='result-goals'?'Result + O/U 2.5':v==='result-gg'?'Result + GG':v==='result-clean-sheet'?'Result + Clean Sheet':'Combo'}
function pickLabel(r){return String(r.displaySelection||r.selection||'Selection')}
function decided(o){return ['won','lost','void','postponed'].includes(String(o||''))}
function outcomeLabel(o){return ({won:'WON',lost:'LOST',void:'VOID',postponed:'POSTPONED'})[o]||'SETTLED'}
function liveResultRow(r){
  const id=String(r.fixtureId)
  for(const bag of ['comboPicks','goalsBankers','picks','filterTips','varTips','dailyBankers','bankers']){
    const hit=(state.results?.[bag]||[]).find(x=>String(x.fixtureId)===id)
    if(hit?.result)return hit.result
  }
  return null
}
function resultFor(r){
  const live=liveResultRow(r)
  const stored=state.board?.results?.[pickKey(r)]||state.board?.results?.[String(r.fixtureId)]||null
  if(live&&decided(live.outcome))return live
  if(live&&live.matchState==='live')return live
  if(stored&&decided(stored.outcome))return stored
  return live||stored
}
function stateFor(r){
  const x=resultFor(r)
  if(x?.matchState)return x.matchState
  if(decided(x?.outcome))return'settled'
  return kickoffMs(r)>Date.now()?'upcoming':'pending'
}
function scoreFor(r){
  const s=stateFor(r)
  if(s!=='live'&&s!=='settled')return null
  if(resultFor(r)?.outcome==='postponed')return null
  const x=resultFor(r)
  const h=x?.homeScore??x?.home?.score,a=x?.awayScore??x?.away?.score
  return h!==null&&h!==undefined&&a!==null&&a!==undefined?{home:h,away:a}:null
}
function clockText(x){
  const clock=String(x?.minute||x?.clock||'').trim()
  if(clock)return clock
  const st=String(x?.status||x?.statusLong||'').trim().toUpperCase()
  if(st==='1H'||st==='H1')return'H1'
  if(st==='HT')return'HT'
  if(st==='2H'||st==='H2')return'2H'
  return''
}
function kickClock(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return'TBC';return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function dateTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function oddStr(r){const n=Number(r.odds);return Number.isFinite(n)?n.toFixed(2):'—'}
function expectedValue(odds,conf){const o=Number(odds),p=Math.min(Math.max(Number(conf)||0,0),100)/100;if(!Number.isFinite(o)||o<=1||p<=0)return null;return p*o-1}
function comboScore(r){const n=Number(r.comboScore??r.engineRating??r.confidence);return Number.isFinite(n)?Math.round(n):0}
function team(name,img,side){return `<div class="team team-${side}"><span class="crest-wrap"><img class="team-crest" src="${esc(img)}" alt="${esc(name)} crest" loading="lazy"></span><span class="team-name">${esc(name)}</span></div>`}
function matchMid(r,score){
  const live=stateFor(r)==='live',o=resultFor(r)?.outcome
  if(o==='postponed')return `<span class="versus">VS</span><b class="match-mid-score postponed">P/P</b>`
  if(score)return `<span class="versus">${live?'LIVE':'VS'}</span><b class="match-mid-score">${esc(score.home)}–${esc(score.away)}</b>`
  return `<span class="versus">VS</span><b class="match-mid-clock">${esc(kickClock(r.kickoff))}</b>`
}
function matchup(r,score){
  const fx=fixtureCrests(state.board)
  return `<div class="teams crest-matchup">${team(r.home,crestSrc(r,'home',fx),'home')}<div class="match-mid">${matchMid(r,score)}</div>${team(r.away,crestSrc(r,'away',fx),'away')}</div>`
}
function topStatus(r){
  const s=stateFor(r),x=resultFor(r)
  if(s==='live'){const clock=clockText(x);return `<span class="m-result live">${clock?esc(clock):'LIVE'}</span>`}
  if(decided(x?.outcome))return `<span class="m-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`
  return `<span class="m-kick-row">${esc(kickClock(r.kickoff))}</span>`
}
function dates(){const out=[];for(let i=-6;i<=6;i++){const d=new Date();d.setUTCDate(d.getUTCDate()+i);out.push(d.toISOString().slice(0,10))}return out}
function renderDates(){
  const host=$('#dates');if(!host)return
  const ds=dates(),today=new Date().toISOString().slice(0,10),stamp=`${state.date}|${ds[0]}|${ds[ds.length-1]}`
  if(host.dataset.stamp===stamp)return
  host.dataset.stamp=stamp
  host.innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('')
  host.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()})
  requestAnimationFrame(()=>scrollDateStrip(host))
}
function uniq(a){return [...new Set(a.filter(Boolean).map(String))].sort((x,y)=>x.localeCompare(y))}
function fill(el,values,current,label){
  if(!el)return'all'
  const valid=current==='all'||values.includes(current)?current:'all'
  el.innerHTML=`<option value="all">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${esc(v)}</option>`).join('')
  return valid
}
function renderChips(base){
  const host=$('#countryChips');if(!host)return
  const countries=uniq(base.map(r=>r.country))
  host.innerHTML=`<button class="country-chip ${state.country==='all'?'active':''}" data-country="all">🌍</button>`+countries.map(c=>`<button class="country-chip ${state.country===c?'active':''}" data-country="${esc(c)}" title="${esc(c)}">${flag(c)}</button>`).join('')
  host.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.league='all';render()})
}
function renderTodayStats(base){
  const host=$('#todayStats');if(!host)return
  const counts={upcoming:0,live:0,settled:0,total:base.length}
  for(const r of base){const s=stateFor(r);if(counts[s]!==undefined)counts[s]++}
  host.innerHTML=`<button data-stat="all"><small>Combo picks</small><b>${counts.total}</b></button><button data-stat="upcoming"><small>Upcoming</small><b>${counts.upcoming}</b></button><button data-stat="live"><small>Live</small><b>${counts.live}</b></button><button data-stat="settled"><small>Settled</small><b>${counts.settled}</b></button>`
  $$('[data-stat]').forEach(b=>b.onclick=()=>{state.status=b.dataset.stat;if($('#statusFilter'))$('#statusFilter').value=state.status;render()})
}
function card(r,i){
  const score=scoreFor(r),conf=comboScore(r),odds=oddStr(r),ev=expectedValue(r.odds,conf)
  const evStr=ev==null?'':`${ev>=0?'+':''}${ev.toFixed(2)}`
  const rank=r.rank?`#${r.rank}`:''
  const confHtml=conf>0?`<div class="confidence"><span>Combo score</span><div class="confidence-bar"><i style="width:${Math.max(0,Math.min(100,conf))}%"></i></div><b>${conf}</b></div>`:''
  return `<article class="card ${stateFor(r)} ${decided(resultFor(r)?.outcome)?esc(resultFor(r).outcome):''}" data-i="${i}" role="button" tabindex="0" aria-label="Why ${esc(r.home)} vs ${esc(r.away)} was chosen"><div class="m-card-top"><span class="m-top-left"><span class="m-board-tag combo">COMBO ${esc(rank)}</span></span><span class="m-top-mid"></span><span class="m-top-right">${topStatus(r)}${conf>0?`<span class="m-conf">${esc(conf)}%</span>`:''}</span></div><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${matchup(r,score)}<div class="pick"><div class="pick-copy"><span class="pick-kicker">PICK</span><strong>${esc(pickLabel(r))}</strong></div><span class="odd">${odds}</span></div>${typeof learningChipHtml==='function'?learningChipHtml(r,esc):''}${confHtml}<div class="m-footer">${ev!=null?`<div class="m-ev"><span>Expected Value</span><b class="${ev>=0?'pos':'neg'}">${evStr}</b></div>`:`<div class="m-ev"><span>${esc(familyLabel(r.group))}</span></div>`}<span class="odd odd-stack"><span class="odd-kicker">ODDS</span>${odds}</span></div><div class="time"><b>Kickoff</b> · ${esc(dateTime(r.kickoff))}</div><button class="details" data-i="${i}" type="button">Why this pick?</button><div class="m-why-row">Why this pick ›</div></article>`
}
function openWhy(r){
  const modal=$('#modal');if(!modal)return
  const score=scoreFor(r),x=resultFor(r)
  modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-label="Why this pick was chosen"><div class="combo-modal-title">Combo ${r.rank?`#${esc(r.rank)}`:''} · ${esc(familyLabel(r.group))}</div><div class="league"><span class="league-flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${matchup(r,score)}<div class="pick"><div class="pick-copy"><span class="pick-kicker">PICK</span><strong>${esc(pickLabel(r))}</strong></div><span class="odd">${oddStr(r)}</span></div><div class="time"><b>Kickoff</b> · ${esc(dateTime(r.kickoff))}</div>${x?.matchState==='settled'||decided(x?.outcome)?`<div class="settled-summary ${esc(x.outcome||'')}">${esc(outcomeLabel(x.outcome||'settled'))}${score?` · ${score.home}–${score.away}`:''}</div>`:''}${whySectionHtml(r)}<div class="combo-modal-score">Combo score ${esc(comboScore(r))} · min price 1.20 · ${esc(familyLabel(r.group))}</div><button class="close" type="button">Close</button></div>`
  bindCrestFallbacks(modal)
  bindWhyModal(modal)
}
function render(){
  renderDates()
  const base=rows().sort((a,b)=>kickoffMs(a)-kickoffMs(b)||(a.rank||99)-(b.rank||99))
  state.country=fill($('#countryFilter'),uniq(base.map(r=>r.country)),state.country,'All countries')
  const countryRows=state.country==='all'?base:base.filter(r=>r.country===state.country)
  state.league=fill($('#leagueFilter'),uniq(countryRows.map(r=>r.league)),state.league,'All leagues')
  if($('#statusFilter'))$('#statusFilter').value=state.status
  if($('#familyFilter'))$('#familyFilter').value=state.family
  renderChips(base)
  renderTodayStats(base)
  const filtered=base.filter(r=>{
    const s=stateFor(r)
    if(state.status!=='all'&&s!==state.status)return false
    if(state.country!=='all'&&r.country!==state.country)return false
    if(state.league!=='all'&&r.league!==state.league)return false
    if(state.family!=='all'&&r.group!==state.family)return false
    return true
  })
  const matches=new Set(filtered.map(r=>String(r.fixtureId))).size
  $('#status').textContent=`${filtered.length} combo pick${filtered.length===1?'':'s'} · ${matches} match${matches===1?'':'es'}`
  const host=$('#cards')
  host.innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">No Combo picks match these filters yet.</div>'
  bindCrestFallbacks(host)
  $$('article[data-i]').forEach(el=>{
    const go=()=>openWhy(filtered[Number(el.dataset.i)])
    el.onclick=e=>{if(e.target.closest('.details'))return;go()}
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}
  })
  $$('button.details').forEach(el=>el.onclick=e=>{e.stopPropagation();openWhy(filtered[Number(el.dataset.i)])})
}
function skeleton(){const host=$('#cards');if(host)host.innerHTML=Array.from({length:6},()=>'<div class="card skeleton"><div></div><div></div><div></div><div></div></div>').join('')}
function startPolling(){
  clearInterval(state.timer)
  const today=new Date().toISOString().slice(0,10)
  if(state.date!==today)return
  state.timer=setInterval(async()=>{try{state.results=await api(`/results?date=${encodeURIComponent(state.date)}`);render()}catch{}},30000)
}
async function fetchComboBoard(date){
  const combo=await api(`/board?date=${encodeURIComponent(date)}&view=combo`,{cache:'no-store'})
  return {...combo,comboPicks:comboRowsOf(combo),goalsBankers:[]}
}
async function load(){
  renderDates()
  const cached=readBoardCache(state.date,VIEW)
  if(cached){state.board=cached;render();bootDone()}
  else{skeleton();$('#status').textContent='Loading…'}
  try{
    const [board,res]=await Promise.all([
      fetchComboBoard(state.date),
      api(`/results?date=${encodeURIComponent(state.date)}`).catch(()=>null)
    ])
    state.board=board
    state.results=res
    writeBoardCache(state.date,VIEW,board)
    render()
    startPolling()
    bootDone()
  }catch(e){
    if(cached)return
    $('#status').textContent='Unavailable'
    $('#cards').innerHTML=`<div class="empty">${esc(e.message)}</div>`
    bootDone()
  }
}

$('#statusFilter')?.addEventListener('change',e=>{state.status=e.target.value;render()})
$('#countryFilter')?.addEventListener('change',e=>{state.country=e.target.value;state.league='all';render()})
$('#leagueFilter')?.addEventListener('change',e=>{state.league=e.target.value;render()})
$('#familyFilter')?.addEventListener('change',e=>{state.family=e.target.value;render()})
$('#clearFilters')?.addEventListener('click',()=>{state.status='all';state.country=state.league=state.family='all';render()})
$('#refresh')?.addEventListener('click',load)
$('#notifyBell')?.addEventListener('click',load)
$('#profileBtn')?.addEventListener('click',()=>document.body.classList.toggle('filters-open'))
load()
window.addEventListener('beforeunload',()=>clearInterval(state.timer))
