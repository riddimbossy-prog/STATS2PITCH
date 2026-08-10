/* Stats2Pitch v1.11.7 — pitch-loader boot guard with automatic recovery only. */
(()=>{
  'use strict'
  let observer=null,slowTimer=0,reloadTimer=0
  const RELOAD_KEY='s2p_auto_boot_reload_1117'

  const guard=()=>document.getElementById('s2p-boot-guard')
  const boardState=()=>document.getElementById('s2p-card-board')?.dataset?.s2pState||''
  const isReady=()=>Boolean(document.querySelector('.auth-page')||boardState()==='ready')

  function markReady(){
    if(!isReady())return false
    document.documentElement.classList.add('s2p-ui-ready')
    clearTimeout(slowTimer);clearTimeout(reloadTimer)
    observer?.disconnect()
    try{sessionStorage.removeItem(RELOAD_KEY)}catch{}
    return true
  }

  function autoRecoverOnce(){
    if(markReady())return
    try{
      if(sessionStorage.getItem(RELOAD_KEY)!=='1'){
        sessionStorage.setItem(RELOAD_KEY,'1')
        location.reload()
      }
    }catch{}
  }

  function start(){
    const root=document.getElementById('root'),g=guard()
    if(!root||!g)return
    if(markReady())return
    observer=new MutationObserver(()=>markReady())
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})
    document.addEventListener('s2p:board-ready',markReady,{passive:true})
    slowTimer=setTimeout(()=>{
      if(markReady())return
      const text=g.querySelector('.s2p-loader-text')
      const sub=g.querySelector('.s2p-loader-sub')
      if(text)text.innerHTML='Loading <b>matches...</b>'
      if(sub)sub.textContent='RECONNECTING TO THE PITCH'
    },8000)
    reloadTimer=setTimeout(autoRecoverOnce,20000)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
})()
