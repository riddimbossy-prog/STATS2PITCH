import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`v1.13.2 today-board regression: ${message}`)}

const router=read('public/date-board-router.v1.10.0.js')
const refresh=read('public/refresh-resilience.v1.10.1.js')
const cacheReset=read('public/cache-reset-v1.11.7.js')

assert(router.includes('const initial=explicit||browserToday()'),'normal visits must default to browser-local today instead of a stale stored date')
assert(!router.includes('queryDate()||stored()||'),'stored yesterday must never outrank current today on a normal visit')
assert(router.includes('function rolloverIfNeeded()'),'open tabs must detect a calendar-day rollover')
assert(router.includes("window.addEventListener('focus',rolloverIfNeeded"),'focus must re-check today after midnight')
assert(refresh.includes('async function maybeAutoPopulateToday()'),'current-day board must have an automatic population path')
assert(refresh.includes('meta.noSnapshot===true||meta.stale===true||sourceFixtures===0'),'missing, stale, or zero-source current-day snapshots must trigger fresh data')
assert(refresh.includes("await start(date,{auto:true})"),'automatic population must reuse the background refresh job')
assert(refresh.includes("request(`/api/refresh-status?date=${encodeURIComponent(date)}`)"),'automatic population must poll the existing deduplicated refresh job')
assert(refresh.includes('meta?.bootShellOnly'),'bootstrap shell responses must not be mistaken for a genuine empty board')
assert(cacheReset.includes("const BUILD='1.13.2'"),'one-time cleanup must clear stale session date state for this build')

console.log('v1.13.2 today-board regression checks passed')
