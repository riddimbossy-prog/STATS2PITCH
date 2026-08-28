import {FINISHED,FORM_SAMPLE,MIN_ODD,MAX_ODD} from './config.js'
import {assessHardGate} from './redFlags.js'

const finite=v=>Number.isFinite(Number(v))
const done=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
const round2=v=>Math.round(Number(v)*100)/100

export function compactFixture(f,teamId=null){
  const home=f?.teams?.home||{},away=f?.teams?.away||{}
  const hs=Number(f?.goals?.home),as=Number(f?.goals?.away)
  const row={
    date:f?.fixture?.date||null,
    home:home.name||'',
    away:away.name||'',
    hs:finite(hs)?hs:null,
    as:finite(as)?as:null,
    league:f?.league?.name||''
  }
  if(teamId!=null&&finite(hs)&&finite(as)){
    const isHome=String(home.id)===String(teamId)
    const own=isHome?hs:as,opp=isHome?as:hs
    row.result=own>opp?'W':own<opp?'L':'D'
    row.opponent=isHome?(away.name||''):(home.name||'')
    row.venue=isHome?'H':'A'
  }
  return row
}

export function last5Form(fixtures,teamId,venue,n=FORM_SAMPLE){
  return (fixtures||[])
    .filter(f=>done(f)&&(venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,n)
    .map(f=>compactFixture(f,teamId))
}

export function last5Overall(fixtures,teamId,n=FORM_SAMPLE){
  return (fixtures||[])
    .filter(f=>{
      if(!done(f))return false
      const h=String(f?.teams?.home?.id??''),a=String(f?.teams?.away?.id??'')
      const id=String(teamId??'')
      return !!id&&(h===id||a===id)&&finite(f?.goals?.home)&&finite(f?.goals?.away)
    })
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,n)
    .map(f=>compactFixture(f,teamId))
}

export function teamStats(rows){
  let played=0,wins=0,gf=0,ga=0,btts=0,o15=0,o25=0,fts=0,cs=0,pts=0
  for(const r of rows||[]){
    if(!finite(r.hs)||!finite(r.as)||!r.result)continue
    const own=r.venue==='H'?r.hs:r.as
    const opp=r.venue==='H'?r.as:r.hs
    played++
    gf+=own
    ga+=opp
    pts+=r.result==='W'?3:r.result==='D'?1:0
    if(r.result==='W')wins++
    if(own>0&&opp>0)btts++
    if(own+opp>1.5)o15++
    if(own+opp>2.5)o25++
    if(own===0)fts++
    if(opp===0)cs++
  }
  const pct=v=>played?Math.round(v*100/played):null
  return played?{
    played,
    winPct:pct(wins),
    ppg:round2(pts/played),
    gf:round2(gf/played),
    ga:round2(ga/played),
    btts:pct(btts),
    over15:pct(o15),
    over25:pct(o25),
    fts:pct(fts),
    cs:pct(cs)
  }:{played:0,winPct:null,ppg:null,gf:null,ga:null,btts:null,over15:null,over25:null,fts:null,cs:null}
}

export function fixtureHasStats(f){
  if(f?.statsReady===false)return false
  if(f?.statsReady===true)return true
  const homeId=f?.home?.id,awayId=f?.away?.id
  const home=last5Overall(f?.home?.lastMatches||f?.home?.fixtures,homeId,1)
  const away=last5Overall(f?.away?.lastMatches||f?.away?.fixtures,awayId,1)
  return home.length>=1&&away.length>=1
}

export function h2hSnapshot(history,homeId,awayId,n=5){
  return (history||[])
    .filter(f=>{
      if(!done(f))return false
      const h=String(f?.teams?.home?.id),a=String(f?.teams?.away?.id)
      return (h===String(homeId)&&a===String(awayId))||(h===String(awayId)&&a===String(homeId))
    })
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,n)
    .map(f=>compactFixture(f))
}

export function formAverages(rows){
  let pts=0,gf=0,ga=0,n=0
  for(const r of rows||[]){
    if(!finite(r.hs)||!finite(r.as)||!r.result)continue
    const own=r.venue==='H'?r.hs:r.as
    const opp=r.venue==='H'?r.as:r.hs
    n++;gf+=own;ga+=opp;pts+=r.result==='W'?3:r.result==='D'?1:0
  }
  return n?{played:n,ppg:round2(pts/n),gf:round2(gf/n),ga:round2(ga/n)}:{played:0,ppg:null,gf:null,ga:null}
}

