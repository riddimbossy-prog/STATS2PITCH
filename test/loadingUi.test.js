import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('football and pitch loader owns page boot and refresh states',async()=>{
  const [html,view,css]=await Promise.all([read('public/index.html'),read('public/boardView.js'),read('public/styles.css')])
  assert.match(html,/stats2pitch-build" content="2\.2\.\d+"/)
  assert.match(html,/s2p-loader--page/)
  assert.match(html,/\/assets\/football-real\.svg\?v=2\.2\.\d+/)
  assert.match(html,/\/assets\/brand-mark\.png\?v=2\.2\.\d+/)
  assert.match(html,/Loading <b>matches\.\.\.<\/b>/)
  assert.match(html,/\/runtime-config\.js\?v=2\.2\.\d+/)
  assert.match(view,/loadingMarkup\('refresh'\)/)
  assert.match(view,/s2p-loader--\$\{esc\(kind\)\}/)
  assert.match(view,/\/assets\/football-real\.svg\?v=2\.0\.1/)
  assert.match(view,/\/assets\/brand-mark\.png\?v=2\.0\.1/)
  assert.doesNotMatch(view,/mature fixtures checked/i)
  assert.doesNotMatch(view,/Refreshing real data/i)
  assert.match(css,/@keyframes s2pBallTravel/)
  assert.match(css,/\.s2p-loader--refresh/)
  await access(new URL('../public/assets/football-real.svg',import.meta.url))
  await access(new URL('../public/assets/brand-mark.png',import.meta.url))
})
