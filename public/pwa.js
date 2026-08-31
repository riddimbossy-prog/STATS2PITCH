let deferredInstall=null
const button=document.getElementById('installApp')
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(button)button.hidden=false})
button?.addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;button.hidden=true})
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=5.12.0').catch(()=>{}))

const root=document.documentElement
let scrollNavTimer=null
const markScrolling=()=>{
  root.classList.add('is-scrolling')
  clearTimeout(scrollNavTimer)
  scrollNavTimer=setTimeout(()=>root.classList.remove('is-scrolling'),450)
}
window.addEventListener('scroll',markScrolling,{passive:true})
window.addEventListener('touchmove',markScrolling,{passive:true})
window.addEventListener('touchend',()=>{
  if(!root.classList.contains('is-scrolling'))return
  clearTimeout(scrollNavTimer)
  scrollNavTimer=setTimeout(()=>root.classList.remove('is-scrolling'),450)
},{passive:true})

const nav=document.querySelector('.mobile-nav')
if(nav){
  let sx=0,sy=0,moved=false
  nav.addEventListener('touchstart',e=>{
    const t=e.changedTouches[0]
    sx=t.clientX;sy=t.clientY;moved=false
  },{passive:true})
  nav.addEventListener('touchmove',e=>{
    const t=e.changedTouches[0]
    if(Math.abs(t.clientX-sx)>8||Math.abs(t.clientY-sy)>8){
      moved=true
      markScrolling()
    }
  },{passive:true})
  const blockNavNav=e=>{
    if(moved||root.classList.contains('is-scrolling')){
      e.preventDefault()
      e.stopPropagation()
    }
  }
  nav.addEventListener('click',blockNavNav,true)
  nav.addEventListener('touchend',blockNavNav,true)
}
