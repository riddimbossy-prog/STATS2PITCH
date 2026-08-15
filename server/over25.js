import {FINISHED} from './config.js'

const finite=v=>Number.isFinite(Number(v))
const pct=(hits,total)=>total?Math.round((hits*1000)/total)/10:null
const finished=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
const score=f=>{
  const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
  return finite(h)&&finite(a)?{home:h,away:a,total:h+a}:null
}
const byDateDesc=(a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0)
const hasTeam=(f,id)=>String(f?.teams?.home?.id)===String(id)||String(f?.teams?.away?.id)===String(id)
const isHome=(f,id)=>String(f?.teams?.home?.id)===String(id)
const isAway=(f,id)=>String(f?.teams?.away?.id)===String(id)

export const OVER25_THRESHOLDS=Object.freeze({
  seasonBoth:70,
  seasonElite:80,
  seasonCompanion:65,
  homeVenue:72,
  awayVenue:68,
  combinedGoals:3.40,
  combinedXg:3.10,
  leagueRate:56,
  minMatches:11,
  recentGames:6,
  recentBoth:4,
  recentElite:5,
  recentCompanion:3
})

function rowsForTeam(history,teamId){
  return (history||[]).filter(f=>finished(f)&&hasTeam(f,teamId)&&score(f)).sort(byDateDesc)
}
function rowsForVenue(history,teamId,venue){
  return (history||[]).filter(f=>finished(f)&&(venue==='home'?isHome(f,teamId):isAway(f,teamId))&&score(f)).sort(byDateDesc)
}
function overRate(rows,line=2.5){
  let hits=0,total=0
  for(const f of rows||[]){const s=score(f);if(!s)continue;total++;if(s.total>line)hits++}
  return{rate:pct(hits,total),hits,total}
}
function averageTotalGoals(rows){
  let sum=0,total=0
  for(const f of rows||[]){const s=score(f);if(!s)continue;sum+=s.total;total++}
  return total?Math.round((sum/total)*100)/100:null
}
function recentOvers(rows,n=6){
  const sample=(rows||[]).slice(0,n)
  return{overs:sample.filter(f=>(score(f)?.total??-1)>2.5).length,played:sample.length}
}
function optionalCombinedXg(xg){
  const homeXg=Number(xg?.home?.xg??xg?.homeXg),homeXga=Number(xg?.home?.xga??xg?.homeXga)
  const awayXg=Number(xg?.away?.xg??xg?.awayXg),awayXga=Number(xg?.away?.xga??xg?.awayXga)
  if(![homeXg,homeXga,awayXg,awayXga].every(Number.isFinite))return null
  return Math.round((((homeXg+homeXga)+(awayXg+awayXga))/2)*100)/100
}

