import {refreshNow} from '../server/refresh.js'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const base=new Date()

function refreshOffsets(){
  const explicit=String(process.env.BOARD_DATE_OFFSETS||'').trim()
  if(explicit){
    const values=explicit.split(',').map(x=>Number(x.trim())).filter(Number.isInteger).filter(x=>x>=0&&x<=6)
    return[...new Set(values)]
  }
  const days=String(process.env.BOARD_DAYS_FORWARD||6)==='week'?(7-base.getUTCDay()):Math.max(0,Math.min(6,Number(process.env.BOARD_DAYS_FORWARD||6)))
  return Array.from({length:days+1},(_,i)=>i)
}

const offsets=refreshOffsets()
if(!offsets.length)throw new Error('No valid board date offsets were supplied')
let completed=0,failed=0

for(let index=0;index<offsets.length;index++){
  const offset=offsets[index]
  const d=new Date(base.getTime()+offset*86400000).toISOString().slice(0,10)
  console.log(`Refreshing ${d} (day +${offset})`)
  try{
    const board=await refreshNow(d,p=>console.log(d,p))
    completed++
    console.log(`${d}: ${board.bestPicks.length} best picks · ${board.priority.length} qualified markets`)
  }catch(error){
    failed++
    console.error(`${d}: refresh failed: ${error?.message||error}`)
  }
  if(index<offsets.length-1)await sleep(Number(process.env.BOARD_DAY_PAUSE_MS||3000))
}

console.log(`Refresh complete: ${completed} day(s) completed, ${failed} day(s) failed`)
if(completed===0)process.exitCode=1
