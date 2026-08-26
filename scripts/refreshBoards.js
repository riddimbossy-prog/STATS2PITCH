import {refreshNow} from '../server/refresh.js'
import {accraWeek} from '../server/week.js'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const dates=accraWeek().dates
let completed=0,failed=0

for(let i=0;i<dates.length;i++){
  const d=dates[i]
  console.log(`Refreshing ${d}`)
  try{
    const board=await refreshNow(d,p=>console.log(d,p))
    const src=Number(board?.meta?.sourceFixtures??board?.meta?.diagnostics?.sourceFixtures??0)
    const published=board.bestPicks.length
    completed++
    console.log(`${d}: ${published} published picks · ${board.priority.length} qualified · ${src} source fixtures`)
    if(src===0&&published===0){
      failed++
      console.error(`${d}: API-Football returned zero fixtures; board not regenerated`)
    }
  }catch(error){
    failed++
    console.error(`${d}: refresh failed: ${error?.message||error}`)
  }
  if(i<dates.length-1)await sleep(Number(process.env.BOARD_DAY_PAUSE_MS||3000))
}

console.log(`Refresh complete: ${completed} day(s) completed, ${failed} day(s) failed`)
if(completed===0)process.exitCode=1
