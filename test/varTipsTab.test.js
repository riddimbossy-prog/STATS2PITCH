import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('VAR Tips is a dedicated public tab with no method copy',async()=>{
  const [html,js,css,index,results,filter,sw,manifest]=await Promise.all([
    read('public/var-tips.html'),
    read('public/varTips.js'),
    read('public/varTips.css'),
    read('public/index.html'),
    read('public/results.html'),
    read('public/filter-tips.html'),
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
  for(const page of [index,results,html,filter]){
    assert.match(page,/href="\/var-tips\.html"/)
    assert.match(page,/href="\/filter-tips\.html"/)
    assert.match(page,/>All Picks</)
    assert.match(page,/>Filter Tips</)
    assert.match(page,/>VAR Tips</)
    assert.match(page,/>Results</)
    assert.doesNotMatch(page,/bankers\.html/)
    assert.doesNotMatch(page,/>Bankers</)
  }
  assert.match(sw,/\/var-tips\.html/)
  assert.match(sw,/\/filter-tips\.html/)
  assert.match(sw,/varTips\.js/)
  assert.match(sw,/filterTips\.js/)
  assert.doesNotMatch(sw,/bankers\.html/)
  assert.doesNotMatch(sw,/bankerRules\.js/)
  assert.match(manifest,/"url":"\/var-tips\.html"/)
  assert.match(manifest,/"url":"\/filter-tips\.html"/)
  assert.doesNotMatch(manifest,/bankers\.html/)
})

test('Filter Tips is a dedicated public tab',async()=>{
  const [html,js,css]=await Promise.all([
    read('public/filter-tips.html'),
    read('public/filterTips.js'),
    read('public/filterTips.css')
  ])
  assert.match(html,/data-view="filter-tips"/)
  assert.match(html,/filterTips\.js/)
  assert.match(js,/board\.filterTips/)
  assert.match(js,/REQUIRED_ENGINE='sporty-filter-v1'/)
  assert.match(css,/\.filter-intro/)
  assert.doesNotMatch(html,/1\.20|1\.55|GG 2\+|trade secret/i)
})

test('All Picks no longer brand the VAR engine on the public pages',async()=>{
  const [index,app]=await Promise.all([
    read('public/index.html'),
    read('public/appCrests.js')
  ])
  assert.doesNotMatch(index,/Away-Fav/)
  assert.doesNotMatch(app,/Away-Fav Streak/)
  assert.doesNotMatch(app,/bankers\.html/)
})
