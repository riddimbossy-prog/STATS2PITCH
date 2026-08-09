(()=>{
  const ACCESS_KEY='s2p_access_token'
  let board=null
  let rowMap=new Map()
  let fetchPromise=null
  let lastFetch=0

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))
  const fmt=n=>{const v=Number(n);return Number.isFinite(v)&&v>1.001?v.toFixed(2):'—'}
  const token=()=>localStorage.getItem(ACCESS_KEY)||''
  const allRows=b=>[...(b?.groups?.threePlus||[]),...(b?.groups?.two||[]),...(b?.groups?.single||[])]
  const keyFor=r=>`${r.fixtureId}|${r.market}|${r.selectedTeamId||r.selectedTeam}`

  function rebuildIndex(){
    rowMap=new Map()
    for(const r of [...allRows(board),...(board?.priority||[])]) rowMap.set(keyFor(r),r)
  }

  async function loadBoard(force=false){
    if(fetchPromise)return fetchPromise
    if(!force&&board&&Date.now()-lastFetch<15000)return board
    const t=token();if(!t)return null
    fetchPromise=fetch('/api/board',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})
      .then(async r=>r.ok?r.json():null)
      .then(j=>{if(j){board=j;lastFetch=Date.now();rebuildIndex()}return board})
      .catch(()=>board)
      .finally(()=>{fetchPromise=null})
    return fetchPromise
  }

  function names(row){
    const split=String(row?.match||'').split(' vs ')
    const home=split[0]||''
    const away=split[1]||''
    const selected=row?.market==='1X2'?(row?.selectedTeam||home):(row?.selectedTeam||'This match')
    let opponent=row?.opponentTeam||''
    if(row?.market==='1X2'&&(!opponent||opponent==='Whole match')) opponent=selected===home?away:home
    return{home,away,selected,opponent}
  }

  function namedReason(text,row){
    const s=String(text||'').trim()
    const {home,away,selected,opponent}=names(row)
    const selectedName=selected||home||'This team'
    const opponentName=opponent||away||'The opponent'
    const rules=[
      [/selected team is in the league'?s? top 3/i,`${selectedName} are in the top 3.`],
      [/selected team is in the bottom 3/i,`${selectedName} are in the bottom 3.`],
      [/selected team averages at least 2 points per game/i,`${selectedName} have a strong points record.`],
      [/selected team averages under 1 point per game/i,`${selectedName} have been struggling for points.`],
      [/selected team scores at least 2\.3 goals per game/i,`${selectedName} score very often.`],
      [/selected team scores at least 2 goals per game/i,`${selectedName} score at least 2 goals a game on average.`],
      [/selected team scores under 1 goal per game/i,`${selectedName} have been struggling to score.`],
      [/selected team concedes more than 2\.3 goals per game/i,`${selectedName} have been conceding heavily.`],
      [/selected team concedes at least 2 goals per game/i,`${selectedName} concede often.`],
      [/selected team concedes under 1 goal per game/i,`${selectedName} have been defending very well.`],
      [/selected team won at least 4 of its last 5/i,`${selectedName} have won 4 of their last 5.`],
      [/selected team won at least 3 of its last 5/i,`${selectedName} have won at least 3 of their last 5.`],
      [/selected team won fewer than 2 of its last 5/i,`${selectedName} have won fewer than 2 of their last 5.`],
      [/selected team won fewer than 3 of its last 5/i,`${selectedName} have won fewer than 3 of their last 5.`],
      [/selected team lost at least 4 of its last 5/i,`${selectedName} have lost 4 of their last 5.`],
      [/selected team lost at least 3 of its last 5/i,`${selectedName} have lost 3 of their last 5.`],
      [/opponent is in the league top 3/i,`${opponentName} are also in the top 3.`],
      [/opponent is in the bottom 3/i,`${opponentName} are in the bottom 3.`],
      [/opponent averages under 1 point per game/i,`${opponentName} have been struggling for points.`],
      [/opponent scores under 1 goal per game/i,`${opponentName} have been struggling to score.`],
      [/opponent concedes more than 2\.3 goals per game/i,`${opponentName} have been conceding heavily.`],
      [/opponent concedes at least 2 goals per game/i,`${opponentName} concede often.`],
      [/opponent concedes under 1 goal per game/i,`${opponentName} have been defending well.`],
      [/opponent lost at least 4 of its last 5/i,`${opponentName} have lost 4 of their last 5.`],
      [/opponent lost at least 3 of its last 5/i,`${opponentName} have lost 3 of their last 5.`],
      [/win price is below 1\.20/i,`The market makes ${selectedName} a very strong favourite.`],
      [/win price is 1\.55 or lower/i,`The market strongly favours ${selectedName}.`],
      [/win price is 2\.00 or lower/i,`The market favours ${selectedName}.`],
      [/win price is above 5\.00/i,`The market sees ${selectedName} as a big outsider.`],
      [/draw price is below 3\.00/i,'The draw is priced as a real possibility.'],
      [/draw price is above 5\.00/i,'The market sees a draw as unlikely.'],
      [/draw price is above 4\.00/i,'The market gives the draw a relatively low chance.']
    ]
    for(const [re,out] of rules)if(re.test(s))return out
    const g=s.match(/(Over|Under) (1\.5|2\.5|3\.5) goals landed in at least (80|60)% of the (home|away) team's recent matches/i)
    if(g){
      const team=g[4].toLowerCase()==='home'?home:away
      return `${g[1]} ${g[2]} goals has appeared in at least ${g[3]==='80'?'4 of 5':'3 of 5'} recent matches for ${team||'this team'}.`
    }
    return s
      .replace(/The selected team/gi,selectedName)
      .replace(/Selected team/gi,selectedName)
      .replace(/The opponent/gi,opponentName)
      .replace(/Opponent/gi,opponentName)
      .replace(/the home team/gi,home||'the first team')
      .replace(/the away team/gi,away||'the second team')
      .replace(/PPG/ig,'points per game')
      .replace(/hit rate/ig,'recent record')
  }

  function img(src,cls,alt=''){
    return src?`<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`:''
  }

  function competitionHtml(row){
    const flag=img(row?.countryFlag,'country-flag',row?.country||'')
    const logo=img(row?.leagueLogo,'league-logo',row?.league||'')
    return `<div class="competition-cell"><div class="competition-icons">${flag}${logo}</div><div><strong>${esc(row?.league||'Competition')}</strong>${row?.country?`<span>${esc(row.country)}</span>`:''}</div></div>`
  }

  function decorateTables(){
    for(const table of document.querySelectorAll('.pred-table')){
      const header=table.querySelector('thead tr')
      if(header&&!header.dataset.s2p17){
        header.dataset.s2p17='1'
        header.innerHTML='<th>Time</th><th>League</th><th>Match</th><th>Prediction</th><th>Odds</th><th>Confidence</th><th>Details</th>'
      }
      for(const tr of table.querySelectorAll('tbody tr')){
        const btn=tr.querySelector('[data-row-key]')
        const row=btn?rowMap.get(btn.dataset.rowKey):null
        if(!row)continue
        let league=tr.querySelector('[data-label="League"]')
        if(!league){
          league=document.createElement('td')
          league.dataset.label='League'
          const time=tr.querySelector('[data-label="Time"]')
          time?.insertAdjacentElement('afterend',league)
        }
        const competition=competitionHtml(row)
        if(league.innerHTML!==competition)league.innerHTML=competition
        const reason=tr.querySelector('[data-label="Key reasons"]')
        if(reason)reason.remove()
        const details=btn.closest('td')
        if(details)details.dataset.label='Details'
      }
    }
  }

  function rebuildPriority(){
    const old=document.querySelector('.priority-compact')
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''))
    if(!title)return

    // Best picks should be a complete, stable list. The old `.slice(0,12)` hid
    // later qualified matches and the panel was rewritten on every mutation.
    const rows=[...document.querySelectorAll('.prediction-panel tbody tr')]
    if(!rows.length){
      if(old&&old.innerHTML)old.innerHTML=''
      return
    }

    const panel=old||document.createElement('section')
    panel.className='priority-compact priority-compact-v17'
    const html=rows.map(tr=>{
      const btn=tr.querySelector('[data-row-key]'),row=btn?rowMap.get(btn.dataset.rowKey):null
      if(!row)return''
      const match=tr.querySelector('[data-label="Match"]')?.innerText?.replace(/\n+/g,' vs ')||row.match||''
      const odd=tr.querySelector('[data-label="Odds"]')?.textContent?.trim()||fmt(row.odds)
      const prediction=tr.querySelector('[data-label="Prediction"]')?.textContent?.trim()||''
      return `<button class="priority-compact-row priority-v17-row" type="button" data-priority-key="${esc(btn.dataset.rowKey)}">
        <div class="priority-v17-competition">${competitionHtml(row)}</div>
        <div class="priority-compact-match"><strong>${esc(match)}</strong><small>${esc(prediction)}</small></div>
        <div class="priority-compact-odd">${esc(odd)}</div>
        <div class="priority-compact-star">★</div>
      </button>`
    }).join('')

    if(!old)title.insertAdjacentElement('afterend',panel)
    if(panel.dataset.s2pPriorityHtml!==html){
      panel.innerHTML=html
      panel.dataset.s2pPriorityHtml=html
      panel.querySelectorAll('[data-priority-key]').forEach(b=>b.onclick=()=>openDetails(rowMap.get(b.dataset.priorityKey)))
    }
  }

  function confidence(row){
    let score=56+Math.min(30,Number(row?.filterCount||0)*7)
    if(row?.contradiction==='MODERATE')score-=8
    if(row?.contradiction==='HIGH')score-=20
    if(Number(row?.odds)>1&&Number(row?.odds)<=1.55)score+=4
    if(Number(row?.odds)>4)score-=4
    return Math.max(50,Math.min(96,Math.round(score)))
  }
  function stars(row){
    const pct=confidence(row),filled=Math.max(1,Math.min(5,Math.round(pct/20)))
    return `<span class="stars">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</span><span class="confidence-pct">${pct}%</span>`
  }
  function predictionName(row){
    const names={'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'}
    return row?.market==='1X2'?`${row.selectedTeam} win`:(names[row?.market]||row?.selectedTeam||'Prediction')
  }

  function openDetails(row){
    if(!row)return
    document.querySelector('.modal-backdrop.s2p17-modal')?.remove()
    const markets=board?.oddsByFixture?.[String(row.fixtureId)]||[]
    const reasons=(row.filters||[]).map(x=>namedReason(x,row))
    const cautions=(row.negativeSignals||[]).map(x=>namedReason(x,row))
    const overlay=document.createElement('div')
    overlay.className='modal-backdrop s2p17-modal'
    overlay.innerHTML=`<section class="detail-modal detail-modal-v17" role="dialog" aria-modal="true" aria-label="Match details">
      <header class="modal-head modal-head-v17">
        <div class="modal-competition">${competitionHtml(row)}</div>
        <button class="modal-close" type="button" aria-label="Close details">×</button>
      </header>
      <div class="detail-body">
        <div class="detail-match-title"><h2>${esc(row.match)}</h2><span>${esc(row.kickoffLocal||'')}</span></div>
        <section class="detail-summary">
          <div><span class="eyebrow">Prediction</span><h3>${esc(predictionName(row))}</h3><div class="confidence">${stars(row)}</div></div>
          <div class="detail-price"><span>Odds</span><strong>${fmt(row.odds)}</strong></div>
        </section>
        <section class="detail-section"><h3>Why this pick</h3><div class="reason-cards">${reasons.length?reasons.map((x,i)=>`<div class="reason-card"><span class="reason-number">${i+1}</span><p>${esc(x)}</p></div>`).join(''):'<div class="reason-card"><p>This match fits the filters you selected.</p></div>'}</div></section>
        ${cautions.length?`<section class="detail-section caution-section"><h3>Things to keep in mind</h3><div class="reason-cards">${cautions.map(x=>`<div class="reason-card caution-card"><p>${esc(x)}</p></div>`).join('')}</div></section>`:''}
        <section class="detail-section"><h3>Available market prices</h3>${markets.length?`<div class="market-grid">${markets.map(m=>`<article class="market-card"><h4>${esc(m.market)}</h4><div class="outcomes">${(m.outcomes||[]).map(o=>`<div class="outcome"><span>${esc(o.name)}</span><strong>${fmt(o.odd)}</strong></div>`).join('')}</div></article>`).join('')}</div>`:'<div class="reason-card"><p>No verified market price is available for this match yet.</p></div>'}</section>
      </div>
    </section>`
    document.body.appendChild(overlay)
    const close=()=>overlay.remove()
    overlay.querySelector('.modal-close').onclick=close
    overlay.onclick=e=>{if(e.target===overlay)close()}
    document.addEventListener('keydown',function key(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',key)}})
  }

  function interceptDetails(){
    document.addEventListener('click',async e=>{
      const btn=e.target.closest?.('[data-row-key]')
      if(!btn)return
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
      let row=rowMap.get(btn.dataset.rowKey)
      if(!row){await loadBoard(true);row=rowMap.get(btn.dataset.rowKey)}
      if(row)openDetails(row)
    },true)
  }

  async function enhance(force=false){
    if(!document.querySelector('.app-shell'))return
    const keys=[...document.querySelectorAll('[data-row-key]')].map(x=>x.dataset.rowKey)
    if(force||!board||keys.some(k=>!rowMap.has(k)))await loadBoard(true)
    decorateTables()
    rebuildPriority()
    document.documentElement.classList.add('s2p-v17')
  }

  interceptDetails()
  let queued=false
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await enhance(false)})}
  new MutationObserver(mutations=>{
    // Ignore our own Best-picks rewrites; otherwise the observer schedules
    // another rebuild immediately and can fight scrolling on that tab.
    if(mutations.length&&mutations.every(m=>m.target?.closest?.('.priority-compact,.s2p-board-tabs')))return
    queue()
  }).observe(document.documentElement,{childList:true,subtree:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhance(true));else enhance(true)
})()
