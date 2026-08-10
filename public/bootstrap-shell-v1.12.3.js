/* Stats2Pitch UI v1.12.4 — immediate modern board surface bootstrap.
 * The opening football animation is visual only. A signed-in user gets the real
 * #s2p-card-board host immediately; network requests only populate that host.
 */
(()=>{
  'use strict'
  const root=document.getElementById('root')
  if(!root)return

  const ACCESS_KEY='s2p_access_token'
  let timer=0

  const token=()=>{try{return localStorage.getItem(ACCESS_KEY)||''}catch{return''}}
  const authVisible=()=>Boolean(document.querySelector('.auth-page'))
  const boardHost=()=>document.getElementById('s2p-card-board')
  const boardState=()=>boardHost()?.dataset?.s2pState||''

  function loadingMarkup(){
    return `<div class="s2p-bootstrap-status" role="status" aria-live="polite">
      <img src="/assets/brand-wordmark.png" alt="Stats2Pitch">
      <strong>Opening prediction board…</strong>
      <span>Loading the latest saved matches.</span>
    </div>`
  }

  function removeBootstrapStatus(){
    const state=boardState()
    if(state!=='ready'&&state!=='error')return
    document.querySelectorAll('.s2p-bootstrap-status').forEach(el=>el.remove())
    const shell=document.querySelector('.app-shell.s2p-bootstrap-shell')
    if(shell)shell.classList.remove('s2p-bootstrap-shell')
    shell?.removeAttribute('aria-busy')
  }

  function ensureSurface(){
    if(authVisible()||!token())return false

    let shell=document.querySelector('.app-shell')
    if(!shell){
      root.innerHTML='<main class="app-shell s2p-bootstrap-shell" aria-busy="true"></main>'
      shell=document.querySelector('.app-shell')
    }
    if(!shell)return false

    let host=boardHost()
    if(!host){
      host=document.createElement('section')
      host.id='s2p-card-board'
      host.dataset.s2pState='loading'
      host.innerHTML=loadingMarkup()
      shell.prepend(host)
    }else if(!host.dataset.s2pState){
      host.dataset.s2pState='loading'
    }

    if(!host.querySelector('.s2p-bootstrap-status')&&host.dataset.s2pState==='loading'){
      host.insertAdjacentHTML('afterbegin',loadingMarkup())
    }

    document.dispatchEvent(new CustomEvent('s2p:shell-ready',{detail:{source:'bootstrap-surface',state:host.dataset.s2pState}}))
    return true
  }

  function schedule(delay=120){
    clearTimeout(timer)
    timer=setTimeout(()=>{
      if(authVisible()||!token())return
      if(!boardHost())ensureSurface()
    },delay)
  }

  // Do not wait for /api/board before creating the user-facing surface.
  if(token())schedule(250)

  const observer=new MutationObserver(()=>{
    if(authVisible())return
    const host=boardHost()
    if(host){
      removeBootstrapStatus()
      return
    }
    if(token())schedule(80)
  })
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})

  document.addEventListener('s2p:board-ready',removeBootstrapStatus,{passive:true})
  document.addEventListener('s2p:board-recover',()=>{if(token()&&!authVisible())ensureSurface()},{passive:true})
  window.addEventListener('pageshow',()=>{if(token()&&!authVisible())ensureSurface()},{passive:true})
})()
