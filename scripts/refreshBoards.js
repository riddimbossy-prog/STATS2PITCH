import {refreshNow} from '../server/refresh.js'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const base=new Date()
const days=String(process.env.BOARD_DAYS_FORWARD||6)==='week'?(7-base.getUTCDay()):Math.max(0,Math.min(6,Number(process.env.BOARD_DAYS_FORWARD||6)))
let completed=0,failed=0

for(let i=0;i<=days;i++){
  const d=new Date(base.getTime()+i*86400000).toISOString().slice(0,10)
  console.log(`Refreshing ${d}`)
  try{
    const board=await refreshNow(d,p=>console.log(d,p))
    completed++
    console.log(`${d}: ${board.bestPicks.length} best picks · ${board.priority.length} qualified markets`)
  }catch(error){
    failed++
    console.error(`${d}: refresh failed: ${error?.message||error}`)
  }
  if(i<days)await sleep(Number(process.env.BOARD_DAY_PAUSE_MS||3000))
}

console.log(`Refresh complete: ${completed} day(s) completed, ${failed} day(s) failed`)
if(completed===0)process.exitCode=1
