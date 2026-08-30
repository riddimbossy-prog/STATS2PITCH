import {FINISHED} from './config.js'
import {isSrlMatch} from './redFlags.js'

export const BANKER_ENGINE='banker-totals-v1'
export const BANKER_RULES=Object.freeze({
  boardTeamOver25Max:2.05,
  oppOver05FavWinMin:1.70,
  oppTeamTotalOver25Max:1.50,
  under35Fav2PlusMin:1.60,
  bothTeamTotalMax:1.30,
  drawOrOver25MatchMax:1.50,
  drawOrOver25TypicalMax:1.35,
  streakYesMin:1.20,
  streakYesMax:1.40,
  over15Max:1.30,
  streakUnder35Min:1.40,
  minPublishOdds:1.20,
  topFive:5
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const px=v=>finite(v)?+Number(v).toFixed(2):null
const finished=f=>FINISHED.has(String(f?.fixture?.status?.short||'').toUpperCase())

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
      if(test(norm(market.marketKey),norm(market.market),norm(outcome.name),outcome,market))return price
    }
  }
  return null
}

function isThreePlusStreak(key,market,name){
  const blob=`${key} ${market} ${name}`
  if(/2\s*\+/.test(blob)&&!/3\s*\+/.test(blob))return false
  if(/streak 2/.test(blob)||/2 streak/.test(blob)||key==='goals-streak-2')return false
  return /3\s*\+\s*goals?\s*streak/.test(blob)
    ||/goals?\s*streak\s*3/.test(blob)
    ||/3\s*\+\s*streak/.test(blob)
    ||/streak\s*3/.test(blob)
    ||/3 streak/.test(blob)
    ||/3\+ goals in a row/.test(blob)
    ||/3 or more goals in a row/.test(blob)
    ||/three plus goals?/.test(blob)
    ||key==='goals-streak-3'
    ||key==='goals streak 3'
}

function isTwoPlusStreak(key,market,name){
  const blob=`${key} ${market} ${name}`
  return key==='goals-streak-2'
    ||/2 or more goals in a row/.test(blob)
    ||/goals? streak/.test(blob)
}

function teamGoalOdd(markets,side,line,teamName){
  const key=side==='home'?'home-team-goals':'away-team-goals'
  const direct=oddOf(markets,key,[`Over ${line}`,`O ${line}`])
  if(direct)return direct
  const wanted=norm(teamName)
  return scanOdd(markets,(marketKey,market,name)=>{
    if(!/over/.test(name)||!name.includes(String(line)))return false
    if(marketKey===key)return true
    if(marketKey!=='team-goals'&&!/team goals/.test(market)&&!/team total/.test(market))return false
    if(side==='home'&&(/home/.test(name)||(wanted&&name.includes(wanted))))return true
    if(side==='away'&&(/away/.test(name)||(wanted&&name.includes(wanted))))return true
    return false
  })
}

function streakYesOdd(markets){
  let streak=scanOdd(markets,(key,market,name)=>isThreePlusStreak(key,market,name)&&/yes/.test(name))
  if(!streak)streak=oddOf(markets,'goals-streak-3',['Yes'])
  if(finite(streak)&&streak>=BANKER_RULES.streakYesMin&&streak<=BANKER_RULES.streakYesMax)return streak
  let two=scanOdd(markets,(key,market,name)=>isTwoPlusStreak(key,market,name)&&/yes/.test(name))
  if(!two)two=oddOf(markets,'goals-streak-2',['Yes'])
  return two||streak||null
}

