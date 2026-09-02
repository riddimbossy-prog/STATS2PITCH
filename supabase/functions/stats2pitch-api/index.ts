const ELITE_FEED_TOKEN=Deno.env.get('STATS2PITCH_ELITE_FEED_TOKEN')||''
const ENGINE_VERSION='stats2pitch-v5-var-tips'
const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||''
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'UTC'
const SPORTYBET_COUNTRY=(Deno.env.get('SPORTYBET_COUNTRY')||'gh').replace(/[^a-z]/gi,'').toLowerCase()||'gh'
const SPORTYBET_BASE=(Deno.env.get('SPORTYBET_BASE')||'https://www.sportybet.com').replace(/\/$/,'')
const TTL_MS=Math.max(15,Number(Deno.env.get('AUTO_REFRESH_TTL_MINUTES')||45))*60_000
const ADMIN_EMAILS=(Deno.env.get('STATS2PITCH_ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
const GITHUB_TOKEN=Deno.env.get('STATS2PITCH_GITHUB_TOKEN')||''
const GITHUB_REPO=Deno.env.get('STATS2PITCH_GITHUB_REPO')||'riddimbossy-prog/STATS2PITCH'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200,cache='no-store')=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':cache}})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const finite=(v:any)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const norm=(s:any)=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const FINISHED=new Set(['FT','AET','PEN'])
