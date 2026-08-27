import {ENGINE_VERSION,FINISHED,FORM_SAMPLE} from './config.js'
import {venueMetrics} from './awayFavEngine.js'
import {attachWhy,last5Form,last5Overall,fixtureHasStats} from './pickWhy.js'

export const ENGINE_ID='sporty-filter-v1'
export const RULES=Object.freeze({
  winMin:1.20,
  winMax:1.55,
  over15Max:1.30,
  over15Under35Min:1.39,
  under35Max:1.30,
  under35Over15Min:1.39,
  over25Max:1.50,
  over25Under35Min:1.60,
  under25Max:1.52,
  under25Over15Min:1.60,
  ggYesMax:1.50,
  gg2NoMin:1.30,
  directionMin:60,
  topN:5,
  bottomN:3,
  minVenueMatches:5,
  similarPpg:0.35,
  similarGf:0.40,
  similarGa:0.40,
  noH2hPpgGap:0.30
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const done=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())
const atVenue=(f,id,venue)=>venue==='home'?String(f?.teams?.home?.id)===String(id):String(f?.teams?.away?.id)===String(id)
const CUP=/\b(cup|copa|coppa|pokal|fa cup|league cup|champions|europa|conference|knockout|play[- ]?offs?|qualification|qualifier|trophy|super cup|community shield|elimination)\b/i

function oddOf(markets,key,names){
  for(const market of markets||[]){
    if(market?.marketKey!==key)continue
    for(const name of names){
      const hit=(market.outcomes||[]).find(o=>norm(o?.name)===norm(name))
      const price=num(hit?.odd)
      if(price)return price
    }
  }
  return null
}

function scanOdd(markets,test){
  for(const market of markets||[]){
    for(const outcome of market.outcomes||[]){
      const price=num(outcome?.odd)
      if(!price)continue
      if(test(norm(market.marketKey),norm(market.market),norm(outcome.name)))return price
    }
  }
  return null
}

function gg2NoOdd(markets){
  const direct=oddOf(markets,'both-teams-score-2',['No'])
  if(direct)return direct
  return scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return (/gg.?ng.?2|gg 2|btts 2|both teams.*2/.test(blob)||key==='both-teams-score-2'||key==='60000')&&/\bno\b/.test(name)
  })
}

export function extractFilterOdds(fixture){
  const markets=fixture?.marketOdds||[]
  return{
    homeWin:oddOf(markets,'match-winner',['Home','1']),
    awayWin:oddOf(markets,'match-winner',['Away','2']),
    over15:oddOf(markets,'total-goals',['Over 1.5','O 1.5']),
    under35:oddOf(markets,'total-goals',['Under 3.5','U 3.5']),
    over25:oddOf(markets,'total-goals',['Over 2.5','O 2.5']),
    under25:oddOf(markets,'total-goals',['Under 2.5','U 2.5']),
    ggYes:oddOf(markets,'both-teams-score',['Yes']),
    gg2No:gg2NoOdd(markets)
  }
}

export function isCupCompetition(name){
  return CUP.test(norm(name))
}

function tableGate(homeSplit,awaySplit){
  const hp=num(homeSplit?.position),ap=num(awaySplit?.position)
  const hs=num(homeSplit?.size),as=num(awaySplit?.size)
  if(!hp||!ap||!hs||!as)return{ok:true,skip:null}
  if(hp<=RULES.topN&&ap<=RULES.topN)return{ok:false,skip:'both-top-five'}
  if(hp>hs-RULES.bottomN&&ap>as-RULES.bottomN)return{ok:false,skip:'both-bottom-three'}
  return{ok:true,skip:null}
}

function similarForm(home,away){
  if(home.ppg===null||away.ppg===null||home.gf===null||away.gf===null||home.ga===null||away.ga===null)return false
  return Math.abs(away.ppg-home.ppg)<RULES.similarPpg
    &&Math.abs(away.gf-home.gf)<RULES.similarGf
    &&Math.abs(away.ga-home.ga)<RULES.similarGa
}

