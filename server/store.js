import {ENGINE_VERSION} from './config.js'

const raw=String(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'')
const URL=!raw?'':/^https?:\/\//i.test(raw)?raw:raw.includes('.supabase.co')?`https://${raw}`:`https://${raw}.supabase.co`
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY||''
const ANON=process.env.SUPABASE_ANON_KEY||''
const memory=new Map()
const configured=()=>Boolean(URL&&SERVICE)
async function request(path,{method='GET',body,token=SERVICE,headers={}}={}){
  const res=await fetch(`${URL}${path}`,{method,headers:{apikey:SERVICE||ANON,Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await res.json().catch(()=>null)
  if(!res.ok)throw new Error(`Supabase ${res.status}`)
  return data
}
const proofKey=p=>`${p?.fixtureId}|${p?.market}|${String(p?.selection||'').trim()}`
function stampPick(p,at){return{...p,publishedAt:p?.publishedAt||at,proofKey:p?.proofKey||proofKey(p)}}
function mergePublished(existing,incoming){
  const now=incoming?.meta?.generatedAt||new Date().toISOString()
  const old=Array.isArray(existing?.bestPicks)?existing.bestPicks:[]
  const fresh=Array.isArray(incoming?.bestPicks)?incoming.bestPicks:[]
  const map=new Map(old.map(p=>[String(p.fixtureId),stampPick(p,p.publishedAt||existing?.meta?.firstPublishedAt||existing?.meta?.storedAt||now)]))
  for(const p of fresh)if(!map.has(String(p.fixtureId)))map.set(String(p.fixtureId),stampPick(p,now))
  const bestPicks=[...map.values()].sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0))
  return{
    ...incoming,
    bestPicks,
    results:{...(existing?.results||{}),...(incoming?.results||{})},
    resultSummary:incoming?.resultSummary||existing?.resultSummary||null,
    availableMarkets:[...new Set([...(incoming?.availableMarkets||[]),...bestPicks.map(x=>x.market).filter(Boolean)])].sort(),
    meta:{...(incoming?.meta||{}),firstPublishedAt:existing?.meta?.firstPublishedAt||existing?.meta?.storedAt||now,publishedPicks:bestPicks.length}
  }
}
export async function loadBoard(date,{allowVersionMismatch=false}={}){
  if(!configured()){const b=memory.get(date)||null;return allowVersionMismatch?b:(b?.meta?.engineVersion===ENGINE_VERSION?b:null)}
  const rows=await request(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null,b=row?.payload||null
  if(!b||(!allowVersionMismatch&&b?.meta?.engineVersion!==ENGINE_VERSION))return null
  return{...b,meta:{...(b.meta||{}),storedAt:row.generated_at}}
}
export async function listBoards(fromDate,toDate){
  if(!configured())return[...memory.entries()].filter(([d])=>(!fromDate||d>=fromDate)&&(!toDate||d<=toDate)).map(([snapshot_date,payload])=>({snapshot_date,payload}))
  let path='/rest/v1/prediction_snapshots?select=snapshot_date,payload,generated_at&order=snapshot_date.asc'
  if(fromDate)path+=`&snapshot_date=gte.${encodeURIComponent(fromDate)}`
  if(toDate)path+=`&snapshot_date=lte.${encodeURIComponent(toDate)}`
  return await request(path)
}
export async function saveBoard(date,board,{preservePublished=true}={}){
  const existing=preservePublished?await loadBoard(date,{allowVersionMismatch:true}).catch(()=>null):null
  const finalBoard=preservePublished?mergePublished(existing,board):board
  memory.set(date,finalBoard)
  if(configured())await request('/rest/v1/prediction_snapshots?on_conflict=snapshot_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{snapshot_date:date,generated_at:new Date().toISOString(),payload:finalBoard}})
  return finalBoard
}
export async function clearBoard(date){
  memory.delete(date)
  if(configured())await request(`/rest/v1/prediction_snapshots?snapshot_date=eq.${encodeURIComponent(date)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}
