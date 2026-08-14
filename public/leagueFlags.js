const COUNTRY_FLAGS={
  england:'🇬🇧',scotland:'🏴',wales:'🏴','northern ireland':'🇬🇧',france:'🇫🇷',germany:'🇩🇪',spain:'🇪🇸',italy:'🇮🇹',portugal:'🇵🇹',netherlands:'🇳🇱',belgium:'🇧🇪',austria:'🇦🇹',switzerland:'🇨🇭',denmark:'🇩🇰',sweden:'🇸🇪',norway:'🇳🇴',finland:'🇫🇮',poland:'🇵🇱','czech republic':'🇨🇿',czechia:'🇨🇿',slovakia:'🇸🇰',slovenia:'🇸🇮',croatia:'🇭🇷',serbia:'🇷🇸',romania:'🇷🇴',bulgaria:'🇧🇬',greece:'🇬🇷',turkey:'🇹🇷','türkiye':'🇹🇷',ukraine:'🇺🇦',ireland:'🇮🇪',iceland:'🇮🇸',hungary:'🇭🇺',israel:'🇮🇱',
  ghana:'🇬🇭',nigeria:'🇳🇬',senegal:'🇸🇳',cameroon:'🇨🇲',morocco:'🇲🇦',egypt:'🇪🇬',tunisia:'🇹🇳',algeria:'🇩🇿','south africa':'🇿🇦','ivory coast':'🇨🇮','cote d ivoire':'🇨🇮',kenya:'🇰🇪',uganda:'🇺🇬',tanzania:'🇹🇿',zambia:'🇿🇲',zimbabwe:'🇿🇼',
  usa:'🇺🇸','united states':'🇺🇸',canada:'🇨🇦',mexico:'🇲🇽',brazil:'🇧🇷',argentina:'🇦🇷',uruguay:'🇺🇾',colombia:'🇨🇴',chile:'🇨🇱',peru:'🇵🇪',ecuador:'🇪🇨',paraguay:'🇵🇾',bolivia:'🇧🇴','costa rica':'🇨🇷',panama:'🇵🇦',jamaica:'🇯🇲',
  japan:'🇯🇵','korea republic':'🇰🇷','south korea':'🇰🇷',china:'🇨🇳',australia:'🇦🇺','new zealand':'🇳🇿',india:'🇮🇳',indonesia:'🇮🇩',malaysia:'🇲🇾',thailand:'🇹🇭',vietnam:'🇻🇳','saudi arabia':'🇸🇦',qatar:'🇶🇦',uae:'🇦🇪','united arab emirates':'🇦🇪',iran:'🇮🇷',iraq:'🇮🇶',jordan:'🇯🇴',
  world:'🌍',international:'🌍',europe:'🌍'
}
function normalizeCountry(v){return String(v||'').toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim()}
function countryFlag(v){return COUNTRY_FLAGS[normalizeCountry(v)]||'🌍'}
function enhanceLeagueFlags(){
  document.querySelectorAll('.league').forEach(el=>{
    if(el.dataset.flagged==='1')return
    const country=el.dataset.country||''
    const badge=document.createElement('span')
    badge.className='league-flag'
    badge.setAttribute('role','img')
    badge.setAttribute('aria-label',`${country||'International'} flag`)
    badge.textContent=countryFlag(country)
    el.prepend(badge)
    el.dataset.flagged='1'
  })
}
window.countryFlag=countryFlag
const observer=new MutationObserver(enhanceLeagueFlags)
observer.observe(document.documentElement,{childList:true,subtree:true})
document.addEventListener('DOMContentLoaded',enhanceLeagueFlags)
enhanceLeagueFlags()
