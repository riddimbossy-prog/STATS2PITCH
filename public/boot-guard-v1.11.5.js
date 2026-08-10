/* Stats2Pitch v1.11.5 — never leave the user on a blank dark page. */
(()=>{
  'use strict'
  let observer=null,slowTimer=0

  function guard(){return document.getElementById('s2p-boot-guard')}
  function isReady(){
    return Boolean(document.querySelector('.auth-page')||document.getElementById('s2p-card-board'))
  }
  function markReady(){
    if(!isReady())return false
    document.documentElement.classList.add('s2p-ui-ready')
    clearTimeout(slowTimer)
    observer?.disconnect()
    return true
  }
  function recover(){
    try{
      const url=new URL(location.href)
      url.searchParams.set('_s2p_recover',String(Date.now()))
      location.replace(url.toString())
    }catch{location.reload()}
  }
  function start(){
    const root=document.getElementById('root')
    const g=guard()
    if(!root||!g)return
    g.querySelector('[data-s2p-recover]')?.addEventListener('click',recover)
    if(markReady())return
    observer=new MutationObserver(()=>markReady())
    observer.observe(root,{childList:true,subtree:true})
    slowTimer=setTimeout(()=>{
      if(markReady())return
      g.classList.add('is-slow')
      const title=g.querySelector('strong')
      const msg=g.querySelector('span')
      if(title)title.textContent='Still loading Stats2Pitch…'
      if(msg)msg.textContent='The app is recovering the latest interface. You can retry safely.'
    },8000)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
})()
