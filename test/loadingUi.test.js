import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('fox video owns page boot and refresh states',async()=>{
  const [html,view,css]=await Promise.all([read('public/index.html'),read('public/boardView.js'),read('public/styles.css')])
  assert.match(html,/stats2pitch-build" content="2\.2\.\d+"/)
  assert.match(html,/s2p-loader--page/)
  assert.match(html,/fox-kicking-ball\.mp4\?v=2\.2\.\d+/)
  assert.match(html,/autoplay loop muted playsinline/)
  assert.doesNotMatch(html,/football-real\.svg/)
  assert.doesNotMatch(html,/Loading <b>matches/)
  assert.match(html,/\/runtime-config\.js\?v=2\.2\.\d+/)
  assert.match(view,/loadingMarkup\('refresh'\)/)
  assert.match(view,/s2p-loader--\$\{esc\(kind\)\}/)
  assert.match(view,/fox-kicking-ball\.mp4/)
  assert.doesNotMatch(view,/football-real\.svg/)
  assert.doesNotMatch(view,/brand-mark\.png/)
  assert.doesNotMatch(view,/mature fixtures checked/i)
  assert.doesNotMatch(view,/Refreshing real data/i)
  assert.doesNotMatch(css,/@keyframes s2pBallTravel/)
  assert.doesNotMatch(css,/@keyframes s2pBallSpin/)
  assert.match(css,/\.s2p-loader-video/)
  assert.match(css,/object-fit:contain/)
  assert.match(css,/\.s2p-loader--refresh/)
  await access(new URL('../public/assets/fox-kicking-ball.mp4',import.meta.url))
})
