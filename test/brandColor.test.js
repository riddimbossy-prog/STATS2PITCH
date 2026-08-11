import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8')

test('header Stats2Pitch 2 stays lemon green',()=>{
  assert.match(html,/\.brand \.logo span\{color:#98ff00\}/)
})
