import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('empty prediction board uses the full supplied fox video',async()=>{
  const [html,view,css]=await Promise.all([read('public/index.html'),read('public/boardView.js'),read('public/noTips.css')])
  assert.match(html,/\/noTips\.css\?v=2\.2\.\d+/)
  assert.match(view,/s2p-no-tips-video/)
  assert.match(view,/fox-kicking-ball\.mp4/)
  assert.match(view,/autoplay loop muted playsinline/)
  assert.match(view,/rawHasQualified/)
  assert.match(view,/No picks match the current filters/)
  assert.doesNotMatch(view,/s2p-no-tips-fox/)
  assert.doesNotMatch(view,/football-real\.svg/)
  assert.doesNotMatch(view,/brand-mark\.png/)
  assert.match(css,/\.s2p-no-tips-video/)
  assert.match(css,/width:100%/)
  assert.match(css,/height:auto/)
  assert.match(css,/object-fit:contain/)
  assert.doesNotMatch(css,/@keyframes/)
  assert.doesNotMatch(css,/transform:/)
  await access(new URL('../public/assets/fox-kicking-ball.mp4',import.meta.url))
})
