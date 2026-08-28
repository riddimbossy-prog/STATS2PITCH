import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')
const app=await read('public/appCrests.js')
const pwa=await read('public/pwa.js')
const sw=await read('public/sw.js')
const net=await read('public/net.js')
const css=await read('public/conceptD.css')

test('v4 uses skeleton loading and installable PWA shell',async()=>{
  assert.match(app,/class=\\?"card skeleton/)
  assert.match(app,/setInterval\(async\(\)=>/)
  assert.match(pwa,/beforeinstallprompt/)
  assert.match(pwa,/serviceWorker\.register/)
  assert.match(sw,/stats2pitch-shell-v5/)
  await access(new URL('../public/offline.html',import.meta.url))
})

test('boot animation covers every public board until picks are ready',async()=>{
  const pages=await Promise.all(['public/index.html','public/filter-tips.html','public/var-tips.html','public/goals-bankers.html','public/results.html'].map(read))
  for(const html of pages){
    assert.match(html,/class="s2p-booting"/)
    assert.match(html,/id="boot"/)
    assert.match(html,/s2p-boot\.mp4/)
    assert.match(html,/s2pBootDone/)
    assert.match(html,/autoplay muted loop/)
  }
  for(const src of [app, await read('public/filterTips.js'), await read('public/varTips.js'), await read('public/goalsBankers.js')]){
    assert.match(src,/bootDone/)
  }
  assert.match(net,/export function bootDone/)
  assert.match(css,/\.s2p-boot/)
  assert.match(css,/s2p-boot-video/)
  await access(new URL('../public/assets/s2p-boot.mp4',import.meta.url))
  await access(new URL('../public/assets/s2p-boot.jpg',import.meta.url))
})
