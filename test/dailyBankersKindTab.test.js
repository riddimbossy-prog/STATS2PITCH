import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('Daily Bankers uses Safest / Value tabs instead of a kind dropdown',async()=>{
  const [html,js,css]=await Promise.all([
    read('public/daily-bankers.html'),
    read('public/dailyBankers.js'),
    read('public/dailyBankers.css')
  ])
  assert.match(html,/id="kindTabs"/)
  assert.match(html,/data-kind="safest"/)
  assert.match(html,/data-kind="value"/)
  assert.match(html,/data-kind="all"/)
  assert.doesNotMatch(html,/id="kindFilter"/)
  assert.match(js,/renderKindTabs/)
  assert.match(js,/\$\('#kindTabs'\)/)
  assert.doesNotMatch(js,/kindFilter/)
  assert.match(css,/\.kind-tabs/)
  assert.match(css,/\.kind-tab\.active\[data-kind="safest"\]/)
  assert.match(css,/\.kind-tab\.active\[data-kind="value"\]/)
})
