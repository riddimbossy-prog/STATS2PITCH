import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css=fs.readFileSync(new URL('../public/responsive.css',import.meta.url),'utf8')
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8')

test('responsive layer is loaded last with a fresh build version',()=>{
  assert.match(html,/stats2pitch-build" content="2\.2\.16"/)
  assert.match(html,/weekBoard\.css\?v=2\.2\.14[\s\S]*responsive\.css\?v=2\.2\.16/)
})

test('board rail and full stadium background stay centred',()=>{
  assert.match(css,/margin-left:auto!important/)
  assert.match(css,/margin-right:auto!important/)
  assert.match(css,/body\.board-page::before\{[\s\S]*stadium-user-bg-v2\.webp/)
  assert.match(css,/background-position:center center!important/)
  assert.match(css,/body\.board-page #app,[\s\S]*background:transparent!important/)
  assert.match(css,/overflow-x:clip/)
})

test('Galaxy Z Fold folded and unfolded breakpoints are explicit',()=>{
  assert.match(css,/@media \(min-width:681px\) and \(max-width:900px\)/)
  assert.match(css,/@media \(max-width:390px\)/)
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/)
})

test('mobile match contents are actually centred inside cards',()=>{
  assert.match(css,/\.competition\{gap:9px;justify-content:center;text-align:center\}/)
  assert.match(css,/\.teams\{gap:7px;justify-items:center;align-items:center\}/)
  assert.match(css,/\.team\{font-size:14px;gap:8px;justify-content:center;text-align:center;width:100%\}/)
  assert.match(css,/\.prediction,\.shell\.dashboard-stadium \.kick\{text-align:center!important\}/)
  assert.match(css,/\.score\{text-align:center!important;font-size:22px\}/)
})

test('mobile cards and labels cannot overflow the viewport',()=>{
  assert.match(css,/\.shell\.dashboard-stadium \.card\{width:100%;max-width:100%;min-width:0/)
  assert.match(css,/overflow-wrap:anywhere/)
  assert.match(css,/\.details\{max-width:100%\}/)
})
