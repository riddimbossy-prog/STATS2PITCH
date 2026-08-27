let deferredInstall=null
const button=document.getElementById('installApp')
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(button)button.hidden=false})
button?.addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;button.hidden=true})
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=5.2.0').catch(()=>{}))
