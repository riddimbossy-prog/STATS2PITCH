const odd=v=>{const n=Number(v);return Number.isFinite(n)&&n>1.001&&n<1000?n:null}
const metric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

function allRows(board){return[...(board?.groups?.threePlus||[]),...(board?.groups?.two||[]),...(board?.groups?.single||[])]}
function rank(x){return x==='LOW'?0:x==='MODERATE'?1:2}
function sortPicks(a,b){return Number(b.filterCount||0)-Number(a.filterCount||0)||Number(b.familyCount||0)-Number(a.familyCount||0)||rank(a.contradiction)-rank(b.contradiction)||Number(b.score||0)-Number(a.score||0)||(Number(a.odds)||99)-(Number(b.odds)||99)}

function fixtureSides(fixture,row){
  const selected=String(row?.selectedTeamId)===String(fixture?.home?.id)?fixture.home:String(row?.selectedTeamId)===String(fixture?.away?.id)?fixture.away:null
  if(!selected)return null
  const isHome=String(selected.id)===String(fixture.home?.id)
  return{selected,opponent:isHome?fixture.away:fixture.home,isHome}
}

function isBottomThree(team){
  const position=Number(team?.position)
  const leagueSize=Number(team?.leagueSize)
  return Number.isFinite(position)&&Number.isFinite(leagueSize)&&leagueSize>=3&&position>leagueSize-3
}

function market(fixture,key){return(fixture?.marketOdds||[]).find(m=>m?.marketKey===key)||null}
function outcomePrice(marketRow,names){
  if(!marketRow)return null
  const wanted=names.map(norm)
  for(const o of marketRow.outcomes||[]){if(wanted.includes(norm(o?.name))){const p=odd(o?.odd);if(p)return p}}
  return null
}

function fallbackMarket(fixture,isHome,teamName){
  const dnb=market(fixture,'draw-no-bet')
  const dnbPrice=outcomePrice(dnb,isHome?['Home',teamName]:['Away',teamName])
  if(dnbPrice)return{market:'DNB',selectionLabel:`${teamName} DNB`,odds:dnbPrice,downgradeMarket:'Draw no bet'}

  const dc=market(fixture,'double-chance')
  const names=isHome?['Home or draw','1X']:['Draw or away','X2']
  const dcPrice=outcomePrice(dc,names)
  if(dcPrice)return{market:'DC',selectionLabel:`${teamName} ${isHome?'1X':'X2'}`,odds:dcPrice,downgradeMarket:isHome?'1X':'X2'}
  return null
}

export const WIN_SAFETY_POLICY='strict-split-bottom3-veto-under60-v4'

export function applyWinSafety(board,fixtures){
  const byId=new Map((fixtures||[]).map(f=>[String(f.fixtureId),f]))
  const kept=[]
  let straightWinsBlocked=0,downgraded=0,exceptionWins=0,bottom3TeamResultBlocked=0,missingSplitBlocked=0,seasonSplitFallbacks=0

  for(const row of allRows(board)){
    if(row?.market!=='1X2'){kept.push(row);continue}
    const fixture=byId.get(String(row.fixtureId))
    const sides=fixtureSides(fixture,row)
    if(!fixture||!sides){straightWinsBlocked++;continue}
    const {selected,opponent,isHome}=sides

    if(!['home','away'].includes(selected?.venue)||!['home','away'].includes(opponent?.venue)){
      missingSplitBlocked++
      straightWinsBlocked++
      continue
    }

    // Absolute split-table veto. No odds/form/weak-opponent exception and no
    // DNB or double-chance downgrade is allowed for a bottom-three venue team.
    if(isBottomThree(selected)){
      bottom3TeamResultBlocked++
      straightWinsBlocked++
      continue
    }

    const venue=selected.venue
    const recentWinRate=metric(selected?.winRate)
    const seasonWinRate=metric(selected?.seasonWinRate)
    const seasonSplitPlayed=metric(selected?.played)
    let winRate=recentWinRate
    let winRateSource='last-5'

    // If the provider cannot return the chronological venue history but the
    // standings themselves contain a mature 5+ HOME/AWAY sample, use that exact
    // split season record. This remains strict venue data; overall form is never
    // substituted. It prevents a transient history endpoint failure from
    // deleting every team-result prediction on the board.
    if(winRate===null&&seasonSplitPlayed!==null&&seasonSplitPlayed>=5&&seasonWinRate!==null){
      winRate=seasonWinRate
      winRateSource='season-split'
      seasonSplitFallbacks++
    }

    if(winRate!==null&&winRate>=60){
      kept.push({...row,winSafety:winRateSource==='last-5'?'split-win-rate-60-plus':'split-season-win-rate-60-plus',winRateSource})
      continue
    }

    const opponentIsLast=Number.isFinite(Number(opponent?.position))&&Number.isFinite(Number(opponent?.leagueSize))&&Number(opponent.position)===Number(opponent.leagueSize)
    const opponentConcedesHeavy=metric(opponent?.goalsConceded)!==null&&Number(opponent.goalsConceded)>2.3
    if(opponentIsLast||opponentConcedesHeavy){
      exceptionWins++
      kept.push({...row,winSafety:opponentIsLast?'split-opponent-last-place-exception':'split-opponent-concedes-2.30-plus-exception',winRateSource:winRateSource||null})
      continue
    }

    if(Number(row.odds)>2){
      const fallback=fallbackMarket(fixture,isHome,selected.name)
      if(fallback){
        downgraded++
        kept.push({...row,...fallback,winSafety:'downgraded-under60-split',originalMarket:'1X2',originalOdds:row.odds,shortReason:`Safer market used because ${selected.name} do not have a verified 60%+ ${venue} win rate.`,winRateSource:winRateSource||null})
        continue
      }
    }
    straightWinsBlocked++
  }

  const groups={
    single:kept.filter(r=>Number(r.filterCount)===1).sort(sortPicks),
    two:kept.filter(r=>Number(r.filterCount)===2).sort(sortPicks),
    threePlus:kept.filter(r=>Number(r.filterCount)>=3).sort(sortPicks)
  }
  return{
    ...board,
    meta:{...board?.meta,qualified:kept.length,winSafetyPolicy:WIN_SAFETY_POLICY,straightWinsBlocked,downgradedWins:downgraded,exceptionWins,bottom3TeamResultBlocked,missingSplitBlocked,seasonSplitWinFallbacks:seasonSplitFallbacks},
    groups,
    priority:[...kept].sort(sortPicks)
  }
}
