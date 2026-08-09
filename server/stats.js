function pct(n,d){ return d ? Math.round((n/d)*100) : null }
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}

export const MIN_LEAGUE_GAMES = 4
export const SPLIT_ENGINE_POLICY = 'strict-home-away-split-v2-integrity'
export const ENGINE_INTEGRITY_POLICY = 'split-integrity-family-goal-coherence-v1'
export const MIN_SPLIT_FORM_SAMPLE = 5
export const SPLIT_FORM_LONG_SAMPLE = 10
export const MIN_SPLIT_TABLE_SAMPLE = 3

function playedValues(standings) {
  if (!Array.isArray(standings) || !standings.length) return []
  return standings.map(row => {const played = Number(row?.all?.played);return Number.isFinite(played) && played >= 0 ? played : 0})
}
export function leagueGamesPlayed(standings) {const values = playedValues(standings);return values.length ? Math.min(...values) : 0}
export function leagueMinimumTeamPlayed(standings) { return leagueGamesPlayed(standings) }
export function leagueTotalCompletedGames(standings) {const values = playedValues(standings);return values.length ? Math.floor(values.reduce((a,b)=>a+b,0) / 2) : 0}
export function leagueAverageTeamPlayed(standings) {const values = playedValues(standings);return values.length ? +(values.reduce((a,b)=>a+b,0) / values.length).toFixed(2) : 0}
export function hasMinimumLeagueGames(standings, minimum=MIN_LEAGUE_GAMES) {const required = Number(minimum || MIN_LEAGUE_GAMES);return playedValues(standings).length > 0 && leagueMinimumTeamPlayed(standings) >= required}

function rowsForTeamGroup(standings,teamId){
  const rows=Array.isArray(standings)?standings:[],own=rows.find(r=>String(r?.team?.id)===String(teamId)),gi=own?._s2pGroupIndex
  if(gi===null||gi===undefined)return rows
  const grouped=rows.filter(r=>r?._s2pGroupIndex===gi)
  return grouped.length?grouped:rows
}
function record(row, venue){
  const r=row?.[venue]||{},played=Math.max(0,num(r?.played)??0),win=Math.max(0,num(r?.win)??0),draw=Math.max(0,num(r?.draw)??0),lose=Math.max(0,num(r?.lose)??0),gf=num(r?.goals?.for),ga=num(r?.goals?.against),points=win*3+draw
  const ppg=played?points/played:null,gd=Number.isFinite(gf)&&Number.isFinite(ga)?gf-ga:null
  return{played,win,draw,lose,gf:Number.isFinite(gf)?gf:null,ga:Number.isFinite(ga)?ga:null,points,ppg:Number.isFinite(ppg)?ppg:null,gd,gdpg:played&&Number.isFinite(gd)?gd/played:null,gfpg:played&&Number.isFinite(gf)?gf/played:null,winRate:played?win/played:null}
}
function pointsSort(a,b){return b.points-a.points || Number(b.gd??-999)-Number(a.gd??-999) || Number(b.gf??-999)-Number(a.gf??-999) || b.win-a.win || String(a.teamName).localeCompare(String(b.teamName))}
function strengthSort(a,b){return Number(b.ppg??-999)-Number(a.ppg??-999) || Number(b.gdpg??-999)-Number(a.gdpg??-999) || Number(b.gfpg??-999)-Number(a.gfpg??-999) || Number(b.winRate??-999)-Number(a.winRate??-999) || pointsSort(a,b)}

