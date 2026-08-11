import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`v1.13.1 interaction regression: ${message}`)}

const index=read('public/index.html')
const fix=read('public/interaction-fix-v1.13.1.js')
const cacheReset=read('public/cache-reset-v1.11.7.js')

assert(/dataset\.s2pUiBuild='1\.13\.\d+'/.test(index),'index must expose a current 1.13.x UI build')
assert(index.includes('interaction-fix-v1.13.1.css'),'interaction stylesheet must stay loaded')
assert(index.includes('interaction-fix-v1.13.1.js'),'interaction runtime must stay loaded')
assert(index.indexOf('interaction-fix-v1.13.1.js')>index.indexOf('live-scores-v1.11.3.js'),'interaction runtime must load after the board/live renderers')
assert(fix.includes("closest?.('#s2p-card-board [data-detail-key]')"),'modern View details clicks must be captured directly')
assert(fix.includes('proxy.dataset.rowKey=key'),'details must bridge to the rich modal without a hidden legacy source row')
assert(fix.includes("name==='board'"),'Board navigation must be owned')
assert(fix.includes("name==='saved'"),'My Picks navigation must be owned')
assert(fix.includes("name==='stats'"),'Stats navigation must be owned')
assert(fix.includes("name==='alerts'"),'Alerts navigation must be owned')
assert(fix.includes("name==='profile'"),'Profile navigation must be owned')
assert(fix.includes('Save to My Picks'),'details modal must expose saved-pick control')
assert(/const BUILD='1\.13\.\d+'/.test(cacheReset),'cache reset must track the current 1.13.x interaction build')

console.log('v1.13.1 interaction regression checks passed')
