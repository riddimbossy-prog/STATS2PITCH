(()=>{
  let activeTab=sessionStorage.getItem('s2p_board_tab')||'best'
  let scheduled=false
  let lastTabsSignature=''

  const text=n=>String(n?.textContent||'').trim()

  function panelKey(panel){
    const title=text(panel?.querySelector('.prediction-panel-title h3')).toLowerCase()
    if(title.includes('3+'))return'three'
    if(title.includes('2 filter'))return'two'
    if(title.includes('single'))return'single'
    return''
  }
  function panelCount(panel){
    const badge=panel?.querySelector('.prediction-panel-title span')
    const n=Number(text(badge))
    return Number.isFinite(n)?n:0
  }

  function cleanDetails(){
    for(const modal of document.querySelectorAll('.detail-modal-v17,.detail-modal')){
      const priceLabel=modal.querySelector('.detail-price span')
      if(priceLabel)priceLabel.textContent='Selected odd'
      for(const section of modal.querySelectorAll('.detail-section')){
        const h=text(section.querySelector('h3')).toLowerCase()
        if(h.includes('available market prices')||h.includes('market prices'))section.remove()
      }
    }
  }

  function applyTab(shell){
    for(const el of shell.querySelectorAll('[data-s2p-tab-panel]')){
      const visible=el.dataset.s2pTabPanel===activeTab
      el.classList.toggle('s2p-tab-visible',visible)
      el.setAttribute('aria-hidden',visible?'false':'true')
    }
    shell.dataset.s2pActiveTab=activeTab
    document.documentElement.dataset.s2pActiveTab=activeTab
    window.dispatchEvent(new CustomEvent('s2p:tabchange',{detail:{tab:activeTab}}))
  }

  function bindTabButtons(tabs,shell){
    tabs.querySelectorAll('[data-s2p-tab]').forEach(btn=>{
      btn.onclick=()=>{
        const next=btn.dataset.s2pTab
        if(!next||next===activeTab)return
        activeTab=next
        sessionStorage.setItem('s2p_board_tab',activeTab)
        applyTab(shell)
        tabs.querySelectorAll('[data-s2p-tab]').forEach(x=>{
          const on=x.dataset.s2pTab===activeTab
          x.classList.toggle('is-active',on)
          x.setAttribute('aria-pressed',on?'true':'false')
        })
        // Do not call scrollIntoView here. The dashboard owns its own scroll
        // surface from v1.7.8, and scrollIntoView can move the wrong ancestor.
      }
    })
  }

  function installTabs(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    const priorityTitle=[...shell.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(text(x)))
    const priorityPanel=shell.querySelector('.priority-compact-v17,.priority-compact')
    const panels=[...shell.querySelectorAll('.prediction-panel')]
    if(!priorityTitle||!priorityPanel||!panels.length)return

    const map={three:null,two:null,single:null}
    for(const p of panels){const k=panelKey(p);if(k)map[k]=p}

    let tabs=shell.querySelector('.s2p-board-tabs')
    if(!tabs){
      tabs=document.createElement('nav')
      tabs.className='s2p-board-tabs'
      tabs.setAttribute('aria-label','Prediction groups')
      priorityTitle.insertAdjacentElement('beforebegin',tabs)
    }

    const bestCount=priorityPanel.querySelectorAll('[data-priority-key]').length
    const defs=[['best','Best picks',bestCount],['three','3+ filters',panelCount(map.three)],['two','2 filters',panelCount(map.two)],['single','Single',panelCount(map.single)]]
    const signature=JSON.stringify(defs)

    // Avoid rewriting the tabs on every MutationObserver callback. Replacing
    // innerHTML here used to generate another mutation and could keep the Best
    // picks area in a continuous render loop while the user tried to scroll.
    if(signature!==lastTabsSignature||!tabs.querySelector('[data-s2p-tab]')){
      tabs.innerHTML=defs.map(([key,label,count])=>`<button type="button" class="s2p-board-tab ${activeTab===key?'is-active':''}" data-s2p-tab="${key}" aria-pressed="${activeTab===key?'true':'false'}"><span>${label}</span><b>${count}</b></button>`).join('')
      lastTabsSignature=signature
      bindTabButtons(tabs,shell)
    }else{
      tabs.querySelectorAll('[data-s2p-tab]').forEach(x=>{
        const on=x.dataset.s2pTab===activeTab
        x.classList.toggle('is-active',on)
        x.setAttribute('aria-pressed',on?'true':'false')
      })
    }

    priorityTitle.dataset.s2pTabPanel='best'
    priorityPanel.dataset.s2pTabPanel='best'
    if(map.three)map.three.dataset.s2pTabPanel='three'
    if(map.two)map.two.dataset.s2pTabPanel='two'
    if(map.single)map.single.dataset.s2pTabPanel='single'

    applyTab(shell)
  }

  function improveControls(){
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    shell.querySelector('.controls')?.classList.add('s2p-controls-v173')
    shell.querySelector('.topbar')?.classList.add('s2p-topbar-v173')
    shell.classList.add('s2p-shell-v173')
  }

  function run(){
    scheduled=false
    cleanDetails()
    installTabs()
    improveControls()
  }
  function queue(mutations=[]){
    // Ignore mutations that are entirely inside the tab bar. Those are our own
    // state updates and must not schedule another full board pass.
    if(mutations.length&&mutations.every(m=>m.target?.closest?.('.s2p-board-tabs')))return
    if(scheduled)return
    scheduled=true
    requestAnimationFrame(run)
  }

  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run()
})()
