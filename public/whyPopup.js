const fallbackEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]))

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

export function whySectionHtml(r,esc=fallbackEsc,opts={}){
  const why=r?.why||{}
  const lines=reasonLines(r)
  const homeForm=why.lastMatchesHome||why.last5Home||[]
  const awayForm=why.lastMatchesAway||why.last5Away||[]
  return`<div class="why-tip">
    <h3>Why this pick was chosen</h3>
    ${consensusHtml(r,esc)}
    ${lines.length?`<ul class="why-lines">${lines.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'<p class="why-empty">The published tip is preserved. Form detail will appear after the next board refresh.</p>'}
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
