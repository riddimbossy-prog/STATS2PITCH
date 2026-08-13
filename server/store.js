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
export async function loadBoard(date){
  if(!configured()){const b=memory.get(date)||null;return b?.meta?.engineVersion===ENGINE_VERSION?b:null}
  const rows=await request(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null,b=row?.payload||null
  if(!b||b?.meta?.engineVersion!==ENGINE_VERSION)return null
  return{...b,meta:{...(b.meta||{}),storedAt:row.generated_at}}
}
export async function saveBoard(date,board){
  memory.set(date,board)
  if(configured())await request('/rest/v1/prediction_snapshots?on_conflict=snapshot_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{snapshot_date:date,generated_at:new Date().toISOString(),payload:board}})
  return board
}
export async function clearBoard(date){
  memory.delete(date)
  if(configured())await request(`/rest/v1/prediction_snapshots?snapshot_date=eq.${encodeURIComponent(date)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}
