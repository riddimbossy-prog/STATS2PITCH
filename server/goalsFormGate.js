export const FORM_SAMPLE=5
export const FORM_GOALS_MIN=60
export const FORM_FAV_WIN_MIN=80
export const FORM_OPP_LOSS_MIN=60
export const WEAK_FAV_BOTTOM_N=3
export const WEAK_FAV_PPG_MAX=0.90
export const WEAK_FAV_PPG_GAMES=3

const finishedStatus=f=>['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||'').toUpperCase())
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null

export function last5VenueRates(fixtures,teamId,venue){
  const rows=(fixtures||[]).filter(f=>{
    if(!finishedStatus(f))return false
    const hid=String(f?.teams?.home?.id??''),aid=String(f?.teams?.away?.id??'')
    return venue==='home'?hid===String(teamId):aid===String(teamId)
  }).sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)).slice(0,FORM_SAMPLE)
  let win=0,loss=0,draw=0,over25=0,btts=0,scored2=0,conceded2=0,comboOver=0,comboUnder=0,comboGg=0,n=0
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
    if(own===opp)draw++
    if(own===opp||own+opp>2.5)comboOver++
    if(own===opp||own+opp<2.5)comboUnder++
    if(own===opp||(own>0&&opp>0))comboGg++
  }
  const pct=v=>n?Math.round(v*100/n):null
  return{played:n,ready:n>=FORM_SAMPLE,win:pct(win),loss:pct(loss),draw:pct(draw),over25:pct(over25),btts:pct(btts),scored2plus:pct(scored2),conceded2plus:pct(conceded2),comboOver:pct(comboOver),comboUnder:pct(comboUnder),comboGg:pct(comboGg)}
}

function applyRouteForm(route,favourite,homeForm,awayForm){
  const fav=favourite==='away'?awayForm:homeForm
  const opp=favourite==='away'?homeForm:awayForm
  if(route==='OVER_2.5'){
    if((homeForm.over25??0)<FORM_GOALS_MIN||(awayForm.over25??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-over25'}
  }else if(route==='GG'){
    if((homeForm.btts??0)<FORM_GOALS_MIN||(awayForm.btts??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-gg'}
  }else if(route==='FAV_2PLUS'){
    if((fav.scored2plus??0)<FORM_GOALS_MIN||(opp.conceded2plus??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-2plus'}
  }else if(route==='FAV_WIN'){
    if((fav.win??0)<FORM_FAV_WIN_MIN||(opp.loss??0)<FORM_OPP_LOSS_MIN)return{ok:false,skip:'form-fav-win'}
  }else if(route==='DRAW_OR_OVER_25'){
    if((homeForm.comboOver??0)<FORM_GOALS_MIN||(awayForm.comboOver??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-combo-over'}
  }else if(route==='DRAW_OR_UNDER_25'){
    if((homeForm.comboUnder??0)<FORM_GOALS_MIN||(awayForm.comboUnder??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-combo-under'}
  }else if(route==='DRAW_OR_GG'){
    if((homeForm.comboGg??0)<FORM_GOALS_MIN||(awayForm.comboGg??0)<FORM_GOALS_MIN)return{ok:false,skip:'form-combo-gg'}
  }
  return{ok:true,skip:null}
}

export function goalsFormGate(route,favourite,homeForm,awayForm,opts={}){
  const homeN=Number(homeForm?.played||0)
  const awayN=Number(awayForm?.played||0)
  if(opts.waive){
    if(homeN<1||awayN<1)return{ok:true,skip:null,homeForm,awayForm,waived:true}
  }else if(!homeForm?.ready||!awayForm?.ready){
    return{ok:false,skip:'form-sample',homeForm,awayForm}
  }
  const rates=applyRouteForm(route,favourite,homeForm,awayForm)
  return{...rates,homeForm,awayForm,waived:opts.waive===true}
}

export function weakFavouriteGate(route,favourite,homeSplit,awaySplit){
  if(!route||route==='SKIP'||String(route).startsWith('DRAW_OR_'))return{ok:true,skip:null}
  const fav=favourite==='away'?awaySplit:homeSplit
  const pos=num(fav?.position)
  const size=num(fav?.size)
  const ppg=num(fav?.ppg)
  const played=num(fav?.played)
  const bottom=pos!==null&&size!==null&&pos>size-WEAK_FAV_BOTTOM_N
  const poorPpg=ppg!==null&&played!==null&&played>=WEAK_FAV_PPG_GAMES&&ppg<WEAK_FAV_PPG_MAX
  if(!bottom&&!poorPpg)return{ok:true,skip:null,bottom:false,poorPpg:false}
  return{ok:false,skip:bottom?'weak-favourite':'weak-favourite-ppg',bottom,poorPpg}
}
