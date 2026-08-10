import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`boot surface regression: ${message}`)}

const bootstrap=read('public/bootstrap-shell-v1.12.3.js')
const runtime=read('public/board-runtime-v1.11.6.js')
const index=read('public/index.html')
const supabase=read('server/supabaseAdmin.js')

assert(bootstrap.includes("host.id='s2p-card-board'"),'bootstrap must create the modern board host before network completion')
assert(bootstrap.includes("host.dataset.s2pState='loading'"),'bootstrap host must start in an explicit loading state')
assert(bootstrap.includes("new Event('s2p:tabchange')"),'bootstrap must explicitly kick the board runtime')
assert(runtime.includes("window.addEventListener('s2p:tabchange'"),'board runtime must listen for the bootstrap kick')
assert(!index.includes('splash-animation.v1.5.1.js'),'the retired second root-level splash runtime must stay removed')
assert(index.indexOf('bootstrap-shell-v1.12.3.js')<index.indexOf('board-runtime-v1.11.6.js'),'bootstrap surface must load before the board runtime')
assert(supabase.includes("fetchWithPolicy"),'Supabase reads must use the bounded fetch policy')
assert(supabase.includes('retries:0'),'startup Supabase reads must not stack retry windows')

console.log('boot surface regression checks passed')
