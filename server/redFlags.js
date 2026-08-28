export const RED_FLAGS=Object.freeze({
  topN:5,
  bottomN:3,
  minRounds:5,
  similarPpg:0.35,
  similarGf:0.40,
  similarGa:0.40,
  noH2hPpgGap:0.30,
  splitVsOverallPpg:0.70,
  rankFlipPpg:0.35
})

export const FLAG_LABELS=Object.freeze({
  'early-season':'Early season (<5 rounds)',
  'both-top-five':'Top 5 vs Top 5',
  'both-bottom-three':'Bottom 3 vs Bottom 3',
  'stats-mismatch':'Split stats do not match',
  'similar-form':'Split stats do not match',
  'fav-conflict':'Split stats do not match',
  srl:'Simulated match',
  cup:'Cup competition'
})

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=v=>finite(v)?Number(v):null
const text=v=>String(v??'').trim()
const norm=s=>text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim()
const CUP=/\b(cup|copa|coppa|pokal|fa cup|league cup|champions|europa|conference|knockout|play[- ]?offs?|qualification|qualifier|trophy|super cup|community shield|elimination)\b/i
const SRL=/\b(srl|simulated reality)\b/i

function flag(code,detail=null){
  return{code,label:FLAG_LABELS[code]||code,detail}
}

export function isCupCompetition(name){
  return CUP.test(norm(name))
}

export function isSrlMatch(fixture){
  const blob=[fixture?.league,fixture?.country,fixture?.home?.name||fixture?.home,fixture?.away?.name||fixture?.away,fixture?.match].map(text).join(' ')
  return SRL.test(norm(blob))||SRL.test(blob)
}

export function isEarlySeason(fixture){
  if(fixture?.earlySeason===true||fixture?.earlySeasonHome===true||fixture?.earlySeasonAway===true)return true
  const samples=fixture?.currentVenueSamples||{}
  const homeSample=num(samples.home)
  const awaySample=num(samples.away)
  if(homeSample!==null&&homeSample<RED_FLAGS.minRounds)return true
  if(awaySample!==null&&awaySample<RED_FLAGS.minRounds)return true
  const homePlayed=num(fixture?.homeSplit?.played)
  const awayPlayed=num(fixture?.awaySplit?.played)
  if(homePlayed!==null&&homePlayed<RED_FLAGS.minRounds)return true
  if(awayPlayed!==null&&awayPlayed<RED_FLAGS.minRounds)return true
  const round=num(fixture?.round??fixture?.leagueRound??fixture?.playedRound)
  if(round!==null&&round<RED_FLAGS.minRounds)return true
  return false
}

export function tableGate(homeSplit,awaySplit){
  const hp=num(homeSplit?.position),ap=num(awaySplit?.position)
  const hs=num(homeSplit?.size),as=num(awaySplit?.size)
  if(!hp||!ap||!hs||!as)return{ok:true,skip:null}
  if(hp<=RED_FLAGS.topN&&ap<=RED_FLAGS.topN)return{ok:false,skip:'both-top-five'}
  if(hp>hs-RED_FLAGS.bottomN&&ap>as-RED_FLAGS.bottomN)return{ok:false,skip:'both-bottom-three'}
  return{ok:true,skip:null}
}

function splitMetrics(split,fallback){
  return{
    ppg:num(split?.ppg)??num(fallback?.ppg),
    gf:num(split?.gf??split?.goalsScored??split?.gfpg)??num(fallback?.gf),
    ga:num(split?.ga??split?.goalsConceded??split?.gapg)??num(fallback?.ga)
  }
}

export function similarForm(home,away){
  if(home?.ppg==null||away?.ppg==null||home?.gf==null||away?.gf==null||home?.ga==null||away?.ga==null)return false
  return Math.abs(away.ppg-home.ppg)<RED_FLAGS.similarPpg
    &&Math.abs(away.gf-home.gf)<RED_FLAGS.similarGf
    &&Math.abs(away.ga-home.ga)<RED_FLAGS.similarGa
}