export function buildSplitTable(standings, venue, teamId=null){
  if(!['home','away'].includes(venue))throw new Error('Split table venue must be home or away')
  const scoped=teamId===null||teamId===undefined?(Array.isArray(standings)?standings:[]):rowsForTeamGroup(standings,teamId)
  const base=scoped.map(row=>{const r=record(row,venue);return{teamId:row?.team?.id??null,teamName:row?.team?.name??'',overallPosition:num(row?.rank),groupIndex:row?._s2pGroupIndex??null,groupName:row?._s2pGroupName??null,...r}}).filter(x=>x.teamId!==null)
  const pointsRank=new Map([...base].sort(pointsSort).map((x,i)=>[String(x.teamId),i+1])),strength=[...base].filter(x=>x.played>0).sort(strengthSort),strengthRank=new Map(strength.map((x,i)=>[String(x.teamId),i+1])),leagueSize=base.length
  return base.map(x=>({...x,pointsPosition:pointsRank.get(String(x.teamId))??null,strengthPosition:strengthRank.get(String(x.teamId))??null,position:x.played>=MIN_SPLIT_TABLE_SAMPLE?(strengthRank.get(String(x.teamId))??null):null,positionSampleReady:x.played>=MIN_SPLIT_TABLE_SAMPLE,leagueSize,venue})).sort((a,b)=>(a.strengthPosition??999)-(b.strengthPosition??999))
}

export function overallStandingMetrics(standings, teamId){
  const row=(standings||[]).find(x=>String(x?.team?.id)===String(teamId));if(!row)return{position:null,played:null,ppg:null,goalsScored:null,goalsConceded:null}
  const played=num(row?.all?.played)??0,gf=num(row?.all?.goals?.for),ga=num(row?.all?.goals?.against),points=num(row?.points)
  return{position:num(row?.rank),played,ppg:played&&Number.isFinite(points)?+(points/played).toFixed(2):null,goalsScored:played&&Number.isFinite(gf)?+(gf/played).toFixed(2):null,goalsConceded:played&&Number.isFinite(ga)?+(ga/played).toFixed(2):null}
}
export function splitStandingMetrics(standings, teamId, venue){
  const table=buildSplitTable(standings,venue,teamId),row=table.find(x=>String(x.teamId)===String(teamId)),overall=overallStandingMetrics(standings,teamId)
  if(!row)return{venue,position:null,pointsPosition:null,positionSampleReady:false,played:null,leagueSize:null,ppg:null,goalsScored:null,goalsConceded:null,seasonWinRate:null,seasonDrawRate:null,seasonLossRate:null,splitPoints:null,splitWins:null,splitDraws:null,splitLosses:null,overallPosition:overall.position,overallPlayed:overall.played,overallPpg:overall.ppg}
  return{venue,position:row.position,strengthPosition:row.strengthPosition,pointsPosition:row.pointsPosition,positionSampleReady:row.positionSampleReady,groupIndex:row.groupIndex,groupName:row.groupName,leagueSize:row.leagueSize,played:row.played,ppg:row.played?+row.ppg.toFixed(2):null,goalsScored:row.played&&Number.isFinite(row.gf)?+(row.gf/row.played).toFixed(2):null,goalsConceded:row.played&&Number.isFinite(row.ga)?+(row.ga/row.played).toFixed(2):null,seasonWinRate:row.played?pct(row.win,row.played):null,seasonDrawRate:row.played?pct(row.draw,row.played):null,seasonLossRate:row.played?pct(row.lose,row.played):null,splitPoints:row.points,splitWins:row.win,splitDraws:row.draw,splitLosses:row.lose,splitGoalDifference:row.gd,overallPosition:overall.position,overallPlayed:overall.played,overallPpg:overall.ppg,overallGoalsScored:overall.goalsScored,overallGoalsConceded:overall.goalsConceded}
}
export function standingMetrics(standings, teamId){return overallStandingMetrics(standings,teamId)}

function isFinished(f){return f?.fixture?.status?.short==='FT'||f?.fixture?.status?.long==='Match Finished'}
function atVenue(f,teamId,venue){return venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)}
function scorePair(f){const h=num(f?.goals?.home),a=num(f?.goals?.away);return Number.isFinite(h)&&Number.isFinite(a)?{home:h,away:a}:null}
function ownOppGoals(f,teamId){const score=scorePair(f);if(!score)return null;const home=String(f?.teams?.home?.id)===String(teamId);return home?{own:score.home,opp:score.away}:{own:score.away,opp:score.home}}
function validHistoricalFixture(f,teamId,venue){return isFinished(f)&&atVenue(f,teamId,venue)&&!!ownOppGoals(f,teamId)}
function rate(rows,predicate){return rows.length?pct(rows.filter(predicate).length,rows.length):null}
function avg(rows,selector){if(!rows.length)return null;const vals=rows.map(selector).filter(Number.isFinite);return vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2):null}

