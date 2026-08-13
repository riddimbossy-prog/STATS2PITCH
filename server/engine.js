import {ENGINE_VERSION,FORM_TABLE_SAMPLE,PROFILE_SOURCE,MIN_LEAGUE_GAMES,MIN_SPLIT_TABLE_SAMPLE,MIN_SPLIT_FORM_SAMPLE,SPLIT_LONG_SAMPLE,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,FAMILY,MIN_ODD,MAX_ODD,MIN_CONSENSUS} from './engineConfig.js'
export {ENGINE_VERSION,FORM_TABLE_SAMPLE,PROFILE_SOURCE,MIN_LEAGUE_GAMES,MIN_SPLIT_TABLE_SAMPLE,MIN_SPLIT_FORM_SAMPLE,SPLIT_LONG_SAMPLE,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,FAMILY,MIN_ODD,MAX_ODD,MIN_CONSENSUS} from './engineConfig.js'
export {leagueMature,buildVenueFormTable,formTableProfile,splitStandingProfile,recentVenueProfile,makeTeamProfile} from './splitEngine.js'

const finite=v=>Number.isFinite(Number(v))
const inOddsWindow=v=>finite(v)&&Number(v)>=MIN_ODD&&Number(v)<=MAX_ODD
const marketRows=[
  {market:'O1.5',selection:'Over 1.5 Goals',oddKey:'over15',rateKey:'over15'},
  {market:'U1.5',selection:'Under 1.5 Goals',oddKey:'under15',rateKey:'under15'},
  {market:'O2.5',selection:'Over 2.5 Goals',oddKey:'over25',rateKey:'over25'},
  {market:'U2.5',selection:'Under 2.5 Goals',oddKey:'under25',rateKey:'under25'},
  {market:'O3.5',selection:'Over 3.5 Goals',oddKey:'over35',rateKey:'over35'},
  {market:'U3.5',selection:'Under 3.5 Goals',oddKey:'under35',rateKey:'under35'},
  {market:'BTTS',selection:'Both Teams To Score',oddKey:'bttsYes',rateKey:'bttsRate'}
]
function candidate(f,m){
  const odd=Number(f?.odds?.[m.oddKey]),homeRate=Number(f?.home?.[m.rateKey]),awayRate=Number(f?.away?.[m.rateKey])
  if(!inOddsWindow(odd)||!finite(homeRate)||!finite(awayRate))return null
  if(homeRate<MIN_CONSENSUS||awayRate<MIN_CONSENSUS)return null
  const consensus=Math.min(homeRate,awayRate)
  return{fixtureId:f.fixtureId,match:f.match,league:f.league,country:f.country,kickoff:f.kickoff,kickoffLocal:f.kickoffLocal,market:m.market,selection:m.selection,odd:+odd.toFixed(2),homeConsensus:homeRate,awayConsensus:awayRate,consensus,filterCount:2,reason:`Odds ${odd.toFixed(2)} are inside ${MIN_ODD.toFixed(2)}-${MAX_ODD.toFixed(2)} and both teams meet the ${MIN_CONSENSUS}% ${m.selection} requirement (${homeRate}% / ${awayRate}%).`}
}
export function analyzeFixture(f){return marketRows.map(m=>candidate(f,m)).filter(Boolean).sort((a,b)=>b.consensus-a.consensus||a.odd-b.odd||String(a.market).localeCompare(String(b.market)))}
export function oneBestPerFixture(rows){const by=new Map();for(const r of rows||[]){const k=String(r.fixtureId),p=by.get(k);if(!p||r.consensus>p.consensus||(r.consensus===p.consensus&&r.odd<p.odd))by.set(k,r)}return[...by.values()].sort((a,b)=>b.consensus-a.consensus||a.odd-b.odd)}
export function buildBoard(fixtures,meta={}){const all=(fixtures||[]).flatMap(analyzeFixture),best=oneBestPerFixture(all);return{meta:{...meta,engineVersion:ENGINE_VERSION,profileSource:PROFILE_SOURCE,formTableSample:FORM_TABLE_SAMPLE,minimumLeagueGames:MIN_LEAGUE_GAMES,teamResultPolicy:TEAM_RESULT_POLICY,ggPolicy:GG_POLICY,oddsPolicy:ODDS_POLICY,minOdd:MIN_ODD,maxOdd:MAX_ODD,minConsensus:MIN_CONSENSUS,qualified:all.length,bestPicks:best.length},groups:{single:[],two:all,threePlus:[]},priority:all,bestPicks:best,availableMarkets:[...new Set(all.map(x=>x.market))].sort()}}
