import {sportyEventFixtures,sportyFixturesByDate,sportyLiveEvents} from '../server/sportyBet.js'
import {gismoMatches,teamLastX,teamVersus} from '../server/sportyStats.js'
import {listBoards,saveBoard} from '../server/store.js'
import {settleBoard,boardPicks,fixtureForPick,indexFixtures,pickNameKey,normalizeFixtureStatus} from '../server/settlement.js'

const lookback=Math.max(1,Math.min(90,Number(process.env.RESULT_LOOKBACK_DAYS||45)))
const ZONE=process.env.APP_TIMEZONE||'Africa/Accra'
const end=new Date(),start=new Date(end.getTime()-(lookback-1)*86400000)
const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10)

function accraDate(iso){
  const t=Date.parse(iso||'')
  if(!Number.isFinite(t))return ''
  return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t))
}

function sameDay(fixture,date,kickoff){
  const n=fixture?.matchState?fixture:normalizeFixtureStatus(fixture)
  const got=accraDate(n.kickoff||fixture?.fixture?.date||fixture?.kickoff)
  const want=accraDate(kickoff)||date
  return Boolean(got)&&got===want
}

async function fixturesForBoard(date,picks){
  const eventIds=picks.map(p=>p.sportyEventId||p.eventId).filter(Boolean)
  const fixtureIds=picks.map(p=>p.fixtureId).filter(id=>id!=null)
  let rows=[]
  try{if(eventIds.length)rows=rows.concat(await sportyEventFixtures(eventIds))}catch{}
  try{rows=rows.concat(await sportyFixturesByDate(date))}catch{}
  try{rows=rows.concat(await sportyLiveEvents())}catch{}
  let index=indexFixtures(rows)
  const missingIds=fixtureIds.filter(id=>!index.byId.has(String(id)))
  if(missingIds.length){
    try{rows=rows.concat(await gismoMatches(missingIds))}catch{}
    index=indexFixtures(rows)
  }
  const unresolved=picks.filter(p=>!fixtureForPick(p,index))
  for(const pick of unresolved){
    try{
      let extra=[]
      if(pick.homeId&&pick.awayId)extra=await teamVersus(pick.homeId,pick.awayId)
      if(!extra.length&&pick.homeId)extra=await teamLastX(pick.homeId,20)
      if(!extra.length&&pick.awayId)extra=await teamLastX(pick.awayId,20)
      const hit=extra.find(f=>fixtureForPick(pick,[f])&&sameDay(f,date,pick.kickoff))
        ||extra.find(f=>fixtureForPick(pick,[f]))
      if(hit)rows.push(hit)
    }catch(error){
      console.warn(`${date}: name fallback ${pickNameKey(pick)||pick.fixtureId}:`,error?.message||error)
    }
  }
  return rows
}

const rows=await listBoards(from,to)
let updated=0,skipped=0,failed=0
for(const row of rows){
  const date=row.snapshot_date,board=row.payload
  const picks=boardPicks(board)
  if(!picks.length){skipped++;continue}
  const fullySettled=picks.every(p=>['won','lost','void','postponed'].includes(board?.results?.[String(p.fixtureId)]?.outcome))
  if(fullySettled){skipped++;continue}
  try{
    const fixtures=await fixturesForBoard(date,picks)
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
