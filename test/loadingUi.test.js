import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const app=await readFile(new URL('../public/appCrests.js',import.meta.url),'utf8')
const pwa=await readFile(new URL('../public/pwa.js',import.meta.url),'utf8')
const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8')

test('v4 uses skeleton loading and installable PWA shell',async()=>{
  assert.match(app,/class=\\?"card skeleton/)
  assert.match(app,/setInterval\(async\(\)=>/)
  assert.match(pwa,/beforeinstallprompt/)
  assert.match(pwa,/serviceWorker\.register/)
  assert.match(sw,/stats2pitch-shell-v4/)
  await access(new URL('../public/offline.html',import.meta.url))
})
