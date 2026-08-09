(()=>{
  const logoSvg=`<svg viewBox="0 0 210 105" aria-hidden="true"><rect x="4" y="8" width="202" height="86" rx="2" fill="#020403" stroke="#f8faf7" stroke-width="4"/><path d="M105 8v86M4 51h33M173 51h33" stroke="#f8faf7" stroke-width="3"/><path d="M4 31h27v40H4M206 31h-27v40h27" fill="none" stroke="#f8faf7" stroke-width="3"/><circle cx="105" cy="51" r="28" fill="#020403" stroke="#f8faf7" stroke-width="4"/><text x="105" y="69" text-anchor="middle" font-size="51" font-family="Arial Black,Arial,sans-serif" font-weight="900" fill="#82e600">2</text><rect x="143" y="50" width="10" height="24" fill="#82e600"/><rect x="158" y="42" width="10" height="32" fill="#82e600"/><rect x="173" y="31" width="10" height="43" fill="#82e600"/><path d="M139 43l18-10 12 6 21-17" fill="none" stroke="#f8faf7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M185 22h7v7" fill="none" stroke="#f8faf7" stroke-width="4"/></svg>`
  const lockup=(compact=false)=>`<div class="s2p-brand-lockup">${logoSvg}<div class="s2p-wordmark">STATS<b>2</b>PITCH</div></div>`
  const seenForms=new WeakSet()
  let busyLookup=false

  function enhanceBrand(){
    const auth=document.querySelector('.auth-wrap')
    if(auth&&!auth.querySelector('.s2p-brand-lockup')){
      const old=auth.querySelector('.auth-logo')
      if(old)old.insertAdjacentHTML('afterend',lockup())
      else auth.insertAdjacentHTML('afterbegin',lockup())
    }
    const brand=document.querySelector('.brand-inline')
    if(brand&&!brand.dataset.s2p16){brand.dataset.s2p16='1';brand.innerHTML=lockup(true)}
  }

  async function maybeMoveNewUser(form){
    if(busyLookup||!form||document.querySelector('.auth-card h1')?.textContent?.toLowerCase().includes('create'))return
    const msg=document.querySelector('.auth-status.error')
    if(!msg||!/email or password is incorrect/i.test(msg.textContent||''))return
    if(msg.dataset.accountChecked==='1')return
    msg.dataset.accountChecked='1'
    const email=form.querySelector('#email')?.value?.trim()||''
    const password=form.querySelector('#password')?.value||''
    if(!email||!password)return
    busyLookup=true
    try{
      const r=await fetch('/api/auth/account-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})})
      const j=await r.json().catch(()=>({}))
      if(r.ok&&j.needsAccount){
        const switcher=document.getElementById('auth-switch')
        if(switcher){
          switcher.click()
          setTimeout(()=>{
            const e=document.getElementById('email'),p=document.getElementById('password'),status=document.getElementById('msg')
            if(e)e.value=email
            if(p)p.value=password
            if(status){status.classList.remove('error');status.classList.add('auth-handoff');status.innerHTML='<strong>New here?</strong> Your details are ready. Create your account to continue.'}
            document.getElementById('auth-submit')?.focus()
          },0)
        }
      }
    }catch{}finally{busyLookup=false}
  }

  function enhanceAuth(){
    const form=document.getElementById('auth-form')
    if(!form)return
    if(!seenForms.has(form)){
      seenForms.add(form)
      const observer=new MutationObserver(()=>maybeMoveNewUser(form))
      const msg=document.getElementById('msg')
      if(msg)observer.observe(msg,{childList:true,characterData:true,subtree:true,attributes:true})
    }
    maybeMoveNewUser(form)
  }

  function enhanceHeader(){
    const wrap=document.querySelector('.profile-wrap')
    if(!wrap||wrap.classList.contains('s2p-hidden'))return
    const email=wrap.querySelector('.profile-menu span')?.textContent?.trim()||''
    const signout=wrap.querySelector('#signout')
    if(!signout)return
    const box=document.createElement('div');box.className='top-actions-inline';box.innerHTML=`<span>${email}</span><button type="button">↪ Sign out</button>`
    box.querySelector('button').onclick=()=>signout.click()
    wrap.parentNode.insertBefore(box,wrap);wrap.classList.add('s2p-hidden')
  }

  function enhanceSummary(){
    const cards=[...document.querySelectorAll('.summary-card')]
    const names=['Fixtures scanned','Qualified picks','3+ Filters','Last refresh']
    cards.slice(0,4).forEach((c,i)=>{const s=c.querySelector('span');if(s)s.textContent=names[i]})
  }

  function enhancePriority(){
    const title=[...document.querySelectorAll('.section-title')].find(x=>/priority prediction list/i.test(x.textContent||''))
    if(!title||document.querySelector('.priority-compact'))return
    const rows=[...document.querySelectorAll('.prediction-panel tbody tr')].slice(0,12)
    if(!rows.length)return
    const panel=document.createElement('section');panel.className='priority-compact'
    panel.innerHTML=rows.map(row=>{
      const match=row.querySelector('[data-label="Match"]')?.innerText?.replace(/\n+/g,' vs ')||''
      const odd=row.querySelector('[data-label="Odds"]')?.textContent?.trim()||'—'
      const reason=row.querySelector('[data-label="Key reasons"]')?.textContent?.trim()||''
      const prediction=row.querySelector('[data-label="Prediction"]')?.textContent?.trim()||''
      return `<div class="priority-compact-row"><div class="priority-compact-match">${escapeHtml(match)} <small>· ${escapeHtml(prediction)}</small></div><div class="priority-compact-odd">${escapeHtml(odd)}</div><div class="priority-compact-reason">${escapeHtml(reason)}</div><div class="priority-compact-star">★</div></div>`
    }).join('')
    title.insertAdjacentElement('afterend',panel)
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function enhance(){enhanceBrand();enhanceAuth();enhanceHeader();enhanceSummary();enhancePriority()}
  let queued=false
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true})
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue);else queue()
})()
