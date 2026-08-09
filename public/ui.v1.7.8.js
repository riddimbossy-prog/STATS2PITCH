(()=>{
  let raf=0

  function viewportHeight(){
    const vv=window.visualViewport
    return Math.max(320,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0))
  }

  function currentScrollTop(){
    const shell=document.querySelector('.app-shell')
    return shell?.scrollTop||0
  }

  function unlockShell(){
    const h=viewportHeight()
    document.documentElement.style.setProperty('--s2p-dashboard-height',`${h}px`)
    document.documentElement.classList.add('s2p-scroll-container-ready')

    const shell=document.querySelector('.app-shell')
    const auth=document.querySelector('.auth-page')

    // The dashboard owns scroll. This bypasses any stale body/html scroll lock.
    if(shell){
      shell.style.setProperty('height',`${h}px`,'important')
      shell.style.setProperty('max-height',`${h}px`,'important')
      shell.style.setProperty('min-height','0','important')
      shell.style.setProperty('overflow-y','auto','important')
      shell.style.setProperty('overflow-x','hidden','important')
      shell.style.setProperty('-webkit-overflow-scrolling','touch','important')
      shell.style.setProperty('touch-action','pan-y pinch-zoom','important')
      shell.setAttribute('data-s2p-scroll-owner','true')
    }

    if(auth){
      auth.style.setProperty('height',`${h}px`,'important')
      auth.style.setProperty('max-height',`${h}px`,'important')
      auth.style.setProperty('min-height','0','important')
      auth.style.setProperty('overflow-y','auto','important')
      auth.style.setProperty('overflow-x','hidden','important')
      auth.style.setProperty('-webkit-overflow-scrolling','touch','important')
    }

    // Keep root/body intentionally non-scrolling; the inner shell is deterministic.
    document.body.style.setProperty('overflow','hidden','important')
    document.documentElement.style.setProperty('overflow','hidden','important')
  }

  function verifyScrollable(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    // If content grows, the board must have a real scroll range.
    const hasOverflow=shell.scrollHeight>shell.clientHeight+2
    shell.dataset.s2pHasOverflow=hasOverflow?'true':'false'
  }

  function refresh(){
    raf=0
    const before=currentScrollTop()
    unlockShell()
    verifyScrollable()
    const shell=document.querySelector('.app-shell')
    if(shell&&before>0&&shell.scrollTop===0)shell.scrollTop=before
  }

  function queue(){
    if(raf)return
    raf=requestAnimationFrame(refresh)
  }

  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})
  window.addEventListener('resize',queue,{passive:true})
  window.addEventListener('orientationchange',queue,{passive:true})
  window.visualViewport?.addEventListener('resize',queue,{passive:true})

  // Re-assert after pageshow because mobile browsers can restore stale scroll-lock styles.
  window.addEventListener('pageshow',queue,{passive:true})

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true})
  else refresh()
})()
