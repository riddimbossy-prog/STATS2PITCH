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
const flag=c=>typeof window.countryFlag==='function'?window.countryFlag(c):'🌍'
const pickLabel=r=>String(r.displaySelection||r.selection||'Selection')
const oddStr=r=>{const n=Number(r.odds);return Number.isFinite(n)?n.toFixed(2):'—'}
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
function groupByFixture(list){
  const map=new Map()
  for(const r of list){
    const id=String(r.fixtureId||'')
    if(!id)continue
    if(!map.has(id))map.set(id,[])
    map.get(id).push(r)
  }
  return [...map.values()].map(picks=>picks.slice().sort((a,b)=>(a.rank||99)-(b.rank||99)||(b.occurrence||0)-(a.occurrence||0)||Number(a.odds)-Number(b.odds)))
}
function groupClass(picks){
  const outs=picks.map(r=>resultFor(r)?.outcome).filter(decided)
  if(outs.length&&outs.every(o=>o==='won'))return'won'
  if(outs.length&&outs.every(o=>o==='lost'))return'lost'
  return''
}
function optionRow(r,gi,pi){
  const x=resultFor(r),odds=oddStr(r)
  const settled=decided(x?.outcome)?`<span class="pick-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''
  const tag=r.rank===1?'Banker':'Backup'
  return `<button class="combo-option" type="button" data-i="${gi}" data-p="${pi}" aria-label="Why ${esc(pickLabel(r))} was chosen"><span class="combo-option-rank">${esc(r.rank||pi+1)}</span><span class="combo-option-copy"><span class="combo-option-kicker">${esc(tag)} · ${esc(r.family||'H2H')}</span><strong>${esc(pickLabel(r))}</strong></span><span class="combo-option-meta">${settled}<span class="odd odd-stack">${odds}</span><span class="combo-option-score">${esc(r.occurrence)}%</span></span></button>`
}
function card(picks,i){
  const r=picks[0],score=scoreFor(r),n=picks.length
  return `<article class="card combo-match ${stateFor(r)} ${groupClass(picks)}" data-i="${i}"><div class="m-card-top"><span class="m-top-left"><span class="m-board-tag combo">H2H · ${n} OPTION${n===1?'':'S'}</span></span><span class="m-top-mid"></span><span class="m-top-right">${topStatus(r)}</span></div><div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league||'League')}</span></div>${matchup(r,score)}<div class="combo-options">${picks.map((p,pi)=>optionRow(p,i,pi)).join('')}</div><div class="time"><b>Kickoff</b> · ${esc(kick(r))} · ${r.h2hHits}/${r.h2hMatches} split H2Hs</div><div class="m-why-row">Tap an option for why ›</div></article>`
}
function renderChips(base){
  const host=$('#countryChips');if(!host)return
  const countries=uniq(base.map(r=>r.country))
  host.innerHTML=`<button class="country-chip ${state.country==='all'?'active':''}" data-country="all">🌍</button>`+countries.map(c=>`<button class="country-chip ${state.country===c?'active':''}" data-country="${esc(c)}" title="${esc(c)}">${flag(c)}</button>`).join('')
  host.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.league='all';render()})
}
function renderTodayStats(groups){
  const host=$('#todayStats');if(!host)return
  const counts={upcoming:0,live:0,settled:0,total:groups.length}
  for(const picks of groups){const s=stateFor(picks[0]);if(counts[s]!==undefined)counts[s]++}
  host.innerHTML=`<button data-stat="all"><small>Matches</small><b>${counts.total}</b></button><button data-stat="upcoming"><small>Upcoming</small><b>${counts.upcoming}</b></button><button data-stat="live"><small>Live</small><b>${counts.live}</b></button><button data-stat="settled"><small>Settled</small><b>${counts.settled}</b></button>`
  $$('[data-stat]').forEach(b=>b.onclick=()=>{state.status=b.dataset.stat;if($('#statusFilter'))$('#statusFilter').value=state.status;render()})
}
function render(){
  dates()
  const all=state.board?.h2hPicks||[]
  state.country=fill($('#countryFilter'),uniq(all.map(x=>x.country)),state.country,'All countries')
  state.league=fill($('#leagueFilter'),uniq(all.filter(x=>state.country==='all'||x.country===state.country).map(x=>x.league)),state.league,'All leagues')
  state.market=fill($('#marketFilter'),uniq(all.map(x=>x.family)),state.market,'All markets')
  if($('#statusFilter'))$('#statusFilter').value=state.status
  renderChips(all)
  const groups=groupByFixture(all)
  renderTodayStats(groups)
  const filtered=groupByFixture(all.filter(x=>{
    const s=stateFor(x)
    if(state.status!=='all'&&s!==state.status)return false
    return (state.country==='all'||x.country===state.country)&&(state.league==='all'||x.league===state.league)&&(state.market==='all'||x.family===state.market)
  }))
  const optionCount=filtered.reduce((n,picks)=>n+picks.length,0)
  const hero=$('#comboHeroCount');if(hero)hero.textContent=String(filtered.length)
  $('#status').textContent=`${filtered.length} match${filtered.length===1?'':'es'} · ${optionCount} 80%+ pattern${optionCount===1?'':'s'}`
  $('#cards').innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">No split H2H market reached 80% with enough meetings.</div>'
  bindCrestFallbacks($('#cards'))
  $$('.combo-option').forEach(el=>el.onclick=e=>{
    e.stopPropagation()
    const picks=filtered[Number(el.dataset.i)]||[]
    const pick=picks[Number(el.dataset.p)]
    if(pick)open(pick)
  })
}
function open(r){
  if(!r)return
  const modal=$('#modal');if(!modal)return
  modal.classList.remove('hidden')
  modal.innerHTML=`<div class="dialog"><div class="combo-modal-title">Split H2H Pattern</div><h3>${esc(r.home)} vs ${esc(r.away)}</h3><div class="pick"><strong>${esc(pickLabel(r))}</strong><span class="odd">${oddStr(r)}</span></div><p>${esc(r.userWhy)}</p><div class="combo-modal-score">Occurrence ${r.occurrence}% · ${r.h2hHits}/${r.h2hMatches} same-venue meetings · minimum 80% · min price 1.20</div><button class="close">Close</button></div>`
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
