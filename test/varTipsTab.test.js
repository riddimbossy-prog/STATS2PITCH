import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('VAR Tips is a dedicated public tab with no method copy',async()=>{
  const [html,js,css,index,bankers,results,sw,manifest]=await Promise.all([
    read('public/var-tips.html'),
    read('public/varTips.js'),
    read('public/varTips.css'),
    read('public/index.html'),
    read('public/bankers.html'),
    read('public/results.html'),
    read('public/sw.js'),
    read('public/manifest.webmanifest')
  ])
  assert.match(html,/VAR Tips/)
  assert.match(html,/data-view="var-tips"/)
  assert.match(html,/varTips\.js/)
  assert.match(js,/board\.varTips/)
  assert.match(js,/REQUIRED_ENGINE='away-fav-streak-v1'/)
  assert.doesNotMatch(html,/Away-Fav|Goals Streak|first-match|trade secret|over 0\.5|1\.10/i)
  assert.doesNotMatch(js,/Goals Streak|first-match|streak window|fav is home/i)
  assert.match(css,/\.var-intro/)
  for(const page of [index,bankers,results,html]){
    assert.match(page,/href="\/var-tips\.html"/)
    assert.match(page,/>All Picks</)
    assert.match(page,/>VAR Tips</)
    assert.match(page,/>Bankers</)
    assert.match(page,/>Results</)
  }
  assert.match(sw,/\/var-tips\.html/)
  assert.match(sw,/varTips\.js/)
  assert.match(manifest,/"url":"\/var-tips\.html"/)
})

test('All Picks and Bankers no longer brand the VAR engine on the public pages',async()=>{
  const [index,bankers,app]=await Promise.all([
    read('public/index.html'),
    read('public/bankers.html'),
    read('public/appCrests.js')
  ])
  assert.doesNotMatch(index,/Away-Fav/)
  assert.doesNotMatch(bankers,/Away-Fav Streak/)
  assert.doesNotMatch(app,/Away-Fav Streak/)
})
