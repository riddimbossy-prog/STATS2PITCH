/* Stats2Pitch UI v1.12.3 — shell-first bootstrap watchdog.
 * The football loader is only the opening splash. A signed-in user always gets
 * an app shell immediately; board data then mounts/reconnects inside that shell.
 */
(()=>{
  'use strict'
  const root=document.getElementById('root')
  if(!root)return

  const ACCESS_KEY='s2p_access_token'
  let mountedByWatchdog=false
  let timer=0

  const token=()=>{try{return localStorage.getItem(ACCESS_KEY)||''}catch{return''}}
  const hasAuth=()=>Boolean(document.querySelector('.auth-page'))
  const hasShell=()=>Boolean(document.querySelector('.app-shell'))
  const hasBoard=()=>Boolean(document.getElementById('s2p-card-board'))

  function removeBootstrapStatus(){
    document.querySelectorAll('.s2p-bootstrap-status').forEach(el=>el.remove())
    const shell=document.querySelector('.app-shell.s2p-bootstrap-shell')
    if(shell&&hasBoard())shell.classList.remove('s2p-bootstrap-shell')
  }

  function mountShell(){
    if(hasAuth()||hasShell()||hasBoard()||!token())return false
    root.innerHTML=`<main class="app-shell s2p-bootstrap-shell" aria-busy="true">
      <section class="s2p-bootstrap-status" role="status" aria-live="polite">
        <img src="/assets/brand-wordmark.png" alt="Stats2Pitch">
        <strong>Preparing prediction board…</strong>
        <span>Matches will appear here automatically.</span>
      </section>
    </main>`
    mountedByWatchdog=true
    document.dispatchEvent(new CustomEvent('s2p:shell-ready',{detail:{source:'bootstrap-watchdog'}}))
    return true
  }

  function schedule(delay=350){
    clearTimeout(timer)
    timer=setTimeout(()=>{
      if(hasAuth()||hasShell()||hasBoard())return
      mountShell()
    },delay)
  }

  // A stored session means the page should never wait for board data before it
  // has somewhere to render. Give the base auth bootstrap a brief head start,
  // then create the shell if it has not done so itself.
  if(token())schedule(900)

  const observer=new MutationObserver(()=>{
    if(hasAuth()){
      mountedByWatchdog=false
      return
    }
    if(hasBoard()){
      removeBootstrapStatus()
      return
    }
    if(!hasShell()&&token())schedule(mountedByWatchdog?120:350)
  })
  observer.observe(root,{childList:true,subtree:false})

  document.addEventListener('s2p:board-ready',removeBootstrapStatus,{passive:true})
  window.addEventListener('pageshow',()=>{if(token()&&!hasAuth()&&!hasShell())schedule(150)},{passive:true})
})()
