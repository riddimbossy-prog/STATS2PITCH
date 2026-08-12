import {num,pct,avg,FORM_TABLE_SAMPLE,PROFILE_SOURCE} from './engineConfig.js'

function rowsForGroup(standings,teamId){
  const rows=Array.isArray(standings)?standings:[],own=rows.find(r=>String(r?.team?.id)===String(teamId)),gi=own?._s2pGroupIndex
  if(gi===null||gi===undefined)return rows
  const grouped=rows.filter(r=>r?._s2pGroupIndex===gi)
  return grouped.length?grouped:rows
}
const finished=f=>['FT','AET','PEN'].includes(String(f?.fixture?.status?.short||''))
const atVenue=(f,id,v)=>v==='home'?String(f?.teams?.home?.id)===String(id):String(f?.teams?.away?.id)===String(id)
function goals(f,id){const h=num(f?.goals?.home),a=num(f?.goals?.away);if(h===null||a===null)return null;return String(f?.teams?.home?.id)===String(id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}}
function fixtureDate(f){const t=Date.parse(f?.fixture?.date||'');return Number.isFinite(t)?t:0}
function inferredTeams(fixtures){
  const by=new Map()
  for(const f of fixtures||[])for(const t of [f?.teams?.home,f?.teams?.away])if(t?.id!==undefined&&t?.id!==null&&!by.has(String(t.id)))by.set(String(t.id),{id:t.id,name:t.name||'',logo:t.logo||null})
  return [...by.values()]
}
function groupTeams(standings,teamId,fixtures){
  const rows=rowsForGroup(standings,teamId)
  if(rows.length)return rows.map(r=>({id:r?.team?.id,name:r?.team?.name||'',logo:r?.team?.logo||null})).filter(x=>x.id!==undefined&&x.id!==null)
  return inferredTeams(fixtures)
}
function teamFormRow(fixtures,team,venue){
  const rows=(fixtures||[]).filter(f=>finished(f)&&atVenue(f,team.id,venue)&&goals(f,team.id)).sort((a,b)=>fixtureDate(b)-fixtureDate(a)).slice(0,FORM_TABLE_SAMPLE)
  let win=0,draw=0,loss=0,gf=0,ga=0,btts=0,cs=0,fts=0,o15=0,o25=0,o35=0
  for(const f of rows){const g=goals(f,team.id);gf+=g.own;ga+=g.opp;if(g.own>g.opp)win++;else if(g.own<g.opp)loss++;else draw++;if(g.own>0&&g.opp>0)btts++;if(g.opp===0)cs++;if(g.own===0)fts++;if(g.total>1.5)o15++;if(g.total>2.5)o25++;if(g.total>3.5)o35++}
  const played=rows.length,points=win*3+draw,ready=played>=FORM_TABLE_SAMPLE,gd=gf-ga
  return{id:team.id,name:team.name||'',logo:team.logo||null,venue,played,ready,win,draw,loss,points,ppg:played?points/played:null,gf,ga,gd,gfpg:played?gf/played:null,gapg:played?ga/played:null,gdpg:played?gd/played:null,winRate:played?win/played:null,lossRate:played?loss/played:null,bttsRate:played?btts/played:null,cleanSheetRate:played?cs/played:null,failedToScoreRate:played?fts/played:null,over15:played?o15/played:null,over25:played?o25/played:null,over35:played?o35/played:null,fixtures:rows}
}
const strengthSort=(a,b)=>Number(b.ppg??-999)-Number(a.ppg??-999)||Number(b.gdpg??-999)-Number(a.gdpg??-999)||Number(b.gfpg??-999)-Number(a.gfpg??-999)||Number(b.winRate??-999)-Number(a.winRate??-999)||b.points-a.points||b.gd-a.gd||b.gf-a.gf||b.win-a.win

export function buildVenueFormTable(fixtures,standings,teamId,venue){
  if(!['home','away'].includes(venue))throw new Error('Venue must be home or away')
  const teams=groupTeams(standings,teamId,fixtures),rows=teams.map(team=>teamFormRow(fixtures,team,venue)),tableReady=rows.length>0&&rows.every(r=>r.ready),ranked=tableReady?[...rows].sort(strengthSort):[],rank=new Map(ranked.map((r,i)=>[String(r.id),i+1]))
  return{source:PROFILE_SOURCE,venue,sample:FORM_TABLE_SAMPLE,tableReady,leagueSize:rows.length,rows:rows.map(r=>({...r,position:tableReady?(rank.get(String(r.id))??null):null}))}
}