function pricedFavourite(odds){
  if(!odds.homeWin||!odds.awayWin)return null
  if(odds.homeWin<odds.awayWin)return{side:'home',odd:odds.homeWin,selection:'Home',displaySelection:'1X2 · Home'}
  if(odds.awayWin<odds.homeWin)return{side:'away',odd:odds.awayWin,selection:'Away',displaySelection:'1X2 · Away'}
  return null
}

function sameTeam(a,b){
  const x=norm(a),y=norm(b)
  return !!x&&!!y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x))))
}

function h2hAgainstFav(h2h,side,homeName,awayName){
  const favName=side==='home'?homeName:awayName
  let n=0,against=0
  for(const row of h2h||[]){
    if(!finite(row?.hs)||!finite(row?.as))continue
    const favHome=sameTeam(row.home,favName)
    const favAway=sameTeam(row.away,favName)
    if(!favHome&&!favAway)continue
    n++
    const favScore=favHome?Number(row.hs):Number(row.as)
    const oppScore=favHome?Number(row.as):Number(row.hs)
    if(favScore<=oppScore)against++
  }
  if(!n)return{ready:false,majority:false,n:0,against:0}
  return{ready:true,majority:against>n/2,n,against}
}

function favConflict(fixture,home,away,side){
  const fav=side==='home'?home:away
  const opp=side==='home'?away:home
  const h2h=h2hAgainstFav(fixture?.h2h,side,fixture?.home?.name,fixture?.away?.name)
  const statsWorse=fav.ppg!==null&&opp.ppg!==null&&fav.ppg<opp.ppg
  if(h2h.ready)return h2h.majority&&statsWorse
  if(fav.ppg===null||opp.ppg===null)return false
  return fav.ppg+RULES.noH2hPpgGap<opp.ppg
}

function venueRows(fixtures,teamId,venue){
  return (fixtures||[]).filter(f=>done(f)&&atVenue(f,teamId,venue))
    .sort((a,b)=>Date.parse(b?.fixture?.date||0)-Date.parse(a?.fixture?.date||0))
    .slice(0,FORM_SAMPLE)
}

function full(f,id){
  const h=num(f?.goals?.home),a=num(f?.goals?.away)
  if(h===null||a===null)return null
  return String(f?.teams?.home?.id)===String(id)?{own:h,opp:a,total:h+a}:{own:a,opp:h,total:h+a}
}

function venueRate(fixtures,teamId,venue,test){
  let t=0,h=0
  for(const row of venueRows(fixtures,teamId,venue)){
    const g=full(row,teamId)
    if(!g)continue
    t++
    if(test(g))h++
  }
  return t?Math.round(h*100/t):null
}

function directionTest(route,side){
  if(route==='straight-win'){
    if(side==='home')return{
      home:g=>g.own>g.opp,
      away:g=>g.own<g.opp
    }
    return{
      home:g=>g.own<g.opp,
      away:g=>g.own>g.opp
    }
  }
  if(route==='over-15')return{home:g=>g.total>1.5,away:g=>g.total>1.5}
  if(route==='under-35')return{home:g=>g.total<3.5,away:g=>g.total<3.5}
  if(route==='over-25')return{home:g=>g.total>2.5,away:g=>g.total>2.5}
  if(route==='under-25')return{home:g=>g.total<2.5,away:g=>g.total<2.5}
  if(route==='gg')return{home:g=>g.own>0&&g.opp>0,away:g=>g.own>0&&g.opp>0}
  return null
}

function directionAgree(fixture,route,side){
  const tests=directionTest(route,side)
  if(!tests)return{ok:false,home:null,away:null}
  const home=venueRate(fixture?.home?.fixtures,fixture?.home?.id,'home',tests.home)
  const away=venueRate(fixture?.away?.fixtures,fixture?.away?.id,'away',tests.away)
  return{ok:home!=null&&away!=null&&home>=RULES.directionMin&&away>=RULES.directionMin,home,away}
}

