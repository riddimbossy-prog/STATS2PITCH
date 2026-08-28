const fallbackEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]))
const GOAL_ROUTES=['FAV_WIN','FAV_2PLUS','OVER_2.5','GG']
const GOAL_LABELS={FAV_WIN:'Favourite win',FAV_2PLUS:'Favourite 2+','OVER_2.5':'Over 2.5',GG:'GG'}

function shortDate(v){
  const d=new Date(v)
  return Number.isNaN(d.getTime())?'':d.toLocaleDateString([],{day:'numeric',month:'short'})
}

function reasonLines(r){
  if(Array.isArray(r?.reasons)&&r.reasons.length)return r.reasons
  if(Array.isArray(r?.why?.reasons)&&r.why.reasons.length)return r.why.reasons
  if(r?.shortReason)return[r.shortReason]
  if(r?.reason)return String(r.reason).split(' • ').filter(Boolean)
  const home=r?.home||'Home',away=r?.away||'Away'
  const h=Math.round((Number(r?.homeConsensus)||0)/20),a=Math.round((Number(r?.awayConsensus)||0)/20)
  const lines=[]
  if(Number.isFinite(Number(r?.homeConsensus)))lines.push(`${home} backed this in ${h}/5 recent home matches (${r.homeConsensus}%).`)
  if(Number.isFinite(Number(r?.awayConsensus)))lines.push(`${away} backed this in ${a}/5 recent away matches (${r.awayConsensus}%).`)
  if(r?.homeSplit?.sampleReady)lines.push(`${home} sit ${r.homeSplit.position}/${r.homeSplit.size} in the home split table.`)
  if(r?.awaySplit?.sampleReady)lines.push(`${away} sit ${r.awaySplit.position}/${r.awaySplit.size} in the away split table.`)
  if(Number.isFinite(Number(r?.odds)))lines.push(`Published at ${Number(r.odds).toFixed(2)}.`)
  return lines
}

function formPills(rows,esc){
  const list=Array.isArray(rows)?rows:[]
  if(!list.length)return''
  return`<div class="form-pills">${list.map(x=>`<span class="form-pill ${esc(x.result||'')}">${esc(x.result||'–')}</span>`).join('')}</div>`
}

function formMatches(rows,esc){
  const list=Array.isArray(rows)?rows:[]
  if(!list.length)return''
  return`<ul class="form-matches">${list.map(x=>{
    const score=x.hs!=null&&x.as!=null?`${x.hs}–${x.as}`:''
    const vs=x.opponent?`vs ${x.opponent}`:`${x.home} vs ${x.away}`
    const when=shortDate(x.date)
    const league=x.league?`<em>${esc(x.league)}</em>`:''
    return`<li><b>${esc(score||'–')}</b><span>${esc(vs)}${league}</span>${when?`<small>${esc(when)}</small>`:''}</li>`
  }).join('')}</ul>`
}

function avgCell(v){return v==null||v===''?'—':String(v)}
function pctCell(v){return v==null||v===''?'—':`${v}%`}

function comparisonHtml(why,r,esc){
  const home=why?.homeStats||why?.homeAvg||{}
  const away=why?.awayStats||why?.awayAvg||{}
  if(home.played==null&&away.played==null&&home.ppg==null&&away.ppg==null&&home.gf==null&&away.gf==null)return''
  return`<div class="why-compare">
    <h4>Team stats · last matches</h4>
    <table>
      <thead><tr><th></th><th>${esc(r.home||'Home')}</th><th>${esc(r.away||'Away')}</th></tr></thead>
      <tbody>
        <tr><th>Matches</th><td>${esc(avgCell(home.played))}</td><td>${esc(avgCell(away.played))}</td></tr>
        <tr><th>Win %</th><td>${esc(pctCell(home.winPct))}</td><td>${esc(pctCell(away.winPct))}</td></tr>
        <tr><th>PPG</th><td>${esc(avgCell(home.ppg))}</td><td>${esc(avgCell(away.ppg))}</td></tr>
        <tr><th>Avg scored</th><td>${esc(avgCell(home.gf))}</td><td>${esc(avgCell(away.gf))}</td></tr>
        <tr><th>Avg conceded</th><td>${esc(avgCell(home.ga))}</td><td>${esc(avgCell(away.ga))}</td></tr>
        <tr><th>BTTS</th><td>${esc(pctCell(home.btts))}</td><td>${esc(pctCell(away.btts))}</td></tr>
        <tr><th>Over 1.5</th><td>${esc(pctCell(home.over15))}</td><td>${esc(pctCell(away.over15))}</td></tr>
        <tr><th>Over 2.5</th><td>${esc(pctCell(home.over25))}</td><td>${esc(pctCell(away.over25))}</td></tr>
      </tbody>
    </table>
  </div>`
}

