import {parseSportyBet} from './odds.js'

export const H2H_ENGINE_VERSION='h2h-v1.1-split-80'
export const H2H_MIN_RATE=Math.max(80,Math.min(100,Number(process.env.H2H_MIN_RATE||80)))
export const H2H_MIN_MATCHES=Math.max(3,Number(process.env.H2H_MIN_MATCHES||5))
export const H2H_MAX_PER_FIXTURE=Math.max(1,Number(process.env.H2H_MAX_PER_FIXTURE||2))
const GOAL_KEYS=new Set(['total-goals','home-team-goals','away-team-goals'])
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const odd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1&&n<100?n:null}
const score=r=>{const h=Number(r?.goals?.home??r?.hs),a=Number(r?.goals?.away??r?.as);return Number.isFinite(h)&&Number.isFinite(a)?{h,a}:null}
const teamId=(r,side)=>String(r?.teams?.[side]?.id??r?.[`${side}Id`]??'')
const line=s=>{const m=String(s||'').match(/^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/i);return m?{side:m[1].toLowerCase(),value:Number(m[2])}:null}
const isHybrid=s=>/&/.test(String(s||''))
const isHalfGoal=s=>{const p=line(s);return Boolean(p)&&Math.abs(p.value%1-0.5)<1e-9}
function splitMeetings(f){const h=String(f?.home?.id??''),a=String(f?.away?.id??'');return(f?.h2hHistory||[]).filter(r=>score(r)&&teamId(r,'home')===h&&teamId(r,'away')===a).sort((x,y)=>Date.parse(y?.fixture?.date||y?.date||0)-Date.parse(x?.fixture?.date||x?.date||0))}
function evaluator(key,name){
  if(isHybrid(name))return null
  const n=norm(name),p=line(name)
  if(key==='match-winner'){if(n==='home'||n==='1')return(h,a)=>h>a;if(n==='draw'||n==='x')return(h,a)=>h===a;if(n==='away'||n==='2')return(h,a)=>a>h}
  if(key==='double-chance'){if(n==='1x'||n.includes('home or draw'))return(h,a)=>h>=a;if(n==='x2'||n.includes('draw or away'))return(h,a)=>a>=h;if(n==='12'||n.includes('home or away'))return(h,a)=>h!==a}
  if(key==='draw-no-bet'){if(n==='home'||n==='1')return(h,a)=>h>=a;if(n==='away'||n==='2')return(h,a)=>a>=h}
  if(key==='both-teams-score'){if(n==='yes')return(h,a)=>h>0&&a>0;if(n==='no')return(h,a)=>h===0||a===0}
  if(GOAL_KEYS.has(key)&&!isHalfGoal(name))return null
  if(p&&key==='total-goals')return(h,a)=>p.side==='over'?h+a>p.value:h+a<p.value
  if(p&&key==='home-team-goals')return(h)=>p.side==='over'?h>p.value:h<p.value
  if(p&&key==='away-team-goals')return(_,a)=>p.side==='over'?a>p.value:a<p.value
  return null
}
function candidates(f){const out=[];for(const market of parseSportyBet(f?.sportyMarkets||[]))for(const outcome of market.outcomes||[]){const price=odd(outcome?.odd),test=evaluator(market.marketKey,outcome?.name);if(price&&test)out.push({market:market.marketKey,selection:outcome.name,odds:+price.toFixed(2),family:market.market||market.marketKey,test})}return out}
export function analyzeH2HFixture(f){const rows=splitMeetings(f);if(rows.length<H2H_MIN_MATCHES)return[];const scored=rows.map(score);return candidates(f).map(c=>{const hits=scored.filter(s=>c.test(s.h,s.a)).length,rate=Math.round(hits*1000/scored.length)/10;return{...c,hits,meetings:scored.length,occurrence:rate}}).filter(x=>x.occurrence>=H2H_MIN_RATE).sort((a,b)=>b.occurrence-a.occurrence||b.meetings-a.meetings||a.odds-b.odds).slice(0,H2H_MAX_PER_FIXTURE).map((x,i)=>({fixtureId:f.fixtureId,kickoff:f.kickoff,league:f.league,country:f.country,home:f.home.name,away:f.away.name,homeId:f.home.id,awayId:f.away.id,homeLogo:f.home.logo,awayLogo:f.away.logo,market:x.market,selection:x.selection,displaySelection:x.selection,odds:x.odds,family:x.family,occurrence:x.occurrence,h2hHits:x.hits,h2hMatches:x.meetings,rank:i+1,confidence:x.occurrence,engineRating:x.occurrence,engineVersion:H2H_ENGINE_VERSION,source:'SportyBet',sportyEventId:f.sportyEventId,sportyGameId:f.sportyGameId,userWhy:`The same home/away setup produced ${x.selection} in ${x.hits} of ${x.meetings} historical meetings (${x.occurrence}%). It passes the strict ${H2H_MIN_RATE}% H2H gate and is currently listed by SportyBet.`,why:{marketChosen:`${x.selection} occurred in ${x.hits} of ${x.meetings} split H2Hs (${x.occurrence}%).`,h2h:f.h2h||[]}}))}
export function buildH2HBoard(fixtures=[],baseMeta={}){const picks=(fixtures||[]).flatMap(analyzeH2HFixture).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)||b.occurrence-a.occurrence);return{picks,meta:{...baseMeta,engine:H2H_ENGINE_VERSION,minOccurrence:H2H_MIN_RATE,minMatches:H2H_MIN_MATCHES,count:picks.length}}}
