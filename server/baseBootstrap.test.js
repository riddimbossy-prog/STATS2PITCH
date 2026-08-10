import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`base bootstrap regression: ${message}`)}

const resilience=read('public/boot-resilience-v1.12.1.js')
const bootstrap=read('public/bootstrap-shell-v1.12.3.js')
const runtime=read('public/board-runtime-v1.11.6.js')

assert(resilience.includes("const isBootstrapBoard=url?.pathname==='/api/board'&&!document.querySelector('.app-shell')"),'first legacy board request must be detected before the shell exists')
assert(resilience.includes('beginRealRead(input,init,key).catch(()=>{})'),'real board read must continue in the background')
assert(resilience.includes('return bootResponse(boardDate(url))'),'legacy bootstrap must receive an immediate shell board')
assert(bootstrap.includes("host.id='s2p-card-board'"),'modern board host must still be created immediately')
assert(runtime.includes("window.addEventListener('s2p:tabchange'"),'modern runtime must still accept explicit bootstrap kicks')

console.log('base bootstrap regression checks passed')
