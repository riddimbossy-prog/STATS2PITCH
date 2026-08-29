export const FORM_SAMPLE=5
export const FORM_GOALS_MIN=60
export const FORM_FAV_WIN_MIN=80
export const FORM_OPP_LOSS_MIN=60

const finishedStatus=f=>['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||'').toUpperCase())

export function last5VenueRates(fixtures,teamId,venue){
  const rows=(fixtures||[]).filter(f=>{
    if(!finishedStatus(f))return false
    const hid=String(f?.teams?.home?.id??''),aid=String(f?.teams?.away?.id??'')
    return venue==='home'?hid===String(teamId):aid===String(teamId)
  }).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,FORM_SAMPLE)
  let win=0,loss=0,over25=0,btts=0,scored2=0,conceded2=0,n=0
  for(const f of rows){
    const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
    if(!Number.isFinite(h)||!Number.isFinite(a))continue
    const own=venue==='home'?h:a,opp=venue==='home'?a:h
    n++
    if(own>opp)win++
    else if(own<opp)loss++
    if(own+opp>2.5)over25++
    if(own>0&&opp>0)btts++
    if(own>=2)scored2++
    if(opp>=2)conceded2++
  }
  const pct=v=>n?Math.round(v*100/n):null
  return{played:n,ready:n>=FORM_SAMPLE,win:pct(win),loss:pct(loss),over25:pct(over25),btts:pct(btts),scored2plus:pct(scored2),conceded2plus:pct(conceded2)}
}

export function goalsFormGate(route,favourite,homeForm,awayForm,opts={}){
  if(opts.waive)return{ok:true,skip:null,homeForm,awayForm,waived:true}
  if(!homeForm?.ready||!awayForm?.ready)return{ok:false,skip:'form-sample',homeForm,awayForm}
  const fav=favourite==='away'?awayForm:homeForm
  const opp=favourite==='away'?homeForm:awayForm
  if(route==='OVER_2.5'){
    if((homeForm.over25??0)<FORM_GOALS_MIN||(awayForm.over25??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-over25',homeForm,awayForm}
  }else if(route==='GG'){
    if((homeForm.btts??0)<FORM_GOALS_MIN||(awayForm.btts??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-gg',homeForm,awayForm}
  }else if(route==='FAV_2PLUS'){
    if((fav.scored2plus??0)<FORM_GOALS_MIN||(opp.conceded2plus??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-2plus',homeForm,awayForm}
  }else if(route==='FAV_WIN'){
    if((fav.win??0)<FORM_FAV_WIN_MIN||(opp.loss??0)<FORM_OPP_LOSS_MIN)return{ok:false,skip:'form-fav-win',homeForm,awayForm}
  }
  return{ok:true,skip:null,homeForm,awayForm}
}
