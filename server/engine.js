import {ENGINE_VERSION,FORM_TABLE_SAMPLE,PROFILE_SOURCE,MIN_LEAGUE_GAMES,MIN_SPLIT_TABLE_SAMPLE,MIN_SPLIT_FORM_SAMPLE,SPLIT_LONG_SAMPLE,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,FAMILY,MIN_ODD,MAX_ODD,MIN_CONSENSUS} from './engineConfig.js'
export {ENGINE_VERSION,FORM_TABLE_SAMPLE,PROFILE_SOURCE,MIN_LEAGUE_GAMES,MIN_SPLIT_TABLE_SAMPLE,MIN_SPLIT_FORM_SAMPLE,SPLIT_LONG_SAMPLE,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,FAMILY,MIN_ODD,MAX_ODD,MIN_CONSENSUS} from './engineConfig.js'
export {leagueMature,buildVenueFormTable,formTableProfile,splitStandingProfile,recentVenueProfile,makeTeamProfile} from './splitEngine.js'

const finite=v=>Number.isFinite(Number(v))
const inOddsWindow=v=>finite(v)&&Number(v)>=MIN_ODD&&Number(v)<=MAX_ODD
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const rate=(hits,total)=>total?Math.round(hits*100/total):null
const teamIsHome=(f,id)=>String(f?.teams?.home?.id)===String(id)

function fullScore(f,id){
  const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
  if(!finite(h)||!finite(a))return null
  return teamIsHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}
