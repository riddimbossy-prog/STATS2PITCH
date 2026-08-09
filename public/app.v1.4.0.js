const root = document.getElementById('root')

const state = {
  config: null,
  session: null,
  user: null,
  board: null,
  market: 'ALL',
  minReasons: 1,
  sortBy: 'BEST',
  ruleMode: 'ANY',
  primaryRule: '',
  selectedRules: new Set(),
  showRules: false,
  date: new Date().toISOString().slice(0, 10),
  authMode: 'signin'
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const fmt = n => Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—'
const ACCESS_KEY = 's2p_access_token'
const REFRESH_KEY = 's2p_refresh_token'

if (!localStorage.getItem(ACCESS_KEY) && localStorage.getItem('mfa_access_token')) localStorage.setItem(ACCESS_KEY, localStorage.getItem('mfa_access_token'))
if (!localStorage.getItem(REFRESH_KEY) && localStorage.getItem('mfa_refresh_token')) localStorage.setItem(REFRESH_KEY, localStorage.getItem('mfa_refresh_token'))

const token = () => state.session?.access_token || localStorage.getItem(ACCESS_KEY) || ''

async function loadConfig() {
  state.config = await fetch('/api/config', { cache:'no-store' }).then(r => r.json())
  if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) throw new Error('Stats2Pitch is temporarily unavailable. Please try again shortly.')
}
function saveSession(s){state.session=s;if(s?.access_token)localStorage.setItem(ACCESS_KEY,s.access_token);if(s?.refresh_token)localStorage.setItem(REFRESH_KEY,s.refresh_token)}
function clearSession(){state.session=null;state.user=null;localStorage.removeItem(ACCESS_KEY);localStorage.removeItem(REFRESH_KEY);localStorage.removeItem('mfa_access_token');localStorage.removeItem('mfa_refresh_token')}
async function supa(path,opts={}){
  const r=await fetch(state.config.supabaseUrl+path,{...opts,headers:{apikey:state.config.supabaseAnonKey,'Content-Type':'application/json',...(opts.headers||{})}})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(j.msg||j.message||j.error_description||j.error||'Sign-in could not be completed.')
  return j
}
async function signIn(email,password){const j=await supa('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});saveSession(j);return j}
async function signUp(email,password){
  const r=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Account could not be created.');await signIn(email,password);return j
}
async function signOut(){const t=token();try{if(t)await supa('/auth/v1/logout',{method:'POST',headers:{Authorization:`Bearer ${t}`}})}catch(_){}clearSession()}
async function refreshSession(){const rt=localStorage.getItem(REFRESH_KEY);if(!rt)return null;try{const j=await supa('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:rt})});saveSession(j);return j}catch{clearSession();return null}}
async function validate(){
  const t=token();if(!t)return false
  let r=await fetch('/api/me',{headers:{Authorization:`Bearer ${t}`}})
  if(r.ok){state.user=await r.json().catch(()=>null);return true}
  const renewed=await refreshSession();if(!renewed)return false
  r=await fetch('/api/me',{headers:{Authorization:`Bearer ${token()}`}});if(!r.ok)return false
  state.user=await r.json().catch(()=>null);return true
}

function setAuthMode(mode){state.authMode=mode;loginView()}
function loginView(message=''){
  const canSignup=state.config?.allowPublicSignup!==false
  if(!canSignup)state.authMode='signin'
  const creating=state.authMode==='signup'
  root.innerHTML=`
    <main class="auth-page">
      <div class="stadium-light left"></div><div class="stadium-light right"></div>
      <section class="auth-wrap">
        <img class="auth-logo" src="/assets/brand-wordmark.png" alt="Stats2Pitch" />
        <p class="auth-tagline">From <b>stats</b> to the <b>pitch.</b></p>
        <section class="auth-card">
          <h1>${creating?'Create account':'Sign in'}</h1>
          <p class="auth-sub">${creating?'Create your account and go straight to the prediction board.':'Welcome back. Let’s get you back to the pitch.'}</p>
          <form id="auth-form" class="auth-form">
            <label>Email<div class="field"><input id="email" type="email" autocomplete="email" required placeholder="Enter your email" /></div></label>
            <label>Password<div class="field"><input id="password" type="password" minlength="6" autocomplete="${creating?'new-password':'current-password'}" required placeholder="Enter your password" /><button id="password-toggle" class="password-toggle" type="button" aria-label="Show password">◉</button></div></label>
            <button id="auth-submit" class="auth-submit" type="submit">${creating?'Create account':'Sign in'}</button>
          </form>
          ${canSignup?`<p class="auth-switch">${creating?'Already have an account?':'New to Stats2Pitch?'} <button id="auth-switch" type="button">${creating?'Sign in':'Create account'}</button></p>`:''}
          <p id="msg" class="auth-status ${message?'error':''}">${esc(message)}</p>
        </section>
      </section>
    </main>`
  const pw=document.getElementById('password');const tog=document.getElementById('password-toggle')
  tog.onclick=()=>{pw.type=pw.type==='password'?'text':'password';tog.textContent=pw.type==='password'?'◉':'◎';tog.setAttribute('aria-label',pw.type==='password'?'Show password':'Hide password')}
  if(canSignup)document.getElementById('auth-switch').onclick=()=>setAuthMode(creating?'signin':'signup')
  const form=document.getElementById('auth-form'),msg=document.getElementById('msg'),submit=document.getElementById('auth-submit')
  form.onsubmit=async e=>{e.preventDefault();msg.classList.remove('error');msg.textContent=creating?'Creating your account…':'Signing you in…';submit.disabled=true;try{const email=document.getElementById('email').value.trim();const password=pw.value;if(creating)await signUp(email,password);else await signIn(email,password);await showDashboard()}catch(err){msg.classList.add('error');msg.textContent=cleanAuthError(err.message)}finally{submit.disabled=false}}
}
function cleanAuthError(message){
  const s=String(message||'')
  if(/invalid login credentials/i.test(s))return 'Email or password is incorrect.'
  if(/email not confirmed/i.test(s))return 'This account cannot sign in yet. Please contact the site owner.'
  if(/fetch|network/i.test(s))return 'Could not connect right now. Please try again.'
  return s.replace(/supabase/ig,'the sign-in service')
}

async function api(path,opts={}){const r=await fetch(path,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${token()}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong. Please try again.');return j}

const MARKET_NAMES={ALL:'All markets','1X2':'Match result','O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}
const RULE_GROUPS=[
 {title:'League position',rules:[['TOP3','Top 3 team'],['BOTTOM3','Bottom 3 team'],['OPP_TOP3','Opponent is top 3'],['OPP_BOTTOM3','Opponent is bottom 3']]},
 {title:'Points and scoring',rules:[['PPG_HIGH','Averages 2+ points a game'],['PPG_LOW','Averages under 1 point a game'],['OPP_PPG_LOW','Opponent averages under 1 point'],['GS_23','Scores 2.3+ goals a game'],['GS_20','Scores 2+ goals a game'],['GS_LOW','Scores under 1 goal a game'],['OPP_GS_LOW','Opponent scores under 1 goal']]},
 {title:'Defending',rules:[['GC_LOW','Concedes under 1 goal a game'],['GC_20','Concedes 2+ goals a game'],['GC_23','Concedes over 2.3 goals a game'],['OPP_GC_LOW','Opponent concedes under 1'],['OPP_GC_20','Opponent concedes 2+'],['OPP_GC_23','Opponent concedes over 2.3']]},
 {title:'Last 5 matches',rules:[['WIN80','Won 4 of last 5'],['WIN60','Won 3 of last 5'],['WIN_LT40','Won fewer than 2 of last 5'],['WIN_LT60','Won fewer than 3 of last 5'],['LOSS80','Lost 4 of last 5'],['LOSS60','Lost 3 of last 5'],['OPP_LOSS80','Opponent lost 4 of last 5'],['OPP_LOSS60','Opponent lost 3 of last 5']]},
 {title:'Prices',rules:[['ODDS_120','Win price below 1.20'],['ODDS_155','Win price 1.55 or lower'],['ODDS_200','Win price 2.00 or lower'],['ODDS_500','Win price above 5.00'],['DRAW_LT3','Draw price below 3.00'],['DRAW_GT4','Draw price above 4.00'],['DRAW_GT5','Draw price above 5.00']]},
 {title:'Goal patterns',rules:[['GOAL_O15_80','Over 1.5 in 4 of 5+'],['GOAL_O15_60','Over 1.5 in 3 of 5+'],['GOAL_U15_80','Under 1.5 in 4 of 5+'],['GOAL_U15_60','Under 1.5 in 3 of 5+'],['GOAL_O25_80','Over 2.5 in 4 of 5+'],['GOAL_O25_60','Over 2.5 in 3 of 5+'],['GOAL_U25_80','Under 2.5 in 4 of 5+'],['GOAL_U25_60','Under 2.5 in 3 of 5+'],['GOAL_O35_80','Over 3.5 in 4 of 5+'],['GOAL_O35_60','Over 3.5 in 3 of 5+'],['GOAL_U35_80','Under 3.5 in 4 of 5+'],['GOAL_U35_60','Under 3.5 in 3 of 5+']]}
]
const RULE_LABELS=new Map(RULE_GROUPS.flatMap(g=>g.rules))

function inferCodes(row){
 const codes=[];const all=[...(row.filters||[]),...(row.negativeSignals||[])].map(String)
 for(const text of all){const s=text.toLowerCase(),opp=s.startsWith('opponent ')
  if(opp&&s.includes('top 3'))codes.push('OPP_TOP3');else if(opp&&s.includes('bottom 3'))codes.push('OPP_BOTTOM3');else if(!opp&&s.includes('top 3'))codes.push('TOP3');else if(!opp&&s.includes('bottom 3'))codes.push('BOTTOM3')
  if(opp&&s.includes('ppg < 1.0'))codes.push('OPP_PPG_LOW');else if(!opp&&s.includes('ppg ≥ 2.0'))codes.push('PPG_HIGH');else if(!opp&&s.includes('ppg < 1.0'))codes.push('PPG_LOW')
  if(opp&&s.includes('goals scored < 1.0'))codes.push('OPP_GS_LOW');else if(!opp&&s.includes('goals scored ≥ 2.3'))codes.push('GS_23');else if(!opp&&s.includes('goals scored ≥ 2.0'))codes.push('GS_20');else if(!opp&&s.includes('goals scored < 1.0'))codes.push('GS_LOW')
  if(opp&&s.includes('goals conceded > 2.3'))codes.push('OPP_GC_23');else if(opp&&s.includes('goals conceded ≥ 2.0'))codes.push('OPP_GC_20');else if(opp&&s.includes('goals conceded < 1.0'))codes.push('OPP_GC_LOW');else if(!opp&&s.includes('goals conceded > 2.3'))codes.push('GC_23');else if(!opp&&s.includes('goals conceded ≥ 2.0'))codes.push('GC_20');else if(!opp&&s.includes('goals conceded < 1.0'))codes.push('GC_LOW')
  if(opp&&s.includes('loss rate ≥ 80%'))codes.push('OPP_LOSS80');else if(opp&&s.includes('loss rate ≥ 60%'))codes.push('OPP_LOSS60');else if(!opp&&s.includes('win rate ≥ 80%'))codes.push('WIN80');else if(!opp&&s.includes('win rate ≥ 60%'))codes.push('WIN60');else if(!opp&&s.includes('win rate < 40%'))codes.push('WIN_LT40');else if(!opp&&s.includes('win rate < 60%'))codes.push('WIN_LT60');else if(!opp&&s.includes('loss rate ≥ 80%'))codes.push('LOSS80');else if(!opp&&s.includes('loss rate ≥ 60%'))codes.push('LOSS60')
  if(s.includes('odds < 1.20'))codes.push('ODDS_120');else if(s.includes('odds ≤ 1.55'))codes.push('ODDS_155');else if(s.includes('odds ≤ 2.00'))codes.push('ODDS_200');else if(s.includes('odds > 5.00'))codes.push('ODDS_500')
  if(s.includes('draw odds < 3.00'))codes.push('DRAW_LT3');else if(s.includes('draw odds > 5.00'))codes.push('DRAW_GT5');else if(s.includes('draw odds > 4.00'))codes.push('DRAW_GT4')
  const gm=text.match(/\b([OU])(1\.5|2\.5|3\.5) hit rate ≥ (80|60)%/i);if(gm)codes.push(`GOAL_${gm[1].toUpperCase()}${gm[2].replace('.','')}_${gm[3]}`)
 }
 return [...new Set(codes)]
}
function rowCodes(row){return[...new Set([...(row.filterCodes||[]),...(row.negativeSignalCodes||[]),...inferCodes(row)])]}
function selectedRuleMatchCount(row){if(!state.selectedRules.size)return 0;const codes=new Set(rowCodes(row));let count=0;for(const id of state.selectedRules)if(codes.has(id))count++;return count}
function rowPassesRules(row){if(!state.selectedRules.size)return true;const count=selectedRuleMatchCount(row);return state.ruleMode==='ALL'?count===state.selectedRules.size:count>0}
function warningRank(x){return x==='LOW'?0:x==='MODERATE'?1:2}
function compareRows(a,b){
 if(state.primaryRule){const ac=rowCodes(a).includes(state.primaryRule)?1:0,bc=rowCodes(b).includes(state.primaryRule)?1:0;if(ac!==bc)return bc-ac}
 if(state.sortBy==='FILTER_MATCH')return selectedRuleMatchCount(b)-selectedRuleMatchCount(a)||b.filterCount-a.filterCount||(a.odds??99)-(b.odds??99)
 if(state.sortBy==='MOST_REASONS')return b.filterCount-a.filterCount||(a.odds??99)-(b.odds??99)
 if(state.sortBy==='LOW_PRICE')return(a.odds??99)-(b.odds??99)||b.filterCount-a.filterCount
 if(state.sortBy==='KICKOFF')return new Date(a.kickoff||0)-new Date(b.kickoff||0)
 if(state.sortBy==='TEAM')return String(a.selectedTeam||'').localeCompare(String(b.selectedTeam||''))
 return b.filterCount-a.filterCount||warningRank(a.contradiction)-warningRank(b.contradiction)||Number(b.score||0)-Number(a.score||0)||(a.odds??99)-(b.odds??99)
}
function groupRows(rows){return(rows||[]).filter(r=>r.filterCount>=state.minReasons&&(state.market==='ALL'||r.market===state.market)&&rowPassesRules(r)).sort(compareRows)}
function allRows(board){return[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]}

function plainReason(text){
 let s=String(text||'')
 const rules=[
  [/selected team is in the league'?s? top 3/i,'The selected team is in the top 3.'],[/selected team is in the bottom 3/i,'The selected team is in the bottom 3.'],
  [/selected team averages at least 2 points per game/i,'The selected team has been collecting points at a very strong rate.'],[/selected team averages under 1 point per game/i,'The selected team has been struggling to collect points.'],
  [/selected team scores at least 2\.3 goals per game/i,'The selected team scores very often.'],[/selected team scores at least 2 goals per game/i,'The selected team scores at least 2 goals a game on average.'],[/selected team scores under 1 goal per game/i,'The selected team has been struggling to score.'],
  [/selected team concedes more than 2\.3 goals per game/i,'The selected team has been conceding heavily.'],[/selected team concedes at least 2 goals per game/i,'The selected team concedes often.'],[/selected team concedes under 1 goal per game/i,'The selected team has been defending very well.'],
  [/selected team won at least 4 of its last 5/i,'The selected team has won 4 of its last 5.'],[/selected team won at least 3 of its last 5/i,'The selected team has won at least 3 of its last 5.'],[/selected team won fewer than 2 of its last 5/i,'The selected team has won fewer than 2 of its last 5.'],[/selected team won fewer than 3 of its last 5/i,'The selected team has won fewer than 3 of its last 5.'],[/selected team lost at least 4 of its last 5/i,'The selected team has lost 4 of its last 5.'],[/selected team lost at least 3 of its last 5/i,'The selected team has lost at least 3 of its last 5.'],
  [/opponent is in the league top 3/i,'The opponent is also in the top 3.'],[/opponent is in the bottom 3/i,'The opponent is in the bottom 3.'],[/opponent averages under 1 point per game/i,'The opponent has been struggling to collect points.'],[/opponent scores under 1 goal per game/i,'The opponent has been struggling to score.'],[/opponent concedes more than 2\.3 goals per game/i,'The opponent has been conceding heavily.'],[/opponent concedes at least 2 goals per game/i,'The opponent concedes often.'],[/opponent concedes under 1 goal per game/i,'The opponent has been defending well.'],[/opponent lost at least 4 of its last 5/i,'The opponent has lost 4 of its last 5.'],[/opponent lost at least 3 of its last 5/i,'The opponent has lost at least 3 of its last 5.'],
  [/win price is below 1\.20/i,'The market makes the selected team a very strong favourite.'],[/win price is 1\.55 or lower/i,'The market strongly favours the selected team.'],[/win price is 2\.00 or lower/i,'The market favours the selected team.'],[/win price is above 5\.00/i,'The market sees this team as a big outsider.'],[/draw price is below 3\.00/i,'The draw is priced as a real possibility.'],[/draw price is above 5\.00/i,'The market sees a draw as unlikely.'],[/draw price is above 4\.00/i,'The market gives the draw a relatively low chance.']
 ]
 for(const [re,out] of rules)if(re.test(s))return out
 const g=s.match(/(Over|Under) (1\.5|2\.5|3\.5) goals landed in at least (80|60)% of the (home|away) team's recent matches/i)
 if(g)return `${g[1]} ${g[2]} goals has appeared in at least ${g[3]==='80'?'4 of 5':'3 of 5'} recent matches for the ${g[4]} team.`
 return s.replace(/PPG/ig,'points per game').replace(/hit rate/ig,'recent record')
}
function reasonSummary(row,limit=2){const reasons=(row.filters||[]).map(plainReason);return reasons.slice(0,limit).join(' ')+(reasons.length>limit?' More signs also support it.':'')}
function strengthLabel(row){if(row.contradiction==='HIGH')return 'Mixed';if(row.filterCount>=5)return 'Very strong';if(row.filterCount>=3)return 'Strong';if(row.filterCount===2)return 'Good';return 'Worth watching'}
function starCount(row){let n=row.filterCount>=5?5:row.filterCount>=3?5:row.filterCount===2?4:3;if(row.contradiction==='MODERATE')n--;if(row.contradiction==='HIGH')n=Math.min(n,2);return Math.max(1,Math.min(5,n))}
function stars(row){const n=starCount(row);return '★'.repeat(n)+'☆'.repeat(5-n)}
function predictionName(row){return row.market==='1X2'?`${row.selectedTeam} win`:(MARKET_NAMES[row.market]||row.selectedTeam)}
function splitKickoff(row){try{const d=new Date(row.kickoff);if(!Number.isNaN(d.getTime()))return{date:new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(d),time:new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(d)}}catch{}return{date:row.kickoffLocal||'',time:''}}
function updatedText(meta){if(!meta?.generatedAt)return 'Not updated yet';try{return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(meta.generatedAt))}catch{return 'Recently'}}
function marketsForFixture(id){return state.board?.oddsByFixture?.[String(id)]||[]}

function renderSelectedFilters(){
 if(!state.selectedRules.size)return `<div class="selected-filter-bar"><span class="filter-glyph">⌁</span><span class="selected-none">No extra filters selected — showing every qualifying match.</span></div>`
 return `<div class="selected-filter-bar"><span class="filter-glyph">⌁</span>${[...state.selectedRules].map(id=>`<span class="selected-chip">${esc(RULE_LABELS.get(id)||id)}<button type="button" data-remove-rule="${esc(id)}" aria-label="Remove filter">×</button></span>`).join('')}<span class="filters-sort-note">${state.primaryRule?`Putting “${esc(RULE_LABELS.get(state.primaryRule)||state.primaryRule)}” first.`:'Selected filters are being used to narrow the board.'}</span></div>`
}
function renderFilterPanel(){if(!state.showRules)return'';return `<section class="filter-panel">
 <div class="filter-panel-head"><div><h2>Choose filters</h2><p>Select the exact football conditions you want. Use “Match all” when every selected condition must be present.</p></div><button id="clear-filters" class="clear-filters" type="button" ${state.selectedRules.size?'':'disabled'}>Clear all</button></div>
 <div class="filter-options"><div><label>How selected filters should work</label><div class="mode-row"><button class="mode-pill ${state.ruleMode==='ANY'?'active':''}" data-mode="ANY" type="button">Match any selected filter</button><button class="mode-pill ${state.ruleMode==='ALL'?'active':''}" data-mode="ALL" type="button">Match all selected filters</button></div></div><label>Put one selected filter first<select id="primary-rule"><option value="">Use all selected filters together</option>${[...state.selectedRules].map(id=>`<option value="${esc(id)}" ${state.primaryRule===id?'selected':''}>${esc(RULE_LABELS.get(id)||id)}</option>`).join('')}</select></label></div>
 <div class="filter-groups">${RULE_GROUPS.map((g,i)=>`<details class="filter-group" ${i<3?'open':''}><summary>${esc(g.title)}</summary><div class="filter-list">${g.rules.map(([id,label])=>`<button type="button" class="filter-choice ${state.selectedRules.has(id)?'active':''}" data-rule="${esc(id)}">${state.selectedRules.has(id)?'✓ ':''}${esc(label)}</button>`).join('')}</div></details>`).join('')}</div>
 </section>`}

function priorityRows(rows){
 rows=groupRows(rows).slice(0,12)
 if(!rows.length)return'<div class="no-data">No picks fit these choices right now.</div>'
 return `<div class="priority-list">${rows.map(r=>{const k=splitKickoff(r);return `<div class="priority-row"><div class="priority-match"><div class="club-stack">${r.selectedTeamLogo?`<img src="${esc(r.selectedTeamLogo)}" alt="">`:''}${r.opponentTeamLogo?`<img src="${esc(r.opponentTeamLogo)}" alt="">`:''}</div><div><b>${esc(r.match)}</b><small>${esc(r.league)} · ${esc(k.date)} ${esc(k.time)}</small></div></div><div class="priority-pick"><b>${esc(predictionName(r))}</b><small>${esc(strengthLabel(r))}</small></div><span class="price-pill">${fmt(r.odds)}</span><div class="reason-line">${esc(reasonSummary(r,2))}</div><button class="details-btn" type="button" data-details="${esc(r.fixtureId)}" data-row-key="${esc(rowKey(r))}">View details ›</button></div>`}).join('')}</div>`
}
function rowKey(r){return `${r.fixtureId}|${r.market}|${r.selectedTeamId||r.selectedTeam}`}
function findRow(key){return allRows(state.board).find(r=>rowKey(r)===key)||state.board?.priority?.find(r=>rowKey(r)===key)}
function table(title,subtitle,rows){
 rows=groupRows(rows)
 return `<section class="panel"><header class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><span class="count">${rows.length}</span></header>${rows.length?`<div class="table-wrap"><table class="pred-table"><thead><tr><th>Time</th><th>Match</th><th>League</th><th>Prediction</th><th>Odds</th><th>Strength</th><th>Key reasons</th><th></th></tr></thead><tbody>${rows.map(r=>{const k=splitKickoff(r);return `<tr><td data-label="Time"><b>${esc(k.date)}</b><br>${esc(k.time)}</td><td data-label="Match"><div class="match-cell"><div class="match-logos">${r.selectedTeamLogo?`<img src="${esc(r.selectedTeamLogo)}" alt="">`:''}${r.opponentTeamLogo?`<img src="${esc(r.opponentTeamLogo)}" alt="">`:''}</div><div class="match-names"><b>${esc(r.market==='1X2'?r.selectedTeam:r.match.split(' vs ')[0]||r.match)}</b><span>${esc(r.market==='1X2'?r.opponentTeam:r.match.split(' vs ')[1]||'')}</span></div></div></td><td data-label="League"><div class="competition">${r.countryFlag?`<img src="${esc(r.countryFlag)}" alt="">`:''}<span>${esc(r.league)}</span></div></td><td data-label="Prediction" class="prediction">${esc(predictionName(r))}</td><td data-label="Odds" class="num">${fmt(r.odds)}</td><td data-label="Strength"><div class="strength"><span class="stars">${stars(r)}</span><small>${esc(strengthLabel(r))}</small></div></td><td data-label="Key reasons" class="key-reasons"><span>${esc(reasonSummary(r,2))}</span></td><td data-label="More" class="details-cell"><button class="details-btn" type="button" data-details="${esc(r.fixtureId)}" data-row-key="${esc(rowKey(r))}">View details ›</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class="no-data">No matches fit these choices right now.</div>`}</section>`
}

function openDetails(row){
 if(!row)return
 const markets=marketsForFixture(row.fixtureId),reasons=(row.filters||[]).map(plainReason)
 const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.id='detail-modal'
 overlay.innerHTML=`<section class="detail-modal" role="dialog" aria-modal="true" aria-label="Match details"><header class="modal-head"><div><h2>${esc(row.match)}</h2><p>${esc(row.league)} · ${esc(row.kickoffLocal||'')}</p></div><button class="modal-close" type="button" aria-label="Close">×</button></header><div class="detail-body"><section class="detail-summary"><div><h3>${esc(predictionName(row))}</h3><p>${esc(strengthLabel(row))} · ${row.filterCount} ${row.filterCount===1?'filter':'filters'} supporting this pick</p></div><div class="detail-price"><span>Current price</span><strong>${fmt(row.odds)}</strong></div></section><section class="detail-section"><h3>Why this match was selected</h3><div class="reason-cards">${reasons.length?reasons.map(x=>`<div class="reason-card">${esc(x)}</div>`).join(''):'<div class="reason-card">This match qualifies through the current board rules.</div>'}</div></section><section class="detail-section"><h3>Available market prices</h3>${markets.length?`<div class="market-grid">${markets.map(m=>`<article class="market-card"><h4>${esc(m.market)}</h4><div class="outcomes">${(m.outcomes||[]).map(o=>`<div class="outcome"><span>${esc(o.name)}</span><strong>${fmt(o.odd)}</strong></div>`).join('')}</div></article>`).join('')}</div>`:'<div class="reason-card">No extra market prices are available for this match yet.</div>'}</section></div></section>`
 document.body.appendChild(overlay);const close=()=>overlay.remove();overlay.querySelector('.modal-close').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};document.addEventListener('keydown',function onKey(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',onKey)}})
}

function renderBoard(){
 const b=state.board||{meta:{},groups:{},priority:[]};const visible=groupRows(allRows(b)),strong=groupRows(b.groups?.threePlus||[]).length,qualified=visible.length,checked=Number(b.meta?.sourceFixtures??b.meta?.fixturesScanned??visible.length),userLabel=state.user?.email||'Signed in'
 root.innerHTML=`<main class="app-shell"><header class="topbar"><div class="topbar-brand"><div class="brand-inline"><img class="mark" src="/assets/brand-mark.png" alt=""><img class="wordmark" src="/assets/brand-wordmark.png" alt="Stats2Pitch"></div><span class="title-divider"></span><div class="page-title">Prediction Board</div></div><div class="top-actions"><span class="user-email">${esc(userLabel)}</span><button id="signout" class="signout" type="button">↪ Sign out</button></div></header>
 <section class="controls"><div class="control-grid"><div class="control"><label>Market<select id="market">${Object.entries(MARKET_NAMES).map(([value,label])=>`<option value="${value}" ${state.market===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div><div class="control"><label>Minimum filters<select id="minf">${[1,2,3,5].map(x=>`<option value="${x}" ${state.minReasons===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="control"><label>Fixture date<input id="date" type="date" value="${esc(state.date)}"></label></div><div class="control"><label>Choose filters<button id="toggle-filters" class="filter-trigger" type="button"><span>${state.selectedRules.size?`${state.selectedRules.size} selected`:'All filters'}</span><strong>${state.selectedRules.size||'All'}</strong></button></label></div><div class="control"><label>Sort by<select id="sortby"><option value="BEST" ${state.sortBy==='BEST'?'selected':''}>Best picks</option><option value="FILTER_MATCH" ${state.sortBy==='FILTER_MATCH'?'selected':''}>Chosen filters first</option><option value="MOST_REASONS" ${state.sortBy==='MOST_REASONS'?'selected':''}>Most filters</option><option value="LOW_PRICE" ${state.sortBy==='LOW_PRICE'?'selected':''}>Lowest price</option><option value="KICKOFF" ${state.sortBy==='KICKOFF'?'selected':''}>Kickoff time</option><option value="TEAM" ${state.sortBy==='TEAM'?'selected':''}>Team name</option></select></label></div><button id="refresh" class="refresh" type="button">↻ Refresh real data</button></div>${renderSelectedFilters()}</section>${renderFilterPanel()}
 ${b.meta?.stale?'<div class="notice">The latest refresh did not finish, so the most recent available prediction board is still being shown.</div>':''}
 <section class="summary-grid"><article class="summary-card"><div class="summary-icon">⌕</div><div><span>Matches checked</span><strong>${checked}</strong></div></article><article class="summary-card"><div class="summary-icon">✓</div><div><span>Good picks</span><strong>${qualified}</strong></div></article><article class="summary-card"><div class="summary-icon">☆</div><div><span>Strongest picks</span><strong>${strong}</strong></div></article><article class="summary-card updated"><div class="summary-icon">◷</div><div><span>Updated</span><strong>${esc(updatedText(b.meta))}</strong></div></article></section>
 <h2 class="section-title">Priority Prediction List</h2><section class="panel">${priorityRows(b.priority)}</section>
 ${table('3+ Filters','Three or more clear reasons support the prediction.',b.groups?.threePlus)}${table('2 Filters','Two clear reasons support the prediction.',b.groups?.two)}${table('Single Filter','One clear reason supports the prediction.',b.groups?.single)}
 <footer class="footnote">Stats2Pitch.com · From stats to the pitch.</footer></main>`
 bindBoard()
}
function bindBoard(){
 document.getElementById('signout').onclick=async()=>{await signOut();loginView()}
 document.getElementById('market').onchange=e=>{state.market=e.target.value;renderBoard()}
 document.getElementById('minf').onchange=e=>{state.minReasons=Number(e.target.value);renderBoard()}
 document.getElementById('sortby').onchange=e=>{state.sortBy=e.target.value;renderBoard()}
 document.getElementById('date').onchange=e=>{state.date=e.target.value}
 document.getElementById('toggle-filters').onclick=()=>{state.showRules=!state.showRules;renderBoard()}
 document.getElementById('refresh').onclick=()=>refreshBoard()
 document.querySelectorAll('[data-remove-rule]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.removeRule;state.selectedRules.delete(id);if(state.primaryRule===id)state.primaryRule='';renderBoard()})
 document.querySelectorAll('[data-details]').forEach(btn=>btn.onclick=()=>openDetails(findRow(btn.dataset.rowKey)))
 if(state.showRules){
  document.querySelectorAll('[data-rule]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.rule;if(state.selectedRules.has(id)){state.selectedRules.delete(id);if(state.primaryRule===id)state.primaryRule=''}else state.selectedRules.add(id);if(state.selectedRules.size&&state.sortBy==='BEST')state.sortBy='FILTER_MATCH';renderBoard()})
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{state.ruleMode=btn.dataset.mode;renderBoard()})
  const clear=document.getElementById('clear-filters');if(clear)clear.onclick=()=>{state.selectedRules.clear();state.primaryRule='';state.sortBy='BEST';renderBoard()}
  const primary=document.getElementById('primary-rule');if(primary)primary.onchange=e=>{state.primaryRule=e.target.value;if(state.primaryRule)state.sortBy='FILTER_MATCH';renderBoard()}
 }
}

async function loadBoard(){try{state.board=await api('/api/board');renderBoard()}catch(e){if(/Authentication/i.test(e.message)){clearSession();loginView('Please sign in again.')}else alert(e.message)}}
async function refreshBoard(){const btn=document.getElementById('refresh');if(btn){btn.disabled=true;btn.textContent='Refreshing…'}try{state.board=await api(`/api/refresh?date=${encodeURIComponent(state.date)}`,{method:'POST'});renderBoard()}catch(e){alert(e.message);renderBoard()}}
async function showDashboard(){root.innerHTML='<div class="splash"><img src="/assets/brand-mark.png" alt=""><span>Opening Stats2Pitch…</span></div>';await validate();await loadBoard()}

;(async()=>{try{await loadConfig();if(await validate())await showDashboard();else loginView()}catch(e){loginView(e.message)}})()
