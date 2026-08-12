import crypto from 'node:crypto'

const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'')
const anon=process.env.SUPABASE_ANON_KEY||''
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
if(!base||!anon||!service)throw new Error('Missing Supabase smoke-test configuration')

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
