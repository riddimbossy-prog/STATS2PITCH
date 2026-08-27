(()=>{
  const FILTER_ID='seasonFilter'
  let mode='all'

  function ensureFilter(){
    const host=document.querySelector('.filters')
    if(!host||document.getElementById(FILTER_ID))return
    const select=document.createElement('select')
    select.id=FILTER_ID
    select.setAttribute('aria-label','Season stage')
    select.innerHTML='<option value="all">All season stages</option><option value="early">🚩 Early season</option><option value="solid">Solid season</option>'
    const clear=document.getElementById('clearFilters')
    if(clear)host.insertBefore(select,clear);else host.appendChild(select)
    select.addEventListener('change',()=>{mode=select.value;apply()})
    clear?.addEventListener('click',()=>{mode='all';select.value='all';queueMicrotask(apply)})
  }

  function apply(){
    ensureFilter()
    const host=document.getElementById('cards')
    if(!host)return
    const cards=[...host.querySelectorAll('.card:not(.skeleton)')]
    let visible=0
    for(const card of cards){
      const early=card.classList.contains('early-season-card')
      const show=mode==='all'||(mode==='early'&&early)||(mode==='solid'&&!early)
      card.hidden=!show
      if(show)visible++
    }
    const status=document.getElementById('status')
    if(status&&mode!=='all'){
      const noun='pick'
      status.textContent=`${visible} ${noun}${visible===1?'':'s'} · ${mode==='early'?'Early season':'Solid season'}`
    }
  }

  function start(){
    ensureFilter()
    const host=document.getElementById('cards')
    if(host)new MutationObserver(()=>queueMicrotask(apply)).observe(host,{childList:true,subtree:false})
    apply()
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()
})()
