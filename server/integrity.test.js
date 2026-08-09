import { buildCoherentOdds } from './oddsPolicy.js'
import { flattenStandingGroups } from './apiFootball.js'
import { splitStandingMetrics } from './stats.js'
import { statusGroup } from './lifecycle.js'
import { oneBestPerFixture } from './engine.js'
import { withDeadline } from './providerFetch.js'

const fixture={teams:{home:{name:'Alpha'},away:{name:'Beta'}}}
const incomplete=[{bookmakers:[{name:'Book A',bets:[{name:'Match Winner',values:[{value:'Home',odd:'1.80'},{value:'Draw',odd:'3.20'}]}]},{name:'Book B',bets:[{name:'Match Winner',values:[{value:'Away',odd:'4.50'}]}]}]}]
let odds=buildCoherentOdds({apiPayload:incomplete,fixture})
if(odds.canonical.home||odds.canonical.draw||odds.canonical.away)throw new Error('1X2 must never be stitched across bookmakers')
const complete=[{bookmakers:[{name:'Pinnacle',bets:[{name:'Match Winner',values:[{value:'Home',odd:'1.81'},{value:'Draw',odd:'3.30'},{value:'Away',odd:'4.40'}]},{name:'Goals Over/Under',values:[{value:'Over 2.5',odd:'1.70'},{value:'Under 2.5',odd:'2.10'}]}]}]}]
odds=buildCoherentOdds({apiPayload:complete,fixture})
if(odds.canonical.home!==1.81||odds.canonical.over25!==1.70||odds.marketOdds.find(m=>m.marketKey==='match-winner')?.bookmaker!=='Pinnacle')throw new Error('Complete coherent bookmaker market was not preserved')

const rec=(played,win,draw,gf,ga)=>({played,win,draw,lose:played-win-draw,goals:{for:gf,against:ga}})
const row=(id,group)=>({team:{id,name:`T${id}`},rank:1,points:12,all:rec(6,4,0,8,3),home:rec(3,2,0,4,1),away:rec(3,2,0,4,2),group})
const provider=[{league:{standings:[[row(1,'East'),row(2,'East')],[row(3,'West'),row(4,'West')]]}}]
const flat=flattenStandingGroups(provider)
if(flat.length!==4||flat.filter(x=>x._s2pGroupIndex===1).length!==2)throw new Error('Grouped/conference standings were not preserved')
const t3=splitStandingMetrics(flat,3,'home')
if(t3.leagueSize!==2||t3.groupName!=='West')throw new Error('Split rank must be calculated inside the team’s own standings group')
if(statusGroup('PST')!=='postponed'||statusGroup('CANC')!=='postponed'||statusGroup('NS')!=='upcoming')throw new Error('Postponed/cancelled matches must not appear as upcoming')

const rows=[{fixtureId:1,market:'O2.5',familyCount:1,familyStrength:1.6,contradiction:'LOW',score:4,odds:1.6,filterCount:3},{fixtureId:1,market:'1X2',familyCount:4,familyStrength:4.2,contradiction:'LOW',score:12,odds:1.9,filterCount:4},{fixtureId:2,market:'O1.5',familyCount:1,familyStrength:1.5,contradiction:'LOW',score:3,odds:1.3,filterCount:3}]
const best=oneBestPerFixture(rows)
if(best.length!==2||best.find(x=>x.fixtureId===1)?.market!=='1X2')throw new Error('Best Picks must contain only the strongest market per fixture')
let timedOut=false
try{await withDeadline(new Promise(r=>setTimeout(r,1200)),1000,'test operation')}catch{timedOut=true}
if(!timedOut)throw new Error('Overall operation deadline did not fail closed')
console.log(JSON.stringify({ok:true,oddsPolicy:odds.policy,groups:flat.length,bestPicks:best.length},null,2))
