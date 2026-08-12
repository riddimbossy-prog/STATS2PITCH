import {loadBoard} from '../server/store.js'
import {refreshNow} from '../server/refresh.js'

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','API_FOOTBALL_KEY']
for(const key of required)if(!process.env[key])throw new Error(`${key} is required for the GitHub Actions refresh worker`)

const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const ttlMs=Math.max(15,Number(process.env.AUTO_REFRESH_TTL_MINUTES||45))*60_000
const timezone=process.env.APP_TIMEZONE||'UTC'
const explicit=process.argv.find(dateOk)||process.env.REFRESH_DATE||''
const force=process.argv.includes('--force')||String(process.env.FORCE_REFRESH||'').toLowerCase()==='true'
const daysForward=Math.max(0,Math.min(3,Number(process.env.BOARD_DAYS_FORWARD||0)))

function dateInZone(offsetDays=0){
  const d=new Date(Date.now()+offsetDays*86_400_000)
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)
  const pick=t=>parts.find(x=>x.type===t)?.value||''
  return`${pick('year')}-${pick('month')}-${pick('day')}`
}
function generatedAt(board){return board?.meta?.generatedAt||board?.meta?.storedAt||null}
function fresh(board){const t=Date.parse(generatedAt(board)||'');return Number.isFinite(t)&&Date.now()-t<ttlMs}

const dates=explicit?[explicit]:Array.from({length:daysForward+1},(_,i)=>dateInZone(i))
let failed=false
for(const date of [...new Set(dates)]){
  try{
    const saved=await loadBoard(date)
    if(!force&&fresh(saved)){
      console.log(`[Stats2Pitch] ${date}: snapshot is fresh (${generatedAt(saved)}); skipping provider refresh.`)
      continue
    }
    console.log(`[Stats2Pitch] ${date}: refreshing with the HOME/AWAY Form Table engine.`)
    const board=await refreshNow(date,progress=>console.log(`[Stats2Pitch] ${date}: ${JSON.stringify(progress)}`))
    console.log(`[Stats2Pitch] ${date}: complete — ${board?.bestPicks?.length||0} Best Picks, ${board?.meta?.qualified||0} qualified markets.`)
  }catch(error){
    failed=true
    console.error(`[Stats2Pitch] ${date}: refresh failed`,error)
  }
}
if(failed)process.exitCode=1
