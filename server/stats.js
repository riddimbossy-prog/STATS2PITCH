function pct(n,d){ return d ? Math.round((n/d)*100) : null }
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null}

export const MIN_LEAGUE_GAMES = 4
export const SPLIT_ENGINE_POLICY = 'strict-home-away-split-v1'
export const MIN_SPLIT_FORM_SAMPLE = 5
export const SPLIT_FORM_LONG_SAMPLE = 10

function playedValues(standings) {
  if (!Array.isArray(standings) || !standings.length) return []
  return standings.map(row => {
    const played = Number(row?.all?.played)
    return Number.isFinite(played) && played >= 0 ? played : 0
  })
}

export function leagueGamesPlayed(standings) {
  const values = playedValues(standings)
  return values.length ? Math.min(...values) : 0
}
export function leagueMinimumTeamPlayed(standings) { return leagueGamesPlayed(standings) }
export function leagueTotalCompletedGames(standings) {
  const values = playedValues(standings)
  return values.length ? Math.floor(values.reduce((a,b)=>a+b,0) / 2) : 0
}
export function leagueAverageTeamPlayed(standings) {
  const values = playedValues(standings)
  return values.length ? +(values.reduce((a,b)=>a+b,0) / values.length).toFixed(2) : 0
}
export function hasMinimumLeagueGames(standings, minimum=MIN_LEAGUE_GAMES) {
  const required = Number(minimum || MIN_LEAGUE_GAMES)
  return playedValues(standings).length > 0 && leagueMinimumTeamPlayed(standings) >= required
}

function record(row, venue){
  const r=row?.[venue]||{}
  const played=Math.max(0,num(r?.played)??0)
  const win=Math.max(0,num(r?.win)??0)
  const draw=Math.max(0,num(r?.draw)??0)
  const lose=Math.max(0,num(r?.lose)??0)
  const gf=num(r?.goals?.for)
  const ga=num(r?.goals?.against)
  const points=win*3+draw
  return{played,win,draw,lose,gf:Number.isFinite(gf)?gf:null,ga:Number.isFinite(ga)?ga:null,points}
}

/**
 * Creates Stats2Pitch's virtual HOME or AWAY table from the provider's split
 * standings. Rank is recalculated from split-only points, then goal difference,
 * goals scored and wins. Overall rank is never reused as a split rank.
 */
export function buildSplitTable(standings, venue){
  if(!['home','away'].includes(venue))throw new Error('Split table venue must be home or away')
  const rows=(Array.isArray(standings)?standings:[]).map(row=>{
    const r=record(row,venue)
    const gd=Number.isFinite(r.gf)&&Number.isFinite(r.ga)?r.gf-r.ga:null
    return{
      teamId:row?.team?.id??null,
      teamName:row?.team?.name??'',
      overallPosition:num(row?.rank),
      ...r,
      goalDiff:gd
    }
  }).filter(x=>x.teamId!==null)

  rows.sort((a,b)=>
    b.points-a.points ||
    (Number(b.goalDiff??-999)-Number(a.goalDiff??-999)) ||
    (Number(b.gf??-999)-Number(a.gf??-999)) ||
    b.win-a.win ||
    String(a.teamName).localeCompare(String(b.teamName))
  )
  return rows.map((x,i)=>({...x,position:i+1,venue}))
}

export function overallStandingMetrics(standings, teamId){
  const row=(standings||[]).find(x=>String(x?.team?.id)===String(teamId))
  if(!row)return{position:null,played:null,ppg:null,goalsScored:null,goalsConceded:null}
  const played=num(row?.all?.played)??0
  const gf=num(row?.all?.goals?.for)
  const ga=num(row?.all?.goals?.against)
  const points=num(row?.points)
  return{
    position:num(row?.rank),
    played,
    ppg:played&&Number.isFinite(points)?+(points/played).toFixed(2):null,
    goalsScored:played&&Number.isFinite(gf)?+(gf/played).toFixed(2):null,
    goalsConceded:played&&Number.isFinite(ga)?+(ga/played).toFixed(2):null
  }
}

export function splitStandingMetrics(standings, teamId, venue){
  const table=buildSplitTable(standings,venue)
  const row=table.find(x=>String(x.teamId)===String(teamId))
  const overall=overallStandingMetrics(standings,teamId)
  if(!row)return{
    venue,position:null,played:null,ppg:null,goalsScored:null,goalsConceded:null,
    seasonWinRate:null,seasonDrawRate:null,seasonLossRate:null,
    splitPoints:null,splitWins:null,splitDraws:null,splitLosses:null,
    overallPosition:overall.position,overallPlayed:overall.played,overallPpg:overall.ppg
  }
  return{
    venue,
    position:row.position,
    played:row.played,
    ppg:row.played?+(row.points/row.played).toFixed(2):null,
    goalsScored:row.played&&Number.isFinite(row.gf)?+(row.gf/row.played).toFixed(2):null,
    goalsConceded:row.played&&Number.isFinite(row.ga)?+(row.ga/row.played).toFixed(2):null,
    seasonWinRate:row.played?pct(row.win,row.played):null,
    seasonDrawRate:row.played?pct(row.draw,row.played):null,
    seasonLossRate:row.played?pct(row.lose,row.played):null,
    splitPoints:row.points,
    splitWins:row.win,
    splitDraws:row.draw,
    splitLosses:row.lose,
    splitGoalDifference:row.goalDiff,
    overallPosition:overall.position,
    overallPlayed:overall.played,
    overallPpg:overall.ppg,
    overallGoalsScored:overall.goalsScored,
    overallGoalsConceded:overall.goalsConceded
  }
}

