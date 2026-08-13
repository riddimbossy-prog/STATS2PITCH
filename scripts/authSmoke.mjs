import crypto from 'node:crypto'

function normalizeSupabaseUrl(value){
  const raw=String(value||'').trim().replace(/\/+$/,'')
  if(!raw)return''
  const dashboard=raw.match(/\/project\/([a-z0-9]+)/i)?.[1]
  if(dashboard)return`https://${dashboard}.supabase.co`
  if(/^[a-z0-9]{15,30}$/i.test(raw))return`https://${raw}.supabase.co`
  if(/^[a-z0-9-]+\.supabase\.co$/i.test(raw))return`https://${raw}`
  return raw
}

const base=normalizeSupabaseUrl(process.env.SUPABASE_URL)
const anon=process.env.SUPABASE_ANON_KEY||''
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
if(!base||!anon||!service)throw new Error('Missing Supabase smoke-test configuration')
try{new URL(base)}catch{throw new Error('SUPABASE_URL is invalid')}

const email=`stats2pitch-smoke-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.invalid`
const password=`S2p!${crypto.randomBytes(18).toString('base64url')}`
let userId=''

async function call(url,options={}){
  const res=await fetch(url,options)
  const data=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(data?.error||data?.message||data?.msg||data?.error_description||`HTTP ${res.status}`)
  return data
}

try{
  const created=await call(`${base}/auth/v1/admin/users`,{
    method:'POST',
    headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},
    body:JSON.stringify({email,password,email_confirm:true})
  })
  userId=created.id
  if(!userId)throw new Error('Smoke user was not created')

  const session=await call(`${base}/functions/v1/stats2pitch-auth/login`,{
    method:'POST',
    headers:{apikey:anon,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  })
  if(!session.access_token||!session.refresh_token)throw new Error('Login did not return a complete session')

  const me=await call(`${base}/functions/v1/stats2pitch-api/me`,{
    headers:{apikey:anon,Authorization:`Bearer ${session.access_token}`}
  })
  if(me.id!==userId)throw new Error('Authenticated API user mismatch')

  const refreshed=await call(`${base}/functions/v1/stats2pitch-auth/refresh`,{
    method:'POST',
    headers:{apikey:anon,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:session.refresh_token})
  })
  if(!refreshed.access_token)throw new Error('Session refresh failed')

  console.log('Stats2Pitch authentication smoke test passed')
}finally{
  if(userId){
    await fetch(`${base}/auth/v1/admin/users/${userId}`,{
      method:'DELETE',
      headers:{apikey:service,Authorization:`Bearer ${service}`}
    }).catch(()=>{})
  }
}
