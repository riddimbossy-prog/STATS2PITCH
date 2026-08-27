/** Settled-performance advice. Sample floors stop tiny hot/cold runs from looking like banks. */

export function classifyGroup(g){
  const picks=Number(g?.picks)||0
  const rate=Number(g?.winRate)||0
  if(picks<12)return'thin'
  if((picks>=20&&rate>=70)||(picks>=15&&rate>=75))return'bank'
  if((picks>=20&&rate<55)||(picks>=30&&rate<58))return'avoid'
  if(picks>=20&&rate>=62)return'steady'
  return'watch'
}

export function decorateRows(rows){
  return(rows||[]).map(g=>({...g,tone:classifyGroup(g),label:String(g?.value||'Unknown').replaceAll('-',' ')}))
}

export function sortPerformanceRows(rows){
  return[...rows].sort((a,b)=>{
    const at=a.tone==='thin'?1:0,bt=b.tone==='thin'?1:0
    if(at!==bt)return at-bt
    return(Number(b.winRate)||0)-(Number(a.winRate)||0)||(Number(b.picks)||0)-(Number(a.picks)||0)
  })
}

function byBest(a,b){return(Number(b.winRate)||0)-(Number(a.winRate)||0)||(Number(b.picks)||0)-(Number(a.picks)||0)}
function byWorst(a,b){return(Number(a.winRate)||0)-(Number(b.winRate)||0)||(Number(b.picks)||0)-(Number(a.picks)||0)}

export function adviceFor(rows){
  const decorated=decorateRows(rows)
  return{
    rows:sortPerformanceRows(decorated),
    bank:decorated.filter(x=>x.tone==='bank').sort(byBest),
    avoid:decorated.filter(x=>x.tone==='avoid').sort(byWorst),
    steady:decorated.filter(x=>x.tone==='steady').sort(byBest),
    watch:decorated.filter(x=>x.tone==='watch').sort(byBest),
    thin:decorated.filter(x=>x.tone==='thin').sort(byBest)
  }
}