export function deriveVenueRecentStats(fixtures, teamId, venue){
  const rows=(Array.isArray(fixtures)?fixtures:[]).filter(f=>validHistoricalFixture(f,teamId,venue)).sort((a,b)=>new Date(b?.fixture?.date)-new Date(a?.fixture?.date)).slice(0,SPLIT_FORM_LONG_SAMPLE)
  const last5=rows.slice(0,5),strict5=last5.length>=MIN_SPLIT_FORM_SAMPLE?last5:[],strict10=rows.length>=SPLIT_FORM_LONG_SAMPLE?rows:[]
  const winRate=rate(strict5,f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp}),lossRate=rate(strict5,f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp}),winRate10=rate(strict10,f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp}),lossRate10=rate(strict10,f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp})
  const goalsRows=rows.length>=MIN_SPLIT_FORM_SAMPLE?rows:[],total=f=>{const s=scorePair(f);return s?s.home+s.away:null}
  const over15=rate(goalsRows,f=>total(f)>1.5),over25=rate(goalsRows,f=>total(f)>2.5),over35=rate(goalsRows,f=>total(f)>3.5),cleanSheetRate=rate(goalsRows,f=>ownOppGoals(f,teamId).opp===0),failedToScoreRate=rate(goalsRows,f=>ownOppGoals(f,teamId).own===0),bttsRate=rate(goalsRows,f=>{const g=ownOppGoals(f,teamId);return g.own>0&&g.opp>0})
  let formAgreement='INSUFFICIENT'
  if(strict10.length){if(winRate>=60&&winRate10>=60)formAgreement='WIN_STRONG';else if(lossRate>=60&&lossRate10>=60)formAgreement='LOSS_STRONG';else if((winRate>=60&&winRate10<50)||(lossRate>=60&&lossRate10<50))formAgreement='CONFLICT';else formAgreement='NEUTRAL'}
  return{venue,formSample:last5.length,formLongSample:rows.length,goalsSample:goalsRows.length,winRate,lossRate,winRate10,lossRate10,formAgreement,over15,under15:Number.isFinite(over15)?100-over15:null,over25,under25:Number.isFinite(over25)?100-over25:null,over35,under35:Number.isFinite(over35)?100-over35:null,cleanSheetRate,failedToScoreRate,bttsRate,recentGoalsScored:avg(goalsRows,f=>ownOppGoals(f,teamId).own),recentGoalsConceded:avg(goalsRows,f=>ownOppGoals(f,teamId).opp)}
}

export function deriveRecentStats(fixtures, teamId){
  const rows=(Array.isArray(fixtures)?fixtures:[]).filter(f=>isFinished(f)&&!!ownOppGoals(f,teamId)).sort((a,b)=>new Date(b?.fixture?.date)-new Date(a?.fixture?.date)).slice(0,10),last5=rows.slice(0,5)
  const wins=last5.filter(f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp}).length,losses=last5.filter(f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp}).length,total=f=>{const s=scorePair(f);return s?s.home+s.away:null},over15=rate(rows,f=>total(f)>1.5),over25=rate(rows,f=>total(f)>2.5),over35=rate(rows,f=>total(f)>3.5)
  return{formSample:last5.length,goalsSample:rows.length,winRate:pct(wins,last5.length),lossRate:pct(losses,last5.length),over15,under15:Number.isFinite(over15)?100-over15:null,over25,under25:Number.isFinite(over25)?100-over25:null,over35,under35:Number.isFinite(over35)?100-over35:null}
}
export function parse1x2Odds(payload) {for (const item of payload || []) for (const book of item.bookmakers || []) {const bet = (book.bets || []).find(b => /match winner|winner/i.test(b.name));if (!bet) continue;const vals = Object.fromEntries((bet.values || []).map(v => [String(v.value).toLowerCase(), Number(v.odd)]));const home = vals.home, draw = vals.draw, away = vals.away;if (home && draw && away) return { home, draw, away, bookmaker: book.name }}return null}
