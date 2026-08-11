/* Stats2Pitch v1.13.2 — route board reads to an explicit date, otherwise browser-local today. */
(()=>{
  'use strict'
  const KEY='s2p_fixture_date'
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
  const pad=n=>String(n).padStart(2,'0')
  const browserToday=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  const queryDate=()=>{try{const v=new URL(location.href).searchParams.get('date');return valid(v)?v:''}catch{return''}}
  const stored=()=>{const v=sessionStorage.getItem(KEY);return valid(v)?v:''}

  // A normal visit always starts on the browser's current calendar day. Historical
  // or future browsing is preserved explicitly in the URL (?date=YYYY-MM-DD).
  const explicit=queryDate()
  const initial=explicit||browserToday()
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
  function rolloverIfNeeded(){
    // If the user intentionally chose a date, the URL owns that choice. Otherwise
    // an open tab that crosses midnight must move from yesterday to today.
    if(queryDate())return
    const today=browserToday()
    if(stored()===today)return
    sessionStorage.setItem(KEY,today)
    const el=document.getElementById('date');if(el)el.value=today
    location.reload()
  }

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
  window.addEventListener('pageshow',()=>{syncInput();rolloverIfNeeded()},{passive:true})
  window.addEventListener('focus',rolloverIfNeeded,{passive:true})
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')rolloverIfNeeded()},{passive:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncInput,{once:true});else syncInput()
})()