// Backward-compatible overall helper. The strict engine does not use this to
// fire filters; enrich.js explicitly uses splitStandingMetrics instead.
export function standingMetrics(standings, teamId){return overallStandingMetrics(standings,teamId)}

function isFinished(f){return f?.fixture?.status?.short==='FT'||f?.fixture?.status?.long==='Match Finished'}
function atVenue(f,teamId,venue){
  return venue==='home'?String(f?.teams?.home?.id)===String(teamId):String(f?.teams?.away?.id)===String(teamId)
}
function ownOppGoals(f,teamId){
  const home=String(f?.teams?.home?.id)===String(teamId)
  const own=Number(home?f?.goals?.home:f?.goals?.away)
  const opp=Number(home?f?.goals?.away:f?.goals?.home)
  return{own,opp}
}
function rate(rows,predicate){return rows.length?pct(rows.filter(predicate).length,rows.length):null}
function avg(rows,selector){
  if(!rows.length)return null
  const vals=rows.map(selector).filter(Number.isFinite)
  return vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2):null
}

/**
 * Strict venue-only recent form. A home team can only use home matches; an away
 * team can only use away matches. Last-5 rates are withheld unless five split
 * matches exist, preventing 2/2 or 3/3 starts from masquerading as 100% form.
 * Last-10 confirmation is withheld unless ten split matches exist.
 */
export function deriveVenueRecentStats(fixtures, teamId, venue){
  const rows=(Array.isArray(fixtures)?fixtures:[])
    .filter(f=>isFinished(f)&&atVenue(f,teamId,venue))
    .sort((a,b)=>new Date(b?.fixture?.date)-new Date(a?.fixture?.date))
    .slice(0,SPLIT_FORM_LONG_SAMPLE)

  const last5=rows.slice(0,5)
  const strict5=last5.length>=MIN_SPLIT_FORM_SAMPLE?last5:[]
  const strict10=rows.length>=SPLIT_FORM_LONG_SAMPLE?rows:[]

  const winRate=rate(strict5,f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp})
  const lossRate=rate(strict5,f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp})
  const winRate10=rate(strict10,f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp})
  const lossRate10=rate(strict10,f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp})

  const goalsRows=rows.length>=MIN_SPLIT_FORM_SAMPLE?rows:[]
  const over15=rate(goalsRows,f=>Number(f?.goals?.home)+Number(f?.goals?.away)>1.5)
  const over25=rate(goalsRows,f=>Number(f?.goals?.home)+Number(f?.goals?.away)>2.5)
  const over35=rate(goalsRows,f=>Number(f?.goals?.home)+Number(f?.goals?.away)>3.5)
  const cleanSheetRate=rate(goalsRows,f=>ownOppGoals(f,teamId).opp===0)
  const failedToScoreRate=rate(goalsRows,f=>ownOppGoals(f,teamId).own===0)
  const bttsRate=rate(goalsRows,f=>{const g=ownOppGoals(f,teamId);return g.own>0&&g.opp>0})

  let formAgreement='INSUFFICIENT'
  if(strict10.length){
    if(winRate>=60&&winRate10>=60)formAgreement='WIN_STRONG'
    else if(lossRate>=60&&lossRate10>=60)formAgreement='LOSS_STRONG'
    else if((winRate>=60&&winRate10<50)||(lossRate>=60&&lossRate10<50))formAgreement='CONFLICT'
    else formAgreement='NEUTRAL'
  }

  return{
    venue,
    formSample:last5.length,
    formLongSample:rows.length,
    goalsSample:goalsRows.length,
    winRate,lossRate,winRate10,lossRate10,formAgreement,
    over15,under15:Number.isFinite(over15)?100-over15:null,
    over25,under25:Number.isFinite(over25)?100-over25:null,
    over35,under35:Number.isFinite(over35)?100-over35:null,
    cleanSheetRate,failedToScoreRate,bttsRate,
    recentGoalsScored:avg(goalsRows,f=>ownOppGoals(f,teamId).own),
    recentGoalsConceded:avg(goalsRows,f=>ownOppGoals(f,teamId).opp)
  }
}

// Kept for compatibility with older tests/tools; it is intentionally not used
// by the strict split engine.
export function deriveRecentStats(fixtures, teamId){
  const rows=(Array.isArray(fixtures)?fixtures:[]).filter(isFinished).sort((a,b)=>new Date(b.fixture.date)-new Date(a.fixture.date)).slice(0,10)
  const last5=rows.slice(0,5)
  const wins=last5.filter(f=>{const g=ownOppGoals(f,teamId);return g.own>g.opp}).length
  const losses=last5.filter(f=>{const g=ownOppGoals(f,teamId);return g.own<g.opp}).length
  const over15=rate(rows,f=>Number(f.goals.home)+Number(f.goals.away)>1.5)
  const over25=rate(rows,f=>Number(f.goals.home)+Number(f.goals.away)>2.5)
  const over35=rate(rows,f=>Number(f.goals.home)+Number(f.goals.away)>3.5)
  return{formSample:last5.length,goalsSample:rows.length,winRate:pct(wins,last5.length),lossRate:pct(losses,last5.length),over15,under15:Number.isFinite(over15)?100-over15:null,over25,under25:Number.isFinite(over25)?100-over25:null,over35,under35:Number.isFinite(over35)?100-over35:null}
}

export function parse1x2Odds(payload) {
  for (const item of payload || []) for (const book of item.bookmakers || []) {
    const bet = (book.bets || []).find(b => /match winner|winner/i.test(b.name))
    if (!bet) continue
    const vals = Object.fromEntries((bet.values || []).map(v => [String(v.value).toLowerCase(), Number(v.odd)]))
    const home = vals.home, draw = vals.draw, away = vals.away
    if (home && draw && away) return { home, draw, away, bookmaker: book.name }
  }
  return null
}
