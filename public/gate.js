import {api,bootDone,clearSession,getToken,releaseAuth,saveSession} from './net.js'

const cfg=window.__STATS2PITCH_CONFIG__||{}
const base=String(cfg.supabaseUrl||'').replace(/\/+$/,'')
const anon=String(cfg.supabaseAnonKey||'')
const allowSignup=cfg.allowPublicSignup!==false
const TOKEN_KEY='s2p_access_token'
const REFRESH_KEY='s2p_refresh_token'

function authUrl(path){return `${base}/functions/v1/stats2pitch-auth${path}`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function authCall(path,body){
  const res=await fetch(authUrl(path),{
    method:'POST',
    headers:{apikey:anon,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  })
  const data=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(data?.error||data?.msg||data?.message||'Unable to sign in right now')
  return data
}

function takeSession(data){
  const session=data?.access_token?data:data?.session
  if(!session?.access_token)throw new Error('Sign-in did not return a session')
  saveSession(session)
  return session
}

function showAuth(mode='login',message=''){
  if(!document.getElementById('s2p-gate-style')){
    const style=document.createElement('style')
    style.id='s2p-gate-style'
    style.textContent='html.s2p-locked .app,html.s2p-locked .mobile-nav{visibility:hidden}#s2p-auth-gate{position:fixed;inset:0;z-index:30000}'
    document.head.appendChild(style)
  }
  bootDone()
  document.documentElement.classList.add('s2p-locked')
  let host=document.getElementById('s2p-auth-gate')
  if(!host){
    host=document.createElement('div')
    host.id='s2p-auth-gate'
    document.body.appendChild(host)
  }
  const signup=mode==='signup'
  host.innerHTML=`<section class="auth-stadium" role="dialog" aria-modal="true" aria-label="Sign in to Stats2Pitch">
    <div class="auth-stage">
      <div class="auth-brand">
        <img class="auth-brand-mark" src="/assets/s2p-pitch-mark.svg" width="138" height="105" alt="">
        <div class="auth-wordmark">STATS<span>2</span>PITCH</div>
        <div class="auth-tagline">Smart Football Picks · <b>2026</b></div>
      </div>
      <div class="auth-card auth-card--stadium">
        <div class="auth-copy">
          <h1>${signup?'Create account':'Sign in'}</h1>
          <p>${signup?'No email verification. Create an account so we can count who uses the boards.':'Sign in to open the boards. No email verification.'}</p>
        </div>
        <form id="s2pAuthForm">
          <div class="auth-field"><label for="s2pEmail">Email</label><input id="s2pEmail" type="email" autocomplete="username" required placeholder="you@email.com"></div>
          <div class="auth-field"><label for="s2pPassword">Password</label><div class="auth-password-wrap"><input id="s2pPassword" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="6" required placeholder="At least 6 characters"><button class="auth-password-toggle" type="button" id="s2pTogglePw" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
          <p class="auth-error" id="s2pAuthError">${esc(message)}</p>
          <button class="auth-submit" type="submit" id="s2pAuthSubmit">${signup?'Create account':'Sign in'}</button>
        </form>
        ${allowSignup?`<p class="auth-signup-line">${signup?'Already have an account?':'New here?'} <button class="auth-signup-link" type="button" id="s2pAuthSwitch">${signup?'Sign in':'Create account'}</button></p>`:''}
      </div>
    </div>
  </section>`
  host.querySelector('#s2pTogglePw').onclick=()=>{
    const input=host.querySelector('#s2pPassword')
    input.type=input.type==='password'?'text':'password'
  }
  host.querySelector('#s2pAuthSwitch')?.addEventListener('click',()=>showAuth(signup?'login':'signup'))
  host.querySelector('#s2pAuthForm').onsubmit=async e=>{
    e.preventDefault()
    const btn=host.querySelector('#s2pAuthSubmit')
    const err=host.querySelector('#s2pAuthError')
    btn.disabled=true
    btn.textContent=signup?'Creating…':'Signing in…'
    err.textContent=''
    try{
      const email=host.querySelector('#s2pEmail').value.trim()
      const password=host.querySelector('#s2pPassword').value
      const data=await authCall(signup?'/signup':'/login',{email,password})
      takeSession(data)
      await finishAuth()
    }catch(ex){
      err.textContent=ex.message||'Unable to sign in right now'
      btn.disabled=false
      btn.textContent=signup?'Create account':'Sign in'
    }
  }
}

function hideAuth(){
  document.getElementById('s2p-auth-gate')?.remove()
  document.documentElement.classList.remove('s2p-locked')
}

function bindAccount(){
  const btn=document.getElementById('profileBtn')
  if(!btn||btn.dataset.s2pAccount==='1')return
  btn.dataset.s2pAccount='1'
  btn.setAttribute('aria-label','Account')
  btn.title='Account'
  btn.addEventListener('click',e=>{
    e.preventDefault()
    e.stopImmediatePropagation()
    const email=sessionStorage.getItem('s2p_email')||'Signed in'
    const existing=document.getElementById('s2p-account-modal')
    if(existing){existing.remove();return}
    const wrap=document.createElement('div')
    wrap.id='s2p-account-modal'
    wrap.innerHTML=`<div class="modal" style="display:grid;place-items:center"><div class="dialog"><h2>Account</h2><p>${esc(email)}</p><p>You are counted as one signed-in user on Stats2Pitch.</p><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button type="button" id="s2pSignOut">Sign out</button><button type="button" class="close" id="s2pAccountClose">Close</button></div></div></div>`
    document.body.appendChild(wrap)
    wrap.querySelector('#s2pAccountClose').onclick=()=>wrap.remove()
    wrap.onclick=ev=>{if(ev.target===wrap.querySelector('.modal'))wrap.remove()}
    wrap.querySelector('#s2pSignOut').onclick=()=>{clearSession();sessionStorage.removeItem('s2p_email');location.reload()}
  },true)
}

async function refreshIfNeeded(){
  const refresh=localStorage.getItem(REFRESH_KEY)
  if(!refresh)return false
  try{
    const data=await authCall('/refresh',{refresh_token:refresh})
    takeSession(data)
    return true
  }catch{
    clearSession()
    return false
  }
}

async function finishAuth(){
  try{
    const me=await api('/me',{skipAuthWait:true})
    if(me?.email)sessionStorage.setItem('s2p_email',me.email)
  }catch{
    if(await refreshIfNeeded()){
      const me=await api('/me',{skipAuthWait:true})
      if(me?.email)sessionStorage.setItem('s2p_email',me.email)
    }else{
      showAuth('login','Please sign in again.')
      return
    }
  }
  hideAuth()
  bindAccount()
  releaseAuth()
}

async function start(){
  if(!base||!anon){
    showAuth('login','Sign-in is not configured yet.')
    return
  }
  if(getToken()){
    await finishAuth()
    return
  }
  showAuth('login')
}

start().catch(()=>showAuth('login','Unable to start sign-in right now.'))
