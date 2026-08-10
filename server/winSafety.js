import { comparePicks, oneBestPerFixture } from './engine.js'

const odd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const metric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const allRows=board=>[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]
function fixtureSides(fixture,row){const selected=String(row?.selectedTeamId)===String(fixture?.home?.id)?fixture.home:String(row?.selectedTeamId)===String(fixture?.away?.id)?fixture.away:null;if(!selected)return null;const isHome=String(selected.id)===String(fixture.home?.id);return{selected,opponent:isHome?fixture.away:fixture.home,isHome}}
function isTopThree(team){const p=Number(team?.position);return team?.positionSampleReady===true&&Number.isFinite(p)&&p<=3}
function isBottomThree(team){const p=Number(team?.position),n=Number(team?.leagueSize);return team?.positionSampleReady===true&&Number.isFinite(p)&&Number.isFinite(n)&&n>=3&&p>n-3}
function market(fixture,key){return(fixture?.marketOdds||[]).find(m=>m?.marketKey===key)||null}
function outcomePrice(marketRow,names){if(!marketRow)return null;const wanted=names.map(norm);for(const o of marketRow.outcomes||[]){if(wanted.includes(norm(o?.name))){const p=odd(o?.odd);if(p)return p}}return null}
function fallbackMarket(fixture,isHome,teamName){const dnb=market(fixture,'draw-no-bet'),dnbPrice=outcomePrice(dnb,isHome?['Home',teamName]:['Away',teamName]);if(dnbPrice)return{market:'DNB',selectionLabel:`${teamName} DNB`,odds:dnbPrice,downgradeMarket:'Draw no bet'};const dc=market(fixture,'double-chance'),names=isHome?['Home or draw','1X']:['Draw or away','X2'],dcPrice=outcomePrice(dc,names);if(dcPrice)return{market:'DC',selectionLabel:`${teamName} ${isHome?'1X':'X2'}`,odds:dcPrice,downgradeMarket:isHome?'1X':'X2'};return null}

export const WIN_SAFETY_POLICY='strict-split-top3-only-result-v7'

export function applyWinSafety(board,fixtures){
  const byId=new Map((fixtures||[]).map(f=>[String(f.fixtureId),f])),kept=[]
  let straightWinsBlocked=0,downgraded=0,exceptionWins=0,bottom3TeamResultBlocked=0,nonTop3TeamResultBlocked=0,missingSplitBlocked=0,seasonSplitFallbacks=0,highContradictionBlocked=0,moderateContradictionBlocked=0,moderateContradictionDowngraded=0,lastPlaceSampleBlocked=0
  for(const row of allRows(board)){
    if(row?.market!=='1X2'){kept.push(row);continue}
    const fixture=byId.get(String(row.fixtureId)),sides=fixtureSides(fixture,row);if(!fixture||!sides){straightWinsBlocked++;continue}
    const {selected,opponent,isHome}=sides
    if(!['home','away'].includes(selected?.venue)||!['home','away'].includes(opponent?.venue)){missingSplitBlocked++;straightWinsBlocked++;continue}
    if(selected?.positionSampleReady!==true||opponent?.positionSampleReady!==true){missingSplitBlocked++;straightWinsBlocked++;continue}

    // Absolute result-market eligibility: selected team must be Top 3 in its relevant split.
    // This gate is before contradiction/form/odds exceptions so DNB/DC can never rescue positions 4+.
    if(!isTopThree(selected)){nonTop3TeamResultBlocked++;if(isBottomThree(selected))bottom3TeamResultBlocked++;straightWinsBlocked++;continue}

    const contradiction=String(row?.contradiction||'LOW').toUpperCase()
    if(contradiction==='HIGH'){highContradictionBlocked++;straightWinsBlocked++;continue}
    if(contradiction==='MODERATE'){
      if(Number(row.odds)>2){const fallback=fallbackMarket(fixture,isHome,selected.name);if(fallback){downgraded++;moderateContradictionDowngraded++;kept.push({...row,...fallback,contradiction:'MODERATE',engineRating:Math.min(Number(row.engineRating||60),68),winSafety:'downgraded-moderate-contradiction',originalMarket:'1X2',originalOdds:row.odds,shortReason:`Safer market used because ${selected.name}'s ${selected.venue} profile contains meaningful contradictions.`});continue}}
      moderateContradictionBlocked++;straightWinsBlocked++;continue
    }
    const venue=selected.venue,recentWinRate=metric(selected?.winRate),seasonWinRate=metric(selected?.seasonWinRate),seasonSplitPlayed=metric(selected?.played)
    let winRate=recentWinRate,winRateSource='last-5'
    if(winRate===null&&seasonSplitPlayed!==null&&seasonSplitPlayed>=5&&seasonWinRate!==null){winRate=seasonWinRate;winRateSource='season-split';seasonSplitFallbacks++}
    if(winRate!==null&&winRate>=60){kept.push({...row,winSafety:winRateSource==='last-5'?'split-win-rate-60-plus':'split-season-win-rate-60-plus',winRateSource});continue}
    const opponentPlayed=metric(opponent?.played),rawOpponentLast=Number.isFinite(Number(opponent?.position))&&Number.isFinite(Number(opponent?.leagueSize))&&Number(opponent.position)===Number(opponent.leagueSize),opponentIsLast=rawOpponentLast&&opponentPlayed!==null&&opponentPlayed>=5
    if(rawOpponentLast&&!opponentIsLast)lastPlaceSampleBlocked++
    const opponentConcedesHeavy=metric(opponent?.goalsConceded)!==null&&Number(opponent.goalsConceded)>2.3
    if(opponentIsLast||opponentConcedesHeavy){exceptionWins++;kept.push({...row,winSafety:opponentIsLast?'split-opponent-last-place-5plus-exception':'split-opponent-concedes-2.30-plus-exception',winRateSource:winRateSource||null});continue}
    if(Number(row.odds)>2){const fallback=fallbackMarket(fixture,isHome,selected.name);if(fallback){downgraded++;kept.push({...row,...fallback,engineRating:Math.min(Number(row.engineRating||60),72),winSafety:'downgraded-under60-split',originalMarket:'1X2',originalOdds:row.odds,shortReason:`Safer market used because ${selected.name} do not have a verified 60%+ ${venue} win rate.`,winRateSource:winRateSource||null});continue}}
    straightWinsBlocked++
  }
  kept.sort(comparePicks)
  const groups={single:kept.filter(r=>Number(r.filterCount)===1),two:kept.filter(r=>Number(r.filterCount)===2),threePlus:kept.filter(r=>Number(r.filterCount)>=3)}
  return{...board,meta:{...board?.meta,qualified:kept.length,winSafetyPolicy:WIN_SAFETY_POLICY,straightWinsBlocked,downgradedWins:downgraded,exceptionWins,bottom3TeamResultBlocked,nonTop3TeamResultBlocked,missingSplitBlocked,seasonSplitWinFallbacks:seasonSplitFallbacks,highContradictionBlocked,moderateContradictionBlocked,moderateContradictionDowngraded,lastPlaceSampleBlocked},groups,priority:kept,bestPicks:oneBestPerFixture(kept)}
}
