const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const view=document.body.dataset.view||'all'
const state={date:new Date().toISOString().slice(0,10),board:null,market:'all',country:'all',league:'all',kickoff:'upcoming'}
const cfg=window.__STATS2PITCH_CONFIG__||{}
const base=String(cfg.supabaseUrl||'').replace(/\/+$/,'')
const anon=String(cfg.supabaseAnonKey||'')
const fn=String(cfg.functionName||'stats2pitch-api')
const fallback='/assets/football-real.svg'

function endpoint(path){if(!base)throw new Error('Service unavailable');return`${base}/functions/v1/${fn}${path}`}
async function api(path,options={}){const headers={apikey:anon,Authorization:`Bearer ${anon}`,...(options.headers||{})};const res=await fetch(endpoint(path),{...options,headers,cache:'no-store'});const body=await res.json().catch(()=>null);if(!res.ok)throw new Error('Unable to load picks');return body}
function logo(v){const s=String(v||'').trim();return /^https?:\/\//i.test(s)||s.startsWith('/')?esc(s):fallback}
function team(name,img,side){return`<div class="team team-${side}"><span class="crest-wrap"><img class="team-crest" src="${logo(img)}" alt="${esc(name)} crest" loading="lazy"></span><span class="team-name">${esc(name)}</span></div>`}
function matchup(r){return`<div class="teams crest-matchup">${team(r.home,r.homeLogo,'home')}<span class="versus">VS</span>${team(r.away,r.awayLogo,'away')}</div>`}
function kickoffMs(r){const n=Date.parse(r?.kickoff||'');return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function formatDateTime(v){return new Date(v).toLocaleString([], {weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function leagueLine(r){return`<div class="league" data-country="${esc(r.country)}">${esc(r.league)}</div>`}
function dates(){const a=[];for(let i=0;i<7;i++){const d=new Date(Date.now()+i*86400000);a.push(d.toISOString().slice(0,10))}return a}
function renderDates(){const ds=dates();$('#dates').innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===ds[0]?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('');$$('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;load()})}

function marketLabel(r){return String(r.displaySelection||r.selection||'This tip').replace(/^1H\s*·\s*/i,'First half · ').replace(/^1H Result\s*·\s*/i,'First half result · ').replace(/^DNB\s*·\s*/i,'Draw no bet · ').replace(/^BTTS\s*·\s*/i,'Both teams to score · ').replace(/^Double Chance\s*·\s*/i,'Double chance · ').replace(/^1X2\s*·\s*/i,'Match result · ')}
function normalizedSelection(r){return String(r.selection||'').toLowerCase().trim()}
function openingLine(r){
  const sel=normalizedSelection(r),market=String(r.market||'')
  if(market==='match-winner'){
    if(sel==='home'||sel==='1')return`${r.home} has the stronger recent home-versus-away profile for this matchup.`
    if(sel==='away'||sel==='2')return`${r.away} has the stronger recent away-versus-home profile for this matchup.`
    return`Recent results from both teams make the draw the clearest match-result direction.`
  }
  if(market==='double-chance'){
    if(sel.includes('home')||sel==='1x')return`${r.home} has been difficult to beat at home, while ${r.away} has not shown enough away to justify a straight opposition win.`
    if(sel.includes('away')||sel==='x2')return`${r.away} has been difficult to beat away, while ${r.home} has not shown enough at home to justify a straight home win.`
    return`Both teams' recent results make avoiding the draw the stronger direction.`
  }
  if(market==='draw-no-bet')return`One team has the stronger recent venue form, but this option keeps the draw protected.`
  if(market==='both-teams-score')return sel==='yes'?`Both teams have regularly scored in their recent home and away matches.`:`At least one of these teams has often failed to score in its recent venue matches.`
  if(market==='total-goals')return sel.includes('over')?`Both teams' recent matches point toward enough goals to clear this line.`:`Both teams' recent matches have stayed controlled enough to support this lower-goals line.`
  if(market==='first-half-goals')return sel.includes('over')?`The recent first halves from both sides have produced goals early enough to support this pick.`:`The recent first halves from both sides have usually stayed below this line.`
  if(market==='home-team-goals')return`${r.home}'s recent home scoring and ${r.away}'s recent away defending both point in the same direction.`
  if(market==='away-team-goals')return`${r.away}'s recent away scoring and ${r.home}'s recent home defending both point in the same direction.`
  return`Recent home and away results from both teams point in the same direction for this market.`
}
function supportLine(r){
  const h=Number(r.homeConsensus)||0,a=Number(r.awayConsensus)||0
  if(h===100&&a===100)return`Every recent home match from ${r.home} and every recent away match from ${r.away} supports this same direction.`
  return`${r.home}'s recent home matches support it ${h}% of the time, and ${r.away}'s recent away matches support it ${a}% of the time.`
}
function closingLine(r){return`That agreement makes ${marketLabel(r)} the preferred tip here at available odds of ${Number(r.odds).toFixed(2)}.`}
function explanationHtml(r){const items=[openingLine(r),supportLine(r),closingLine(r)];return`<div class="why-tip"><h3>Why this tip was chosen</h3><ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`}

function bankerOnly(rows){return view==='bankers'?rows.filter(r=>Number(r.homeConsensus)===100&&Number(r.awayConsensus)===100):rows}
function sortedUnique(values){return[...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b))}
function setOptions(select,values,current,allLabel,formatter=v=>v){
  if(!select)return'all'
  const valid=current==='all'||values.includes(current)?current:'all'
  select.innerHTML=`<option value="all">${esc(allLabel)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${formatter(v)}</option>`).join('')
  return valid
}
function refreshFilterOptions(baseRows){
  const countries=sortedUnique(baseRows.map(r=>r.country))
  state.country=setOptions($('#countryFilter'),countries,state.country,'All countries',c=>`${flag(c)} ${esc(c)}`)
  const countryRows=state.country==='all'?baseRows:baseRows.filter(r=>String(r.country)===state.country)
  const leagues=sortedUnique(countryRows.map(r=>r.league))
  state.league=setOptions($('#leagueFilter'),leagues,state.league,'All leagues',l=>esc(l))
  const leagueRows=state.league==='all'?countryRows:countryRows.filter(r=>String(r.league)===state.league)
  const markets=sortedUnique(leagueRows.map(r=>r.market))
  state.market=setOptions($('#market'),markets,state.market,'All markets',m=>esc(m.replaceAll('-',' ')))
  if($('#kickoffFilter'))$('#kickoffFilter').value=state.kickoff
}
function filteredRows(baseRows){
  const now=Date.now()
  return baseRows.filter(r=>{
    if(state.kickoff==='upcoming'&&kickoffMs(r)<=now)return false
    if(state.country!=='all'&&String(r.country)!==state.country)return false
    if(state.league!=='all'&&String(r.league)!==state.league)return false
    if(state.market!=='all'&&String(r.market)!==state.market)return false
    return true
  }).sort((a,b)=>kickoffMs(a)-kickoffMs(b)||String(a.league).localeCompare(String(b.league)))
}
function bankerBadge(r){return view==='bankers'?'<span class="banker-badge">100% AGREEMENT</span>':''}
function render(){
  renderDates()
  const all=bankerOnly(state.board?.bestPicks||[])
  refreshFilterOptions(all)
  const rows=filteredRows(all)
  const noun=view==='bankers'?'banker':'pick'
  $('#status').textContent=`${rows.length} ${noun}${rows.length===1?'':'s'}`
  $('#cards').innerHTML=rows.length?rows.map((r,i)=>`<article class="card">${leagueLine(r)}${bankerBadge(r)}${matchup(r)}<div class="pick"><strong>${esc(marketLabel(r))}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time"><b>Kickoff</b> · ${formatDateTime(r.kickoff)}</div><button class="details" data-i="${i}">Why this tip?</button></article>`).join(''):`<div class="empty">${view==='bankers'?'No 100% agreement bankers available for these filters yet.':'No picks available for these filters yet.'}</div>`
  $$('[data-i]').forEach(btn=>btn.onclick=()=>open(rows[Number(btn.dataset.i)]))
}
function open(r){
  $('#modal').classList.remove('hidden')
  $('#modal').innerHTML=`<div class="dialog">${leagueLine(r)}${bankerBadge(r)}<div class="dialog-matchup">${team(r.home,r.homeLogo,'home')}<span class="versus">VS</span>${team(r.away,r.awayLogo,'away')}</div><div class="pick"><strong>${esc(marketLabel(r))}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time"><b>Kickoff</b> · ${formatDateTime(r.kickoff)}</div>${explanationHtml(r)}<button class="close">Close</button></div>`
  $('.close').onclick=()=>$('#modal').classList.add('hidden')
}
function bindFilters(){
  const pairs=[['kickoffFilter','kickoff'],['countryFilter','country'],['leagueFilter','league'],['market','market']]
  for(const[id,key]of pairs){const el=$('#'+id);if(el)el.onchange=e=>{state[key]=e.target.value;if(key==='country')state.league='all';render()}}
  const clear=$('#clearFilters');if(clear)clear.onclick=()=>{state.kickoff='upcoming';state.country='all';state.league='all';state.market='all';render()}
}
async function load(){
  $('#status').textContent='Loading…'
  try{state.board=await api(`/board?date=${encodeURIComponent(state.date)}`);render()}
  catch{$('#status').textContent='Unable to load picks';$('#cards').innerHTML='<div class="empty">Please try again shortly.</div>'}
}
$('#refresh').onclick=load
bindFilters()
renderDates()
load()
