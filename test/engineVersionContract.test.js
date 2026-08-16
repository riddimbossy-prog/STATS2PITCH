import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ENGINE_VERSION} from '../server/config.js'

test('live Edge API accepts the same engine version written by the board worker',()=>{
  const edge=readFileSync(new URL('../supabase/functions/stats2pitch-api/index.ts',import.meta.url),'utf8')
  const match=edge.match(/const ENGINE_VERSION='([^']+)'/)
  assert.ok(match,'Edge API must declare its engine version')
  assert.equal(match[1],ENGINE_VERSION,'Edge API and board worker engine versions must stay in sync or live boards are rejected as empty')
})
