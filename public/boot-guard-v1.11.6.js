/* Stats2Pitch v1.11.6 — boot guard waits for a rendered board or auth page. */
(()=>{
  'use strict'
  let observer=null,slowTimer=0

  function guard(){return document.getElementById('s2p-boot-guard')}
  function boardState(){return document.getElementById('s2p-card-board')?.dataset?.s2pState||''}
  function isReady(){
    const state=boardState()
    return Boolean(document.querySelector('.auth-page')||state==='ready'||state==='error')
  }
  function markReady(){
    if(!isReady())return false
    document.documentElement.classList.add('s2p-ui-ready')
    clearTimeout(slowTimer)
    observer?.disconnect()
    return true
  }
  function recover(){
    const retry=document.querySelector('[data-board-retry]')
    if(retry){retry.click();return}
    try{
      const url=new URL(location.href)
      url.searchParams.set('_s2p_recover',String(Date.now()))
      location.replace(url.toString())
    }catch{location.reload()}
  }
  function start(){
    const root=document.getElementById('root'),g=guard()
    if(!root||!g)return
    g.querySelector('[data-s2p-recover]')?.addEventListener('click',recover)
    if(markReady())return
    observer=new MutationObserver(()=>markReady())
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-s2p-state']})
    document.addEventListener('s2p:board-ready',markReady,{passive:true})
    slowTimer=setTimeout(()=>{
      if(markReady())return
      g.classList.add('is-slow')
      const title=g.querySelector('strong'),msg=g.querySelector('span')
      if(title)title.textContent='Still loading Stats2Pitch…'
      if(msg)msg.textContent='The board has not finished loading yet. Retry without clearing your account or saved picks.'
    },8000)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
})()
