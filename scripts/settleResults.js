import {fixturesByDate} from '../server/apiFootball.js'
import {listBoards,saveBoard} from '../server/store.js'
import {settleBoard} from '../server/settlement.js'

const lookback=Math.max(1,Math.min(90,Number(process.env.RESULT_LOOKBACK_DAYS||45)))
const end=new Date(),start=new Date(end.getTime()-(lookback-1)*86400000)
const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10)
const rows=await listBoards(from,to)
let updated=0,skipped=0,failed=0
for(const row of rows){
  const date=row.snapshot_date,board=row.payload
  if(!board?.bestPicks?.length){skipped++;continue}
  const fullySettled=(board.bestPicks||[]).every(p=>['won','lost','void'].includes(board?.results?.[String(p.fixtureId)]?.outcome))
  if(fullySettled){skipped++;continue}
  try{
    const fixtures=await fixturesByDate(date)
    const settled=settleBoard(board,fixtures)
    settled.meta={...(settled.meta||{}),resultsUpdatedAt:new Date().toISOString()}
    await saveBoard(date,settled,{preservePublished:true})
    updated++
    console.log(`${date}: results updated`,settled.resultSummary)
  }catch(error){failed++;console.error(`${date}: settlement failed`,error?.message||error)}
}
console.log(`Settlement complete: ${updated} updated, ${skipped} skipped, ${failed} failed`)
if(updated===0&&failed>0)process.exitCode=1