function gates(odds){
  const out=[]
  const fav=pricedFavourite(odds)
  if(fav&&fav.odd>=RULES.winMin&&fav.odd<=RULES.winMax){
    out.push({route:'straight-win',market:'match-winner',selection:fav.selection,displaySelection:fav.displaySelection,odds:fav.odd,favourite:fav.side,family:'1X2'})
  }
  if(finite(odds.over15)&&odds.over15<RULES.over15Max&&finite(odds.under35)&&odds.under35>RULES.over15Under35Min){
    out.push({route:'over-15',market:'total-goals',selection:'Over 1.5',displaySelection:'Over 1.5',odds:odds.over15,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.under35)&&odds.under35<RULES.under35Max&&finite(odds.over15)&&odds.over15>RULES.under35Over15Min){
    out.push({route:'under-35',market:'total-goals',selection:'Under 3.5',displaySelection:'Under 3.5',odds:odds.under35,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.over25)&&odds.over25<RULES.over25Max&&finite(odds.under35)&&odds.under35>RULES.over25Under35Min){
    out.push({route:'over-25',market:'total-goals',selection:'Over 2.5',displaySelection:'Over 2.5',odds:odds.over25,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.under25)&&odds.under25<RULES.under25Max&&finite(odds.over15)&&odds.over15>RULES.under25Over15Min){
    out.push({route:'under-25',market:'total-goals',selection:'Under 2.5',displaySelection:'Under 2.5',odds:odds.under25,favourite:fav?.side||null,family:'Goals'})
  }
  if(finite(odds.ggYes)&&odds.ggYes<RULES.ggYesMax&&finite(odds.gg2No)&&odds.gg2No>RULES.gg2NoMin){
    out.push({route:'gg',market:'both-teams-score',selection:'Yes',displaySelection:'BTTS · Yes',odds:odds.ggYes,favourite:fav?.side||null,family:'BTTS'})
  }
  return out
}

function publicReasons(pick,home,away,direction,odds){
  const homeName=pick?.home||'Home',awayName=pick?.away||'Away'
  const label=pick?.displaySelection||pick?.selection||'this pick'
  const lines=[]
  if(pick.route==='straight-win'&&pick.favourite==='home')lines.push(`${homeName} is the priced favourite at ${Number(pick.odds).toFixed(2)}.`)
  else if(pick.route==='straight-win'&&pick.favourite==='away')lines.push(`${awayName} is the priced favourite at ${Number(pick.odds).toFixed(2)}.`)
  else lines.push(`${label} cleared the SportyBet odds filter at ${Number(pick.odds).toFixed(2)}.`)
  if(pick.route==='over-15'&&finite(odds.under35))lines.push(`Over 1.5 ${odds.over15.toFixed(2)} is backed by Under 3.5 at ${odds.under35.toFixed(2)}.`)
  if(pick.route==='under-35'&&finite(odds.over15))lines.push(`Under 3.5 ${odds.under35.toFixed(2)} is backed by Over 1.5 at ${odds.over15.toFixed(2)}.`)
  if(pick.route==='over-25'&&finite(odds.under35))lines.push(`Over 2.5 ${odds.over25.toFixed(2)} is backed by Under 3.5 at ${odds.under35.toFixed(2)}.`)
  if(pick.route==='under-25'&&finite(odds.over15))lines.push(`Under 2.5 ${odds.under25.toFixed(2)} is backed by Over 1.5 at ${odds.over15.toFixed(2)}.`)
  if(pick.route==='gg'&&finite(odds.gg2No))lines.push(`GG Yes ${odds.ggYes.toFixed(2)} is backed by GG 2+ No at ${odds.gg2No.toFixed(2)}.`)
  if(direction?.home!=null&&direction?.away!=null)lines.push(`Both sides last-5 venue form supports ${label} (${direction.home}% home, ${direction.away}% away).`)
  if(home?.ppg!=null)lines.push(`${homeName} average ${home.ppg} PPG at home (${home.gf} scored, ${home.ga} conceded).`)
  if(away?.ppg!=null)lines.push(`${awayName} average ${away.ppg} PPG away (${away.gf} scored, ${away.ga} conceded).`)
  return lines
}

function packPick(fixture,odds,home,away,routed,direction){
  const lastMatchesHome=last5Overall(fixture?.home?.lastMatches||fixture?.home?.fixtures,fixture?.home?.id)
  const lastMatchesAway=last5Overall(fixture?.away?.lastMatches||fixture?.away?.fixtures,fixture?.away?.id)
  const last5Home=last5Form(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const last5Away=last5Form(fixture?.away?.fixtures,fixture?.away?.id,'away')
  const pick={
    fixtureId:fixture.fixtureId,
    league:fixture.league,
    country:fixture.country,
    kickoff:fixture.kickoff,
    home:fixture.home?.name,
    away:fixture.away?.name,
    homeId:fixture.home?.id??null,
    awayId:fixture.away?.id??null,
    homeLogo:fixture.home?.logo||null,
    awayLogo:fixture.away?.logo||null,
    market:routed.market,
    marketName:routed.displaySelection,
    selection:routed.selection,
    displaySelection:routed.displaySelection,
    pick:routed.displaySelection,
    odds:+Number(routed.odds).toFixed(2),
    engine:ENGINE_ID,
    engineVersion:ENGINE_VERSION,
    route:routed.route,
    favourite:routed.favourite||null,
    homeConsensus:direction.home,
    awayConsensus:direction.away,
    consensus:direction.home!=null&&direction.away!=null?Math.min(direction.home,direction.away):null,
    oddsBook:odds,
    homeSplit:fixture.homeSplit||null,
    awaySplit:fixture.awaySplit||null,
    metrics:{home,away},
    earlySeason:fixture.earlySeason===true,
    sportyEventId:fixture.sportyEventId||null
  }
  const reasons=publicReasons(pick,home,away,direction,odds)
  return attachWhy(pick,fixture,{reasons,last5Home,last5Away,lastMatchesHome,lastMatchesAway,homeAvg:home,awayAvg:away,h2h:fixture.h2h||[]})
}

export function diagnoseFilterFixture(fixture){
  if(!fixtureHasStats(fixture))return{pick:null,skip:'no-stats'}
  if(fixture?.earlySeason===true)return{pick:null,skip:'early-season'}
  if(isCupCompetition(fixture?.league))return{pick:null,skip:'cup'}
  const table=tableGate(fixture?.homeSplit,fixture?.awaySplit)
  if(!table.ok)return{pick:null,skip:table.skip}
  const home=venueMetrics(fixture?.home?.fixtures,fixture?.home?.id,'home')
  const away=venueMetrics(fixture?.away?.fixtures,fixture?.away?.id,'away')
  if(similarForm(home,away))return{pick:null,skip:'similar-form',home,away}
  const odds=extractFilterOdds(fixture)
  const routed=gates(odds)
  if(!routed.length)return{pick:null,skip:'no-route',odds,home,away}
  let favFail=0,directionFail=0
  for(const row of routed){
    if(row.route==='straight-win'&&favConflict(fixture,home,away,row.favourite)){favFail++;continue}
    const direction=directionAgree(fixture,row.route,row.favourite)
    if(!direction.ok){directionFail++;continue}
    return{pick:packPick(fixture,odds,home,away,row,direction),skip:null,odds,home,away,direction,favourite:row.favourite}
  }
  if(favFail&&!directionFail)return{pick:null,skip:'fav-conflict',odds,home,away}
  return{pick:null,skip:'direction-disagree',odds,home,away}
}

export function evaluateFilterFixture(fixture){
  return diagnoseFilterFixture(fixture).pick
}

export function buildFilterBoard(fixtures,meta={}){
  const diagnosed=(fixtures||[]).map(fixture=>({fixture,result:diagnoseFilterFixture(fixture)}))
  const qualified=diagnosed.map(row=>row.result.pick).filter(Boolean)
    .sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(a.odds)-Number(b.odds))
  const skipped=diagnosed.filter(row=>!row.result.pick).reduce((map,row)=>{
    const key=row.result.skip||'unknown'
    map[key]=(map[key]||0)+1
    return map
  },{})
  return{
    meta:{
      ...meta,
      engineVersion:ENGINE_VERSION,
      engine:ENGINE_ID,
      formSample:FORM_SAMPLE,
      qualified:qualified.length,
      bestPicks:qualified.length,
      skipped
    },
    priority:qualified,
    bestPicks:qualified,
    availableMarkets:[...new Set(qualified.map(row=>row.market))].sort()
  }
}
