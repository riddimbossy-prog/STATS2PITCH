import {readFileSync} from 'node:fs'

const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'')
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
if(!url||!key){
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const file=JSON.parse(readFileSync(new URL('../data/split-bankers.json', import.meta.url),'utf8'))
const dates=process.argv[2]?[process.argv[2]]:Object.keys(file).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
const headers={
  apikey:key,
  Authorization:`Bearer ${key}`,
  Accept:'application/json',
  'Content-Type':'application/json'
}

function drop(rows){
  return (Array.isArray(rows)?rows:[]).filter(row=>row?.engine!=='sporty-split-v1')
}

for(const date of dates){
  const pack=file[date]
  const incoming=Array.isArray(pack?.valueBankers)?pack.valueBankers:[]
  if(!incoming.length){
    console.log(date,'no rows')
    continue
  }
  const res=await fetch(`${url}/rest/v1/prediction_snapshots?select=payload&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`,{headers})
  const rows=await res.json().catch(()=>null)
  if(!res.ok){
    console.error(date,'load',res.status,JSON.stringify(rows).slice(0,300))
    process.exit(1)
  }
  const existing=Array.isArray(rows)&&rows[0]?.payload?rows[0].payload:{}
  const value=[...drop(existing.valueBankers),...incoming]
  const daily=[...drop(existing.dailyBankers),...incoming]
  const payload={
    ...existing,
    valueBankers:value,
    dailyBankers:daily,
    meta:{
      ...(existing.meta||{}),
      generatedAt:new Date().toISOString(),
      splitBankersEngine:'sporty-split-v1',
      splitBankersCount:incoming.length,
      valueBankersCount:value.length
    }
  }
  const save=await fetch(`${url}/rest/v1/prediction_snapshots?on_conflict=snapshot_date`,{
    method:'POST',
    headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({snapshot_date:date,generated_at:new Date().toISOString(),payload})
  })
  if(!save.ok){
    console.error(date,'save',save.status,await save.text())
    process.exit(1)
  }
  console.log(date,'published',incoming.length)
}
