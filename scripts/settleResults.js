import {sportyEventFixtures,sportyFixturesByDate} from '../server/sportyBet.js'
import {gismoMatches} from '../server/sportyStats.js'
import {listBoards,saveBoard} from '../server/store.js'
import {settleBoard} from '../server/settlement.js'

const lookback=Math.max(1,Math.min(90,Number(process.env.RESULT_LOOKBACK_DAYS||45)))
const end=new Date(),start=new Date(end.getTime()-(lookback-1)*86400000)
const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10)
const rows=await listBoards(from,to)
let updated=0,skipped=0,failed=0
for(const row of rows){
  const date=row.snapshot_date,board=row.payload
  const picks=[...(board?.bestPicks||[]),...(board?.varTips||[]),...(board?.filterTips||[]),...(board?.goalsBankers||[])]
  if(!picks.length){skipped++;continue}
  const fullySettled=picks.every(p=>['won','lost','void'].includes(board?.results?.[String(p.fixtureId)]?.outcome))
  if(fullySettled){skipped++;continue}
  try{
    const eventIds=picks.map(p=>p.sportyEventId).filter(Boolean)
    const fixtureIds=picks.map(p=>p.fixtureId).filter(Boolean)
    let fixtures=eventIds.length?await sportyEventFixtures(eventIds):[]
    if(!fixtures.length)fixtures=await sportyFixturesByDate(date).catch(()=>[])
    const have=new Set(fixtures.map(f=>String(f?.fixture?.id||'')))
    const missing=fixtureIds.filter(id=>!have.has(String(id)))
    if(missing.length){
      const extra=await gismoMatches(missing)
      fixtures=[...fixtures,...extra]
    }
    const settled=settleBoard(board,fixtures)
    settled.meta={...(settled.meta||{}),resultsUpdatedAt:new Date().toISOString()}
    await saveBoard(date,settled,{preservePublished:true})
    updated++
    console.log(`${date}: results updated`,settled.resultSummary)
  }catch(error){
    const msg=String(error?.message||error)
    failed++;console.error(`${date}: settlement failed`,msg)
  }
}
console.log(`Settlement complete: ${updated} updated, ${skipped} skipped, ${failed} failed`)
if(failed>0&&updated===0&&skipped===0)process.exitCode=1