export function extractBankerOdds(fixture){
  const markets=fixture?.marketOdds||[]
  const homeName=fixture?.home?.name||''
  const awayName=fixture?.away?.name||''
  const homeWin=oddOf(markets,'match-winner',['Home','1'])
  const awayWin=oddOf(markets,'match-winner',['Away','2'])
  const draw=oddOf(markets,'match-winner',['Draw','X'])
  const over15=oddOf(markets,'total-goals',['Over 1.5','O 1.5'])
  const over25=oddOf(markets,'total-goals',['Over 2.5','O 2.5'])
  const under35=oddOf(markets,'total-goals',['Under 3.5','U 3.5'])
  const homeO05=teamGoalOdd(markets,'home',0.5,homeName)
  const awayO05=teamGoalOdd(markets,'away',0.5,awayName)
  const homeO15=teamGoalOdd(markets,'home',1.5,homeName)
  const awayO15=teamGoalOdd(markets,'away',1.5,awayName)
  const homeO25=teamGoalOdd(markets,'home',2.5,homeName)
  const awayO25=teamGoalOdd(markets,'away',2.5,awayName)
  const streak=streakYesOdd(markets)
  const drawOrOver25=scanOdd(markets,(key,market,name)=>{
    const blob=`${key} ${market} ${name}`
    return /draw/.test(blob)&&/over/.test(blob)&&/2\.5/.test(blob)
  })
  let favourite=null
  if(homeWin&&awayWin){
    if(homeWin<awayWin)favourite='home'
    else if(awayWin<homeWin)favourite='away'
  }else if(homeWin&&!awayWin)favourite='home'
  else if(awayWin&&!homeWin)favourite='away'
  const favWin=favourite==='home'?homeWin:favourite==='away'?awayWin:null
  const oppWin=favourite==='home'?awayWin:favourite==='away'?homeWin:null
  const oppO05=favourite==='home'?awayO05:favourite==='away'?homeO05:null
  const favO15=favourite==='home'?homeO15:favourite==='away'?awayO15:null
  const favO25=favourite==='home'?homeO25:favourite==='away'?awayO25:null
  const teamOver25Prices=[homeO25,awayO25].filter(finite).map(Number)
  const boardTeamOver25=teamOver25Prices.length?Math.min(...teamOver25Prices):null
  return{
    favourite,homeWin,awayWin,draw,favWin,oppWin,
    over15,over25,under35,streakYes:streak,drawOrOver25,
    homeO05,awayO05,homeO15,awayO15,homeO25,awayO25,oppO05,favO15,favO25,boardTeamOver25
  }
}

export function buildLeagueScoringProfile(history=[]){
  const rows=(history||[]).filter(f=>finished(f)&&finite(f?.goals?.home)&&finite(f?.goals?.away))
  let goals=0,draws=0,over25=0
  for(const f of rows){
    const h=Number(f.goals.home),a=Number(f.goals.away),t=h+a
    goals+=t;if(h===a)draws++;if(t>2.5)over25++
  }
  const matches=rows.length
  const avgGoals=matches?Math.round(goals*100/matches)/100:null
  const drawRate=matches?Math.round(draws*1000/matches)/10:null
  const over25Rate=matches?Math.round(over25*1000/matches)/10:null
  let className='insufficient'
  if(matches>=20){
    if(Number(over25Rate)>=56||Number(avgGoals)>=2.8)className='high-scoring'
    else if(Number(over25Rate)<50&&Number(avgGoals)<=2.6&&Number(drawRate)>=30)className='neutral'
    else className='neutral'
  }
  return{class:className,matches,avgGoals,drawRate,over25Rate}
}

function bothTopFive(f){
  const hp=num(f?.homeSplit?.position),ap=num(f?.awaySplit?.position)
  return finite(hp)&&finite(ap)&&hp<=BANKER_RULES.topFive&&ap<=BANKER_RULES.topFive
}

function publishedFavWin(f,odds){
  const price=px(odds.favWin)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'match-winner',selection:'Home',displaySelection:`${f.home.name} to Win`,odds:price,family:'1X2'}
    :{market:'match-winner',selection:'Away',displaySelection:`${f.away.name} to Win`,odds:price,family:'1X2'}
}

function publishedFav2Plus(f,odds){
  const price=px(odds.favO15)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'home-team-goals',selection:'Over 1.5',displaySelection:`${f.home.name} 2+`,odds:price,family:'Team Goals'}
    :{market:'away-team-goals',selection:'Over 1.5',displaySelection:`${f.away.name} 2+`,odds:price,family:'Team Goals'}
}

function publishedFav3Plus(f,odds){
  const price=px(odds.favO25)
  if(!price||!odds.favourite)return null
  return odds.favourite==='home'
    ?{market:'home-team-goals',selection:'Over 2.5',displaySelection:`${f.home.name} 3+`,odds:price,family:'Team Goals'}
    :{market:'away-team-goals',selection:'Over 2.5',displaySelection:`${f.away.name} 3+`,odds:price,family:'Team Goals'}
}

function publishedOver(line,price){
  const odd=px(price)
  if(!odd)return null
  return{market:'total-goals',selection:`Over ${line}`,displaySelection:`Over ${line}`,odds:odd,family:'Goals'}
}

function publishedDraw(odds){
  const price=px(odds.draw)
  if(!price)return null
  return{market:'match-winner',selection:'Draw',displaySelection:'1X2 \u00b7 Draw',odds:price,family:'1X2'}
}

function publishedDrawOrOver25(odds){
  const combo=px(odds.drawOrOver25)
  if(combo)return{market:'draw-or-over-25',selection:'Draw or Over 2.5',displaySelection:'Draw or Over 2.5',odds:combo,family:'Combo'}
  const over=px(odds.over25),draw=px(odds.draw)
  const overOk=finite(over)&&over<=BANKER_RULES.drawOrOver25TypicalMax
  const drawOk=finite(draw)&&draw<=BANKER_RULES.drawOrOver25TypicalMax
  if(overOk&&!drawOk)return publishedOver(2.5,over)
  if(drawOk&&!overOk)return publishedDraw(odds)
  if(overOk&&drawOk)return over<=draw?publishedOver(2.5,over):publishedDraw(odds)
  if(finite(over)&&over<BANKER_RULES.drawOrOver25MatchMax)return publishedOver(2.5,over)
  return null
}

