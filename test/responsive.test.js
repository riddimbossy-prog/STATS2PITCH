import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const css=fs.readFileSync(new URL('../public/product.css',import.meta.url),'utf8')
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8')

test('v4 stylesheet is loaded last and mobile bottom nav exists',()=>{
  assert.match(html,/tabVisibility\.css\?v=4\.0\.\d+[\s\S]*product\.css\?v=4\.0\.\d+/)
  assert.match(html,/class="mobile-nav"/)
})
test('folded and unfolded layouts have explicit breakpoints',()=>{
  assert.match(css,/@media \(min-width:621px\) and \(max-width:900px\)/)
  assert.match(css,/@media \(max-width:390px\)/)
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/)
})
test('filters collapse cleanly on smaller screens',()=>{
  assert.match(css,/@media\(max-width:850px\)/)
  assert.match(css,/\.filters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/)
  assert.match(css,/@media\(max-width:620px\)/)
  assert.match(css,/\.filters\{grid-template-columns:1fr!important\}/)
})
