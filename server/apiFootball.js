import {fetchJson} from './http.js'
import {API_FOOTBALL_BASE,API_FOOTBALL_KEY,HISTORY_LAST,ODDS_MAX_PAGES} from './config.js'

const headers=()=>({'x-apisports-key':API_FOOTBALL_KEY,Accept:'application/json'})
const ensure=()=>{if(!API_FOOTBALL_KEY)throw new Error('API_FOOTBALL_KEY is not configured')}
const unwrap=b=>Array.isArray(b?.response)?b.response:[]

async function call(path,params={}){
  ensure()
  const url=new URL(`${API_FOOTBALL_BASE}${path}`)
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))
  return fetchJson(url,{headers:headers()},Number(process.env.API_FOOTBALL_TIMEOUT_MS||15000))
}
export async function fixturesByDate(date){return unwrap(await call('/fixtures',{date}))}
export async function teamHistory(teamId){
  return unwrap(await call('/fixtures',{team:teamId,last:HISTORY_LAST}))
}
export async function fixtureOdds(fixtureId){
  const rows=[]
  for(let page=1;page<=ODDS_MAX_PAGES;page++){
    const body=await call('/odds',{fixture:fixtureId,page})
    rows.push(...unwrap(body))
    const current=Number(body?.paging?.current||page),total=Number(body?.paging?.total||current)
    if(current>=total)break
  }
  return rows
}
