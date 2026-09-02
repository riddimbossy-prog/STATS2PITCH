const CACHE='stats2pitch-shell-v5.15.0'

self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()))
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys()
  await Promise.all(keys.map(k=>caches.delete(k)))
  await self.registration.unregister()
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  await Promise.all(clients.map(c=>c.navigate(c.url).catch(()=>{})))
})()))