function nextAvailableSteps(f,odds,published){
  const sel=String(published?.selection||'')
  const fam=String(published?.family||'')
  if(fam==='1X2'&&(sel==='Home'||sel==='Away'))return [publishedFav2Plus(f,odds),publishedOver(1.5,odds.over15),publishedFav3Plus(f,odds),publishedOver(2.5,odds.over25)]
  if(fam==='Team Goals'&&sel==='Over 1.5')return [publishedFav3Plus(f,odds),publishedOver(1.5,odds.over15),publishedOver(2.5,odds.over25)]
  if(fam==='Goals'&&sel==='Over 1.5')return [publishedOver(2.5,odds.over25)]
  if(sel==='Over 2.5'||fam==='Combo')return [publishedDraw(odds),publishedFav2Plus(f,odds)]
  return [publishedFav2Plus(f,odds),publishedOver(1.5,odds.over15),publishedOver(2.5,odds.over25)]
}

function liftToFloor(f,odds,published){
  if(!published)return{published:null,lifted:false,from:null}
  if(Number(published.odds)>=BANKER_RULES.minPublishOdds)return{published,lifted:false,from:null}
  const from={...published}
  for(const next of nextAvailableSteps(f,odds,published)){
    if(next&&Number(next.odds)>=BANKER_RULES.minPublishOdds)return{published:next,lifted:true,from}
  }
  return{published:null,lifted:true,from}
}

function pack(f,odds,rule,published,reasons){
  return{
    fixtureId:f.fixtureId,league:f.league,country:f.country,kickoff:f.kickoff,
    home:f.home?.name,away:f.away?.name,homeId:f.home?.id??null,awayId:f.away?.id??null,
    homeLogo:f.home?.logo||null,awayLogo:f.away?.logo||null,
    homeSplit:f.homeSplit||null,awaySplit:f.awaySplit||null,
    market:published.market,selection:published.selection,displaySelection:published.displaySelection,
    pick:published.displaySelection,odds:published.odds,family:published.family,
    rule,engine:BANKER_ENGINE,favourite:odds.favourite||null,
    reasons,why:reasons,whyText:reasons.join(' '),
    oddsBook:{
      favWin:px(odds.favWin),oppWin:px(odds.oppWin),draw:px(odds.draw),
      over15:px(odds.over15),over25:px(odds.over25),under35:px(odds.under35),
      oppO05:px(odds.oppO05),homeO05:px(odds.homeO05),awayO05:px(odds.awayO05),
      favO15:px(odds.favO15),homeO25:px(odds.homeO25),awayO25:px(odds.awayO25),
      favO25:px(odds.favO25),boardTeamOver25:px(odds.boardTeamOver25),streakYes:px(odds.streakYes)
    },
    sportyEventId:f.sportyEventId||null
  }
}

function boardReason(odds){
  return `Board filter: team total Over 2.5 is ${px(odds.boardTeamOver25)} (home ${px(odds.homeO25)} / away ${px(odds.awayO25)}), max ${BANKER_RULES.boardTeamOver25Max.toFixed(2)}.`
}

function emit(f,odds,rule,published,reasons){
  const chosen=liftToFloor(f,odds,published)
  if(!chosen.published)return{pick:null,skip:'odds-below-floor',odds}
  if(chosen.lifted)reasons.push(`Qualified price ${chosen.from.displaySelection} @ ${chosen.from.odds} was under ${BANKER_RULES.minPublishOdds.toFixed(2)}. Next available: ${chosen.published.displaySelection} @ ${chosen.published.odds}.`)
  return{pick:pack(f,odds,rule,chosen.published,reasons),skip:null,odds}
}

