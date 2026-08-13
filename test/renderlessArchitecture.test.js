import test from 'node:test'
import assert from 'node:assert/strict'
import {access,readFile} from 'node:fs/promises'

const url=path=>new URL(`../${path}`,import.meta.url)
const read=path=>readFile(url(path),'utf8')
const exists=path=>access(url(path)).then(()=>true,()=>false)

test('GitHub plus Supabase production path is complete without Render',async()=>{
  const [pkg,html,core,pages,refresh,edge,cname,renderExists]=await Promise.all([
    read('package.json'),read('public/index.html'),read('public/core.js'),
    read('.github/workflows/pages.yml'),read('.github/workflows/refresh-board.yml'),
    read('supabase/functions/stats2pitch-api/index.ts'),read('public/CNAME'),exists('render.yaml')
  ])
  assert.equal(renderExists,false)
  assert.match(pkg,/scripts\/refreshBoards\.js/)
  assert.doesNotMatch(pkg,/"start"\s*:\s*"node server\/index\.js"/)
  assert.match(html,/runtime-config\.js/)
  assert.match(core,/functions\/v1\/\$\{fn\}/)
  assert.doesNotMatch(core,/apiMode==='legacy'/)
  assert.doesNotMatch(core,/fetch\('\/api\/config'/)
  assert.match(pages,/actions\/deploy-pages@v4/)
  assert.match(pages,/SUPABASE_ANON_KEY/)
  assert.match(refresh,/scripts\/refreshBoards\.js/)
  assert.match(refresh,/schedule:/)
  assert.match(edge,/Deno\.serve/)
  assert.match(edge,/\/live-scores/)
  assert.match(edge,/prediction_snapshots/)
  assert.equal(cname.trim(),'www.stats2pitch.com')
})
