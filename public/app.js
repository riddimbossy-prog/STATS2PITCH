import {app,state,esc,getToken,clearSession,loadConfig,authRequest,api} from './core.js'
import {startDashboard} from './dashboard.js'
function authView(message=''){
  app.innerHTML=`<main class="auth"><section class="auth-card"><div class="logo">STATS<span>2</span>PITCH</div><h1>Prediction Board</h1><p>Sign in to load today’s split-based predictions.</p><form id="auth-form"><div class="field"><label>Email<input id="email" type="email" required autocomplete="email"></label></div><div class="field"><label>Password<input id="password" type="password" required minlength="6" autocomplete="current-password"></label></div><div id="auth-error" class="error">${esc(message)}</div><div class="auth-actions"><button class="primary" type="submit">Sign in</button>${state.config?.allowPublicSignup?'<button class="secondary" id="signup" type="button">Create account</button>':''}</div></form></section></main>`
  const form=document.getElementById('auth-form'),error=document.getElementById('auth-error'),email=document.getElementById('email'),password=document.getElementById('password')
  form.onsubmit=async e=>{e.preventDefault();error.textContent='';try{await authRequest('login',email.value,password.value);await authenticatedStart()}catch(err){error.textContent=err.message}}
  const signup=document.getElementById('signup');if(signup)signup.onclick=async()=>{error.textContent='';try{const data=await authRequest('signup',email.value,password.value);if(data.access_token)await authenticatedStart();else error.textContent='Account created. Sign in to continue.'}catch(err){error.textContent=err.message}}
}
async function authenticatedStart(){try{state.user=await api('/api/me');await startDashboard()}catch(e){clearSession();authView(e.message)}}
async function boot(){try{await loadConfig();if(getToken())await authenticatedStart();else authView()}catch(e){app.innerHTML=`<main class="auth"><section class="auth-card"><div class="logo">STATS<span>2</span>PITCH</div><h1>Unable to start</h1><p>${esc(e.message)}</p></section></main>`}}
boot()
