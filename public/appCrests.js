import {crestSrc,fixtureCrests,bindCrestFallbacks} from './crests.js'
import {whySectionHtml,bindWhyModal,learningChipHtml} from './whyPopup.js?v=5.16.0'
import {api,readBoardCache,writeBoardCache,warmNeighbors,scrollDateStrip,hasRemainingTips,nextDateWithTips,isSrlPick,bootDone} from './net.js'
import {adviceFor} from './performanceAdvice.js'

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]))
const view=document.body.dataset.view||'all'
const BOARD_VIEW=view==='results'?'all':'all'
const state={date:new URLSearchParams(location.search).get('date')||new Date().toISOString().slice(0,10),board:null,resultData:null,performance:null,market:'all',country:'all',league:'all',seasonStage:'all',status:view==='results'?'settled':'upcoming',performanceGroup:'market',timer:null}
function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function team(name,img,side){return`<div class="team team-${side}"><span class="crest-wrap"><img class="team-crest" src="${esc(img)}" alt="${esc(name)} crest" loading="lazy"></span><span class="team-name">${esc(name)}</span></div>`}
function matchMid(r,score){const live=stateFor(r)==='live',o=resultFor(r)?.outcome;if(o==='postponed')return`<span class="versus">VS</span><b class="match-mid-score postponed">P/P</b>`;if(score)return`<span class="versus">${live?'LIVE':'VS'}</span><b class="match-mid-score">${esc(score.home)}–${esc(score.away)}</b>`;return`<span class="versus">VS</span><b class="match-mid-clock">${esc(kickClock(r.kickoff))}</b>`}
function matchup(r,score){const fx=fixtureCrests(state.board);return`<div class="teams crest-matchup">${team(r.home,crestSrc(r,'home',fx),'home')}<div class="match-mid">${matchMid(r,score)}</div>${team(r.away,crestSrc(r,'away',fx),'away')}</div>`}
function seasonStageFor(r){if(r?.earlySeason===true)return'early';const hs=Number(r?.currentVenueSamples?.home),as=Number(r?.currentVenueSamples?.away);if(Number.isFinite(hs)&&Number.isFinite(as))return hs>=5&&as>=5?'solid':'early';if(r?.earlySeason===false)return'solid';return'unknown'}
function earlyFlag(r){return seasonStageFor(r)==='early'?'<span class="early-flag" title="Early season matchup" aria-label="Early season matchup">🚩</span>':''}
function earlyNote(r){if(seasonStageFor(r)!=='early')return'';const hs=Number(r?.currentVenueSamples?.home||0),as=Number(r?.currentVenueSamples?.away||0);return`<div class="early-note"><span class="early-note-flag">🚩</span><span>Early season matchup${hs||as?` · current-season venue sample: ${hs}/5 home, ${as}/5 away`:''}</span></div>`}
function leagueLine(r){return`<div class="league"><span class="league-flag" role="img" aria-label="${esc(r.country||'International')} flag">${flag(r.country)}</span><span>${esc(r.league)}</span>${earlyFlag(r)}</div>`}
function kickoffMs(r){const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function formatDateTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function publishedTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'Published before kickoff':`Published ${d.toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}
function dates(){const a=[];for(let i=-6;i<=6;i++){const d=new Date(Date.now()+i*86400000);a.push(d.toISOString().slice(0,10))}return a}
function calIcon(){return`<svg class="date-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`}
function dateLabel(d,today){return d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}
function kickClock(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return'TBC';return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function expectedValue(odds,conf){const o=Number(odds),p=Math.min(Math.max(Number(conf)||0,0),100)/100;if(!Number.isFinite(o)||o<=1||p<=0)return null;return p*o-1}
function renderDates(){const host=$('#dates');if(!host)return;const ds=dates(),today=new Date().toISOString().slice(0,10),stamp=`${state.date}|${ds[0]}|${ds[ds.length-1]}`;if(host.dataset.stamp===stamp)return;host.dataset.stamp=stamp;host.innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===state.date?calIcon():''}<span>${dateLabel(d,today)}</span></button>`).join('');host.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()});requestAnimationFrame(()=>scrollDateStrip(host))}
function marketLabel(r){return String(r.displaySelection||r.selection||'This tip').replace(/^1H\s*·\s*/i,'First half · ').replace(/^1H Result\s*·\s*/i,'First half result · ').replace(/^DNB\s*·\s*/i,'Draw no bet · ').replace(/^BTTS\s*·\s*/i,'Both teams to score · ').replace(/^Double Chance\s*·\s*/i,'Double chance · ').replace(/^1X2\s*·\s*/i,'Match result · ')}
function decided(o){return ['won','lost','void','postponed'].includes(String(o||''))}
function outcomeLabel(o){return({won:'WON',lost:'LOST',void:'VOID',postponed:'POSTPONED'})[o]||'SETTLED'}
function liveResultRow(r){const id=String(r.fixtureId);for(const bag of ['picks','varTips','filterTips','goalsBankers','dailyBankers','bankers']){const hit=(state.resultData?.[bag]||[]).find(x=>String(x.fixtureId)===id);if(hit?.result)return hit.result}return null}
function resultFor(r){const live=liveResultRow(r),stored=state.board?.results?.[String(r.fixtureId)]||null;if(live&&decided(live.outcome))return live;if(live&&live.matchState==='live')return live;if(stored&&decided(stored.outcome))return stored;return live||stored}
function stateFor(r){const x=resultFor(r);if(x?.matchState)return x.matchState;if(decided(x?.outcome))return'settled';return kickoffMs(r)>Date.now()?'upcoming':'pending'}
function scoreFor(r){const s=stateFor(r);if(s!=='live'&&s!=='settled')return null;if(resultFor(r)?.outcome==='postponed')return null;const x=resultFor(r);const h=x?.home?.score??x?.homeScore,a=x?.away?.score??x?.awayScore;return h!==null&&h!==undefined&&a!==null&&a!==undefined?{home:h,away:a}:null}
function clockText(x){const clock=String(x?.minute||x?.clock||'').trim();if(clock)return clock;const st=String(x?.status||x?.statusLong||'').trim().toUpperCase();if(st==='1H'||st==='H1')return'H1';if(st==='HT')return'HT';if(st==='2H'||st==='H2')return'2H';return''}
function statusBadge(r){const x=resultFor(r),s=stateFor(r);if(s==='live'){const clock=clockText(x);return`<span class="match-badge live">${clock?esc(clock):'LIVE'}</span>`}if(s==='settled'){const o=x?.outcome||'pending';return`<span class="match-badge ${esc(o)}">${outcomeLabel(o)}</span>`}return`<span class="match-badge upcoming">UPCOMING</span>`}
function pickResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="pick-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function topStatus(r){const s=stateFor(r),x=resultFor(r);if(s==='live'){const clock=clockText(x);return `<span class="m-result live">${clock?esc(clock):'LIVE'}</span>`}if(decided(x?.outcome))return topResult(r);return `<span class="m-kick-row">${esc(kickClock(r.kickoff))}</span>`}
function topResult(r){const x=resultFor(r);return decided(x?.outcome)?`<span class="m-result ${esc(x.outcome)}">${outcomeLabel(x.outcome)}</span>`:''}
function bankerApproved(r){if(Number(r?.homeConsensus)!==100||Number(r?.awayConsensus)!==100)return false;const checks=Array.isArray(r?.bankerChecks)?r.bankerChecks:[];const bottomThreeBlocked=checks.some(x=>x?.ok===false&&String(x?.label||'').toLowerCase().includes('not bottom three'));return !bottomThreeBlocked}
function sortedUnique(values){return[...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b))}
function setOptions(el,values,current,label,fmt=v=>v){if(!el)return'all';const valid=current==='all'||values.includes(current)?current:'all';el.innerHTML=`<option value="all">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${fmt(v)}</option>`).join('');return valid}
function refreshFilterOptions(baseRows){
  const countries=sortedUnique(baseRows.map(r=>r.country));state.country=setOptions($('#countryFilter'),countries,state.country,'All countries',c=>`${flag(c)} ${esc(c)}`)
  const countryRows=state.country==='all'?baseRows:baseRows.filter(r=>String(r.country)===state.country),leagues=sortedUnique(countryRows.map(r=>r.league));state.league=setOptions($('#leagueFilter'),leagues,state.league,'All leagues',esc)
  const leagueRows=state.league==='all'?countryRows:countryRows.filter(r=>String(r.league)===state.league),markets=sortedUnique(leagueRows.map(r=>r.market));state.market=setOptions($('#market'),markets,state.market,'All markets',m=>esc(m.replaceAll('-',' ')))
  if($('#statusFilter'))$('#statusFilter').value=state.status
  if($('#seasonFilter'))$('#seasonFilter').value=state.seasonStage
}
function filteredRows(baseRows){return baseRows.filter(r=>{const s=stateFor(r),stage=seasonStageFor(r);if(state.status!=='all'&&s!==state.status)return false;if(state.seasonStage!=='all'&&stage!==state.seasonStage)return false;if(state.country!=='all'&&String(r.country)!==state.country)return false;if(state.league!=='all'&&String(r.league)!==state.league)return false;if(state.market!=='all'&&String(r.market)!==state.market)return false;return true}).sort((a,b)=>kickoffMs(a)-kickoffMs(b)||String(a.league).localeCompare(String(b.league)))}
function renderCountryChips(rows){const host=$('#countryChips');if(!host)return;const countries=sortedUnique(rows.map(r=>r.country));host.innerHTML=`<button class="country-chip ${state.country==='all'?'active':''}" data-country="all" title="All countries">🌍</button>`+countries.map(c=>`<button class="country-chip ${state.country===c?'active':''}" data-country="${esc(c)}" title="${esc(c)}" aria-label="${esc(c)}">${flag(c)}</button>`).join('');$$('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;state.league='all';renderBoard()})}
function renderTodayStats(rows){const host=$('#todayStats');if(!host)return;const counts={upcoming:0,live:0,settled:0,total:rows.length};for(const r of rows){const s=stateFor(r);if(counts[s]!==undefined)counts[s]++}host.innerHTML=`<button data-stat="all"><small>Total Picks</small><b>${counts.total}</b></button><button data-stat="upcoming"><small>Upcoming</small><b>${counts.upcoming}</b></button><button data-stat="live"><small>Live</small><b>${counts.live}</b></button><button data-stat="settled"><small>Settled</small><b>${counts.settled}</b></button>`;$$('[data-stat]').forEach(b=>b.onclick=()=>{state.status=b.dataset.stat;renderBoard()})}
function openingLine(r){if(Array.isArray(r.reasons)&&r.reasons.length)return r.reasons[0];if(r.shortReason)return r.shortReason;const sel=String(r.selection||'').toLowerCase(),market=String(r.market||'');if(market==='match-winner'){if(sel==='home'||sel==='1')return`${r.home} has repeatedly won at home while ${r.away}'s recent away results point the opposite way.`;if(sel==='away'||sel==='2')return`${r.away} has repeatedly won away while ${r.home}'s recent home results point the opposite way.`;return`Both teams' recent venue results make a draw the strongest match-result direction.`}if(market==='double-chance')return`The recent venue form suggests the selected side is unlikely to lose, so the safer double-chance route was chosen.`;if(market==='draw-no-bet')return`One side has the stronger venue trend, but the draw is protected.`;if(market==='both-teams-score')return sel==='yes'?`Both teams' recent venue matches regularly produced goals for both sides.`:`At least one side regularly failed to score in the recent venue sample.`;if(market.includes('goals'))return sel.includes('over')?`The recent home and away samples consistently produced enough goals to clear this line.`:`The recent home and away samples consistently stayed below this line.`;return`Both teams' recent venue results point strongly in the same direction for this market.`}
function evidenceLine(r){if(Array.isArray(r.reasons)&&r.reasons.length>1)return r.reasons.slice(1).join(' ');if(Number.isFinite(Number(r.engineRating)))return`Engine score ${Math.round(Number(r.engineRating))}.`;const h=Math.round((Number(r.homeConsensus)||0)/20),a=Math.round((Number(r.awayConsensus)||0)/20);return`${r.home} supports this in ${h}/5 recent home matches, while ${r.away} supports it in ${a}/5 recent away matches.`}
function splitLine(r){const hs=r.homeSplit,as=r.awaySplit,parts=[];if(hs?.sampleReady)parts.push(`${r.home} is ${hs.position}${ordinal(hs.position)} in its recent home split`);if(as?.sampleReady)parts.push(`${r.away} is ${as.position}${ordinal(as.position)} in its recent away split`);return parts.length?`${parts.join(', while ')}.`:''}
function ordinal(n){n=Number(n);const v=n%100;return v>=11&&v<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}
function closingLine(r){return`The two venue trends agree strongly enough for Stats2Pitch to prefer ${marketLabel(r)} at ${Number(r.odds).toFixed(2)}.`}
function explanationHtml(r){return whySectionHtml(r,esc,{banker:bankerApproved(r),marketLabel:marketLabel(r)})}

function proofLine(r){return`<div class="proof-line">✓ Original published tip preserved · ${esc(publishedTime(r.publishedAt))}</div>`}
function card(r,i){const score=scoreFor(r),x=resultFor(r),stage=seasonStageFor(r),banker=bankerApproved(r);const conf=Number.isFinite(Number(r.engineRating))?Math.round(Number(r.engineRating)):Math.round(Math.min(Number(r.homeConsensus)||0,Number(r.awayConsensus)||0));const confPct=Math.max(0,Math.min(100,conf));const ev=expectedValue(r.odds,confPct);const evStr=ev==null?'':`${ev>=0?'+':''}${ev.toFixed(2)}`;const confHtml=conf>0?`<div class="confidence"><span>${Number.isFinite(Number(r.engineRating))?'Engine score':'Confidence'}</span><div class="confidence-bar"><i style="width:${confPct}%"></i></div><b>${conf}${Number.isFinite(Number(r.engineRating))?'':'%'}</b></div>`:'';return`<article class="card ${stateFor(r)} ${decided(x?.outcome)?esc(x.outcome):''} ${stage==='early'?'early-season-card':stage==='solid'?'solid-season-card':''}" data-i="${i}" role="button" tabindex="0" aria-label="Why ${esc(r.home)} vs ${esc(r.away)} was chosen"><div class="m-card-top"><span class="m-top-left">${banker?`<span class="m-banker"><span class="m-star">★</span> BANKER</span>`:''}</span><span class="m-top-mid"></span><span class="m-top-right">${topStatus(r)}${conf>0?`<span class="m-conf">${esc(conf)}%</span>`:''}</span></div>${leagueLine(r)}${banker?'<span class="banker-badge">BANKER</span>':''}${matchup(r,score)}<div class="pick"><div class="pick-copy"><span class="pick-kicker">PICK</span><strong>${esc(marketLabel(r))}</strong></div><span class="odd">${Number(r.odds).toFixed(2)}</span></div>${learningChipHtml(r,esc)}${confHtml}<div class="m-footer">${ev!=null?`<div class="m-ev"><span>Expected Value</span><b class="${ev>=0?'pos':'neg'}">${evStr}</b></div>`:'<div class="m-ev"></div>'}<span class="odd odd-stack"><span class="odd-kicker">ODDS</span>${Number(r.odds).toFixed(2)}</span></div><div class="time"><b>Kickoff</b> · ${formatDateTime(r.kickoff)}</div>${earlyNote(r)}<button class="details" data-i="${i}" type="button">Why this pick?</button><div class="m-why-row">Why this pick ›</div></article>`}
function renderBoard(){renderDates();const base=pickRows(state.board);refreshFilterOptions(base);renderCountryChips(base);renderTodayStats(base);const rows=filteredRows(base),stageLabel=state.seasonStage==='early'?' · Early season':state.seasonStage==='solid'?' · Solid season':'';$('#status').textContent=`${rows.length} pick${rows.length===1?'':'s'}${stageLabel}`;$('#cards').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">No picks match these filters yet.</div>';bindCrestFallbacks($('#cards'));$$('article[data-i]').forEach(el=>{const go=()=>open(rows[Number(el.dataset.i)]);el.onclick=e=>{if(e.target.closest('.details'))return;go()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});$$('button.details').forEach(el=>el.onclick=e=>{e.stopPropagation();open(rows[Number(el.dataset.i)])})}
function open(r){const x=resultFor(r),score=scoreFor(r),modal=$('#modal');modal.classList.remove('hidden');modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-label="Why this pick was chosen">${leagueLine(r)}${statusBadge(r)}${matchup(r,score)}<div class="pick"><strong>${esc(marketLabel(r))}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time"><b>Kickoff</b> · ${formatDateTime(r.kickoff)}</div>${earlyNote(r)}${x?.matchState==='settled'?`<div class="settled-summary ${esc(x.outcome||'')}">${esc(outcomeLabel(x.outcome||'settled'))}${score?` · ${score.home}–${score.away}`:''}</div>`:''}${explanationHtml(r)}${proofLine(r)}<button class="close" type="button">Close</button></div>`;bindCrestFallbacks(modal);bindWhyModal(modal)}

function skeleton(){const host=$('#cards');if(host)host.innerHTML=Array.from({length:6},()=>'<div class="card skeleton"><div></div><div></div><div></div><div></div></div>').join('')}
function pickRows(board){return (board?.bestPicks||[]).filter(r=>!isSrlPick(r))}
async function hopIfEmpty(){
  if(view==='results'||state.status!=='upcoming')return false
  if(hasRemainingTips(pickRows(state.board)))return false
  const hop=await nextDateWithTips(state.date,BOARD_VIEW,pickRows)
  if(!hop)return false
  state.date=hop.date
  state.board=hop.board
  writeBoardCache(hop.date,BOARD_VIEW,hop.board)
  history.replaceState(null,'',`?date=${encodeURIComponent(hop.date)}`)
  state.resultData=await api(`/results?date=${encodeURIComponent(hop.date)}`).catch(()=>null)
  return true
}
async function loadBoardData(){
  const cached=readBoardCache(state.date,BOARD_VIEW)
  if(cached){state.board=cached;renderBoard();bootDone()}
  const [board,res]=await Promise.all([
    api(`/board?date=${encodeURIComponent(state.date)}&view=${BOARD_VIEW}`,{cache:'default'}),
    api(`/results?date=${encodeURIComponent(state.date)}`).catch(()=>null)
  ])
  state.board=board;state.resultData=res
  writeBoardCache(state.date,BOARD_VIEW,board)
  await hopIfEmpty()
  renderBoard();startPolling();warmNeighbors(state.date,BOARD_VIEW)
}
function startPolling(){clearInterval(state.timer);const today=new Date().toISOString().slice(0,10);if(state.date!==today)return;state.timer=setInterval(async()=>{try{state.resultData=await api(`/results?date=${encodeURIComponent(state.date)}`);if(await hopIfEmpty()){renderBoard();startPolling();warmNeighbors(state.date,BOARD_VIEW);return}renderBoard()}catch{}},30000)}
function performanceRows(){const dimension=state.performanceGroup;return(state.performance?.groups||[]).filter(x=>x.dimension===dimension)}
function groupTitle(value){const label=esc(String(value||'Unknown').replaceAll('-',' '));return state.performanceGroup==='country'?`${flag(value)} ${label}`:label}
function toneLabel(tone){return({bank:'Bank on',avoid:'Avoid',steady:'Steady',watch:'Mixed',thin:'Too few'})[tone]||''}
function meterCard(r){
  const rate=Number(r.winRate)||0
  return`<article class="perf-meter ${esc(r.tone)}"><div class="perf-meter-top"><strong>${groupTitle(r.value)}</strong><span class="perf-tone ${esc(r.tone)}">${toneLabel(r.tone)}</span></div><div class="perf-meter-rate"><b>${rate.toFixed(1)}%</b><span>${r.picks} settled</span></div><div class="perf-bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,rate))}%"></i></div><div class="perf-meter-meta"><span class="win">${r.won} won</span><span class="loss">${r.lost} lost</span></div></article>`
}
function adviceList(items){return`<ul>${items.map(r=>`<li><strong>${groupTitle(r.value)}</strong><span>${Number(r.winRate).toFixed(1)}% · ${r.picks} settled · ${r.won}W / ${r.lost}L</span></li>`).join('')}</ul>`}
function learningDesk(){
  if(state.performance?.learningState)return state.performance.learningState
  if(state.board?.learning&&!Array.isArray(state.board.learning))return state.board.learning
  const l=state.performance?.learning
  if(l&&!Array.isArray(l)&&(l.drop||l.tighten||l.keep))return l
  return null
}
function learningList(items,tone){
  if(!items?.length)return`<p class="perf-empty-note">Nothing in this bucket yet.</p>`
  return`<ul>${items.map(r=>{
    const form=Array.isArray(r.form)&&r.form.length?`<span class="learn-form" aria-label="recent form">${r.form.map(x=>`<i class="${x==='W'?'w':'l'}">${x}</i>`).join('')}</span>`:''
    return`<li><strong>${esc(r.label||'Profile')}</strong>${form}<span>${Number(r.winRate||0).toFixed(1)}% · ${r.wins||0}W / ${r.losses||0}L · ${esc(r.note||'')}</span></li>`
  }).join('')}</ul>`
}
function renderLearningDesk(){
  const host=$('#learningDesk')
  if(!host)return
  const desk=learningDesk()||{}
  const drop=desk.drop||[],tighten=desk.tighten||[],keep=[...(desk.boost||[]),...(desk.keep||[])].slice(0,8)
  host.innerHTML=`<div class="perf-callout avoid"><div class="perf-callout-kicker">Dropped overnight</div><p>Filters and markets that kept missing. They are off tomorrow's board until they recover.</p>${learningList(drop,'drop')}</div><div class="perf-callout tighten"><div class="perf-callout-kicker">Tightened</div><p>Still published, but only higher-evidence copies survive after recent losses.</p>${learningList(tighten,'tighten')}</div><div class="perf-callout bank"><div class="perf-callout-kicker">Kept / boosted</div><p>These are hitting. They stay on, and in-form routes get first look.</p>${learningList(keep,'keep')}</div><p class="perf-rule">Tomorrow's Why on each pick names the exact adjustment — for example a Filter Over 2.5 that lost four straight is dropped, while Draw No Bet stays if it is still clearing 70%+.</p>`
}
function renderPerformance(){
  const p=state.performance||{summary:{},groups:[]},s=p.summary||{},host=$('#performanceSummary')
  const ring=Number(s.winRate||0)
  const ringColor=ring>=70?'var(--accent)':ring>=58?'#d4d4d8':'var(--lost)'
  if(host)host.innerHTML=`<div class="perf-hero"><div class="perf-ring" style="--p:${ring};--ring:${ringColor}"><div class="perf-ring-copy"><b>${ring.toFixed(1)}%</b><small>Success</small></div></div><div class="perf-hero-grid"><div><small>Picks</small><b>${s.picks||0}</b></div><div class="win"><small>Won</small><b>${s.won||0}</b></div><div class="loss"><small>Lost</small><b>${s.lost||0}</b></div><div><small>Void</small><b>${s.void||0}</b></div></div></div>`
  const advice=adviceFor(performanceRows())
  const adviceHost=$('#performanceAdvice')
  if(adviceHost){
    const bankBody=advice.bank.length?adviceList(advice.bank):'<p class="perf-empty-note">Nothing clears the bank bar yet — need a high hit rate and at least 15 settled picks.</p>'
    const avoidBody=advice.avoid.length?adviceList(advice.avoid):'<p class="perf-empty-note">No group with a large enough sample is failing. Tiny samples below are not a sell signal.</p>'
    adviceHost.innerHTML=`<div class="perf-callout bank"><div class="perf-callout-kicker">Bank on</div><p>High hit rate with a large enough settled sample. Core of the slip.</p>${bankBody}</div><div class="perf-callout avoid"><div class="perf-callout-kicker">Avoid</div><p>Enough settled picks, but the hit rate is not holding. Leave these off the slip.</p>${avoidBody}</div><p class="perf-rule">A group needs 12+ settled picks before it can be banked or avoided. A 100% run on two picks is not a bank.</p>`
  }
  const table=$('#performanceTable')
  if(table)table.innerHTML=advice.rows.length?advice.rows.map(meterCard).join(''):'<div class="empty">No settled performance data yet.</div>'
  const g=$('#performanceGroup');if(g)g.value=state.performanceGroup
  renderLearningDesk()
}

async function loadResultsView(){skeleton();const [perf]=await Promise.all([api('/performance?days=30')]);state.performance=perf;renderPerformance();await loadBoardData()}
function bind(){for(const[id,key]of[['statusFilter','status'],['seasonFilter','seasonStage'],['countryFilter','country'],['leagueFilter','league'],['market','market']]){const el=$('#'+id);if(el)el.onchange=e=>{state[key]=e.target.value;if(key==='country')state.league='all';renderBoard()}};$('#clearFilters')?.addEventListener('click',()=>{state.status=view==='results'?'settled':'upcoming';state.country=state.league=state.market=state.seasonStage='all';renderBoard()});$('#performanceGroup')?.addEventListener('change',e=>{state.performanceGroup=e.target.value;renderPerformance()});$('#refresh')?.addEventListener('click',load);$('#notifyBell')?.addEventListener('click',load);$('#profileBtn')?.addEventListener('click',()=>document.body.classList.toggle('filters-open'))}
async function load(){
  try{
    if(view==='results'){skeleton();await loadResultsView();bootDone();return}
    if(!readBoardCache(state.date,BOARD_VIEW))skeleton()
    await loadBoardData()
    bootDone()
  }catch{$('#status').textContent='Unable to load picks';$('#cards').innerHTML='<div class="empty">Please try again shortly.</div>';bootDone()}
}
bind();renderDates();load();window.addEventListener('beforeunload',()=>clearInterval(state.timer))
