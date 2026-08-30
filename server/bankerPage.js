import {BANKER_ENGINE} from './bankerEngine.js'

export function toBankerPageRows(picks=[]){
  const safest=[],value=[]
  for(const pick of picks||[]){
    const kind=pick.rule==='OPP_TT_OVER25'||pick.rule==='DRAW_OR_OVER25'?'value':'safest'
    const marketName=pick.family==='1X2'?'Match winner':pick.family==='Team Goals'?'Team goals':pick.family==='Combo'?'Combo':String(pick.market||'').replaceAll('-',' ')
    const row={
      ...pick,
      kind,
      category:kind,
      marketName,
      why:Array.isArray(pick.reasons)?pick.reasons:pick.why,
      whyText:pick.whyText||(Array.isArray(pick.reasons)?pick.reasons.join(' '):'')
    }
    if(kind==='value')value.push(row)
    else safest.push(row)
  }
  return{
    safestBankers:safest,
    valueBankers:value,
    bestPicks:[...safest,...value],
    meta:{engine:BANKER_ENGINE,safestCount:safest.length,valueCount:value.length,total:safest.length+value.length,source:'banker-totals-v1'}
  }
}
