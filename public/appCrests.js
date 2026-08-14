const $=q=>document.querySelector(q),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={date:new Date().toISOString().slice(0,10),board:null,market:'all'}
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
function dates(){const a=[];for(let i=0;i<7;i++){const d=new Date(Date.now()+i*86400000);a.push(d.toISOString().slice(0,10))}return a}
function renderDates(){const ds=dates();$('#dates').innerHTML=ds.map(d=>`<button class="date ${d===state.date?'active':''}" data-d="${d}">${d===ds[0]?'Today':new Date(d+'T12:00:00Z').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</button>`).join('');document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{state.date=b.dataset.d;load()})}
function render(){renderDates();const b=state.board||{},rows=(b.bestPicks||[]).filter(x=>state.market==='all'||x.market===state.market);const markets=['all',...(b.availableMarkets||[])];$('#market').innerHTML=markets.map(m=>`<option ${m===state.market?'selected':''} value="${esc(m)}">${m==='all'?'All markets':esc(m)}</option>`).join('');$('#status').textContent=`${rows.length} pick${rows.length===1?'':'s'}`;$('#cards').innerHTML=rows.length?rows.map((r,i)=>`<article class="card"><div class="league">${esc(r.league)} · ${esc(r.country)}</div>${matchup(r)}<div class="pick"><strong>${esc(r.displaySelection||r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time">${new Date(r.kickoff).toLocaleString()}</div><button class="details" data-i="${i}">View details</button></article>`).join(''):'<div class="empty">No picks available for this date yet.</div>';document.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>open(rows[Number(btn.dataset.i)]))}
function open(r){$('#modal').classList.remove('hidden');$('#modal').innerHTML=`<div class="dialog"><div class="league">${esc(r.league)} · ${esc(r.country)}</div><div class="dialog-matchup">${team(r.home,r.homeLogo,'home')}<span class="versus">VS</span>${team(r.away,r.awayLogo,'away')}</div><div class="pick"><strong>${esc(r.displaySelection||r.selection)}</strong><span class="odd">${Number(r.odds).toFixed(2)}</span></div><div class="time">${new Date(r.kickoff).toLocaleString()}</div><button class="close">Close</button></div>`;$('.close').onclick=()=>$('#modal').classList.add('hidden')}
async function load(){ $('#status').textContent='Loading…';try{state.board=await api(`/board?date=${encodeURIComponent(state.date)}`);render()}catch{$('#status').textContent='Unable to load picks';$('#cards').innerHTML='<div class="empty">Please try again shortly.</div>'}}
$('#market').onchange=e=>{state.market=e.target.value;render()}
$('#refresh').onclick=load
renderDates()
load()
