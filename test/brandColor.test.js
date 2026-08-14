import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const css=await readFile(new URL('../public/product.css',import.meta.url),'utf8')
const palette=await readFile(new URL('../public/noPink.css',import.meta.url),'utf8')

test('v4 uses the mint/emerald palette and supplied Stats2Pitch logo',async()=>{
  assert.match(css,/--mint:#93ffd0/)
  assert.match(css,/--deep:#064d3e/)
  assert.match(palette,/--accent:#b6ffe1/)
  await access(new URL('../public/assets/stats2pitch-logo.png',import.meta.url))
  await access(new URL('../public/assets/stats2pitch-favicon.png',import.meta.url))
})
