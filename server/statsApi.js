import { fetchWithPolicy } from './providerFetch.js'

const BASE = process.env.STATS_API_BASE_URL || 'https://api.thestatsapi.com/api'
const KEY = process.env.STATS_API_KEY || process.env.THESTATSAPI_KEY || ''
const CACHE_TTL = Number(process.env.STATS_VALUE_CACHE_TTL_SECONDS || 1800) * 1000
const MIN_INTERVAL = Math.max(0, Number(process.env.STATS_API_MIN_INTERVAL_MS || 300))
const REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.STATS_API_REQUESTS_PER_MINUTE || 40))
const MAX_COMPETITION_PAGES = Math.max(1, Number(process.env.STATS_API_COMPETITION_PAGES || 5))
const MAX_MATCH_PAGES = Math.max(1, Number(process.env.STATS_API_MAX_MATCH_PAGES || 5))
const TIMEOUT_MS=Math.max(3000,Number(process.env.STATS_API_TIMEOUT_MS||18000))
const RETRIES=Math.max(0,Number(process.env.STATS_API_RETRIES||2))
const MATCH_TOLERANCE_HOURS=Math.max(1,Number(process.env.STATS_API_MATCH_TOLERANCE_HOURS||6))
const memory = new Map(), requestTimes=[]
let lastRequestAt=0

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const keyFor=(path,params={})=>`${path}?${new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString()}`
async function pace(){const now=Date.now();while(requestTimes.length&&now-requestTimes[0]>=60000)requestTimes.shift();if(requestTimes.length>=REQUESTS_PER_MINUTE){const wait=Math.max(0,60000-(now-requestTimes[0])+25);if(wait)await sleep(wait)}const since=Date.now()-lastRequestAt;if(since<MIN_INTERVAL)await sleep(MIN_INTERVAL-since)}

export function statsApiConfigured(){return Boolean(KEY)}
export async function statsApi(path,params={},opts={}){
  if(!KEY)return null
  const k=keyFor(path,params),cached=memory.get(k)
  if(!opts.bypassCache&&cached&&Date.now()-cached.at<CACHE_TTL)return cached.data
  await pace()
  const url=new URL(`${BASE}${path}`);for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))
  const response=await fetchWithPolicy(url,{headers:{Authorization:`Bearer ${KEY}`,Accept:'application/json'}},{timeoutMs:TIMEOUT_MS,retries:RETRIES})
  lastRequestAt=Date.now();requestTimes.push(lastRequestAt)
  const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(`Stats API ${response.status}`)
  memory.set(k,{at:Date.now(),data:body});return body
}
function unwrap(body,keys=[]){for(const k of keys)if(Array.isArray(body?.[k]))return body[k];if(Array.isArray(body?.data))return body.data;if(Array.isArray(body))return body;return[]}
function compId(c){return c?.id??c?.competition_id??c?.comp_id??null}
function compName(c){return c?.name??c?.competition??c?.title??''}
function compCountry(c){return c?.country?.name??c?.country_name??c?.country??''}
let competitionCache=null
async function competitions(opts={}){if(!opts.bypassCache&&competitionCache&&Date.now()-competitionCache.at<CACHE_TTL)return competitionCache.rows;const rows=[];for(let page=1;page<=MAX_COMPETITION_PAGES;page++){const body=await statsApi('/football/competitions',{per_page:100,page},opts),part=unwrap(body,['competitions']);rows.push(...part);if(part.length<100)break}competitionCache={at:Date.now(),rows};return rows}
async function findCompetition(leagueName,countryName,opts={}){
  const league=norm(leagueName),country=norm(countryName),rows=await competitions(opts),scored=[]
  for(const c of rows){const name=norm(compName(c)),ctry=norm(compCountry(c));if(country&&ctry&&country!==ctry)continue;let score=0;if(name===league)score=100;else if(name&&league&&Math.min(name.length,league.length)>=6&&(name.includes(league)||league.includes(name)))score=70;if(!score)continue;if(country&&ctry===country)score+=20;scored.push({c,score})}
  scored.sort((a,b)=>b.score-a.score);if(!scored.length)return null;if(scored[1]&&scored[1].score===scored[0].score)return null;return scored[0].c
}
const matchCache=new Map()
async function competitionMatches(id,season,opts={}){const k=`${id}:${season}`,cached=matchCache.get(k);if(!opts.bypassCache&&cached&&Date.now()-cached.at<CACHE_TTL)return cached.rows;const rows=[];for(let page=1;page<=MAX_MATCH_PAGES;page++){const body=await statsApi('/football/matches',{competition_id:id,season,per_page:100,page},opts),part=unwrap(body,['matches']);rows.push(...part);if(part.length<100)break}matchCache.set(k,{at:Date.now(),rows});return rows}
function teamName(m,side){const snake=`${side}_team`,vals=[m?.[snake]?.name,m?.[snake]?.team_name,m?.[snake],m?.[side]?.name,m?.[side]?.team_name,m?.[side],m?.teams?.[side]?.name,m?.match?.[snake]?.name,m?.participants?.[side]?.name];return text(vals.find(v=>typeof v==='string'&&v.trim())||'')}
function teamScore(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 100;if(Math.min(x.length,y.length)>=7&&(x.includes(y)||y.includes(x)))return 85;const xa=new Set(x.split(' ').filter(t=>t.length>2)),ya=new Set(y.split(' ').filter(t=>t.length>2)),common=[...xa].filter(t=>ya.has(t)).length,denom=Math.max(xa.size,ya.size,1);return common>=2&&common/denom>=.66?80:0}
function matchId(m){return m?.id??m?.match_id??m?.mt_id??m?.match?.id??null}
function matchDate(m){return m?.date??m?.start_date??m?.kickoff??m?.starts_at??m?.start_time??m?.match?.date??null}
function gapHours(a,b){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/3600000:null}
export async function findStatsMatch(fixture,opts={}){
  if(!KEY)return null
  const comp=await findCompetition(fixture?.league?.name||fixture?.league||'',fixture?.league?.country||fixture?.country||'',opts),cid=compId(comp);if(!cid)return null
  const season=fixture?.league?.season??fixture?.season??new Date(fixture?.fixture?.date||fixture?.kickoff||Date.now()).getUTCFullYear(),rows=await competitionMatches(cid,season,opts),home=fixture?.teams?.home?.name??fixture?.home?.name??'',away=fixture?.teams?.away?.name??fixture?.away?.name??'',kickoff=fixture?.fixture?.date??fixture?.kickoff??null,candidates=[]
  for(const m of rows){const hs=teamScore(teamName(m,'home'),home),as=teamScore(teamName(m,'away'),away);if(hs<80||as<80)continue;const gap=gapHours(matchDate(m),kickoff);if(gap===null||gap>MATCH_TOLERANCE_HOURS)continue;candidates.push({m,score:hs+as,gap})}
  candidates.sort((a,b)=>b.score-a.score||a.gap-b.gap);if(!candidates.length)return null;if(candidates[1]&&candidates[1].score===candidates[0].score&&Math.abs(candidates[1].gap-candidates[0].gap)<1)return null
  const best=candidates[0];return{id:matchId(best.m),row:best.m,competitionId:cid,matchGapHours:best.gap}
}
export async function getStatsOddsForFixture(fixture,opts={}){if(!KEY)return null;const matched=await findStatsMatch(fixture,opts);if(!matched?.id)return null;const payload=await statsApi(`/football/matches/${matched.id}/odds`,{},opts);return{matchId:matched.id,payload,matchGapHours:matched.matchGapHours}}
