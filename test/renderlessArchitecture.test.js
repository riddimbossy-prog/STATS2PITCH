import test from 'node:test'
import assert from 'node:assert/strict'
import {access,readFile} from 'node:fs/promises'
const url=p=>new URL(`../${p}`,import.meta.url),read=p=>readFile(url(p),'utf8'),exists=p=>access(url(p)).then(()=>true,()=>false)

test('GitHub Pages plus Supabase production path includes results, admin and settlement',async()=>{
  const [html,pages,refresh,edge,results,admin,cname,renderExists]=await Promise.all([read('public/index.html'),read('.github/workflows/pages.yml'),read('.github/workflows/refresh-board.yml'),read('supabase/functions/stats2pitch-api/index.ts'),read('public/results.html'),read('public/admin.html'),read('public/CNAME'),exists('render.yaml')])
  assert.equal(renderExists,false)
  assert.match(html,/runtime-config\.js/)
  assert.match(html,/bankers\.html/)
  assert.match(html,/var-tips\.html/)
  assert.match(html,/results\.html/)
  assert.match(pages,/actions\/deploy-pages@v4/)
  assert.match(refresh,/npm run settle/)
  assert.match(edge,/Deno\.serve/)
  assert.match(edge,/route==='\/results'/)
  assert.match(edge,/route==='\/performance'/)
  assert.match(edge,/route==='\/admin\/overview'/)
  assert.match(results,/30-Day Performance/)
  assert.match(admin,/Stats2Pitch Admin/)
  assert.equal(cname.trim(),'www.stats2pitch.com')
})
