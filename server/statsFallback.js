import { statsApi, statsApiConfigured } from './statsApi.js'

const MAX_PAGES=Math.max(1,Number(process.env.STATS_API_FALLBACK_MATCH_PAGES||5))
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const loose=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y)return false;if(x===y)return true;if(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x)))return true;const xa=new Set(x.split(' ')),ya=new Set(y.split(' '));return [...xa].filter(t=>t.length>2&&ya.has(t)).length>=Math.min(2,Math.min(xa.size,ya.size))}
const unwrap=body=>Array.isArray(body?.matches)?body.matches:Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[]
const totalPages=body=>Math.max(1,Number(body?.meta?.total_pages??body?.pagination?.total_pages??body?.paging?.total??1))
function teamName(m,side){const snake=`${side}_team`;const c=[m?.[snake]?.name,m?.[snake]?.team_name,m?.[snake],m?.[side]?.name,m?.[side]?.team_name,m?.[side],m?.teams?.[side]?.name,m?.participants?.[side]?.name,m?.match?.[snake]?.name,m?.match?.[side]?.name];return text(c.find(v=>typeof v==='string'&&v.trim())||'')}
function matchId(m){return m?.id??m?.match_id??m?.mt_id??m?.match?.id??null}
function matchDate(m){return m?.date??m?.start_date??m?.kickoff??m?.starts_at??m?.start_time??m?.match?.date??null}
function dist(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y):Number.MAX_SAFE_INTEGER}

async function searchVariant(params,home,away,kickoff){
  const found=[]
  for(let page=1;page<=MAX_PAGES;page++){
    let body
    try{body=await statsApi('/football/matches',{...params,per_page:100,page})}catch{return null}
    const rows=unwrap(body)
    for(const m of rows){
      const h=teamName(m,'home'),a=teamName(m,'away')
      // Never reverse home/away here. A wrong fixture is worse than missing odds.
      if(loose(h,home)&&loose(a,away))found.push(m)
    }
    if(page>=totalPages(body)||rows.length<100)break
  }
  if(!found.length)return null
  found.sort((a,b)=>dist(matchDate(a),kickoff)-dist(matchDate(b),kickoff))
  const best=found[0]
  if(!best||dist(matchDate(best),kickoff)>12*3600*1000)return null
  return best
}

export async function getStatsOddsFallback(fixture){
  if(!statsApiConfigured())return null
  const home=fixture?.teams?.home?.name??fixture?.home?.name??''
  const away=fixture?.teams?.away?.name??fixture?.away?.name??''
  const kickoff=fixture?.fixture?.date??fixture?.kickoff??null
  const date=kickoff?String(kickoff).slice(0,10):''
  if(!date||!home||!away)return null

  // TheStatsAPI's working date-list route uses date_from/date_to.
  const variants=[
    {date_from:date,date_to:date},
    {date}
  ]
  let match=null
  for(const params of variants){match=await searchVariant(params,home,away,kickoff);if(match)break}
  if(!match)return null
  const id=matchId(match)
  if(!id)return null
  try{return{matchId:id,payload:await statsApi(`/football/matches/${id}/odds`)}}catch{return null}
}
