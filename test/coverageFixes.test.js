import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {normalizeSupabaseUrl} from '../server/store.js'
import {needsOddsFallback} from '../server/refresh.js'

test('Supabase worker accepts project ref, host, or full URL',()=>{
  assert.equal(normalizeSupabaseUrl('abcdefghijklmnopqrst'),'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(normalizeSupabaseUrl('demo.supabase.co'),'https://demo.supabase.co')
  assert.equal(normalizeSupabaseUrl('https://demo.supabase.co/'),'https://demo.supabase.co')
})

test('odds fallback runs when any engine market is missing, not only when all odds are absent',()=>{
  const complete={canonical:{home:1.8,draw:3.4,away:4.2,over15:1.2,under15:4.1,over25:1.75,under25:2.05,over35:2.8,under35:1.42,bttsYes:1.7}}
  assert.equal(needsOddsFallback(complete),false)
  const missingOne=structuredClone(complete);missingOne.canonical.over25=null
  assert.equal(needsOddsFallback(missingOne),true)
  assert.equal(needsOddsFallback({canonical:{home:1.8,draw:3.4,away:4.2}}),true)
})

test('scheduled refresh defaults to unlimited fixture coverage',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/refresh-board.yml',import.meta.url),'utf8')
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8')
  assert.match(workflow,/MAX_FIXTURES_PER_REFRESH: \$\{\{ vars\.MAX_FIXTURES_PER_REFRESH \|\| '0' \}\}/)
  assert.match(env,/MAX_FIXTURES_PER_REFRESH=0/)
})
