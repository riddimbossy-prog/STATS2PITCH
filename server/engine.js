import {ENGINE_VERSION,MIN_LEAGUE_GAMES,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,PROFILE_SOURCE,FORM_TABLE_SAMPLE} from './engineConfig.js'
import {resultPicks} from './resultEngine.js'
import {goalPicks,ggPick} from './goalEngine.js'
import {comparePicks} from './pickUtils.js'
export {ENGINE_VERSION,FORM_TABLE_SAMPLE,PROFILE_SOURCE,MIN_LEAGUE_GAMES,MIN_SPLIT_TABLE_SAMPLE,MIN_SPLIT_FORM_SAMPLE,SPLIT_LONG_SAMPLE,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY,FAMILY} from './engineConfig.js'
export {leagueMature,buildVenueFormTable,formTableProfile,splitStandingProfile,recentVenueProfile,makeTeamProfile} from './splitEngine.js'
export function analyzeFixture(f){const rows=[...resultPicks(f),...goalPicks(f)],gg=ggPick(f);if(gg)rows.push(gg);return rows.sort(comparePicks)}
export function oneBestPerFixture(rows){const by=new Map();for(const r of rows||[]){const k=String(r.fixtureId),p=by.get(k);if(!p||comparePicks(r,p)<0)by.set(k,r)}return[...by.values()].sort(comparePicks)}
export function buildBoard(fixtures,meta={}){const all=(fixtures||[]).flatMap(analyzeFixture).sort(comparePicks),best=oneBestPerFixture(all);return{meta:{...meta,engineVersion:ENGINE_VERSION,profileSource:PROFILE_SOURCE,formTableSample:FORM_TABLE_SAMPLE,minimumLeagueGames:MIN_LEAGUE_GAMES,teamResultPolicy:TEAM_RESULT_POLICY,ggPolicy:GG_POLICY,oddsPolicy:ODDS_POLICY,qualified:all.length,bestPicks:best.length},groups:{single:all.filter(x=>x.filterCount===1),two:all.filter(x=>x.filterCount===2),threePlus:all.filter(x=>x.filterCount>=3)},priority:all,bestPicks:best,availableMarkets:[...new Set(all.map(x=>x.market))].sort()}}
