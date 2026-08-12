import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('empty prediction board uses the animated Stats2Pitch fox state',async()=>{
  const [html,view,css]=await Promise.all([read('public/index.html'),read('public/boardView.js'),read('public/noTips.css')])
  assert.match(html,/\/noTips\.css\?v=2\.2\.0/)
  assert.match(view,/NO TIPS/)
  assert.match(view,/FOR \$\{dayLabel\}/)
  assert.match(view,/SAFE SKIP/)
  assert.match(view,/localToday/)
  assert.match(view,/\/assets\/brand-mark\.png\?v=2\.0\.1/)
  assert.match(view,/\/assets\/football-real\.svg\?v=2\.0\.1/)
  assert.match(view,/rawHasQualified/)
  assert.match(view,/No picks match the current filters/)
  assert.match(css,/\.s2p-no-tips-fox/)
  assert.match(css,/@keyframes s2pFoxKick/)
  assert.match(css,/@keyframes s2pFoxBall/)
  assert.match(css,/prefers-reduced-motion:reduce/)
})
