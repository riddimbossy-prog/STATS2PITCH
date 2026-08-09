import { statsApi, statsApiConfigured } from './statsApi.js'

const MAX_PAGES=Math.max(1,Number(process.env.STATS_API_FALLBACK_MATCH_PAGES||5))
const TOLERANCE_HOURS=Math.max(1,Number(process.env.STATS_API_MATCH_TOLERANCE_HOURS||6))
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const unwrap=body=>Array.isArray(body?.matches)?body.matches:Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[]
const totalPages=body=>Math.max(1,Number(body?.meta?.total_pages??body?.pagination?.total_pages??body?.paging?.total??1))
function teamName(m,side){const snake=`${side}_team`,c=[m?.[snake]?.name,m?.[snake]?.team_name,m?.[snake],m?.[side]?.name,m?.[side]?.team_name,m?.[side],m?.teams?.[side]?.name,m?.participants?.[side]?.name,m?.match?.[snake]?.name,m?.match?.[side]?.name];return text(c.find(v=>typeof v==='string'&&v.trim())||'')}
function teamScore(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 100;if(Math.min(x.length,y.length)>=7&&(x.includes(y)||y.includes(x)))return 85;const xa=new Set(x.split(' ').filter(t=>t.length>2)),ya=new Set(y.split(' ').filter(t=>t.length>2)),common=[...xa].filter(t=>ya.has(t)).length;return common>=2&&common/Math.max(xa.size,ya.size,1)>=.66?80:0}
const matchId=m=>m?.id??m?.match_id??m?.mt_id??m?.match?.id??null
const matchDate=m=>m?.date??m?.start_date??m?.kickoff??m?.starts_at??m?.start_time??m?.match?.date??null
const gap=(a,b)=>{const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/3600000:null}
async function searchVariant(params,home,away,kickoff,opts={}){
  const found=[]
  for(let page=1;page<=MAX_PAGES;page++){
    let body;try{body=await statsApi('/football/matches',{...params,per_page:100,page},opts)}catch{return null}
    const rows=unwrap(body)
    for(const m of rows){const hs=teamScore(teamName(m,'home'),home),as=teamScore(teamName(m,'away'),away),g=gap(matchDate(m),kickoff);if(hs>=80&&as>=80&&g!==null&&g<=TOLERANCE_HOURS)found.push({m,score:hs+as,g})}
    if(page>=totalPages(body)||rows.length<100)break
  }
  found.sort((a,b)=>b.score-a.score||a.g-b.g);if(!found.length)return null;if(found[1]&&found[1].score===found[0].score&&Math.abs(found[1].g-found[0].g)<1)return null;return found[0].m
}
export async function getStatsOddsFallback(fixture,opts={}){
  if(!statsApiConfigured())return null
  const home=fixture?.teams?.home?.name??fixture?.home?.name??'',away=fixture?.teams?.away?.name??fixture?.away?.name??'',kickoff=fixture?.fixture?.date??fixture?.kickoff??null,date=kickoff?String(kickoff).slice(0,10):''
  if(!date||!home||!away)return null
  let match=null;for(const params of [{date_from:date,date_to:date},{date}]){match=await searchVariant(params,home,away,kickoff,opts);if(match)break}
  if(!match)return null;const id=matchId(match);if(!id)return null
  try{return{matchId:id,payload:await statsApi(`/football/matches/${id}/odds`,{},opts)}}catch{return null}
}
