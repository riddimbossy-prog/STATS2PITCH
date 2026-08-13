import {refreshNow} from '../server/refresh.js'
const base=new Date(),days=String(process.env.BOARD_DAYS_FORWARD||6)==='week'?(7-base.getUTCDay()):Math.max(0,Math.min(6,Number(process.env.BOARD_DAYS_FORWARD||6)))
for(let i=0;i<=days;i++){
  const d=new Date(base.getTime()+i*86400000).toISOString().slice(0,10)
  console.log(`Refreshing ${d}`)
  const board=await refreshNow(d,p=>console.log(d,p))
  console.log(`${d}: ${board.bestPicks.length} best picks`)
}
