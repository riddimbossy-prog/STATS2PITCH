import {app,state,esc,getToken,clearSession,loadConfig,authRequest,api} from './core.js'
import {startDashboard} from './dashboard.js'

const eyeIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6-9.8-6-9.8-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>`

function authView(message=''){
  const signupMarkup=state.config?.allowPublicSignup
    ? `<div class="auth-signup-line">New to Stats2Pitch? <button id="signup" class="auth-signup-link" type="button">Create account</button></div>`
    : ''
  app.innerHTML=`<main class="auth auth-stadium">
    <section class="auth-stage">
      <div class="auth-brand" aria-label="Stats2Pitch">
        <img class="auth-brand-mark" src="./assets/brand-mark.png?v=2.2.1" alt="">
        <div class="auth-wordmark">STATS<span>2</span>PITCH</div>
        <div class="auth-tagline">From <b>stats</b> to the <b>pitch.</b></div>
      </div>
      <section class="auth-card auth-card--stadium">
        <div class="auth-copy"><h1>Sign in</h1><p>Welcome back. Let’s get you back to the pitch.</p></div>
        <form id="auth-form">
          <div class="auth-field">
            <label for="email">Email</label>
            <input id="email" type="email" required autocomplete="email" placeholder="Enter your email">
          </div>
          <div class="auth-field">
            <label for="password">Password</label>
            <div class="auth-password-wrap">
              <input id="password" type="password" required minlength="6" autocomplete="current-password" placeholder="Enter your password">
              <button id="password-toggle" class="auth-password-toggle" type="button" aria-label="Show password">${eyeIcon}</button>
            </div>
          </div>
          <div id="auth-error" class="error auth-error">${esc(message)}</div>
          <button class="auth-submit" type="submit">Sign in</button>
          ${signupMarkup}
        </form>
      </section>
    </section>
  </main>`
  const form=document.getElementById('auth-form'),error=document.getElementById('auth-error'),email=document.getElementById('email'),password=document.getElementById('password')
  const toggle=document.getElementById('password-toggle')
  if(toggle)toggle.onclick=()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.setAttribute('aria-label',show?'Hide password':'Show password')}
  form.onsubmit=async e=>{e.preventDefault();error.textContent='';try{await authRequest('login',email.value,password.value);await authenticatedStart()}catch(err){error.textContent=err.message}}
  const signup=document.getElementById('signup');if(signup)signup.onclick=async()=>{error.textContent='';try{const data=await authRequest('signup',email.value,password.value);if(data.access_token)await authenticatedStart();else error.textContent='Account created. Sign in to continue.'}catch(err){error.textContent=err.message}}
}
async function authenticatedStart(){try{state.user=await api('/api/me');await startDashboard()}catch(e){clearSession();authView(e.message)}}
async function boot(){try{await loadConfig();if(getToken())await authenticatedStart();else authView()}catch(e){app.innerHTML=`<main class="auth"><section class="auth-card"><div class="logo">STATS<span>2</span>PITCH</div><h1>Unable to start</h1><p>${esc(e.message)}</p></section></main>`}}
boot()
