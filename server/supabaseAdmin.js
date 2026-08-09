const rawUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const url = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

function need(){ if(!url||!anon||!service) throw new Error('Supabase server environment variables are missing.') }
export async function verifyBearer(header){
 need(); const token=String(header||'').replace(/^Bearer\s+/i,''); if(!token)return null
 const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}}); if(!r.ok)return null; return r.json()
}
export async function saveSnapshot(board,date){
 need(); const r=await fetch(`${url}/rest/v1/prediction_snapshots?on_conflict=snapshot_date`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({snapshot_date:date,payload:board,generated_at:new Date().toISOString()})}); if(!r.ok)throw new Error(`Supabase snapshot write failed (${r.status}): ${await r.text()}`)
}
export async function loadLatestSnapshot(){
 need(); const r=await fetch(`${url}/rest/v1/prediction_snapshots?select=payload,generated_at,snapshot_date&order=generated_at.desc&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}}); if(!r.ok)throw new Error(`Supabase snapshot read failed (${r.status})`); const rows=await r.json(); return rows?.[0]?.payload||null
}
export async function createConfirmedUser(email,password){
 need();
 const r=await fetch(`${url}/auth/v1/admin/users`,{
  method:'POST',
  headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},
  body:JSON.stringify({email,password,email_confirm:true})
 });
 const body=await r.json().catch(()=>({}));
 if(!r.ok){
  const msg=body?.msg||body?.message||body?.error_description||body?.error||`Supabase admin user creation failed (${r.status})`;
  const err=new Error(msg); err.status=r.status; throw err;
 }
 return body;
}

