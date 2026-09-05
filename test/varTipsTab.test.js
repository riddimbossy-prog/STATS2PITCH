import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('VAR Tips is a dedicated public tab with no method copy',async()=>{
  const [html,js,css,index,results,filter,goals,sw,manifest]=await Promise.all([
    read('public/var-tips.html'),
    read('public/varTips.js'),
    read('public/varTips.css'),
    read('public/index.html'),
    read('public/results.html'),
    read('public/filter-tips.html'),
    read('public/goals-bankers.html'),
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
  for(const page of [index,results,html,filter,goals]){
    assert.match(page,/href="\/var-tips\.html"/)
    assert.match(page,/href="\/filter-tips\.html"/)
    assert.match(page,/href="\/goals-bankers\.html"/)
    assert.match(page,/>All Picks</)
    assert.match(page,/>Filter Tips</)
    assert.match(page,/>VAR Tips</)
    assert.match(page,/>Goals Bankers</)
    assert.match(page,/>Daily Bankers</)
    assert.match(page,/>Results</)
    assert.match(page,/href="\/daily-bankers\.html"/)
    assert.doesNotMatch(page,/href="\/bankers\.html"/)
  }
  assert.match(sw,/registration\.unregister/)
  assert.doesNotMatch(sw,/addEventListener\('fetch'/)
  assert.match(manifest,/"url":"\/var-tips\.html"/)
  assert.match(manifest,/"url":"\/filter-tips\.html"/)
  assert.match(manifest,/"url":"\/goals-bankers\.html"/)
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
  assert.match(js,/REQUIRED_ENGINES=new Set\(\['sporty-filter-v1','sporty-filter-v2','perfect-split-v1'\]\)/)
  assert.match(js,/board\.filterTips\.length>0/)
  assert.match(css,/\.filter-intro/)
  assert.doesNotMatch(html,/1\.20|1\.55|GG 2\+|trade secret/i)
})

test('Goals Bankers is a dedicated public tab with slip rules and no method copy',async()=>{
  const [html,js,css]=await Promise.all([
    read('public/goals-bankers.html'),
    read('public/goalsBankers.js'),
    read('public/goalsBankers.css')
  ])
  assert.match(html,/data-view="goals-bankers"/)
  assert.match(html,/goalsBankers\.js/)
  assert.match(html,/id="goalsHeroCount"/)
  assert.match(html,/id="goalsMarkets"/)
  assert.match(html,/Add up to three legs/)
  assert.match(html,/v3-badge/)
  assert.match(html,/Goals Bankers/)
  assert.match(js,/board\.goalsBankers/)
  assert.match(js,/REQUIRED_ENGINES=new Set\(\['goals-bankers-v5\.1','goals-bankers-v5\.2','goals-bankers-v5\.3'\]\)/)
  assert.match(js,/canAddAccaLeg/)
  assert.match(js,/max-1-result/)
  assert.match(js,/need-goals-leg/)
  assert.match(js,/MARKET_CHIPS/)
  assert.match(js,/data-route/)
  assert.match(js,/goalsHeroCount/)
  assert.match(css,/\.goals-hero/)
  assert.match(css,/\.goals-markets/)
  assert.match(css,/\.goals-market/)
  assert.match(css,/\.acca-slip/)
  assert.doesNotMatch(html,/Goals Streak|first-match|1\.10|1\.40|trade secret/i)
  assert.doesNotMatch(js,/Goals Streak|first-match|streak window|streak_yes|1\.10|1\.40/i)
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

test('Filter, VAR and Goals mobile cards do not yank the page or overlay crests',async()=>{
  const [filterJs,varJs,goalsJs,app,css,concept,pwa]=await Promise.all([
    read('public/filterTips.js'),
    read('public/varTips.js'),
    read('public/goalsBankers.js'),
    read('public/appCrests.js'),
    read('public/mobile2026.css'),
    read('public/conceptD.css'),
    read('public/pwa.js')
  ])
  for(const src of [filterJs,varJs,goalsJs,app]){
    assert.match(src,/scrollDateStrip/)
    assert.doesNotMatch(src,/scrollIntoView/)
    assert.match(src,/m-card-top/)
    assert.match(src,/odd-stack/)
    assert.match(src,/s!=='live'&&s!=='settled'/)
    assert.match(src,/match-mid/)
    assert.match(src,/crest-matchup/)
    assert.match(src,/padStart\(2,'0'\)/)
  }
  assert.match(css,/html\.is-scrolling \.mobile-nav/)
  assert.match(css,/\.filter-badge/)
  assert.match(css,/\.var-badge/)
  assert.match(css,/\.m-board-tag/)
  assert.match(css,/border-radius:\s*999px/)
  assert.match(concept,/--peanut/)
  assert.match(concept,/preserveAspectRatio/)
  assert.match(concept,/mask:/)
  assert.match(pwa,/is-scrolling/)
  assert.match(pwa,/mobile-nav/)
})
