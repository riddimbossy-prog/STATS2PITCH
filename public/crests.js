export const FALLBACK='/assets/football-real.svg'

export function isLogo(v){
  const s=String(v||'').trim()
  return /^https?:\/\//i.test(s)||s.startsWith('/')
}

export function sportradarCrest(id){
  const m=String(id??'').match(/(\d+)$/)
  return m?`https://img.sportradar.com/ls/crest/big/${m[1]}.png`:''
}

export function preferLogo(...values){
  const urls=values.map(v=>String(v||'').trim()).filter(isLogo)
  return urls.find(u=>/s\.sporty\.net\//i.test(u))||urls[0]||''
}

export function fixtureCrests(board){
  const map=new Map()
  for(const f of board?.fixtures||[]){
    map.set(String(f.fixtureId),{home:f.homeLogo,away:f.awayLogo})
  }
  return map
}

export function crestSrc(row,side,fixtures){
  const logoKey=side==='away'?'awayLogo':'homeLogo'
  const idKey=side==='away'?'awayId':'homeId'
  const fx=fixtures instanceof Map?fixtures.get(String(row?.fixtureId)):null
  const fromFx=side==='away'?fx?.away:fx?.home
  return preferLogo(row?.[logoKey],fromFx,sportradarCrest(row?.[idKey]||row?.[side==='away'?'awayTeamId':'homeTeamId']))||FALLBACK
}

export function bindCrestFallbacks(root){
  const host=root||(typeof document!=='undefined'?document:null)
  if(!host?.querySelectorAll)return
  for(const img of host.querySelectorAll('img.team-crest')){
    if(img.dataset.crestBound)continue
    img.dataset.crestBound='1'
    const fail=()=>{
      if(img.dataset.crestFail)return
      img.dataset.crestFail='1'
      img.src=FALLBACK
    }
    img.addEventListener('error',fail)
    img.addEventListener('load',()=>{if((img.naturalWidth||0)<8||(img.naturalHeight||0)<8)fail()})
    if(img.complete&&img.naturalWidth>0&&(img.naturalWidth<8||img.naturalHeight<8))fail()
  }
}