export function evaluateBankerFixture(f){
  if(isSrlMatch(f))return{pick:null,skip:'srl'}
  const odds=extractBankerOdds(f)
  const over25=num(odds.over25)
  const oppO05=num(odds.oppO05)
  const homeO05=num(odds.homeO05)
  const awayO05=num(odds.awayO05)
  const under35=num(odds.under35)
  const over15=num(odds.over15)
  const streak=num(odds.streakYes)
  const boardTeamOver25=num(odds.boardTeamOver25)
  const onBoard=finite(boardTeamOver25)&&boardTeamOver25<=BANKER_RULES.boardTeamOver25Max

  if(onBoard&&finite(homeO05)&&finite(awayO05)&&homeO05<BANKER_RULES.bothTeamTotalMax&&awayO05<BANKER_RULES.bothTeamTotalMax&&finite(over25)&&over25<BANKER_RULES.drawOrOver25MatchMax){
    const published=publishedDrawOrOver25(odds)
    if(published){
      return emit(f,odds,'DRAW_OR_OVER25',published,[
        boardReason(odds),
        `Both team totals Over 0.5 are under ${BANKER_RULES.bothTeamTotalMax.toFixed(2)} (${px(homeO05)} / ${px(awayO05)}).`,
        `Match Over 2.5 is ${px(over25)} (under ${BANKER_RULES.drawOrOver25MatchMax.toFixed(2)}).`,
        `Qualified ${published.displaySelection} @ ${published.odds}.`
      ])
    }
  }

  if(onBoard&&finite(oppO05)&&oppO05>BANKER_RULES.oppOver05FavWinMin){
    const published=publishedFavWin(f,odds)
    if(published){
      return emit(f,odds,'OPP_O05_FAV_WIN',published,[
        boardReason(odds),
        `Opponent team total Over 0.5 is ${px(oppO05)} > ${BANKER_RULES.oppOver05FavWinMin.toFixed(2)}.`,
        `Favourite to win: ${published.displaySelection} @ ${published.odds}.`
      ])
    }
    return{pick:null,skip:'missing-fav-win-odds',odds}
  }

  if(onBoard&&finite(oppO05)&&oppO05<BANKER_RULES.oppTeamTotalOver25Max){
    const published=publishedOver(2.5,over25)
    if(published){
      return emit(f,odds,'OPP_TT_OVER25',published,[
        boardReason(odds),
        `Opponent team total Over 0.5 is ${px(oppO05)} < ${BANKER_RULES.oppTeamTotalOver25Max.toFixed(2)}.`,
        `Total goals Over 2.5 @ ${published.odds}.`
      ])
    }
  }

  if(onBoard&&finite(under35)&&under35>BANKER_RULES.under35Fav2PlusMin){
    const published=publishedFav2Plus(f,odds)
    if(published){
      return emit(f,odds,'U35_FAV_2PLUS',published,[
        boardReason(odds),
        `Under 3.5 is ${px(under35)} > ${BANKER_RULES.under35Fav2PlusMin.toFixed(2)}.`,
        `Favourite to score 2+: ${published.displaySelection} @ ${published.odds}.`
      ])
    }
    return{pick:null,skip:'missing-fav-2plus-odds',odds}
  }

  const streakWindow=finite(streak)&&streak>=BANKER_RULES.streakYesMin&&streak<=BANKER_RULES.streakYesMax
  const over15Cheap=finite(over15)&&over15<BANKER_RULES.over15Max
  const under35Open=finite(under35)&&under35>BANKER_RULES.streakUnder35Min
  if(streakWindow&&over15Cheap&&under35Open){
    if(bothTopFive(f))return{pick:null,skip:'both-top-five',odds}
    const published=publishedOver(1.5,over15)
    if(published){
      return emit(f,odds,'STREAK_OVER15',published,[
        `Over 1.5 board: 3+ goals streak Yes is ${px(streak)} (${BANKER_RULES.streakYesMin.toFixed(2)}-${BANKER_RULES.streakYesMax.toFixed(2)}).`,
        `Over 1.5 is ${px(over15)} < ${BANKER_RULES.over15Max.toFixed(2)}.`,
        `Under 3.5 is ${px(under35)} > ${BANKER_RULES.streakUnder35Min.toFixed(2)}.`,
        'Top-5 vs Top-5 is blocked for this route.'
      ])
    }
  }

  if(!onBoard&&finite(streak)&&!streakWindow)return{pick:null,skip:'streak-3plus-outside-window',odds}
  if(!onBoard&&!finite(streak)&&finite(over15))return{pick:null,skip:'missing-3plus-streak',odds}
  if(!finite(boardTeamOver25))return{pick:null,skip:'missing-team-over25',odds}
  if(!onBoard)return{pick:null,skip:'team-over25-above-board-max',odds}
  return{pick:null,skip:'no-rule-qualified',odds}
}

export function buildBankerRules(fixtures=[]){
  const picks=[],skipCounts={}
  for(const f of fixtures||[]){
    const result=evaluateBankerFixture(f)
    if(result.pick)picks.push(result.pick)
    else skipCounts[result.skip]=(skipCounts[result.skip]||0)+1
  }
  picks.sort((a,b)=>Date.parse(a.kickoff||0)-Date.parse(b.kickoff||0)||Number(a.odds)-Number(b.odds))
  return{picks,meta:{engine:BANKER_ENGINE,count:picks.length,skips:skipCounts,rules:BANKER_RULES}}
}
