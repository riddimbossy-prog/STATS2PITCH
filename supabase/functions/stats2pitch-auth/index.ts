const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const ALLOW_PUBLIC_SIGNUP=String(Deno.env.get('ALLOW_PUBLIC_SIGNUP')||'true').toLowerCase()!=='false'

const cors={
  'Access-Control-Allow-Origin':Deno.env.get('STATS2PITCH_ALLOWED_ORIGIN')||'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})

async function readJson(res:Response){
  return await res.json().catch(()=>({}))
}

function emailsMatch(a:string,b:string){
  return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase()
}

async function userExists(email:string){
  if(!SUPABASE_SERVICE_ROLE_KEY||!email)return null
  const response=await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200&email=${encodeURIComponent(email)}`,{
    headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`}
  }).catch(()=>null)
  if(!response)return null
  const data=await readJson(response)
  if(!response.ok)return null
  const users=Array.isArray(data?.users)?data.users:Array.isArray(data)?data:data?.user?[data.user]:data?.id?[data]:[]
  return users.some((u: {email?: string})=>emailsMatch(String(u?.email||''),email))
}

async function passwordGrant(email:string,password:string){
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  })
  const data=await readJson(response)
  if(!response.ok){
    const message=data?.msg||data?.error_description||data?.message||data?.error||`Authentication failed (${response.status})`
    return json({error:message},response.status)
  }
  return json(data,response.status)
}

async function confirmUser(id:string){
  if(!SUPABASE_SERVICE_ROLE_KEY||!id)return
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`,{
    method:'PUT',
    headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({email_confirm:true})
  }).catch(()=>{})
}

async function adminCreate(email:string,password:string){
  const response=await fetch(`${SUPABASE_URL}/auth/v1/admin/users`,{
    method:'POST',
    headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({email,password,email_confirm:true})
  })
  return {ok:response.ok,status:response.status,data:await readJson(response)}
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  const url=new URL(req.url),marker='/stats2pitch-auth',route=(url.pathname.split(marker)[1]||'/').replace(/\/+$/,'')||'/'
  if(route==='/health'&&req.method==='GET')return json({ok:true,service:'stats2pitch-auth',version:'2.4.0'})
  if(req.method!=='POST')return json({error:'Not found'},404)
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY)return json({error:'Authentication service is not configured'},500)
  const body=await req.json().catch(()=>({}))
  if(route==='/login'){
    const email=String(body?.email||'').trim(),password=String(body?.password||'')
    if(!email||!password)return json({error:'Enter your email and password.'},400)
    const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    })
    const data=await readJson(response)
    if(response.ok)return json(data,response.status)
    const message=String(data?.msg||data?.error_description||data?.message||data?.error||'')
    if(/invalid/i.test(message)){
      const exists=await userExists(email)
      if(exists===false)return json({error:'No account for this email yet.',code:'new_user'},404)
      return json({error:'Wrong email or password.',code:'invalid_credentials'},400)
    }
    return json({error:message||`Authentication failed (${response.status})`},response.status)
  }
  if(route==='/signup'){
    if(!ALLOW_PUBLIC_SIGNUP)return json({error:'Account creation is currently disabled.'},403)
    const email=String(body?.email||'').trim(),password=String(body?.password||'')
    if(!email||!password)return json({error:'Enter your email and password.'},400)
    if(password.length<6)return json({error:'Password must be at least 6 characters.'},400)
    if(SUPABASE_SERVICE_ROLE_KEY){
      const created=await adminCreate(email,password)
      if(!created.ok){
        const message=String(created.data?.msg||created.data?.error_description||created.data?.message||created.data?.error||'')
        if(/already|registered|exists/i.test(message))return json({error:'That email already has an account. Sign in instead.',code:'exists'},409)
        return json({error:message||'Unable to create account.'},created.status||400)
      }
      return passwordGrant(email,password)
    }
    const response=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
      method:'POST',
      headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    })
    const data=await readJson(response)
    if(!response.ok){
      const message=String(data?.msg||data?.error_description||data?.message||data?.error||'')
      if(/already|registered|exists/i.test(message))return json({error:'That email already has an account. Sign in instead.',code:'exists'},409)
      return json({error:message||`Authentication failed (${response.status})`},response.status)
    }
    if(data?.id)await confirmUser(data.id)
    if(data?.access_token)return json(data,response.status)
    if(data?.session?.access_token)return json(data.session,response.status)
    return passwordGrant(email,password)
  }
  if(route==='/refresh'){
    const refresh_token=String(body?.refresh_token||'')
    if(!refresh_token)return json({error:'Refresh token is required.'},400)
    const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',
      headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token})
    })
    const data=await readJson(response)
    if(!response.ok){
      const message=data?.msg||data?.error_description||data?.message||data?.error||`Authentication failed (${response.status})`
      return json({error:message},response.status)
    }
    return json(data,response.status)
  }
  return json({error:'Not found'},404)
})