export function formTableProfile(fixtures,standings,teamId,venue){
  const table=buildVenueFormTable(fixtures,standings,teamId,venue),row=table.rows.find(r=>String(r.id)===String(teamId))
  if(!row)return null
  const sampleReady=row.ready===true,positionReady=sampleReady&&table.tableReady===true,rate=v=>sampleReady?pct(Math.round((v||0)*FORM_TABLE_SAMPLE),FORM_TABLE_SAMPLE):null
  return{source:PROFILE_SOURCE,venue,formTableSample:FORM_TABLE_SAMPLE,formTableReady:sampleReady,position:positionReady?row.position:null,positionSampleReady:positionReady,leagueSize:table.leagueSize,played:sampleReady?FORM_TABLE_SAMPLE:row.played,ppg:sampleReady?+row.ppg.toFixed(2):null,goalsScored:sampleReady?+row.gfpg.toFixed(2):null,goalsConceded:sampleReady?+row.gapg.toFixed(2):null,winRate:sampleReady?rate(row.winRate):null,lossRate:sampleReady?rate(row.lossRate):null,goalsSample:sampleReady?FORM_TABLE_SAMPLE:row.played,bttsRate:sampleReady?rate(row.bttsRate):null,cleanSheetRate:sampleReady?rate(row.cleanSheetRate):null,failedToScoreRate:sampleReady?rate(row.failedToScoreRate):null,over15:sampleReady?rate(row.over15):null,under15:sampleReady?100-rate(row.over15):null,over25:sampleReady?rate(row.over25):null,under25:sampleReady?100-rate(row.over25):null,over35:sampleReady?rate(row.over35):null,under35:sampleReady?100-rate(row.over35):null,recentGoalsScored:sampleReady?+row.gfpg.toFixed(2):null,recentGoalsConceded:sampleReady?+row.gapg.toFixed(2):null,formAgreement:sampleReady?'FORM_TABLE_ONLY':'INSUFFICIENT'}
}

// Fixture maturity only requires the two teams being analysed to have five relevant venue matches.
// A complete league-wide venue table is still required for ranking-dependent team-result markets.
export function leagueMature(leagueHistory,standings,homeId,awayId){
  const home=formTableProfile(leagueHistory,standings,homeId,'home'),away=formTableProfile(leagueHistory,standings,awayId,'away')
  return home?.formTableReady===true&&away?.formTableReady===true
}

// Compatibility exports: both now read the exact same last-5 venue Form Table source.
export function splitStandingProfile(standings,teamId,venue,leagueHistory=[]){return formTableProfile(leagueHistory,standings,teamId,venue)}
export function recentVenueProfile(fixtures,id,venue){
  const team=inferredTeams(fixtures).find(t=>String(t.id)===String(id))||{id,name:'',logo:null},row=teamFormRow(fixtures,team,venue),ready=row.ready,rate=v=>ready?pct(Math.round((v||0)*FORM_TABLE_SAMPLE),FORM_TABLE_SAMPLE):null
  return{source:PROFILE_SOURCE,formSample:row.played,goalsSample:row.played,winRate:ready?rate(row.winRate):null,lossRate:ready?rate(row.lossRate):null,winRate10:null,lossRate10:null,formAgreement:ready?'FORM_TABLE_ONLY':'INSUFFICIENT',over15:ready?rate(row.over15):null,under15:ready?100-rate(row.over15):null,over25:ready?rate(row.over25):null,under25:ready?100-rate(row.over25):null,over35:ready?rate(row.over35):null,under35:ready?100-rate(row.over35):null,bttsRate:ready?rate(row.bttsRate):null,cleanSheetRate:ready?rate(row.cleanSheetRate):null,failedToScoreRate:ready?rate(row.failedToScoreRate):null,recentGoalsScored:ready?+row.gfpg.toFixed(2):null,recentGoalsConceded:ready?+row.gapg.toFixed(2):null}
}
export function makeTeamProfile({standings,leagueHistory,history,team,venue}){
  const source=Array.isArray(leagueHistory)&&leagueHistory.length?leagueHistory:(history||[]),profile=formTableProfile(source,standings,team.id,venue)||{}
  return{id:team.id,name:team.name,logo:team.logo||null,venue,...profile}
}