export function buildOver25Profile(history,homeId,awayId,{xg=null}={}){
  const leagueRows=(history||[]).filter(f=>finished(f)&&score(f))
  const homeSeason=rowsForTeam(leagueRows,homeId),awaySeason=rowsForTeam(leagueRows,awayId)
  const homeVenue=rowsForVenue(leagueRows,homeId,'home'),awayVenue=rowsForVenue(leagueRows,awayId,'away')
  const homeSeasonO25=overRate(homeSeason),awaySeasonO25=overRate(awaySeason)
  const homeHomeO25=overRate(homeVenue),awayAwayO25=overRate(awayVenue)
  const homeGoalsAvg=averageTotalGoals(homeSeason),awayGoalsAvg=averageTotalGoals(awaySeason)
  const combinedAverageGoals=finite(homeGoalsAvg)&&finite(awayGoalsAvg)?Math.round(((homeGoalsAvg+awayGoalsAvg)/2)*100)/100:null
  const leagueO25=overRate(leagueRows)
  const homeRecent=recentOvers(homeSeason,OVER25_THRESHOLDS.recentGames),awayRecent=recentOvers(awaySeason,OVER25_THRESHOLDS.recentGames)
  const combinedXg=optionalCombinedXg(xg)

  const seasonStrength=(Number(homeSeasonO25.rate)>=OVER25_THRESHOLDS.seasonBoth&&Number(awaySeasonO25.rate)>=OVER25_THRESHOLDS.seasonBoth)||
    (Number(homeSeasonO25.rate)>=OVER25_THRESHOLDS.seasonElite&&Number(awaySeasonO25.rate)>=OVER25_THRESHOLDS.seasonCompanion)||
    (Number(awaySeasonO25.rate)>=OVER25_THRESHOLDS.seasonElite&&Number(homeSeasonO25.rate)>=OVER25_THRESHOLDS.seasonCompanion)
  const homeVenuePass=Number(homeHomeO25.rate)>=OVER25_THRESHOLDS.homeVenue
  const awayVenuePass=Number(awayAwayO25.rate)>=OVER25_THRESHOLDS.awayVenue
  const goalsPass=Number(combinedAverageGoals)>=OVER25_THRESHOLDS.combinedGoals
  const recentPass=(homeRecent.overs>=OVER25_THRESHOLDS.recentBoth&&awayRecent.overs>=OVER25_THRESHOLDS.recentBoth)||
    (homeRecent.overs>=OVER25_THRESHOLDS.recentElite&&awayRecent.overs>=OVER25_THRESHOLDS.recentCompanion)||
    (awayRecent.overs>=OVER25_THRESHOLDS.recentElite&&homeRecent.overs>=OVER25_THRESHOLDS.recentCompanion)
  const leaguePass=Number(leagueO25.rate)>=OVER25_THRESHOLDS.leagueRate
  const maturityPass=homeSeason.length>=OVER25_THRESHOLDS.minMatches&&awaySeason.length>=OVER25_THRESHOLDS.minMatches
  const xgAvailable=finite(combinedXg),xgPass=xgAvailable?Number(combinedXg)>=OVER25_THRESHOLDS.combinedXg:null

  const checks=[
    {key:'season',ok:seasonStrength,label:'Season Over 2.5 strength',value:{home:homeSeasonO25.rate,away:awaySeasonO25.rate}},
    {key:'home-venue',ok:homeVenuePass,label:'Home team home Over 2.5 ≥ 72%',value:homeHomeO25.rate},
    {key:'away-venue',ok:awayVenuePass,label:'Away team away Over 2.5 ≥ 68%',value:awayAwayO25.rate},
    {key:'goals',ok:goalsPass,label:'Combined average goals ≥ 3.40',value:combinedAverageGoals},
    {key:'xg',ok:xgPass,label:'Combined xG + xGA ≥ 3.10',value:combinedXg,optional:true,available:xgAvailable},
    {key:'recent',ok:recentPass,label:'Last 6 Over 2.5 pattern',value:{home:homeRecent.overs,away:awayRecent.overs}},
    {key:'league',ok:leaguePass,label:'League Over 2.5 average ≥ 56%',value:leagueO25.rate},
    {key:'maturity',ok:maturityPass,label:'Both teams have played at least 11 matches',value:{home:homeSeason.length,away:awaySeason.length}}
  ]
  const mandatoryPass=checks.filter(c=>!c.optional).every(c=>c.ok===true)
  return{
    allowed:mandatoryPass,
    grade:mandatoryPass?(xgAvailable&&xgPass?'elite':'strong'):'skip',
    xgStatus:!xgAvailable?'unavailable':xgPass?'pass':'below-threshold',
    checks,
    metrics:{
      homeSeasonOver25:homeSeasonO25.rate,awaySeasonOver25:awaySeasonO25.rate,
      homeVenueOver25:homeHomeO25.rate,awayVenueOver25:awayAwayO25.rate,
      combinedAverageGoals,combinedXg,
      homeLast6Overs:homeRecent.overs,awayLast6Overs:awayRecent.overs,
      leagueOver25:leagueO25.rate,homeMatches:homeSeason.length,awayMatches:awaySeason.length
    }
  }
}

export function isOver25Selection(market,outcome){
  if(String(market?.marketKey||'')!=='total-goals')return false
  const match=String(outcome?.name||'').match(/\bOver\s*2(?:\.0|\.00)?\.?(?:5)?\b/i)
  if(match)return /\bOver\s*2\.5\b/i.test(String(outcome?.name||''))
  const parsed=String(outcome?.name||'').match(/\bOver\s*([0-9]+(?:\.[0-9]+)?)/i)
  return parsed?Number(parsed[1])===2.5:false
}

export function over25Gate(f,market,outcome){
  if(!isOver25Selection(market,outcome))return{applies:false,allowed:true,profile:null}
  const profile=f?.over25Profile||null
  return{applies:true,allowed:profile?.allowed===true,profile}
}
