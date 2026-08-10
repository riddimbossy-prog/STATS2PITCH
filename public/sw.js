/* Stats2Pitch v1.11.6 — network-only cleanup service worker. */
const BUILD='1.11.6'

async function purge(){
  const keys=await caches.keys()
  await Promise.all(keys.map(key=>caches.delete(key)))
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{await purge();await self.skipWaiting()})())
})

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await purge()
    await self.clients.claim()
  })())
})

self.addEventListener('message',event=>{
  if(event.data==='PURGE_S2P_CACHES')event.waitUntil(purge())
})

self.addEventListener('fetch',event=>{
  const request=event.request
  const url=new URL(request.url)
  if(url.origin!==self.location.origin)return
  if(request.mode==='navigate'||['script','style','document','manifest'].includes(request.destination)){
    event.respondWith(fetch(request,{cache:'no-store'}))
  }
})
