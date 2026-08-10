import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`v1.13 boot regression: ${message}`)}

const index=read('public/index.html')
const resilience=read('public/boot-resilience-v1.13.0.js')
const surface=read('public/board-loading-surface-v1.13.0.js')
const runtime=read('public/board-runtime-v1.11.6.js')
const cacheReset=read('public/cache-reset-v1.11.7.js')

assert(index.includes("dataset.s2pUiBuild='1.13.0'"),'index must expose UI build 1.13.0')
assert(index.includes('boot-resilience-v1.13.0.js'),'new deterministic bootstrap must be loaded')
assert(!index.includes('bootstrap-shell-v1.12.3.js'),'competing shell watchdog must stay out of production startup')
assert(index.includes('board-loading-surface-v1.13.0.js'),'visible loading surface must be loaded')
assert(resilience.includes("bootstrapBoardIssued=false"),'bootstrap board gate must be one-time')
assert(resilience.includes("url?.pathname==='/api/board'&&!bootstrapBoardIssued"),'first board request must never depend on DOM timing')
assert(resilience.includes('beginRealRead(input,init,key).catch(()=>{})'),'real board read must continue behind the immediate shell response')
assert(surface.includes("section.id='s2p-card-board'"),'loading surface must create the modern board host')
assert(surface.includes("section.dataset.s2pState='loading'"),'loading surface must advertise explicit loading state')
assert(surface.includes("window.dispatchEvent(new Event('s2p:tabchange'))"),'loading surface must wake the production runtime')
assert(runtime.includes("window.addEventListener('s2p:tabchange'"),'production runtime must accept the wake event')
assert(cacheReset.includes("const BUILD='1.13.0'"),'cache reset must run once for the new build')

console.log('v1.13 deterministic boot regression checks passed')
