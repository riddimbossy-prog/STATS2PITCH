const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const cfg=window.__STATS2PITCH_CONFIG__||{},base=String(cfg.supabaseUrl||'').replace(/\/+$/,''),anon=String(cfg.supabaseAnonKey||''),fn=String(cfg.functionName||'stats2pitch-api')
const REQUIRED_ENGINE='banker-rules-v2'
const state={date:new URLSearchParams(location.search).get('date')||new Date().toISOString().slice(0,10),board:null,rule:'all',country:'all',league:'all'}
const fallback='/assets/football-real.svg'
function endpoint(path){if(!base)throw new Error('Service unavailable');return`${base}/functions/v1/${fn}${path}`}
async function api(path){const r=await fetch(endpoint(path),{headers:{apikey:anon,Authorization:`Bearer ${anon}`},cache:'no-store'}),b=await r.json().catch(()=>null);if(!r.ok)throw new Error('Unable to load this right now');return b}
function flag(country){return typeof window.countryFlag==='function'?window.countryFlag(country):'🌍'}
function logo(v){const s=String(v||'').trim();return /^https?:\/\//i.test(s)||s.startsWith('/')?esc(s):fallback}
function team(name,img){return`<div class="banker-rule-team"><span><img src="${logo(img)}" alt="${esc(name)} crest" loading="lazy"></span><b>${esc(name)}</b></div>`}
function dateList(){const out=[];for(let i=-2;i<=6;i++){const d=new Date();d.setUTCDate(d.getUTCDate()+i);out.push(d.toISOString().slice(0,10))}return out}
function renderDates(){const host=$('#dates'),today=new Date().toISOString().slice(0,10);host.innerHTML=dateList().map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===today?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('');$$('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;history.replaceState(null,'',`?date=${encodeURIComponent(state.date)}`);load()})}
function uniq(xs){return[...new Set(xs.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b))}
function options(el,values,current,label,fmt=v=>v){const valid=current==='all'||values.includes(current)?current:'all';el.innerHTML=`<option value="all">${esc(label)}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===valid?'selected':''}>${fmt(v)}</option>`).join('');return valid}
function ruleName(rule){return({HOME_STRAIGHT_WIN:'Straight Win',AWAY_TEAM_NOT_TO_WIN:'Team Not to Win',AWAY_STRENGTH_OVER15:'Away Strength · O1.5',BALANCED_HIGH_SCORING_OVER25:'Balanced Teams · O2.5',BALANCED_LOW_SCORING_OVER15:'Balanced Teams · O1.5'})[rule]||String(rule||'Banker Rule').replaceAll('_',' ')}
function leagueClass(x){return x==='high-scoring'?'HIGH SCORING':x==='low-scoring-draw-heavy'?'LOW + DRAW HEAVY':x==='neutral'?'NEUTRAL':'INSUFFICIENT'}
function pos(s){return Number.isFinite(Number(s?.position))?`#${Number(s.position)}/${Number(s.size)||'—'}`:'—'}
function kickoff(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TBC':d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function metric(label,value){return`<span><small>${esc(label)}</small><b>${esc(value??'—')}</b></span>`}
function card(r){const h=r?.metrics?.home||{},a=r?.metrics?.away||{},l=r?.metrics?.league||{};return`<article class="banker-rule-card">
  <div class="banker-rule-top"><span>${flag(r.country)} ${esc(r.country||'International')} · ${esc(r.league||'League')}</span><b>${esc(ruleName(r.rule))}</b></div>
  <div class="banker-rule-match">${team(r.home,r.homeLogo)}<strong>VS</strong>${team(r.away,r.awayLogo)}</div>
  <div class="banker-rule-pick"><small>RULE SIGNAL</small><b>${esc(r.displaySelection||r.selection)}</b></div>
  <div class="banker-rule-maths">
    <section><h4>${esc(r.home)} · HOME</h4><div>${metric('PPG',h.ppg)}${metric('GF AVG',h.avgGF)}${metric('GA AVG',h.avgGA)}${metric('LOSS',`${h.lossRate??'—'}%`)}${metric('RANK',pos(r.homeSplit))}</div></section>
    <section><h4>${esc(r.away)} · AWAY</h4><div>${metric('PPG',a.ppg)}${metric('GF AVG',a.avgGF)}${metric('GA AVG',a.avgGA)}${metric('LOSS',`${a.lossRate??'—'}%`)}${metric('RANK',pos(r.awaySplit))}</div></section>
  </div>
  <div class="banker-rule-league"><b>${esc(leagueClass(l.class))}</b><span>League avg goals ${l.avgGoals??'—'} · O2.5 ${l.over25Rate??'—'}% · Draws ${l.drawRate??'—'}%</span></div>
  <ul>${(r.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <footer>${esc(kickoff(r.kickoff))}</footer>
</article>`}
function filtered(rows){return rows.filter(r=>(state.rule==='all'||r.rule===state.rule)&&(state.country==='all'||r.country===state.country)&&(state.league==='all'||r.league===state.league)).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff))}
function render(){
  renderDates()
  const meta=state.board?.bankerRulesMeta||{},current=meta.engine===REQUIRED_ENGINE,all=current?(state.board?.bankers||[]):[]
  const rules=uniq(all.map(x=>x.rule)),countries=uniq(all.map(x=>x.country))
  state.rule=options($('#ruleFilter'),rules,state.rule,'All banker rules',ruleName)
  state.country=options($('#countryFilter'),countries,state.country,'All countries',c=>`${flag(c)} ${c}`)
  const countryRows=state.country==='all'?all:all.filter(x=>x.country===state.country),leagues=uniq(countryRows.map(x=>x.league))
  state.league=options($('#leagueFilter'),leagues,state.league,'All leagues')
  const rows=filtered(all),skips=meta.skips||{}
  $('#bankerStats').innerHTML=`<div><small>QUALIFIED</small><b>${all.length}</b></div><div><small>EARLY SKIPS</small><b>${skips['early-season']||0}</b></div><div><small>HOME &lt;1 PPG</small><b>${skips['home-under-1-ppg']||0}</b></div><div><small>TOP-5 CLASHES</small><b>${skips['both-top-five']||0}</b></div>`
  if(!current){
    $('#status').textContent='Waiting for refreshed rules'
    $('#bankerCards').innerHTML='<div class="empty">The saved board uses an older Banker rules revision. Run Refresh Boards to generate the new v2 signals.</div>'
    return
  }
  $('#status').textContent=`${rows.length} qualified signal${rows.length===1?'':'s'}`
  $('#bankerCards').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty">No fixture passed the dedicated Banker rules for this date.</div>'
}
async function load(){renderDates();$('#status').textContent='Loading…';$('#bankerCards').innerHTML='<div class="empty">Loading Banker rules…</div>';try{state.board=await api(`/board?date=${encodeURIComponent(state.date)}`);render()}catch(e){$('#status').textContent='Unavailable';$('#bankerCards').innerHTML=`<div class="empty">${esc(e.message)}</div>`}}
$('#ruleFilter').onchange=e=>{state.rule=e.target.value;render()};$('#countryFilter').onchange=e=>{state.country=e.target.value;state.league='all';render()};$('#leagueFilter').onchange=e=>{state.league=e.target.value;render()};$('#refresh').onclick=load
load()
