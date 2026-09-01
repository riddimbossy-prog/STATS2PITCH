import {ENGINE_VERSION} from './config.js'
import {BANKER_ENGINE} from './bankerEngine.js'
import {toBankerPageRows} from './bankerPage.js'

const raw=String(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'')
const URL=!raw?'':/^https?:\/\//i.test(raw)?raw:raw.includes('.supabase.co')?`https://${raw}`:`https://${raw}.supabase.co`
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY||''
const ANON=process.env.SUPABASE_ANON_KEY||''
const memory=new Map()
const configured=()=>Boolean(URL&&SERVICE)
async function request(path,{method='GET',body,token=SERVICE,headers={}}={}){
  const res=await fetch(`${URL}${path}`,{method,headers:{apikey:SERVICE||ANON,Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await res.json().catch(()=>null)
  if(!res.ok)throw new Error(`Supabase ${res.status}`)
  return data
}
function isLogo(v){const s=String(v||'').trim();return /^https?:\/\//i.test(s)||s.startsWith('/')}
function preferLogo(...values){
  const urls=values.map(v=>String(v||'').trim()).filter(isLogo)
  return urls.find(u=>/s\.sporty\.net\//i.test(u))||urls[0]||null
}
export function attachCrests(board){
  if(!board)return board
  const fx=new Map((board.fixtures||[]).map(f=>[String(f.fixtureId),f]))
  const patch=row=>{
    if(!row)return row
    const f=fx.get(String(row.fixtureId))||{}
    const homeLogo=preferLogo(row.homeLogo,f.homeLogo)
    const awayLogo=preferLogo(row.awayLogo,f.awayLogo)
    const homeId=row.homeId??f.homeId??null
    const awayId=row.awayId??f.awayId??null
    if(homeLogo===row.homeLogo&&awayLogo===row.awayLogo&&homeId===row.homeId&&awayId===row.awayId)return row
    return{...row,homeLogo,awayLogo,homeId,awayId}
  }
  const next={...board}
  for(const key of ['bestPicks','varTips','filterTips','goalsBankers','dailyBankers','safestBankers','valueBankers','bankers','priority'])if(Array.isArray(board[key]))next[key]=board[key].map(patch)
  return next
}
function applyBankerPage(board){
  if(!board||!Array.isArray(board.bankers))return board
  const page=toBankerPageRows(board.bankers)
  return{
    ...board,
    safestBankers:page.safestBankers,
    valueBankers:page.valueBankers,
    dailyBankers:page.bestPicks,
    dailyBankersMeta:page.meta,
    meta:{
      ...(board.meta||{}),
      dailyBankersEngine:BANKER_ENGINE,
      safestBankersCount:page.safestBankers.length,
      valueBankersCount:page.valueBankers.length,
      bankerRulesEngine:BANKER_ENGINE,
      bankerRulesCount:board.bankers.length
    }
  }
}
const proofKey=p=>`${p?.fixtureId}|${p?.market}|${String(p?.selection||'').trim()}`
function stampPick(p,at){return{...p,publishedAt:p?.publishedAt||at,proofKey:p?.proofKey||proofKey(p)}}
function mergeRows(oldRows,freshRows,now,existing){
  const oldList=Array.isArray(oldRows)?oldRows:[]
  const freshList=Array.isArray(freshRows)?freshRows:[]
  const freshMap=new Map(freshList.map(p=>[String(p?.fixtureId),p]))
  const out=[]
  const seen=new Set()
  for(const old of oldList){
    const id=String(old?.fixtureId??'')
    if(!id||seen.has(id))continue
    const fresh=freshMap.get(id)
    const stamped=stampPick(old,old.publishedAt||existing?.meta?.firstPublishedAt||existing?.meta?.storedAt||now)
    out.push({
      ...stamped,
      homeLogo:preferLogo(fresh?.homeLogo,stamped.homeLogo,old.homeLogo),
      awayLogo:preferLogo(fresh?.awayLogo,stamped.awayLogo,old.awayLogo),
      homeId:stamped.homeId??fresh?.homeId??old.homeId??null,
      awayId:stamped.awayId??fresh?.awayId??old.awayId??null
    })
    seen.add(id)
  }
  for(const p of freshList){
    const id=String(p?.fixtureId??'')
    if(!id||seen.has(id))continue
    out.push(stampPick(p,now))
    seen.add(id)
  }
  return out.sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0))
}
function countTips(board){
  return (board?.bestPicks||[]).length+(board?.varTips||[]).length+(board?.filterTips||[]).length+(board?.goalsBankers||[]).length+(board?.dailyBankers||[]).length+(board?.safestBankers||[]).length+(board?.valueBankers||[]).length+(board?.priority||[]).length+(board?.bankers||[]).length
}
function incomingFeedEmpty(board){
  const source=Number(board?.meta?.sourceFixtures??board?.meta?.diagnostics?.sourceFixtures??0)
  const scheduled=Number(board?.meta?.scheduledFixtures??board?.meta?.diagnostics?.scheduledFixtures??0)
  return source===0&&scheduled===0&&countTips(board)===0
}
function mergePublished(existing,incoming){
  if(!existing)return incoming
  if(incomingFeedEmpty(incoming)&&countTips(existing)>0)return existing
  const now=incoming?.meta?.generatedAt||new Date().toISOString()
  const sameEngine=String(existing?.meta?.engineVersion||'')===String(incoming?.meta?.engineVersion||'')
  if(!sameEngine)return countTips(incoming)>0?incoming:existing
  const bestPicks=mergeRows(existing?.bestPicks,incoming?.bestPicks,now,existing)
  const varTips=mergeRows(existing?.varTips,incoming?.varTips,now,existing)
  const filterTips=mergeRows(existing?.filterTips,incoming?.filterTips,now,existing)
  const goalsBankers=mergeRows(existing?.goalsBankers,incoming?.goalsBankers,now,existing)
  const bankers=mergeRows(existing?.bankers,incoming?.bankers,now,existing)
  return attachCrests({
    ...incoming,
    bestPicks,
    varTips,
    filterTips,
    goalsBankers,
    bankers,
    results:{...(existing?.results||{}),...(incoming?.results||{})},
    resultSummary:incoming?.resultSummary||existing?.resultSummary||null,
    availableMarkets:[...new Set([...(incoming?.availableMarkets||[]),...bestPicks.map(x=>x.market).filter(Boolean)])].sort(),
    meta:{
      ...(incoming?.meta||{}),
      firstPublishedAt:existing?.meta?.firstPublishedAt||existing?.meta?.storedAt||now,
      publishedPicks:bestPicks.length,
      varTipsCount:varTips.length,
      filterTipsCount:filterTips.length,
      goalsBankersCount:goalsBankers.length,
      bankerRulesCount:bankers.length
    }
  })
}
export async function loadBoard(date,{allowVersionMismatch=false}={}){
  if(!configured()){const b=memory.get(date)||null;return allowVersionMismatch?b:(b?.meta?.engineVersion===ENGINE_VERSION?b:null)}
  const rows=await request(`/rest/v1/prediction_snapshots?select=payload,generated_at&snapshot_date=eq.${encodeURIComponent(date)}&limit=1`)
  const row=Array.isArray(rows)?rows[0]:null,b=row?.payload||null
  if(!b||(!allowVersionMismatch&&b?.meta?.engineVersion!==ENGINE_VERSION))return null
  return{...b,meta:{...(b.meta||{}),storedAt:row.generated_at}}
}
export async function listBoards(fromDate,toDate){
  if(!configured())return[...memory.entries()].filter(([d])=>(!fromDate||d>=fromDate)&&(!toDate||d<=toDate)).map(([snapshot_date,payload])=>({snapshot_date,payload}))
  let path='/rest/v1/prediction_snapshots?select=snapshot_date,payload,generated_at&order=snapshot_date.asc'
  if(fromDate)path+=`&snapshot_date=gte.${encodeURIComponent(fromDate)}`
  if(toDate)path+=`&snapshot_date=lte.${encodeURIComponent(toDate)}`
  return await request(path)
}
export async function saveBoard(date,board,{preservePublished=true}={}){
  const existing=preservePublished?await loadBoard(date,{allowVersionMismatch:true}).catch(()=>null):null
  if(preservePublished&&existing&&incomingFeedEmpty(board)&&countTips(existing)>0){
    const kept={
      ...existing,
      meta:{
        ...(existing.meta||{}),
        refresh:{...(board?.meta?.refresh||{}),state:'preserved',reason:'empty-upstream-feed',generatedAt:board?.meta?.generatedAt||new Date().toISOString()},
        lastEmptyRefreshAt:board?.meta?.generatedAt||new Date().toISOString()
      }
    }
    memory.set(date,kept)
    if(configured())await request('/rest/v1/prediction_snapshots?on_conflict=snapshot_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{snapshot_date:date,generated_at:new Date().toISOString(),payload:kept}})
    return kept
  }
  const merged=preservePublished?mergePublished(existing,board):board
  const finalBoard=attachCrests(applyBankerPage(merged))
  memory.set(date,finalBoard)
  if(configured())await request('/rest/v1/prediction_snapshots?on_conflict=snapshot_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{snapshot_date:date,generated_at:new Date().toISOString(),payload:finalBoard}})
  return finalBoard
}
export async function clearBoard(date){
  memory.delete(date)
  if(configured())await request(`/rest/v1/prediction_snapshots?snapshot_date=eq.${encodeURIComponent(date)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}
