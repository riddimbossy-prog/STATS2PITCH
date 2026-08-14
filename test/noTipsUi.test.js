import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const app=await readFile(new URL('../public/appCrests.js',import.meta.url),'utf8')

test('empty boards use plain public wording with no backend language',()=>{
  assert.match(app,/No picks match these filters yet/)
  assert.match(app,/No verified 100% agreement bankers match these filters yet/)
  assert.doesNotMatch(app,/API-Football|TheStatsAPI|worker refresh|Supabase Functions workflow/)
})
