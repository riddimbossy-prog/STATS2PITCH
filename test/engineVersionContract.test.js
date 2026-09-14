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

test('live Edge API strips H2H engine internals from the public board',()=>{
  const edge=readFileSync(new URL('../supabase/functions/stats2pitch-api/index.ts',import.meta.url),'utf8')
  assert.match(edge,/function publicH2HWhy/)
  assert.match(edge,/function publicH2HPick/)
  assert.match(edge,/published head-to-head pick/)
  assert.match(edge,/publicH2HPick\(\{\.\.\.p,rank:i\+1\}\)\)/)
  assert.match(edge,/empty\.h2hMeta=\{count:empty\.h2hPicks\.length\}/)
  assert.match(edge,/delete empty\.meta\.h2hEngine/)
  assert.doesNotMatch(edge,/h2hEngine:meta\.h2hEngine/)
  const keep=edge.match(/const PICK_KEEP=new Set\(\[([^\]]+)\]\)/)
  assert.ok(keep,'Edge API must declare PICK_KEEP')
  assert.doesNotMatch(keep[1],/occurrence|h2hHits|h2hMatches|formRate|formHits|formMatches/)
})
