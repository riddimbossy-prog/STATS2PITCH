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
  }catch(error){
    const msg=String(error?.message||error)
    if(/do not have access to this date|request limit for the day|rate.?limit/i.test(msg)){skipped++;console.warn(`${date}: skipped — football data plan cannot read this date`);continue}
    failed++;console.error(`${date}: settlement failed`,msg)
  }
}
console.log(`Settlement complete: ${updated} updated, ${skipped} skipped, ${failed} failed`)
if(failed>0&&updated===0&&skipped===0)process.exitCode=1
