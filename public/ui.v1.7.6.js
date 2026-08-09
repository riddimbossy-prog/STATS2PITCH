(()=>{
  const ROOT_CLASS='s2p-scroll-ready'

  function unlockDocumentScroll(){
    const shell=document.querySelector('.app-shell')
    const auth=document.querySelector('.auth-page')
    if(!shell&&!auth)return

    document.documentElement.classList.add(ROOT_CLASS)
    document.body.classList.add(ROOT_CLASS)

    // Clear stale inline locks left by older UI/modal code or browser restores.
    for(const el of [document.documentElement,document.body]){
      if(!el)continue
      const style=el.style
      if(style.overflow==='hidden')style.removeProperty('overflow')
      if(style.overflowY==='hidden')style.removeProperty('overflow-y')
      if(style.height==='100vh'||style.height==='100dvh')style.removeProperty('height')
      if(style.position==='fixed'){
        style.removeProperty('position')
        style.removeProperty('top')
        style.removeProperty('left')
        style.removeProperty('right')
        style.removeProperty('width')
      }
    }
  }

  function setViewportUnit(){
    const height=window.visualViewport?.height||window.innerHeight
    if(height)document.documentElement.style.setProperty('--s2p-safe-vh',`${height*.01}px`)
  }

  function markDeviceWidth(){
    const width=Math.round(window.visualViewport?.width||window.innerWidth||document.documentElement.clientWidth||0)
    document.documentElement.dataset.s2pWidth=String(width)
    document.documentElement.classList.toggle('s2p-zfold-cover',width>0&&width<=390)
    document.documentElement.classList.toggle('s2p-mobile',width>0&&width<=600)
    document.documentElement.classList.toggle('s2p-tablet',width>600&&width<=1100)
  }

  function refresh(){
    unlockDocumentScroll()
    setViewportUnit()
    markDeviceWidth()
  }

  let raf=0
  const queue=()=>{
    if(raf)return
    raf=requestAnimationFrame(()=>{raf=0;refresh()})
  }

  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})
  window.addEventListener('resize',queue,{passive:true})
  window.addEventListener('orientationchange',queue,{passive:true})
  window.visualViewport?.addEventListener('resize',queue,{passive:true})
  window.visualViewport?.addEventListener('scroll',queue,{passive:true})

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true})
  else refresh()
})()
