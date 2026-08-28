import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const css=await readFile(new URL('../public/product.css',import.meta.url),'utf8')
const palette=await readFile(new URL('../public/noPink.css',import.meta.url),'utf8')
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('v4 uses the mint/emerald palette and supplied Stats2Pitch logo',async()=>{
  assert.match(css,/--mint:#93ffd0/)
  assert.match(css,/--deep:#064d3e/)
  assert.match(palette,/--accent:#b6ffe1/)
  await access(new URL('../public/assets/stats2pitch-logo.png',import.meta.url))
  await access(new URL('../public/assets/stats2pitch-favicon.png',import.meta.url))
})

test('header and app icon use the pitch mark instead of S2',async()=>{
  await access(new URL('../public/assets/s2p-pitch-mark.svg',import.meta.url))
  await access(new URL('../public/assets/stats2pitch-favicon-v3.png',import.meta.url))
  const pages=await Promise.all(['public/index.html','public/filter-tips.html','public/var-tips.html','public/goals-bankers.html','public/results.html'].map(read))
  for(const html of pages){
    assert.match(html,/s2p-pitch-mark\.svg/)
    assert.match(html,/class="brand-mark"/)
    assert.doesNotMatch(html,/>S2</)
  }
  const sw=await read('public/sw.js')
  const manifest=await read('public/manifest.webmanifest')
  assert.match(sw,/s2p-pitch-mark\.svg/)
  assert.match(manifest,/stats2pitch-favicon-v3\.png/)
})
