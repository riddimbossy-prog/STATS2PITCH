/* Stats2Pitch v1.10.0 — route legacy /api/board reads to the chosen fixture date. */
(()=>{
  'use strict'
  const KEY='s2p_fixture_date'
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
  const queryDate=()=>{try{const v=new URL(location.href).searchParams.get('date');return valid(v)?v:''}catch{return''}}
  const stored=()=>{const v=sessionStorage.getItem(KEY);return valid(v)?v:''}
  const initial=queryDate()||stored()||new Date().toISOString().slice(0,10)
  sessionStorage.setItem(KEY,initial)

  const nativeFetch=window.fetch.bind(window)
  window.fetch=(input,init)=>{
    try{
      const raw=typeof input==='string'?input:input?.url
      if(raw){
        const u=new URL(raw,location.origin)
        if(u.origin===location.origin&&u.pathname==='/api/board'&&!u.searchParams.has('date')){
          u.searchParams.set('date',stored()||initial)
          if(typeof input==='string')input=u.pathname+u.search
          else input=new Request(u.toString(),input)
        }
      }
    }catch{}
    return nativeFetch(input,init)
  }

  function syncInput(){const el=document.getElementById('date'),v=stored();if(el&&v&&el.value!==v)el.value=v}
  document.addEventListener('change',e=>{
    if(e.target?.id!=='date'||!valid(e.target.value))return
    const next=e.target.value
    if(next===stored())return
    sessionStorage.setItem(KEY,next)
    const u=new URL(location.href);u.searchParams.set('date',next)
    history.replaceState(null,'',u.pathname+u.search+u.hash)
    location.reload()
  },true)
  const root=document.getElementById('root')
  if(root)new MutationObserver(()=>requestAnimationFrame(syncInput)).observe(root,{childList:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncInput,{once:true});else syncInput()
})()
