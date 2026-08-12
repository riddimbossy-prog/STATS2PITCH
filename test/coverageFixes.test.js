import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {normalizeSupabaseUrl} from '../server/store.js'
import {selectRecentVenueFixtures} from '../server/apiFootball.js'
import {needsOddsFallback,mergeHistories} from '../server/refresh.js'

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

const historyFixture=(id,date,homeId,awayId)=>({fixture:{id,date:`${date}T12:00:00Z`,status:{short:'FT'}},teams:{home:{id:homeId},away:{id:awayId}},goals:{home:1,away:0}})
test('team-history fallback extracts exactly the latest five venue matches before kickoff',()=>{
  const rows=[
    historyFixture(1,'2026-07-01',7,101),historyFixture(2,'2026-07-08',7,102),historyFixture(3,'2026-07-15',7,103),
    historyFixture(4,'2026-07-22',7,104),historyFixture(5,'2026-07-29',7,105),historyFixture(6,'2026-08-05',7,106),
    historyFixture(7,'2026-08-11',7,107),historyFixture(8,'2026-08-06',108,7)
  ]
  const picked=selectRecentVenueFixtures(rows,7,'home',5,'2026-08-10T18:00:00Z')
  assert.deepEqual(picked.map(x=>x.fixture.id),[6,5,4,3,2])
  assert.equal(picked.every(x=>x.teams.home.id===7),true)
})

test('merged league and team fallback history de-duplicates the same fixture',()=>{
  const a=historyFixture(20,'2026-07-01',7,101),b=historyFixture(21,'2026-07-08',7,102)
  assert.deepEqual(mergeHistories([a],[a,b]).map(x=>x.fixture.id),[20,21])
})

test('scheduled refresh defaults to unlimited fixtures, today plus tomorrow, and forty-match fallback search',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/refresh-board.yml',import.meta.url),'utf8')
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8')
  assert.match(workflow,/MAX_FIXTURES_PER_REFRESH: \$\{\{ vars\.MAX_FIXTURES_PER_REFRESH \|\| '0' \}\}/)
  assert.match(workflow,/BOARD_DAYS_FORWARD: \$\{\{ vars\.BOARD_DAYS_FORWARD \|\| '1' \}\}/)
  assert.match(workflow,/API_FOOTBALL_HISTORY_LAST: \$\{\{ vars\.API_FOOTBALL_HISTORY_LAST \|\| '40' \}\}/)
  assert.match(workflow,/FORCE_REFRESH: \$\{\{ github\.event_name == 'push' \|\| \(github\.event_name == 'workflow_dispatch' && github\.event\.inputs\.force\) \}\}/)
  assert.match(env,/MAX_FIXTURES_PER_REFRESH=0/)
  assert.match(env,/BOARD_DAYS_FORWARD=1/)
  assert.match(env,/API_FOOTBALL_HISTORY_LAST=40/)
})
