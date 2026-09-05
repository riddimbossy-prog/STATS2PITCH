const SUPABASE_URL=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const APP_TIMEZONE=Deno.env.get('APP_TIMEZONE')||'Africa/Accra'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Max-Age':'86400'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=90'}})
const dateOk=(v:string|null)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))

function today(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:APP_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(t:string)=>parts.find(x=>x.type===t)?.value||''
  return`${get('year')}-${get('month')}-${get('day')}`
}

async function snapshot(date:string){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Storage unavailable')
  const path=`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`
  const res=await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,Accept:'application/json'}})
  const rows=await res.json().catch(()=>null)
  if(!res.ok)throw new Error(`Storage ${res.status}`)
  const row=Array.isArray(rows)?rows[0]:null
  return row?{payload:row.payload||{},generatedAt:row.generated_at||null}:null
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='GET')return json({error:'Method not allowed'},405)
  try{
    const url=new URL(req.url)
    const raw=url.searchParams.get('date')
    const date=dateOk(raw)?String(raw):today()
    const row=await snapshot(date)
    if(!row)return json({meta:{date,generatedAt:null,engine:'banker-totals-v1.1'},fixtures:[],results:{},dailyBankers:[],safestBankers:[],valueBankers:[],bankers:[],dailyBankersMeta:null})
    const board=row.payload||{}
    const dedicated=Array.isArray(board.bankers)?board.bankers:[]
    const safest=Array.isArray(board.safestBankers)?board.safestBankers:dedicated.filter((x:any)=>x?.kind!=='value'&&x?.rule!=='OPP_TT_OVER25'&&x?.rule!=='DRAW_OR_OVER25')
    const value=Array.isArray(board.valueBankers)?board.valueBankers:dedicated.filter((x:any)=>x?.kind==='value'||x?.rule==='OPP_TT_OVER25'||x?.rule==='DRAW_OR_OVER25')
    const daily=Array.isArray(board.dailyBankers)&&board.dailyBankers.length?board.dailyBankers:[...safest,...value]
    const engine=board?.dailyBankersMeta?.engine||board?.meta?.bankerRulesEngine||board?.bankerRulesMeta?.engine||board?.meta?.dailyBankersEngine||'banker-totals-v1.1'
    return json({
      meta:{date,generatedAt:board?.meta?.generatedAt||row.generatedAt,dailyBankersEngine:engine,safestBankersCount:safest.length,valueBankersCount:value.length,bankerRulesCount:dedicated.length},
      fixtures:Array.isArray(board.fixtures)?board.fixtures:[],
      results:board?.results&&typeof board.results==='object'?board.results:{},
      dailyBankers:daily,
      safestBankers:safest,
      valueBankers:value,
      bankers:dedicated,
      dailyBankersMeta:board?.dailyBankersMeta||null,
      bankerRulesMeta:board?.bankerRulesMeta||null
    })
  }catch(error){
    console.error('stats2pitch-bankers',String(error?.message||error))
    return json({error:'Unable to load bankers right now'},503)
  }
})