export function statsDoNotMatch(fixture,home=null,away=null){
  const homeSplit=splitMetrics(fixture?.homeSplit,home)
  const awaySplit=splitMetrics(fixture?.awaySplit,away)
  if(similarForm(homeSplit,awaySplit)||similarForm(home,away))return{mismatch:true,reason:'similar-form'}
  const homeOverall=num(fixture?.homeStats?.ppg)
  const awayOverall=num(fixture?.awayStats?.ppg)
  if(homeOverall!==null&&homeSplit.ppg!==null&&Math.abs(homeOverall-homeSplit.ppg)>=RED_FLAGS.splitVsOverallPpg){
    return{mismatch:true,reason:'home-overall-vs-home-split'}
  }
  if(awayOverall!==null&&awaySplit.ppg!==null&&Math.abs(awayOverall-awaySplit.ppg)>=RED_FLAGS.splitVsOverallPpg){
    return{mismatch:true,reason:'away-overall-vs-away-split'}
  }
  if(homeOverall!==null&&awayOverall!==null&&homeSplit.ppg!==null&&awaySplit.ppg!==null){
    const overallGap=homeOverall-awayOverall
    const splitGap=homeSplit.ppg-awaySplit.ppg
    if(Math.abs(overallGap)>=RED_FLAGS.rankFlipPpg&&Math.abs(splitGap)>=RED_FLAGS.rankFlipPpg&&overallGap*splitGap<0){
      return{mismatch:true,reason:'overall-vs-split-rank-flip'}
    }
  }
  return{mismatch:false,reason:null}
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

export function favConflict(fixture,home,away,side){
  if(!side)return false
  const fav=side==='home'?home:away
  const opp=side==='home'?away:home
  const h2h=h2hAgainstFav(fixture?.h2h,side,fixture?.home?.name,fixture?.away?.name)
  const statsWorse=fav?.ppg!=null&&opp?.ppg!=null&&fav.ppg<opp.ppg
  if(h2h.ready)return h2h.majority&&statsWorse
  if(fav?.ppg==null||opp?.ppg==null)return false
  return fav.ppg+RED_FLAGS.noH2hPpgGap<opp.ppg
}

export function assessHardGate(fixture,ctx={}){
  const flags=[]
  if(isSrlMatch(fixture))flags.push(flag('srl'))
  if(isEarlySeason(fixture))flags.push(flag('early-season'))
  if(isCupCompetition(fixture?.league))flags.push(flag('cup'))
  const table=tableGate(fixture?.homeSplit,fixture?.awaySplit)
  if(!table.ok)flags.push(flag(table.skip))
  const mismatch=statsDoNotMatch(fixture,ctx.home,ctx.away)
  if(mismatch.mismatch)flags.push(flag('stats-mismatch',mismatch.reason))
  if(ctx.favourite&&favConflict(fixture,ctx.home,ctx.away,ctx.favourite)){
    if(!flags.some(row=>row.code==='stats-mismatch'))flags.push(flag('stats-mismatch','fav-conflict'))
  }
  const hard=flags.find(row=>['srl','early-season','cup','both-top-five','both-bottom-three','stats-mismatch'].includes(row.code))
  return{
    blocked:!!hard,
    skip:hard?.code||null,
    flags,
    earlySeason:flags.some(row=>row.code==='early-season'),
    statsMismatch:flags.some(row=>row.code==='stats-mismatch')
  }
}

export function structuralSkip(fixture,homeMetrics=null,awayMetrics=null){
  if(isSrlMatch(fixture))return'srl'
  if(isEarlySeason(fixture))return'early-season'
  if(isCupCompetition(fixture?.league))return'cup'
  const table=tableGate(fixture?.homeSplit,fixture?.awaySplit)
  if(!table.ok)return table.skip
  if(similarForm(homeMetrics,awayMetrics))return'similar-form'
  const mismatch=statsDoNotMatch(fixture,homeMetrics,awayMetrics)
  if(mismatch.mismatch&&mismatch.reason!=='similar-form')return'stats-mismatch'
  return null
}

export function redFlagSkip(fixture,{home=null,away=null,favourite=null}={}){
  const skip=structuralSkip(fixture,home,away)
  if(skip)return skip
  if(favourite&&favConflict(fixture,home,away,favourite))return'fav-conflict'
  return null
}