function h2hHtml(rows,esc){
  const list=Array.isArray(rows)?rows:[]
  if(!list.length)return''
  return`<div class="why-h2h">
    <h4>Previous meetings</h4>
    <ul>${list.map(x=>{
      const score=x.hs!=null&&x.as!=null?`${x.hs}–${x.as}`:'–'
      const when=shortDate(x.date)
      return`<li><span>${esc(x.home)} <b>${esc(score)}</b> ${esc(x.away)}</span>${when?`<small>${esc(when)}</small>`:''}</li>`
    }).join('')}</ul>
  </div>`
}

function consensusHtml(r,esc){
  const hr=Number(r?.homeConsensus),ar=Number(r?.awayConsensus)
  if(!Number.isFinite(hr)&&!Number.isFinite(ar))return''
  return`<div class="why-consensus">
    ${Number.isFinite(hr)?`<span><small>${esc(r.home||'Home')} home</small><b>${esc(hr)}%</b></span>`:''}
    ${Number.isFinite(ar)?`<span><small>${esc(r.away||'Away')} away</small><b>${esc(ar)}%</b></span>`:''}
  </div>`
}

function bankerHtml(r,esc,banker){
  const checks=Array.isArray(r?.bankerChecks)?r.bankerChecks.filter(x=>x?.ok):[]
  if(!banker||!checks.length)return''
  return`<div class="banker-safety"><b>Banker check passed</b>${checks.map(x=>`<span>✓ ${esc(x.label)}</span>`).join('')}</div>`
}

function px(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(2):null}
function vs(a,b){if(a&&b)return` (${a} vs ${b})`;return a?` (${a})`:''}

function chosenHeadline(route,fav,price){
  if(route==='FAV_WIN')return`${fav} is the short-priced favourite${price?` at ${price}`:''}. Favourite win is the published Goals Banker because this matchup is one-sided enough to take the win instead of a goals market.`
  if(route==='FAV_2PLUS')return`${fav} 2+${price?` at ${price}`:''} is the published Goals Banker. They are the favourite and priced to score at least twice, which is a stronger favourite-side call than the straight win or a shared goals market.`
  if(route==='OVER_2.5')return`Over 2.5${price?` at ${price}`:''} is the published Goals Banker. The game is priced as a goals match, so the total is the cleaner market than a favourite win or favourite 2+.`
  if(route==='GG')return`Both teams to score${price?` at ${price}`:''} is the published Goals Banker. Both sides are priced to get on the scoresheet, so GG beats a favourite-side call.`
  return''
}

function passedReason(chosen,other,fav,prices){
  const a=prices[chosen],b=prices[other]
  if(!b)return`${GOAL_LABELS[other]} was not clearly priced, so it could not beat the published market.`
  if(other==='FAV_WIN'){
    if(chosen==='FAV_2PLUS')return`${fav}'s 2+ is the stronger favourite-side market than the straight win${vs(a,b)}.`
    return`This is not a one-sided win call. The published market is a goals pick, not ${fav} to win at ${b}.`
  }
  if(other==='FAV_2PLUS'){
    if(chosen==='FAV_WIN')return`${fav} 2+ is not the sharper favourite-side price${vs(a,b)}. The extra goal is not required for this call.`
    return`This pick is not about ${fav} running up 2+ at ${b}. The published market is the shared goals side of the match.`
  }
  if(other==='OVER_2.5'){
    if(chosen==='GG'){
      if(a&&Number(a)<=Number(b))return`GG is the sharper open-game price than Over 2.5${vs(a,b)}.`
      return`Over 2.5 is available at ${b}, but GG is the published goals market because both sides are in this game.`
    }
    if(chosen==='FAV_WIN')return`Over 2.5 is not short enough to take goals instead of the favourite win${vs(a,b)}.`
    return`Over 2.5 at ${b} was passed over — this pick is ${fav} scoring twice, not a high match total.`
  }
  if(chosen==='OVER_2.5'){
    if(a&&Number(a)<=Number(b))return`Over 2.5 is the sharper goals price than GG${vs(a,b)}.`
    return`GG is available at ${b}, but the game total is the published Goals Banker.`
  }
  if(chosen==='FAV_WIN')return`GG is not the call — this matchup is built around ${fav}, not both sides scoring (${b}).`
  return`GG is not the call — the opponent is not the scoring side this pick is built on (${b}).`
}

