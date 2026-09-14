import {parseSportyBet} from './odds.js'

export const H2H_ENGINE_VERSION='h2h-v1.4-form-60'
export const H2H_MIN_RATE=Math.max(80,Math.min(100,Number(process.env.H2H_MIN_RATE||80)))
export const H2H_MIN_MATCHES=Math.max(3,Number(process.env.H2H_MIN_MATCHES||5))
export const H2H_MAX_PER_FIXTURE=Math.max(1,Number(process.env.H2H_MAX_PER_FIXTURE||2))
export const H2H_MIN_ODD=1.20
export const H2H_FORM_MIN=Math.max(60,Math.min(100,Number(process.env.H2H_FORM_MIN||60)))
export const H2H_FORM_SAMPLE=Math.max(3,Number(process.env.H2H_FORM_SAMPLE||5))
const GOAL_KEYS=new Set(['total-goals','home-team-goals','away-team-goals'])
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')
const odd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1&&n<100?n:null}
const score=r=>{const h=Number(r?.goals?.home??r?.hs),a=Number(r?.goals?.away??r?.as);return Number.isFinite(h)&&Number.isFinite(a)?{h,a}:null}
const teamId=(r,side)=>String(r?.teams?.[side]?.id??r?.[`${side}Id`]??'')
const line=s=>{const m=String(s||'').match(/^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/i);return m?{side:m[1].toLowerCase(),value:Number(m[2])}:null}
const isHybrid=s=>/&/.test(String(s||''))
const isHalfGoal=s=>{const p=line(s);return Boolean(p)&&Math.abs(p.value%1-0.5)<1e-9}
const pct=(hits,n)=>n?Math.round(hits*1000/n)/10:null
export function isSkippedH2HSelection(name){
  const n=norm(name)
  return n==='12'||n==='1x'||n==='home away'||n.includes('home or away')||n.includes('home or draw')
}
function splitMeetings(f){const h=String(f?.home?.id??''),a=String(f?.away?.id??'');return(f?.h2hHistory||[]).filter(r=>score(r)&&teamId(r,'home')===h&&teamId(r,'away')===a).sort((x,y)=>Date.parse(y?.fixture?.date||y?.date||0)-Date.parse(x?.fixture?.date||x?.date||0))}
function evaluator(key,name){
  if(isHybrid(name)||isSkippedH2HSelection(name))return null
  const n=norm(name),p=line(name)
  if(key==='match-winner'){if(n==='home'||n==='1')return(h,a)=>h>a;if(n==='draw'||n==='x')return(h,a)=>h===a;if(n==='away'||n==='2')return(h,a)=>a>h}
  if(key==='double-chance'){if(n==='x2'||n.includes('draw or away'))return(h,a)=>a>=h}
  if(key==='draw-no-bet'){if(n==='home'||n==='1')return(h,a)=>h>=a;if(n==='away'||n==='2')return(h,a)=>a>=h}
  if(key==='both-teams-score'){if(n==='yes')return(h,a)=>h>0&&a>0;if(n==='no')return(h,a)=>h===0||a===0}
  if(GOAL_KEYS.has(key)&&!isHalfGoal(name))return null
  if(p&&key==='total-goals')return(h,a)=>p.side==='over'?h+a>p.value:h+a<p.value
  if(p&&key==='home-team-goals')return(h)=>p.side==='over'?h>p.value:h<p.value
  if(p&&key==='away-team-goals')return(_,a)=>p.side==='over'?a>p.value:a<p.value
  return null
}
function candidates(f){const out=[];for(const market of parseSportyBet(f?.sportyMarkets||[]))for(const outcome of market.outcomes||[]){const price=odd(outcome?.odd),test=evaluator(market.marketKey,outcome?.name);if(price&&price>=H2H_MIN_ODD&&test)out.push({market:market.marketKey,selection:outcome.name,odds:+price.toFixed(2),family:market.market||market.marketKey,test})}return out}
function formSides(key,name){
  const n=norm(name)
  if(key==='home-team-goals')return['home']
  if(key==='away-team-goals')return['away']
  if(key==='match-winner'){
    if(n==='home'||n==='1')return['home']
    if(n==='away'||n==='2')return['away']
    return['home','away']
  }
  if(key==='draw-no-bet'){
    if(n==='home'||n==='1')return['home']
    if(n==='away'||n==='2')return['away']
  }
  if(key==='double-chance')return['away']
  return['home','away']
}
function formRows(f,side){
  const team=f?.[side],id=String(team?.id??'')
  const source=team?.formHistory||team?.fixtures||team?.lastMatches||[]
  return source.filter(r=>score(r)&&teamId(r,side)===id).sort((x,y)=>Date.parse(y?.fixture?.date||y?.date||0)-Date.parse(x?.fixture?.date||x?.date||0)).slice(0,H2H_FORM_SAMPLE)
}
export function formSupport(f,candidate){
  const sides=formSides(candidate.market,candidate.selection)
  const details=[]
  for(const side of sides){
    const scored=formRows(f,side).map(score).filter(Boolean)
    if(scored.length<H2H_FORM_SAMPLE)return{ok:false,skip:'form-sample',rate:null,hits:0,matches:scored.length,details}
    const hits=scored.filter(s=>candidate.test(s.h,s.a)).length
    const rate=pct(hits,scored.length)
    details.push({side,hits,matches:scored.length,rate})
    if(rate<H2H_FORM_MIN)return{ok:false,skip:'form-confirm',rate,hits,matches:scored.length,details}
  }
  const hits=details.reduce((n,d)=>n+d.hits,0)
  const matches=details.reduce((n,d)=>n+d.matches,0)
  const rate=details.length===1?details[0].rate:pct(hits,matches)
  return{ok:true,skip:null,rate,hits,matches,details}
}
function formWhy(form){
  const bits=(form.details||[]).map(d=>`${d.side} ${d.hits}/${d.matches} (${d.rate}%)`)
  if(bits.length===1)return`Current ${bits[0].split(' ')[0]} form produced it in ${form.hits} of the last ${form.matches} venue games (${form.rate}%).`
  return`Current venue form produced it in ${form.hits} of ${form.matches} last-${H2H_FORM_SAMPLE} games (${form.rate}%): ${bits.join(', ')}.`
}
export function analyzeH2HFixture(f){
  const rows=splitMeetings(f)
  if(rows.length<H2H_MIN_MATCHES)return[]
  const scored=rows.map(score)
  const h2hHits=candidates(f).map(c=>{
    const hits=scored.filter(s=>c.test(s.h,s.a)).length
    return{...c,hits,meetings:scored.length,occurrence:pct(hits,scored.length)}
  }).filter(x=>x.occurrence>=H2H_MIN_RATE)
  if(!h2hHits.length)return[]
  const backed=h2hHits.map(c=>{
    const form=formSupport(f,c)
    return{...c,form}
  }).filter(x=>x.form.ok)
  if(!backed.length)return[]
  return backed.sort((a,b)=>b.occurrence-a.occurrence||b.form.rate-a.form.rate||b.meetings-a.meetings||a.odds-b.odds).slice(0,H2H_MAX_PER_FIXTURE).map((x,i)=>({
    fixtureId:f.fixtureId,kickoff:f.kickoff,league:f.league,country:f.country,
    home:f.home.name,away:f.away.name,homeId:f.home.id,awayId:f.away.id,homeLogo:f.home.logo,awayLogo:f.away.logo,
    market:x.market,selection:x.selection,displaySelection:x.selection,odds:x.odds,family:x.family,
    occurrence:x.occurrence,h2hHits:x.hits,h2hMatches:x.meetings,
    formRate:x.form.rate,formHits:x.form.hits,formMatches:x.form.matches,
    rank:i+1,confidence:x.occurrence,engineRating:x.occurrence,engineVersion:H2H_ENGINE_VERSION,source:'listed',
    sportyEventId:f.sportyEventId,sportyGameId:f.sportyGameId,
    userWhy:`The same home/away setup produced ${x.selection} in ${x.hits} of ${x.meetings} historical meetings (${x.occurrence}%). ${formWhy(x.form)} It passes the ${H2H_MIN_RATE}% H2H gate, the ${H2H_FORM_MIN}% current-form gate, and is currently listed at a qualifying price.`,
    why:{marketChosen:`${x.selection} occurred in ${x.hits} of ${x.meetings} split H2Hs (${x.occurrence}%) and current form backs it at ${x.form.rate}%.`,h2h:f.h2h||[],form:x.form.details||[]}
  }))
}
export function buildH2HBoard(fixtures=[],baseMeta={}){
  const picks=(fixtures||[]).flatMap(analyzeH2HFixture).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)||b.occurrence-a.occurrence)
  return{picks,meta:{...baseMeta,engine:H2H_ENGINE_VERSION,minOccurrence:H2H_MIN_RATE,minForm:H2H_FORM_MIN,formSample:H2H_FORM_SAMPLE,minMatches:H2H_MIN_MATCHES,minOdds:H2H_MIN_ODD,count:picks.length}}
}
