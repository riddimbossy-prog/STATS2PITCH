const CACHE='stats2pitch-shell-v5.6.0'
const SHELL=['/','/filter-tips.html','/var-tips.html','/goals-bankers.html','/results.html','/offline.html','/conceptD.css','/mobile2026.css','/filterTips.css','/varTips.css','/goalsBankers.css','/leagueFlags.js','/appCrests.js','/filterTips.js','/varTips.js','/goalsBankers.js','/performanceAdvice.js','/net.js','/crests.js','/whyPopup.js','/pwa.js','/assets/s2p-pitch-mark.svg','/assets/stats2pitch-favicon-v3.png','/assets/football-real.svg']

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url)
  if(e.request.method!=='GET')return
  if(u.pathname.includes('/functions/v1/')||u.pathname.startsWith('/api/')){
    e.respondWith(fetch(e.request).catch(()=>new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}})))
    return
  }
  const versioned=u.searchParams.has('v')||/\.(css|js|png|svg|webp|woff2)$/i.test(u.pathname)
  if(versioned){
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})))
    return
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>hit||caches.match('/offline.html'))
    return hit||net
  }))
})