function halfScore(f,id){
  const h=Number(f?.score?.halftime?.home),a=Number(f?.score?.halftime?.away)
  if(!finite(h)||!finite(a))return null
  return teamIsHome(f,id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}
function parsedOU(name){
  const m=String(name||'').match(/\b(Over|Under)\s*([0-9]+(?:\.[0-9]+)?)/i)
  return m?{side:m[1].toLowerCase(),line:Number(m[2])}:null
}
function saneLine(key,line){
  if(!finite(line))return false
  if(key==='total-goals')return line>=0.5&&line<=6.5
  if(key==='first-half-goals')return line>=0.5&&line<=3.5
  if(['home-team-goals','away-team-goals','team-goals'].includes(key))return line>=0.5&&line<=4.5
  return true
}
function resultRate(profile,wanted,half=false){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){
    const g=half?halfScore(f,id):fullScore(f,id);if(!g)continue
    total++
    const r=g.own>g.opp?'win':g.own<g.opp?'loss':'draw'
    if(r===wanted)hits++
  }
  return rate(hits,total)
}
function totalRate(profile,side,line,half=false){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){
    const g=half?halfScore(f,id):fullScore(f,id);if(!g)continue
    total++
    if(side==='over'?g.total>line:g.total<line)hits++
  }
  return rate(hits,total)
}
function ownGoalRate(profile,side,line){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){const g=fullScore(f,id);if(!g)continue;total++;if(side==='over'?g.own>line:g.own<line)hits++}
  return rate(hits,total)
}
function oppGoalRate(profile,side,line){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){const g=fullScore(f,id);if(!g)continue;total++;if(side==='over'?g.opp>line:g.opp<line)hits++}
  return rate(hits,total)
}
function bttsRate(profile,yes){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){const g=fullScore(f,id);if(!g)continue;total++;const b=g.own>0&&g.opp>0;if(b===yes)hits++}
  return rate(hits,total)
}
function dcRate(profile,type){
  const rows=profile?.venueFixtures||[],id=profile?.id
  let total=0,hits=0
  for(const f of rows){
    const g=fullScore(f,id);if(!g)continue;total++
    const win=g.own>g.opp,draw=g.own===g.opp,loss=g.own<g.opp
    if((type==='not-loss'&&(win||draw))||(type==='not-win'&&(loss||draw))||(type==='not-draw'&&(win||loss)))hits++
  }
  return rate(hits,total)
}
function consensusFor(f,market,outcome){
  const key=market?.marketKey,name=String(outcome?.name||''),n=norm(name),home=f.home,away=f.away
  if(key==='match-winner'){
    if(n==='home'||n==='1')return[resultRate(home,'win'),resultRate(away,'loss')]
    if(n==='away'||n==='2')return[resultRate(home,'loss'),resultRate(away,'win')]
    if(n==='draw'||n==='x')return[resultRate(home,'draw'),resultRate(away,'draw')]
  }
  if(key==='double-chance'){
    if(n.includes('home or draw')||n==='1x')return[dcRate(home,'not-loss'),dcRate(away,'not-win')]
    if(n.includes('draw or away')||n==='x2')return[dcRate(home,'not-win'),dcRate(away,'not-loss')]
    if(n.includes('home or away')||n==='12')return[dcRate(home,'not-draw'),dcRate(away,'not-draw')]
  }
  if(key==='draw-no-bet'){
    if(n==='home'||n==='1')return[dcRate(home,'not-loss'),dcRate(away,'not-win')]
    if(n==='away'||n==='2')return[dcRate(home,'not-win'),dcRate(away,'not-loss')]
  }
  if(key==='both-teams-score'){
    if(n==='yes')return[bttsRate(home,true),bttsRate(away,true)]
    if(n==='no')return[bttsRate(home,false),bttsRate(away,false)]
  }
  if(key==='total-goals'){
    const p=parsedOU(name);if(p&&saneLine(key,p.line))return[totalRate(home,p.side,p.line),totalRate(away,p.side,p.line)]
  }
  if(key==='first-half-goals'){
    const p=parsedOU(name);if(p&&saneLine(key,p.line))return[totalRate(home,p.side,p.line,true),totalRate(away,p.side,p.line,true)]
  }
  if(key==='first-half-winner'){
    if(n==='home'||n==='1')return[resultRate(home,'win',true),resultRate(away,'loss',true)]
    if(n==='away'||n==='2')return[resultRate(home,'loss',true),resultRate(away,'win',true)]
    if(n==='draw'||n==='x')return[resultRate(home,'draw',true),resultRate(away,'draw',true)]
  }
  if(key==='home-team-goals'){
    const p=parsedOU(name);if(p&&saneLine(key,p.line))return[ownGoalRate(home,p.side,p.line),oppGoalRate(away,p.side,p.line)]
  }
  if(key==='away-team-goals'){
    const p=parsedOU(name);if(p&&saneLine(key,p.line))return[oppGoalRate(home,p.side,p.line),ownGoalRate(away,p.side,p.line)]
  }
  if(key==='team-goals'){
    const p=parsedOU(name)
    if(p&&saneLine(key,p.line)&&/\bhome\b/i.test(name))return[ownGoalRate(home,p.side,p.line),oppGoalRate(away,p.side,p.line)]
    if(p&&saneLine(key,p.line)&&/\baway\b/i.test(name))return[oppGoalRate(home,p.side,p.line),ownGoalRate(away,p.side,p.line)]
  }
  return null
}
function candidate(f,market,outcome){
  const odds=Number(outcome?.odd)
  if(!inOddsWindow(odds))return null
  const pair=consensusFor(f,market,outcome)
  if(!pair)return null
  const [homeRate,awayRate]=pair
  if(!finite(homeRate)||!finite(awayRate)||homeRate<MIN_CONSENSUS||awayRate<MIN_CONSENSUS)return null
  const consensus=Math.min(homeRate,awayRate)
  const selection=String(outcome?.name||'Selection')
  const marketName=String(market?.market||market?.marketKey||'Market')
  const reason=`${marketName} — ${selection} @ ${odds.toFixed(2)}. Home split support ${homeRate}%; away split support ${awayRate}%. Both meet the ${MIN_CONSENSUS}% rule.`
  return{
    fixtureId:f.fixtureId,match:f.match,league:f.league,country:f.country,leagueLogo:f.leagueLogo||null,countryFlag:f.countryFlag||null,
    kickoff:f.kickoff,kickoffLocal:f.kickoffLocal,home:f?.home?.name||'',away:f?.away?.name||'',homeLogo:f?.home?.logo||null,awayLogo:f?.away?.logo||null,
    market:market.marketKey,marketName,selection,odds:+odds.toFixed(2),homeConsensus:homeRate,awayConsensus:awayRate,consensus,
    filterCount:2,engineRating:`${consensus}%`,reasons:[reason],warnings:[],reason
  }
}
export function analyzeFixture(f){
  const rows=[]
  for(const market of f?.marketOdds||[])for(const outcome of market?.outcomes||[]){const c=candidate(f,market,outcome);if(c)rows.push(c)}
  return rows.sort((a,b)=>b.consensus-a.consensus||a.odds-b.odds||String(a.marketName).localeCompare(String(b.marketName)))
}
export function oneBestPerFixture(rows){
  const by=new Map()
  for(const r of rows||[]){const k=String(r.fixtureId),p=by.get(k);if(!p||r.consensus>p.consensus||(r.consensus===p.consensus&&r.odds<p.odds))by.set(k,r)}
  return[...by.values()].sort((a,b)=>b.consensus-a.consensus||a.odds-b.odds)
}
export function buildBoard(fixtures,meta={}){
  const all=(fixtures||[]).flatMap(analyzeFixture),best=oneBestPerFixture(all)
  return{meta:{...meta,engineVersion:ENGINE_VERSION,profileSource:PROFILE_SOURCE,formTableSample:FORM_TABLE_SAMPLE,minimumLeagueGames:MIN_LEAGUE_GAMES,
    teamResultPolicy:TEAM_RESULT_POLICY,ggPolicy:GG_POLICY,oddsPolicy:ODDS_POLICY,minOdd:MIN_ODD,maxOdd:MAX_ODD,minConsensus:MIN_CONSENSUS,
    qualified:all.length,bestPicks:best.length},
    groups:{single:[],two:all,threePlus:[]},priority:all,bestPicks:best,availableMarkets:[...new Set(all.map(x=>x.market).filter(Boolean))].sort()}
}
