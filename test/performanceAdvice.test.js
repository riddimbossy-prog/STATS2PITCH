import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {classifyGroup,adviceFor} from '../public/performanceAdvice.js'

test('banks high-rate volume and ignores tiny samples',()=>{
  assert.equal(classifyGroup({picks:209,winRate:71.8}),'bank')
  assert.equal(classifyGroup({picks:58,winRate:79.3}),'bank')
  assert.equal(classifyGroup({picks:31,winRate:80.6}),'bank')
  assert.equal(classifyGroup({picks:22,winRate:77.3}),'bank')
  assert.equal(classifyGroup({picks:185,winRate:74.6}),'bank')
  assert.equal(classifyGroup({picks:73,winRate:95.9}),'bank')
  assert.equal(classifyGroup({picks:181,winRate:65.7}),'steady')
  assert.equal(classifyGroup({picks:132,winRate:67.4}),'steady')
  assert.equal(classifyGroup({picks:13,winRate:61.5}),'watch')
  assert.equal(classifyGroup({picks:48,winRate:50}),'avoid')
  assert.equal(classifyGroup({picks:30,winRate:53.3}),'avoid')
  assert.equal(classifyGroup({picks:3,winRate:33.3}),'thin')
  assert.equal(classifyGroup({picks:2,winRate:100}),'thin')
  assert.equal(classifyGroup({picks:4,winRate:75}),'thin')
  assert.equal(classifyGroup({picks:6,winRate:66.7}),'thin')
  assert.equal(classifyGroup({picks:9,winRate:55.6}),'thin')
})

test('advice splits bank and avoid and ranks thin last',()=>{
  const out=adviceFor([
    {dimension:'market',value:'match-winner',picks:48,won:24,lost:24,winRate:50},
    {dimension:'market',value:'double-chance',picks:73,won:70,lost:3,winRate:95.9},
    {dimension:'market',value:'both-teams-score',picks:30,won:16,lost:14,winRate:53.3},
    {dimension:'market',value:'first-half-goals',picks:4,won:3,lost:1,winRate:75}
  ])
  assert.deepEqual(out.bank.map(x=>x.value),['double-chance'])
  assert.deepEqual(out.avoid.map(x=>x.value),['match-winner','both-teams-score'])
  assert.equal(out.rows.at(-1).value,'first-half-goals')
  assert.equal(out.rows[0].tone,'bank')
})

test('Results page renders advice boards instead of a raw table',async()=>{
  const [html,js,css]=await Promise.all([
    readFile(new URL('../public/results.html',import.meta.url),'utf8'),
    readFile(new URL('../public/appCrests.js',import.meta.url),'utf8'),
    readFile(new URL('../public/conceptD.css',import.meta.url),'utf8')
  ])
  assert.match(html,/id="performanceAdvice"/)
  assert.match(html,/performanceAdvice\.js/)
  assert.match(js,/adviceFor/)
  assert.match(js,/perf-callout/)
  assert.match(js,/Bank on/)
  assert.match(js,/Avoid/)
  assert.doesNotMatch(js,/perf-head/)
  assert.match(css,/\.perf-meter/)
  assert.match(css,/\.perf-callout/)
  assert.doesNotMatch(html,/Goals Streak|first-match|1\.10|trade secret/i)
  assert.doesNotMatch(js,/Goals Streak|first-match|streak window/i)
})
