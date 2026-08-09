(()=>{
  const selectors=['.odds','.priority-compact-odd','.detail-price strong','.outcome strong','[data-label="Odds"]']
  function invalidDisplayedOdd(text){
    const raw=String(text??'').trim().replace(',','.')
    if(!raw)return true
    const n=Number(raw)
    return Number.isFinite(n) && n <= 1.001
  }
  function fixOdds(root=document){
    for(const el of root.querySelectorAll(selectors.join(','))){
      if(invalidDisplayedOdd(el.textContent)){
        el.textContent='—'
        el.classList.add('odds-missing')
        el.setAttribute('aria-label','Odds unavailable')
      }
    }
  }
  let queued=false
  const queue=()=>{
    if(queued)return
    queued=true
    requestAnimationFrame(()=>{queued=false;fixOdds()})
  }
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue)
  else queue()
})()
