import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('GitHub plus Supabase production path is complete before Render cutover',async()=>{
  const [pkg,render,html,core,pages,refresh,edge,cname]=await Promise.all([
    read('package.json'),read('render.yaml'),read('public/index.html'),read('public/core.js'),
    read('.github/workflows/pages.yml'),read('.github/workflows/refresh-board.yml'),
    read('supabase/functions/stats2pitch-api/index.ts'),read('public/CNAME')
  ])
  assert.match(pkg,/scripts\/refreshBoards\.js/)
  assert.match(render,/LEGACY CUTOVER FALLBACK ONLY/)
  assert.match(html,/runtime-config\.js/)
  assert.match(core,/functions\/v1\/\$\{fn\}/)
  assert.doesNotMatch(core,/fetch\('\/api\/config'/)
  assert.match(pages,/actions\/deploy-pages@v4/)
  assert.match(pages,/SUPABASE_ANON_KEY/)
  assert.match(refresh,/scripts\/refreshBoards\.js/)
  assert.match(refresh,/schedule:/)
  assert.match(edge,/Deno\.serve/)
  assert.match(edge,/\/live-scores/)
  assert.match(edge,/prediction_snapshots/)
  assert.equal(cname.trim(),'stats2pitch.com')
})
