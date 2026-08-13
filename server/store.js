export function normalizeSupabaseUrl(value){
  const raw=String(value||'').trim().replace(/\/+$/,'')
  if(!raw)return''
  if(/^https?:\/\//i.test(raw))return raw
  if(/^[a-z0-9.-]+\.supabase\.co$/i.test(raw))return`https://${raw}`
  if(/^[a-z0-9-]+$/i.test(raw))return`https://${raw}.supabase.co`
  return raw
}
const URL=normalizeSupabaseUrl(process.env.SUPABASE_URL)
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY||''
const ANON=process.env.SUPABASE_ANON_KEY||''
const memory=new Map()
const configured=()=>Boolean(URL&&SERVICE)
async function request(path,{method='GET',body,token=SERVICE,headers={}}={}){
  if(!URL)throw new Error('SUPABASE_URL is not configured')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000)
  try{
    const res=await fetch(`${URL}${path}`,{method,signal:controller.signal,headers:{apikey:SERVICE||ANON,Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)})
    const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(`Supabase ${res.status}: ${data?.message||data?.error_description||res.statusText}`);return data
  }finally{clearTimeout(timer)}
}
export async function verifyUser(accessToken){if(!URL||!ANON||!accessToken)throw new Error('Authentication unavailable');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);try{const res=await fetch(`${URL}/auth/v1/user`,{signal:controller.signal,headers:{apikey:ANON,Authorization:`Bearer ${accessToken}`}});const data=await res.json().catch(()=>null);if(!res.ok||!data?.id)throw new Error('Authentication required');return data}finally{clearTimeout(timer)}}
export async function loadBoard(date){
  if(!configured())return memory.get(date)||null
  const rows=await request(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null;if(!row)return null;return{...row.payload,meta:{...(row.payload?.meta||{}),storedAt:row.generated_at}}
}
export async function saveBoard(date,board){
  memory.set(date,board);if(!configured())return board
  await request('/rest/v1/prediction_snapshots?on_conflict=snapshot_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{snapshot_date:date,generated_at:new Date().toISOString(),payload:board}});return board
}
export function publicConfig(){return{supabaseUrl:URL,supabaseAnonKey:ANON,allowPublicSignup:String(process.env.ALLOW_PUBLIC_SIGNUP||'true').toLowerCase()!=='false'}}
