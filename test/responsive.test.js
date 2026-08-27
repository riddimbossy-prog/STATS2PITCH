import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const css=fs.readFileSync(new URL('../public/conceptC.css',import.meta.url),'utf8')
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8')

test('Concept D stylesheet is active and mobile bottom nav exists',()=>{
  assert.match(html,/conceptD\.css\?v=5\.3\.0/)

  assert.doesNotMatch(html,/product\.css/)
  assert.match(html,/class="mobile-nav"/)
  assert.match(html,/var-tips\.html/)
})
test('Concept C has tablet, phone and foldable breakpoints',()=>{
  assert.match(css,/@media\(max-width:800px\)/)
  assert.match(css,/@media\(max-width:620px\)/)
  assert.match(css,/@media\(max-width:390px\)/)
  assert.match(css,/#cards\{grid-template-columns:1fr\}/)
})
test('filters reflow cleanly on smaller screens',()=>{
  assert.match(css,/\.toolbar\.filters\{display:grid;grid-template-columns:1fr 1fr;width:100%\}/)
  assert.match(css,/#status\{grid-column:1\/-1;text-align:center\}/)
})
