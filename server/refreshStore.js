import { fetchWithPolicy } from './providerFetch.js'

const rawUrl=String(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'')
const url=rawUrl&&!/^https?:\/\//i.test(rawUrl)?`https://${rawUrl}`:rawUrl
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
const table=process.env.REFRESH_JOB_TABLE||'prediction_refresh_jobs'
let support='unknown'
const headers=extra=>({apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',...extra})
function configured(){return Boolean(url&&service)}
function unavailableStatus(status,body=''){return status===404||status===406||/PGRST202|42P01|does not exist|Could not find the function/i.test(String(body||''))}
function iso(v){return v||null}
function normalize(row){if(!row)return null;return{date:String(row.job_date||row.date||''),status:row.status||'idle',startedAt:iso(row.started_at),updatedAt:iso(row.updated_at||row.heartbeat_at),finishedAt:iso(row.finished_at),progress:row.progress||null,error:row.error||null,board:null,persistent:true}}
export function refreshStoreMode(){return !configured()?'memory-only':support==='available'?'supabase':'supabase-with-memory-fallback'}
export async function claimRefreshJob(date,ownerId,staleAfterSeconds=300){
  if(!configured()||support==='unavailable')return{supported:false,claimed:true}
  try{
    const r=await fetchWithPolicy(`${url}/rest/v1/rpc/claim_prediction_refresh_job`,{method:'POST',headers:headers(),body:JSON.stringify({p_job_date:date,p_owner_id:ownerId,p_stale_after_seconds:Math.max(30,Number(staleAfterSeconds||300))})},{timeoutMs:8000,retries:1})
    const body=await r.text()
    if(!r.ok){if(unavailableStatus(r.status,body)){support='unavailable';return{supported:false,claimed:true}};throw new Error(`Refresh job claim failed (${r.status})`)}
    support='available';let parsed=false;try{parsed=JSON.parse(body)}catch{};if(Array.isArray(parsed))parsed=parsed[0]
    return{supported:true,claimed:parsed===true||parsed?.claim_prediction_refresh_job===true}
  }catch(e){console.warn('Persistent refresh claim unavailable:',e.message);return{supported:false,claimed:true}}
}
export async function saveRefreshJob(job){
  if(!configured()||support==='unavailable')return false
  const payload={job_date:job.date,status:job.status,owner_id:job.ownerId||null,started_at:job.startedAt||null,updated_at:job.updatedAt||new Date().toISOString(),heartbeat_at:job.updatedAt||new Date().toISOString(),finished_at:job.finishedAt||null,progress:job.progress||null,error:job.error||null}
  try{
    const r=await fetchWithPolicy(`${url}/rest/v1/${table}?on_conflict=job_date`,{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(payload)},{timeoutMs:8000,retries:1})
    if(!r.ok){const body=await r.text();if(unavailableStatus(r.status,body)){support='unavailable';return false};throw new Error(`Refresh job save failed (${r.status})`)}
    support='available';return true
  }catch(e){console.warn('Persistent refresh save unavailable:',e.message);return false}
}
export async function loadRefreshJob(date){
  if(!configured()||support==='unavailable')return null
  try{
    const r=await fetchWithPolicy(`${url}/rest/v1/${table}?select=job_date,status,started_at,updated_at,finished_at,heartbeat_at,progress,error&job_date=eq.${encodeURIComponent(date)}&limit=1`,{headers:headers()},{timeoutMs:8000,retries:1})
    const body=await r.text()
    if(!r.ok){if(unavailableStatus(r.status,body)){support='unavailable';return null};throw new Error(`Refresh job read failed (${r.status})`)}
    support='available';const rows=JSON.parse(body||'[]');return normalize(rows?.[0]||null)
  }catch(e){console.warn('Persistent refresh read unavailable:',e.message);return null}
}
