import {refreshNow} from '../server/refresh.js'
import {accraWeek} from '../server/week.js'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const skippable=msg=>/do not have access to this date|request limit for the day|rate.?limit/i.test(String(msg||''))
const dates=accraWeek().dates
let completed=0,failed=0,skipped=0

for(let i=0;i<dates.length;i++){
  const d=dates[i]
  console.log(`Refreshing ${d}`)
  try{
    const board=await refreshNow(d,p=>console.log(d,p))
    const src=Number(board?.meta?.sourceFixtures??board?.meta?.diagnostics?.sourceFixtures??0)
    const published=board.bestPicks.length
    const varTips=board.varTips?.length||0
    completed++
    console.log(`${d}: ${published} All Picks · ${varTips} VAR Tips · ${board.priority.length} qualified · ${src} source fixtures`)
    if(src===0){
      console.warn(`${d}: no upcoming fixtures for this date`)
    }
  }catch(error){
    const msg=String(error?.message||error)
    if(skippable(msg)){
      skipped++
      console.warn(`${d}: skipped — ${msg}`)
      continue
    }
    failed++
    console.error(`${d}: refresh failed: ${msg}`)
  }
  if(i<dates.length-1)await sleep(Number(process.env.BOARD_DAY_PAUSE_MS||3000))
}

console.log(`Refresh complete: ${completed} day(s) completed, ${skipped} skipped, ${failed} day(s) failed`)
if(completed===0&&failed>0)process.exitCode=1