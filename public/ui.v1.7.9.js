(()=>{
  let raf=0

  function canonicalMatchForKey(key){
    if(!key)return''
    let source=null
    try{source=document.querySelector(`[data-row-key="${CSS.escape(key)}"]`)}catch{}
    const row=source?.closest('tr')
    const teams=[...(row?.querySelectorAll('.match-team span')||[])].map(x=>String(x.textContent||'').trim()).filter(Boolean)
    if(teams.length>=2)return `${teams[0]} vs ${teams[1]}`

    const matchCell=row?.querySelector('[data-label="Match"]')
    if(matchCell){
      const text=String(matchCell.textContent||'').trim().replace(/\s+/g,' ')
      // Collapse any accidental repeated separators left by older renderers.
      return text.replace(/\bvs\b(?:\s*\bvs\b)+/gi,'vs')
    }
    return''
  }

  function fixBestPickLabels(){
    raf=0
    for(const item of document.querySelectorAll('.priority-v17-row[data-priority-key]')){
      const strong=item.querySelector('.priority-compact-match strong')
      if(!strong)continue
      const canonical=canonicalMatchForKey(item.dataset.priorityKey)
      if(canonical&&strong.textContent!==canonical)strong.textContent=canonical
      else if(!canonical){
        const cleaned=String(strong.textContent||'').replace(/\bvs\b(?:\s*\bvs\b)+/gi,'vs').replace(/\s+/g,' ').trim()
        if(cleaned!==strong.textContent)strong.textContent=cleaned
      }
    }
  }

  function queue(){
    if(raf)return
    raf=requestAnimationFrame(fixBestPickLabels)
  }

  new MutationObserver(mutations=>{
    if(mutations.some(m=>m.target?.closest?.('.priority-compact,.prediction-panel')))queue()
  }).observe(document.documentElement,{childList:true,subtree:true})

  window.addEventListener('s2p:tabchange',queue,{passive:true})
  window.addEventListener('pageshow',queue,{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue()
})()
