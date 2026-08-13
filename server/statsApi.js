import {fetchJson} from './http.js'
import {STATS_API_BASE,STATS_API_KEY} from './config.js'

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const text=v=>String(v??'').trim()
const unwrap=(b,keys=[])=>{for(const k of keys)if(Array.isArray(b?.[k]))return b[k];if(Array.isArray(b?.data))return b.data;if(Array.isArray(b))return b;return[]}
const timeout=()=>Number(process.env.STATS_API_TIMEOUT_MS||15000)
const auth=()=>({Authorization:`Bearer ${STATS_API_KEY}`,Accept:'application/json'})
const enabled=()=>Boolean(STATS_API_KEY)
async function call(path,params={}){
  if(!enabled())return null
  const u=new URL(`${STATS_API_BASE}${path}`)
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))
  return fetchJson(u,{headers:auth()},timeout())
}
function compName(c){return c?.name??c?.competition??c?.title??''}
function compCountry(c){return c?.country?.name??c?.country_name??c?.country??''}
function compId(c){return c?.id??c?.competition_id??c?.comp_id??null}
function teamName(m,side){
  const snake=`${side}_team`
  const vals=[m?.[snake]?.name,m?.[snake]?.team_name,m?.[snake],m?.[side]?.name,m?.[side]?.team_name,m?.[side],m?.teams?.[side]?.name]
  return text(vals.find(v=>typeof v==='string'&&v.trim())||'')
}
function teamScore(a,b){
  const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 100
  if(Math.min(x.length,y.length)>=7&&(x.includes(y)||y.includes(x)))return 85
  const xa=new Set(x.split(' ').filter(t=>t.length>2)),ya=new Set(y.split(' ').filter(t=>t.length>2))
  const common=[...xa].filter(t=>ya.has(t)).length
  return common>=2&&common/Math.max(xa.size,ya.size,1)>=.66?80:0
}
function gapHours(a,b){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/3600000:null}
function matchDate(m){return m?.date??m?.start_date??m?.kickoff??m?.starts_at??m?.start_time??null}
function matchId(m){return m?.id??m?.match_id??m?.mt_id??null}

let compsCache=null
async function competitions(){
  if(compsCache)return compsCache
  const rows=[]
  for(let page=1;page<=5;page++){const part=unwrap(await call('/football/competitions',{per_page:100,page}),['competitions']);rows.push(...part);if(part.length<100)break}
  compsCache=rows;return rows
}
async function findCompetition(league,country){
  const l=norm(league),c=norm(country),hits=[]
  for(const row of await competitions()){
    const n=norm(compName(row)),ct=norm(compCountry(row));if(c&&ct&&c!==ct)continue
    let score=n===l?100:(n&&l&&Math.min(n.length,l.length)>=6&&(n.includes(l)||l.includes(n))?70:0)
    if(!score)continue;if(c&&ct===c)score+=20;hits.push({row,score})
  }
  hits.sort((a,b)=>b.score-a.score)
  if(!hits.length||(hits[1]&&hits[1].score===hits[0].score))return null
  return hits[0].row
}
export function statsApiConfigured(){return enabled()}
export async function getStatsOddsForFixture(fixture){
  if(!enabled())return null
  const league=fixture?.league?.name||'',country=fixture?.league?.country||'',comp=await findCompetition(league,country),cid=compId(comp)
  if(!cid)return null
  const season=fixture?.league?.season??new Date(fixture?.fixture?.date||Date.now()).getUTCFullYear()
  const home=fixture?.teams?.home?.name||'',away=fixture?.teams?.away?.name||'',kick=fixture?.fixture?.date
  const rows=[]
  for(let page=1;page<=5;page++){const part=unwrap(await call('/football/matches',{competition_id:cid,season,per_page:100,page}),['matches']);rows.push(...part);if(part.length<100)break}
  const tolerance=Number(process.env.STATS_API_MATCH_TOLERANCE_HOURS||6)
  const candidates=[]
  for(const m of rows){
    const hs=teamScore(teamName(m,'home'),home),as=teamScore(teamName(m,'away'),away),gap=gapHours(matchDate(m),kick)
    if(hs>=80&&as>=80&&gap!==null&&gap<=tolerance)candidates.push({m,score:hs+as,gap})
  }
  candidates.sort((a,b)=>b.score-a.score||a.gap-b.gap)
  const id=matchId(candidates[0]?.m);if(!id)return null
  return await call(`/football/matches/${id}/odds`)
}
