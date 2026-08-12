const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const ALLOW_PUBLIC_SIGNUP=String(Deno.env.get('ALLOW_PUBLIC_SIGNUP')||'true').toLowerCase()!=='false'

const cors={
  'Access-Control-Allow-Origin':Deno.env.get('STATS2PITCH_ALLOWED_ORIGIN')||'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})

async function exchange(path:string,body:unknown){
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY)return json({error:'Authentication service is not configured'},500)
  const response=await fetch(`${SUPABASE_URL}${path}`,{
    method:'POST',
    headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  })
  const data=await response.json().catch(()=>({}))
  if(!response.ok){
    const message=data?.msg||data?.error_description||data?.message||data?.error||`Authentication failed (${response.status})`
    return json({error:message},response.status)
  }
  return json(data,response.status)
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  const url=new URL(req.url),marker='/stats2pitch-auth',route=(url.pathname.split(marker)[1]||'/').replace(/\/+$/,'')||'/'
  if(route==='/health'&&req.method==='GET')return json({ok:true,service:'stats2pitch-auth',version:'2.2.2'})
  if(req.method!=='POST')return json({error:'Not found'},404)
  const body=await req.json().catch(()=>({}))
  if(route==='/login'){
    const email=String(body?.email||'').trim(),password=String(body?.password||'')
    if(!email||!password)return json({error:'Enter your email and password.'},400)
    return exchange('/auth/v1/token?grant_type=password',{email,password})
  }
  if(route==='/signup'){
    if(!ALLOW_PUBLIC_SIGNUP)return json({error:'Account creation is currently disabled.'},403)
    const email=String(body?.email||'').trim(),password=String(body?.password||'')
    if(!email||!password)return json({error:'Enter your email and password.'},400)
    return exchange('/auth/v1/signup',{email,password})
  }
  if(route==='/refresh'){
    const refresh_token=String(body?.refresh_token||'')
    if(!refresh_token)return json({error:'Refresh token is required.'},400)
    return exchange('/auth/v1/token?grant_type=refresh_token',{refresh_token})
  }
  return json({error:'Not found'},404)
})
