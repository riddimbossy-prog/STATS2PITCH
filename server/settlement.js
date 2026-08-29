import {FINISHED} from './config.js'

const finite=v=>Number.isFinite(Number(v))
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const ou=s=>{const m=String(s||'').match(/\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null}
const result=(pass,voided=false)=>voided?'void':pass?'won':'lost'
const CANCELLED=new Set(['CANC','ABD','AWD','WO'])
const POSTPONED=new Set(['PST'])
export const DECIDED=new Set(['won','lost','void','postponed'])

export function isDecided(outcome){
  return DECIDED.has(String(outcome||''))
}

export function normalizeFixtureStatus(f){
  const status=String(f?.fixture?.status?.short||f?.status||'').toUpperCase()
  const ftHome=finite(f?.score?.fulltime?.home)?Number(f.score.fulltime.home):finite(f?.goals?.home)?Number(f.goals.home):finite(f?.homeScore)?Number(f.homeScore):null
  const ftAway=finite(f?.score?.fulltime?.away)?Number(f.score.fulltime.away):finite(f?.goals?.away)?Number(f.goals.away):finite(f?.awayScore)?Number(f.awayScore):null
  const htHome=finite(f?.score?.halftime?.home)?Number(f.score.halftime.home):finite(f?.htHome)?Number(f.htHome):null
  const htAway=finite(f?.score?.halftime?.away)?Number(f.score.halftime.away):finite(f?.htAway)?Number(f.htAway):null
  const finished=FINISHED.has(status)
  const live=['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(status)
  const cancelled=CANCELLED.has(status)
  const postponed=POSTPONED.has(status)
  return{
    fixtureId:f?.fixture?.id??f?.fixtureId,
    status,
    statusLong:f?.fixture?.status?.long||f?.statusLong||'',
    minute:f?.fixture?.status?.elapsed??f?.minute??null,
    kickoff:f?.fixture?.date||f?.kickoff||null,
    finished,live,cancelled,postponed,
    matchState:finished?'settled':live?'live':(cancelled||postponed)?'settled':'upcoming',
    homeScore:ftHome,awayScore:ftAway,htHome,htAway,
    homeName:f?.teams?.home?.name||f?.homeName||'',awayName:f?.teams?.away?.name||f?.awayName||''
  }
}

export function settlePick(pick,fixture){
  const f=fixture?normalizeFixtureStatus(fixture):null
  if(!f)return{outcome:'pending',matchState:'upcoming'}
  if(f.postponed||POSTPONED.has(String(f.status||'').toUpperCase()))return{outcome:'postponed',matchState:'settled',...f}
  if(f.cancelled||CANCELLED.has(String(f.status||'').toUpperCase()))return{outcome:'void',matchState:'settled',...f}
  if(!f.finished)return{outcome:'pending',matchState:f.matchState,...f}
  const h=Number(f.homeScore??f.home?.score),a=Number(f.awayScore??f.away?.score)
  if(!Number.isFinite(h)||!Number.isFinite(a))return{outcome:'pending',matchState:'settled',...f}
  const market=String(pick?.market||''),sel=norm(pick?.selection)
  let outcome='pending'
  if(market==='match-winner'){
    if(sel==='home'||sel==='1')outcome=result(h>a)
    else if(sel==='away'||sel==='2')outcome=result(a>h)
    else if(sel==='draw'||sel==='x')outcome=result(h===a)
  }else if(market==='double-chance'){
    if(sel==='1x'||sel.includes('home or draw'))outcome=result(h>=a)
    else if(sel==='x2'||sel.includes('draw or away'))outcome=result(a>=h)
    else if(sel==='12'||sel.includes('home or away'))outcome=result(h!==a)
  }else if(market==='draw-no-bet'){
    if(h===a)outcome='void'
    else if(sel==='home'||sel==='1')outcome=result(h>a)
    else if(sel==='away'||sel==='2')outcome=result(a>h)
  }else if(market==='both-teams-score'){
    const yes=h>0&&a>0
    if(sel==='yes')outcome=result(yes)
    else if(sel==='no')outcome=result(!yes)
  }else if(market==='total-goals'){
    const p=ou(pick?.selection);if(p)outcome=result(p.side==='over'?h+a>p.line:h+a<p.line,h+a===p.line)
  }else if(market==='home-team-goals'){
    const p=ou(pick?.selection);if(p)outcome=result(p.side==='over'?h>p.line:h<p.line,h===p.line)
  }else if(market==='away-team-goals'){
    const p=ou(pick?.selection);if(p)outcome=result(p.side==='over'?a>p.line:a<p.line,a===p.line)
  }else if(market==='first-half-goals'){
    if(Number.isFinite(Number(f.htHome))&&Number.isFinite(Number(f.htAway))){const t=Number(f.htHome)+Number(f.htAway),p=ou(pick?.selection);if(p)outcome=result(p.side==='over'?t>p.line:t<p.line,t===p.line)}
  }else if(market==='first-half-winner'){
    if(Number.isFinite(Number(f.htHome))&&Number.isFinite(Number(f.htAway))){const x=Number(f.htHome),y=Number(f.htAway);if(sel==='home'||sel==='1')outcome=result(x>y);else if(sel==='away'||sel==='2')outcome=result(y>x);else if(sel==='draw'||sel==='x')outcome=result(x===y)}
  }
  return{outcome,matchState:'settled',...f,settledAt:new Date().toISOString()}
}

export function resolveResult(pick,fixture,stored){
  const live=fixture?settlePick(pick,fixture):null
  if(live&&isDecided(live.outcome))return live
  if(live&&live.matchState==='live')return live
  if(stored&&isDecided(stored.outcome))return stored
  return live||stored||{outcome:'pending',matchState:Date.parse(pick?.kickoff)>Date.now()?'upcoming':'pending'}
}

export function settleBoard(board,fixtures=[]){
  const map=new Map((fixtures||[]).map(f=>{const n=normalizeFixtureStatus(f);return[String(n.fixtureId),n]}))
  const prior=board?.results||{}
  const results={...prior}
  for(const pick of [...(board?.bestPicks||[]),...(board?.varTips||[]),...(board?.filterTips||[]),...(board?.goalsBankers||[]),...(board?.dailyBankers||[])]){
    const key=String(pick.fixtureId),fixture=map.get(key)
    if(!fixture)continue
    results[key]=resolveResult(pick,fixture,prior[key])
  }
  const values=Object.values(results),summary={pending:0,live:0,won:0,lost:0,void:0,postponed:0}
  for(const r of values){
    if(r?.outcome==='won')summary.won++
    else if(r?.outcome==='lost')summary.lost++
    else if(r?.outcome==='void')summary.void++
    else if(r?.outcome==='postponed')summary.postponed++
    else if(r?.matchState==='live')summary.live++
    else summary.pending++
  }
  return{...board,results,resultSummary:summary}
}
