import {sportyEventFixtures,sportyFixturesByDate,sportyLiveEvents} from '../server/sportyBet.js'
import {gismoMatches,teamLastX,teamVersus} from '../server/sportyStats.js'
import {listBoards,saveBoard} from '../server/store.js'
import {settleBoard,boardPicks,fixtureForPick,indexFixtures,pickNameKey,pickResultKey,pickDecided,normalizeFixtureStatus} from '../server/settlement.js'

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

function shareTeamIds(picks,index){
  const byName=new Map()
  for(const pick of picks||[]){
    const k=pickNameKey(pick)
    if(!k)continue
    const fx=fixtureForPick(pick,index)
    const homeId=pick.homeId??fx?.teams?.home?.id??fx?.homeId??null
    const awayId=pick.awayId??fx?.teams?.away?.id??fx?.awayId??null
    const prev=byName.get(k)||{}
    byName.set(k,{homeId:prev.homeId||homeId,awayId:prev.awayId||awayId})
  }
  for(const pick of picks||[]){
    const ids=byName.get(pickNameKey(pick))
    if(!ids)continue
    if(!pick.homeId&&ids.homeId)pick.homeId=ids.homeId
    if(!pick.awayId&&ids.awayId)pick.awayId=ids.awayId
  }
}

async function fixturesForBoard(date,picks){
  const eventIds=picks.map(p=>p.sportyEventId||p.eventId).filter(Boolean)
  const fixtureIds=picks.map(p=>p.fixtureId).filter(id=>id!=null)
  let rows=[]
  try{if(eventIds.length)rows=rows.concat(await sportyEventFixtures(eventIds))}catch{}
  try{rows=rows.concat(await sportyFixturesByDate(date))}catch{}
  try{rows=rows.concat(await sportyLiveEvents())}catch{}
  let index=indexFixtures(rows)
  shareTeamIds(picks,index)
  const missingIds=fixtureIds.filter(id=>!index.byId.has(String(id))&&!picks.some(p=>String(p.fixtureId)===String(id)&&fixtureForPick(p,index)))
  if(missingIds.length){
    try{rows=rows.concat(await gismoMatches(missingIds))}catch{}
    index=indexFixtures(rows)
    shareTeamIds(picks,index)
  }
  const unresolved=picks.filter(p=>!fixtureForPick(p,index))
  const tried=new Set()
  for(const pick of unresolved){
    const name=pickNameKey(pick)||String(pick.fixtureId||'')
    if(tried.has(name))continue
    tried.add(name)
    try{
      let extra=[]
      if(pick.homeId&&pick.awayId)extra=await teamVersus(pick.homeId,pick.awayId)
      if(!extra.length&&pick.homeId)extra=await teamLastX(pick.homeId,20)
      if(!extra.length&&pick.awayId)extra=await teamLastX(pick.awayId,20)
      const hit=extra.find(f=>fixtureForPick(pick,[f])&&sameDay(f,date,pick.kickoff))
        ||extra.find(f=>fixtureForPick(pick,[f]))
      if(hit){
        rows.push(hit)
        index=indexFixtures(rows)
        shareTeamIds(picks,index)
      }
    }catch(error){
      console.warn(`${date}: name fallback ${name}:`,error?.message||error)
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
  const fullySettled=picks.every(p=>pickDecided(board?.results,p))
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
