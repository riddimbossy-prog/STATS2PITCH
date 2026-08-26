import {fetchJson} from './http.js'
import {API_FOOTBALL_BASE,API_FOOTBALL_KEY,HISTORY_LAST,ODDS_MAX_PAGES} from './config.js'

const headers=()=>({'x-apisports-key':API_FOOTBALL_KEY,Accept:'application/json'})
const ensure=()=>{if(!API_FOOTBALL_KEY)throw new Error('API_FOOTBALL_KEY is not configured')}
const unwrap=b=>Array.isArray(b?.response)?b.response:[]
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const minInterval=Math.max(100,Number(process.env.API_FOOTBALL_MIN_INTERVAL_MS||650))
let queue=Promise.resolve(),lastStarted=0

function footballErrors(body){
  const e=body?.errors
  if(!e)return ''
  if(typeof e==='string')return e
  if(Array.isArray(e))return e.map(x=>x?.message||x).filter(Boolean).join('; ')
  if(typeof e==='object')return Object.entries(e).map(([k,v])=>`${k}:${v}`).join('; ')
  return String(e)
}

async function paced(task){
  const run=queue.then(async()=>{
    const wait=Math.max(0,minInterval-(Date.now()-lastStarted))
    if(wait)await sleep(wait)
    lastStarted=Date.now()
    return task()
  })
  queue=run.catch(()=>{})
  return run
}

async function call(path,params={}){
  ensure()
  const url=new URL(`${API_FOOTBALL_BASE}${path}`)
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))
  return paced(()=>fetchJson(url,{headers:headers()},Number(process.env.API_FOOTBALL_TIMEOUT_MS||15000),{
    retries:Number(process.env.API_FOOTBALL_RETRIES||5),
    baseDelayMs:Number(process.env.API_FOOTBALL_RETRY_BASE_MS||2500)
  }))
}

export async function fixturesByDate(date){
  const body=await call('/fixtures',{date})
  const rows=unwrap(body)
  const err=footballErrors(body)
  if(!rows.length&&err)throw new Error(`API-Football fixtures ${date} blocked: ${err}`)
  if(!rows.length){
    const results=body?.results??'n/a'
    console.warn(`API-Football fixtures ${date} returned 0 (results=${results} errors=${JSON.stringify(body?.errors||{})})`)
  }
  return rows
}

export async function teamHistory(teamId){
  return unwrap(await call('/fixtures',{team:teamId,last:HISTORY_LAST}))
}

export async function leagueHistory(leagueId,season){
  if(!leagueId||season===undefined||season===null)return[]
  return unwrap(await call('/fixtures',{league:leagueId,season}))
}

export async function fixtureEvents(fixtureId){
  if(!fixtureId)return[]
  return unwrap(await call('/fixtures/events',{fixture:fixtureId}))
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

export async function oddsByDate(date){
  const byFixture=new Map()
  const hardCap=Math.max(ODDS_MAX_PAGES,Number(process.env.API_FOOTBALL_DATE_ODDS_MAX_PAGES||80))
  for(let page=1;page<=hardCap;page++){
    const body=await call('/odds',{date,page})
    for(const row of unwrap(body)){
      const id=String(row?.fixture?.id??'')
      if(!id)continue
      if(!byFixture.has(id))byFixture.set(id,[])
      byFixture.get(id).push(row)
    }
    const current=Number(body?.paging?.current||page),total=Number(body?.paging?.total||current)
    if(current>=total)break
  }
  return byFixture
}
