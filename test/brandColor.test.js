import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8')
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8')

test('Stats2Pitch 2 uses the sampled lemon green from the supplied logo',()=>{
  assert.match(css,/\.logo span\{color:#7ac81e\}/)
  assert.doesNotMatch(html,/\.brand \.logo span\{color:/)
})