export function goalsMarketWhy(pick){
  const route=String(pick?.route||'')
  if(!GOAL_ROUTES.includes(route))return null
  if(pick?.engine&&pick.engine!=='goals-bankers-v1')return null
  const book=pick?.oddsBook||{}
  const prices={FAV_WIN:px(book.fav_odds),FAV_2PLUS:px(book.fav_2plus),'OVER_2.5':px(book.over25),GG:px(book.btts_yes)}
  const fav=pick?.favourite==='home'?pick.home:pick?.favourite==='away'?pick.away:(pick?.home||'the favourite')
  return{
    route,
    chosen:GOAL_LABELS[route],
    price:prices[route],
    headline:chosenHeadline(route,fav,prices[route]),
    passed:GOAL_ROUTES.filter(id=>id!==route).map(id=>({id,label:GOAL_LABELS[id],price:prices[id],reason:passedReason(route,id,fav,prices)}))
  }
}

function marketChoiceHtml(choice,esc){
  if(!choice)return''
  return`<div class="why-market">
    <p class="why-market-chosen">${esc(choice.headline)}</p>
    <h4>Why not the other markets</h4>
    <ul class="why-passed">${choice.passed.map(row=>`<li><span class="why-passed-label">${esc(row.label)}${row.price?` · ${esc(row.price)}`:''}</span><span>${esc(row.reason)}</span></li>`).join('')}</ul>
  </div>`
}

export function whySectionHtml(r,esc=fallbackEsc,opts={}){
  const why=r?.why||{}
  const choice=goalsMarketWhy(r)
  const lines=choice?[]:reasonLines(r)
  const homeForm=why.lastMatchesHome||why.last5Home||[]
  const awayForm=why.lastMatchesAway||why.last5Away||[]
  return`<div class="why-tip">
    <h3>Why this pick was chosen</h3>
    ${consensusHtml(r,esc)}
    ${choice?marketChoiceHtml(choice,esc):(lines.length?`<ul class="why-lines">${lines.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'<p class="why-empty">The published tip is preserved. Form detail will appear after the next board refresh.</p>')}
    ${homeForm.length||awayForm.length?`<div class="why-form">
      <section><h4>${esc(r.home||'Home')} · last matches</h4>${formPills(homeForm,esc)}${formMatches(homeForm,esc)}</section>
      <section><h4>${esc(r.away||'Away')} · last matches</h4>${formPills(awayForm,esc)}${formMatches(awayForm,esc)}</section>
    </div>`:''}
    ${comparisonHtml(why,r,esc)}
    ${h2hHtml(why.h2h,esc)}
    ${bankerHtml(r,esc,opts.banker===true)}
  </div>`
}

export function bindWhyModal(modal){
  if(!modal)return
  const close=()=>{
    modal.classList.add('hidden')
    modal.innerHTML=''
    document.body.classList.remove('modal-open')
  }
  modal.classList.remove('hidden')
  document.body.classList.add('modal-open')
  modal.querySelector('.close')?.addEventListener('click',close)
  modal.onclick=e=>{if(e.target===modal)close()}
  modal._close=close
  if(!window.__s2pWhyEsc){
    window.__s2pWhyEsc=true
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return
      const open=document.getElementById('modal')
      if(open&&!open.classList.contains('hidden')&&typeof open._close==='function')open._close()
    })
  }
}
