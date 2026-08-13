import {fixturesByDate,teamHistory,fixtureOdds} from './apiFootball.js'
import {getStatsOddsForFixture,statsApiConfigured} from './statsApi.js'
import {verifiedMarkets} from './odds.js'
import {venueSample,buildBoard} from './engine.js'
import {saveBoard} from './store.js'
import {ENGINE_VERSION,SCHEDULED,FORM_SAMPLE} from './config.js'

const jobs=new Map()
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function w(){while(true){const x=i++;if(x>=items.length)return;out[x]=await fn(items[x],x)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out}
function publicFixture(f,status='scheduled'){return{fixtureId:f?.fixture?.id,kickoff:f?.fixture?.date,status:f?.fixture?.status?.short||'NS',league:f?.league?.name||'',country:f?.league?.country||'',home:f?.teams?.home?.name||'',away:f?.teams?.away?.name||'',homeLogo:f?.teams?.home?.logo||null,awayLogo:f?.teams?.away?.logo||null,availability:status}}
export async function refreshNow(date,onProgress=()=>{}){
  const raw=await fixturesByDate(date),scheduled=raw.filter(f=>SCHEDULED.has(String(f?.fixture?.status?.short||'').toUpperCase()))
  let done=0,statsVerified=0
  const analyzed=await mapLimit(scheduled,Math.max(1,Number(process.env.REFRESH_CONCURRENCY||3)),async f=>{
    try{
      const homeId=f?.teams?.home?.id,awayId=f?.teams?.away?.id
      const [hh,ah,apiOdds,statsOdds]=await Promise.all([
        teamHistory(homeId),teamHistory(awayId),fixtureOdds(f?.fixture?.id),
        statsApiConfigured()?getStatsOddsForFixture(f).catch(()=>null):Promise.resolve(null)
      ])
      if(statsOdds)statsVerified++
      const homeFixtures=venueSample(hh,homeId,'home'),awayFixtures=venueSample(ah,awayId,'away')
      const marketOdds=verifiedMarkets({apiPayload:apiOdds,statsPayload:statsOdds,fixture:f})
      done++;onProgress({stage:'analyzing',done,total:scheduled.length,statsVerified})
      if(homeFixtures.length<FORM_SAMPLE||awayFixtures.length<FORM_SAMPLE)return null
      return{
        fixtureId:f.fixture.id,league:f.league?.name||'',country:f.league?.country||'',kickoff:f.fixture.date,
        home:{id:homeId,name:f.teams.home.name,logo:f.teams.home.logo||null,fixtures:homeFixtures},
        away:{id:awayId,name:f.teams.away.name,logo:f.teams.away.logo||null,fixtures:awayFixtures},
        marketOdds
      }
    }catch{done++;return null}
  })
  const fixtures=analyzed.filter(Boolean)
  const board=buildBoard(fixtures,{date,generatedAt:new Date().toISOString(),engineVersion:ENGINE_VERSION,sourceFixtures:raw.length,scheduledFixtures:scheduled.length,analyzedFixtures:fixtures.length,statsVerifiedFixtures:statsVerified})
  const picks=new Map(board.bestPicks.map(p=>[String(p.fixtureId),p]))
  board.fixtures=raw.map(f=>publicFixture(f,picks.has(String(f?.fixture?.id))?'qualified':'no-qualified-pick'))
  await saveBoard(date,board)
  return board
}
export function refreshStatus(date){return jobs.get(date)||{state:'idle',date}}
export function startRefresh(date){
  if(jobs.get(date)?.state==='running')return jobs.get(date)
  const job={state:'running',date,startedAt:new Date().toISOString(),progress:{stage:'start'}};jobs.set(date,job)
  refreshNow(date,p=>job.progress=p).then(board=>{job.state='complete';job.completedAt=new Date().toISOString();job.result={bestPicks:board.bestPicks.length,qualified:board.priority.length}}).catch(e=>{job.state='failed';job.error=e.message;job.completedAt=new Date().toISOString()})
  return job
}