export function consensusReasons(pick){
  const home=pick?.home||'Home',away=pick?.away||'Away'
  const label=pick?.displaySelection||pick?.selection||'this pick'
  const hr=Number(pick?.homeConsensus),ar=Number(pick?.awayConsensus)
  const hHits=Number.isFinite(hr)?Math.round(hr/20):null
  const aHits=Number.isFinite(ar)?Math.round(ar/20):null
  const lines=[]
  if(hHits!=null)lines.push(`${home} backed ${label} in ${hHits}/5 recent home matches (${hr}%).`)
  if(aHits!=null)lines.push(`${away} backed ${label} in ${aHits}/5 recent away matches (${ar}%).`)
  if(pick?.homeSplit?.sampleReady)lines.push(`${home} sit ${pick.homeSplit.position}/${pick.homeSplit.size} in the home split table (${pick.homeSplit.ppg} PPG).`)
  if(pick?.awaySplit?.sampleReady)lines.push(`${away} sit ${pick.awaySplit.position}/${pick.awaySplit.size} in the away split table (${pick.awaySplit.ppg} PPG).`)
  if(pick?.homeTier&&pick?.awayTier&&pick.homeTier!==pick.awayTier)lines.push(`Venue split tiers differ (${home} ${pick.homeTier} vs ${away} ${pick.awayTier}).`)
  if(pick?.over25Filter?.grade)lines.push(`Over 2.5 filter passed at ${pick.over25Filter.grade} grade.`)
  if(finite(pick?.odds))lines.push(`SportyBet price ${Number(pick.odds).toFixed(2)} is inside the ${Number(MIN_ODD).toFixed(2)}–${Number(MAX_ODD).toFixed(2)} window.`)
  return lines
}

export function varPublicReasons(pick,homeAvg,awayAvg){
  const home=pick?.home||'Home',away=pick?.away||'Away'
  const fav=pick?.favourite==='home'?home:pick?.favourite==='away'?away:null
  const label=pick?.displaySelection||pick?.selection||'this pick'
  const lines=[]
  if(fav)lines.push(`${fav} is the priced favourite for this matchup.`)
  if(homeAvg?.ppg!=null)lines.push(`${home} average ${homeAvg.ppg} PPG at home (${homeAvg.gf} scored, ${homeAvg.ga} conceded).`)
  if(awayAvg?.ppg!=null)lines.push(`${away} average ${awayAvg.ppg} PPG away (${awayAvg.gf} scored, ${awayAvg.ga} conceded).`)
  if(/btts/i.test(label)||/both teams/i.test(label))lines.push('Both sides have been involved in goals in this venue sample, so BTTS is the selected route.')
  else if(/over/i.test(label))lines.push(`Recent venue matches produced enough goals to prefer ${label}.`)
  else if(fav)lines.push(`${fav}'s venue form is the stronger side of this matchup, so ${label} was published.`)
  else lines.push(`${label} was the strongest published route for this matchup.`)
  if(finite(pick?.odds))lines.push(`Published at ${Number(pick.odds).toFixed(2)}.`)
  return lines
}

export function buildWhy(f,extra={}){
  const homeId=f?.home?.id,awayId=f?.away?.id
  const overallHome=f?.home?.lastMatches||f?.home?.fixtures
  const overallAway=f?.away?.lastMatches||f?.away?.fixtures
  const lastMatchesHome=extra.lastMatchesHome||extra.last5Home||last5Overall(overallHome,homeId)
  const lastMatchesAway=extra.lastMatchesAway||extra.last5Away||last5Overall(overallAway,awayId)
  const last5Home=extra.last5Home||last5Form(f?.home?.fixtures,homeId,'home')
  const last5Away=extra.last5Away||last5Form(f?.away?.fixtures,awayId,'away')
  const h2h=Array.isArray(extra.h2h)?extra.h2h:(Array.isArray(f?.h2h)?f.h2h:[])
  const homeStats=extra.homeStats||teamStats(lastMatchesHome)
  const awayStats=extra.awayStats||teamStats(lastMatchesAway)
  const homeAvg=extra.homeAvg||formAverages(last5Home.length?last5Home:lastMatchesHome)
  const awayAvg=extra.awayAvg||formAverages(last5Away.length?last5Away:lastMatchesAway)
  return{last5Home,last5Away,lastMatchesHome,lastMatchesAway,h2h,homeAvg,awayAvg,homeStats,awayStats}
}

export function attachWhy(pick,f,extra={}){
  const why=buildWhy(f,extra)
  const reasons=Array.isArray(extra.reasons)&&extra.reasons.length?extra.reasons:consensusReasons(pick)
  const gate=assessHardGate(f,{home:extra.homeAvg||extra.home||null,away:extra.awayAvg||extra.away||null,favourite:pick?.favourite||null})
  return{
    ...pick,
    reasons,
    shortReason:reasons[0]||pick.shortReason||null,
    reason:reasons.join(' • '),
    why,
    redFlags:Array.isArray(pick?.redFlags)&&pick.redFlags.length?pick.redFlags:gate.flags,
    hardGated:gate.blocked,
    statsMismatch:gate.statsMismatch,
    earlySeason:pick?.earlySeason===true||gate.earlySeason
  }
}
