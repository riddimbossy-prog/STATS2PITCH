import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'
import {api,bootDone,loadLiveResults,scrollDateStrip} from './net.js'
const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]))
const state={date:new URLSearchParams(location.search).get('date')||new Date().toISOString().slice(0,10),board:null,results:null,status:'all',country:'all',league:'all',market:'all',timer:null}
const kickoffMs=r=>{const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
const kick=r=>{const d=new Date(r.kickoff);return Number.isNaN(d)?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
const kickClock=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return'TBC';return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
const uniq=a=>[...new Set(a.filter(Boolean).map(String))].sort()
const decided=o=>['won','lost','void','postponed'].includes(String(o||''))
const outcomeLabel=o=>({won:'WON',lost:'LOST',void:'VOID',postponed:'POSTPONED'})[o]||'SETTLED'
function fill(el,a,v,label){if(!el)return'all';const ok=v==='all'||a.includes(v)?v:'all';el.innerHTML=`<option value="all">${label}</option>`+a.map(x=>`<option ${x===ok?'selected':''}>${esc(x)}</option>`).join('');return ok}
function liveHit(r){
  const id=String(r.fixtureId),market=String(r.market||''),sel=String(r.selection||'').trim()
  for(const bag of ['h2hPicks','picks','filterTips','varTips','comboPicks','goalsBankers','dailyBankers','bankers']){
    const rows=state.results?.[bag]||[]
    const hit=rows.find(x=>String(x.fixtureId)===id&&String(x.market||'')===market&&String(x.selection||'').trim()===sel)||rows.find(x=>String(x.fixtureId)===id)
    if(hit?.result)return hit.result
  }
  return null
}
function resultFor(r){
  const live=liveHit(r),stored=state.board?.results?.[`${r.fixtureId}|${r.market}|${String(r.selection||'').trim()}`]||state.board?.results?.[String(r.fixtureId)]||null
  if(live&&decided(live.outcome))return live
  if(live&&live.matchState==='live')return live
  if(stored&&decided(stored.outcome))return stored
  return live||stored
}
function stateFor(r){const x=resultFor(r);if(x?.matchState)return x.matchState;if(decided(x?.outcome))return'settled';return kickoffMs(r)>Date.now()?'upcoming':'pending'}
function scoreFor(r){const s=stateFor(r);if(s!=='live'&&s!=='settled')return null;const x=resultFor(r);if(x?.outcome==='postponed')return null;const h=x?.homeScore??x?.home?.score,a=x?.awayScore??x?.away?.score;return h!=null&&a!=null?{home:h,away:a}:null}
function clockText(x){const clock=String(x?.minute||x?.clock||'').trim();if(clock)return clock;const st=String(x?.status||x?.statusLong||'').trim().toUpperCase();if(st==='1H'||st==='H1')return'H1';if(st==='HT')return'HT';if(st==='2H'||st==='H2')return'2H';return''}
function dates(){const h=$('#dates');if(!h)return;const ds=[];for(let i=-6;i<=6;i++){const d=new Date();d.setUTCDate(d.getUTCDate()+i);ds.push(d.toISOString().slice(0,10))}const today=new Date().toISOString().slice(0,10),stamp=`${state.date}|${ds[0]}|${ds[ds.length-1]}`;if(h.dataset.stamp===stamp)return;h.dataset.stamp=stamp;h.innerHTML=ds.map(v=>`<button class="date ${v===state.date?'active':''}" data-d="${v}">${v===today?'Today':new Date(v+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric'})}</button>`).join('');h.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(b.dataset.d)}`);load()});requestAnimationFrame(()=>scrollDateStrip(h))}
function card(r,i){
  const fx=fixtureCrests(state.board),hl=crestSrc(r,'home',fx),al=crestSrc(r,'away',fx),score=scoreFor(r),s=stateFor(r),x=resultFor(r)
  const mid=x?.outcome==='postponed'?'<span class="versus">VS</span><b class="match-mid-score postponed">P/P</b>':score?`<span class="versus">${s==='live'?'LIVE':'VS'}</span><b class="match-mid-score">${esc(score.home)}–${esc(score.away)}</b>`:`<span class="versus">VS</span><b class="match-mid-clock">${esc(kickClock(r.kickoff))}</b>`
  const top=s==='live'?`<span class="m-conf">${clockText(x)||'LIVE'}</span>`:decided(x?.outcome)?`<span class="m-conf">${outcomeLabel(x.outcome)}</span>`:`<span class="m-conf">${r.occurrence}%</span>`
  return `<article class="card ${s}" data-i="${i}"><div class="m-card-top"><span class="m-board-tag combo">H2H ${r.rank===1?'BANKER':'BACKUP'}</span>${top}</div><div class="league">${esc(r.country)} · ${esc(r.league)}</div><div class="teams crest-matchup"><div class="team"><img class="team-crest" src="${esc(hl)}"><span>${esc(r.home)}</span></div>${mid}<div class="team"><img class="team-crest" src="${esc(al)}"><span>${esc(r.away)}</span></div></div><div class="pick"><div class="pick-copy"><span class="pick-kicker">${esc(r.family)}</span><strong>${esc(r.selection)}</strong></div><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="confidence"><span>Historical occurrence</span><div class="confidence-bar"><i style="width:${r.occurrence}%"></i></div><b>${r.occurrence}%</b></div><div class="time">${esc(kick(r))} · ${r.h2hHits}/${r.h2hMatches} split H2Hs</div><button class="details">Why this pick?</button></article>`
}
function render(){
  dates()
  const all=state.board?.h2hPicks||[]
  state.country=fill($('#countryFilter'),uniq(all.map(x=>x.country)),state.country,'All countries')
  state.league=fill($('#leagueFilter'),uniq(all.filter(x=>state.country==='all'||x.country===state.country).map(x=>x.league)),state.league,'All leagues')
  state.market=fill($('#marketFilter'),uniq(all.map(x=>x.family)),state.market,'All markets')
  if($('#statusFilter'))$('#statusFilter').value=state.status
  const rows=all.filter(x=>{
    const s=stateFor(x)
    if(state.status!=='all'&&s!==state.status)return false
    return (state.country==='all'||x.country===state.country)&&(state.league==='all'||x.league===state.league)&&(state.market==='all'||x.family===state.market)
  })
  const hero=$('#comboHeroCount');if(hero)hero.textContent=String(rows.length)
  $('#status').textContent=`${rows.length} qualified 80%+ pattern${rows.length===1?'':'s'}`
  $('#cards').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">No split H2H market reached 80% with enough meetings.</div>'
  bindCrestFallbacks($('#cards'))
  $$('article[data-i]').forEach(el=>el.onclick=()=>open(rows[Number(el.dataset.i)]))
}
function open(r){
  if(!r)return
  const modal=$('#modal');if(!modal)return
  modal.classList.remove('hidden')
  modal.innerHTML=`<div class="dialog"><div class="combo-modal-title">Split H2H Pattern</div><h3>${esc(r.home)} vs ${esc(r.away)}</h3><div class="pick"><strong>${esc(r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><p>${esc(r.userWhy)}</p><div class="combo-modal-score">Occurrence ${r.occurrence}% · ${r.h2hHits}/${r.h2hMatches} same-venue meetings · minimum 80%</div><button class="close">Close</button></div>`
  modal.querySelector('.close').onclick=()=>modal.classList.add('hidden')
}
function startPolling(){
  clearInterval(state.timer)
  if(state.date!==new Date().toISOString().slice(0,10))return
  state.timer=setInterval(()=>{loadLiveResults(state.date,data=>{state.results=data;render()})},30000)
}
async function load(){
  try{
    state.board=await api(`/board?date=${state.date}&view=h2h`,{cache:'no-store'})
    render()
    startPolling()
    loadLiveResults(state.date,data=>{state.results=data;render()})
  }catch{$('#cards').innerHTML='<div class="empty">Unable to load H2H patterns.</div>'}
  finally{bootDone()}
}
for(const id of ['countryFilter','leagueFilter','marketFilter','statusFilter'])$("#"+id)?.addEventListener('change',e=>{state[id.replace('Filter','')]=e.target.value;render()})
$('#clearFilters')?.addEventListener('click',()=>{state.country=state.league=state.market=state.status='all';render()})
$('#refresh')?.addEventListener('click',load)
$('#notifyBell')?.addEventListener('click',load)
load()
window.addEventListener('beforeunload',()=>clearInterval(state.timer))
