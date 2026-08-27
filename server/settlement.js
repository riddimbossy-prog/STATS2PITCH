import {FINISHED} from './config.js'

const finite=v=>Number.isFinite(Number(v))
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const ou=s=>{const m=String(s||'').match(/\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null}
const result=(pass,voided=false)=>voided?'void':pass?'won':'lost'

export function normalizeFixtureStatus(f){
  const status=String(f?.fixture?.status?.short||'').toUpperCase()
  const ftHome=finite(f?.score?.fulltime?.home)?Number(f.score.fulltime.home):finite(f?.goals?.home)?Number(f.goals.home):null
  const ftAway=finite(f?.score?.fulltime?.away)?Number(f.score.fulltime.away):finite(f?.goals?.away)?Number(f.goals.away):null
  const htHome=finite(f?.score?.halftime?.home)?Number(f.score.halftime.home):null
  const htAway=finite(f?.score?.halftime?.away)?Number(f.score.halftime.away):null
  const finished=FINISHED.has(status)
  const live=['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(status)
  const cancelled=['CANC','PST','ABD','AWD','WO'].includes(status)
  return{
    fixtureId:f?.fixture?.id,
    status,
    statusLong:f?.fixture?.status?.long||'',
    minute:f?.fixture?.status?.elapsed??null,
    kickoff:f?.fixture?.date||null,
    finished,live,cancelled,
    matchState:finished?'settled':live?'live':cancelled?'settled':'upcoming',
    homeScore:ftHome,awayScore:ftAway,htHome,htAway,
    homeName:f?.teams?.home?.name||'',awayName:f?.teams?.away?.name||''
  }
}

export function settlePick(pick,fixture){
  const f=fixture?.fixtureId?fixture:normalizeFixtureStatus(fixture)
  if(!f)return{outcome:'pending',matchState:'upcoming'}
  if(f.cancelled)return{outcome:'void',matchState:'settled',...f}
  if(!f.finished)return{outcome:'pending',matchState:f.matchState,...f}
  const h=Number(f.homeScore),a=Number(f.awayScore)
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

export function settleBoard(board,fixtures=[]){
  const map=new Map((fixtures||[]).map(f=>{const n=normalizeFixtureStatus(f);return[String(n.fixtureId),n]}))
  const prior=board?.results||{}
  const results={...prior}
  for(const pick of [...(board?.bestPicks||[]),...(board?.varTips||[]),...(board?.filterTips||[])]){
    const key=String(pick.fixtureId),fixture=map.get(key)
    if(!fixture)continue
    results[key]=settlePick(pick,fixture)
  }
  const values=Object.values(results),summary={pending:0,live:0,won:0,lost:0,void:0}
  for(const r of values){if(r?.outcome==='won')summary.won++;else if(r?.outcome==='lost')summary.lost++;else if(r?.outcome==='void')summary.void++;else if(r?.matchState==='live')summary.live++;else summary.pending++}
  return{...board,results,resultSummary:summary}
}
