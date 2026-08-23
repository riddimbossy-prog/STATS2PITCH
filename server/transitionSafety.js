const FORM_SAMPLE=5

export const TRANSITION_RULES=Object.freeze({
  sample:FORM_SAMPLE,
  leakRedirectRate:80,
  win:{
    weakConcedeFirstRate:60,
    weakStayDownRate:60,
    strongScoreFirstRate:60,
    strongScoreFirstWinRate:60,
    strongLeadHoldRate:60,
    strongComebackWinRate:50
  },
  notLose:{
    weakConcedeFirstRate:40,
    weakStayDownRate:50,
    strongScoreFirstRate:40,
    strongScoreFirstNonLossRate:80,
    strongComebackNonLossRate:50
  }
})

const finite=v=>Number.isFinite(Number(v))
const pct=(hits,total)=>total?Math.round(hits*1000/total)/10:null
const same=(a,b)=>String(a??'')===String(b??'')

function isHome(f,teamId){return same(f?.teams?.home?.id,teamId)}
function finalScore(f,teamId){
  const h=Number(f?.goals?.home),a=Number(f?.goals?.away)
  if(!finite(h)||!finite(a))return null
  return isHome(f,teamId)?{own:h,opp:a}:{own:a,opp:h}
}
function goalEvents(f){
  return Array.isArray(f?.events)?f.events.filter(e=>String(e?.type||'').toLowerCase()==='goal').sort((a,b)=>Number(a?.time?.elapsed||0)-Number(b?.time?.elapsed||0)||Number(a?.time?.extra||0)-Number(b?.time?.extra||0)):[]
}
function scoringTeamId(event){return event?.team?.id??null}

function leadWasHeld(events,teamId){
  if(!events.length||!same(scoringTeamId(events[0]),teamId))return false
  let own=0,opp=0
  for(const event of events){
    if(same(scoringTeamId(event),teamId))own++
    else opp++
    if(own<=opp)return false
  }
  return true
}

export function buildTransitionProfile(fixtures=[],teamId){
  const rows=(fixtures||[]).slice(0,FORM_SAMPLE)
  let played=0,covered=0,scoredMatches=0,concededMatches=0,over15=0,over25=0
  let scoredFirst=0,concededFirst=0,scoreFirstWins=0,scoreFirstNonLosses=0,leadHeld=0,comebackWins=0,comebackNonLosses=0,stayDown=0
  for(const f of rows){
    const score=finalScore(f,teamId);if(!score)continue
    played++
    if(score.own>0)scoredMatches++
    if(score.opp>0)concededMatches++
    if(score.own+score.opp>1.5)over15++
    if(score.own+score.opp>2.5)over25++
    if(f?.eventsComplete!==true)continue
    covered++
    const events=goalEvents(f)
    if(!events.length)continue
    const firstFor=same(scoringTeamId(events[0]),teamId)
    if(firstFor){
      scoredFirst++
      if(score.own>score.opp)scoreFirstWins++
      if(score.own>=score.opp)scoreFirstNonLosses++
      if(score.own>score.opp&&leadWasHeld(events,teamId))leadHeld++
    }else{
      concededFirst++
      if(score.own>score.opp)comebackWins++
      if(score.own>=score.opp)comebackNonLosses++
      if(score.own<score.opp)stayDown++
    }
  }
  return{
    played,covered,ready:played>=FORM_SAMPLE&&covered>=FORM_SAMPLE,
    scoredMatchRate:pct(scoredMatches,played),concededMatchRate:pct(concededMatches,played),
    over15Rate:pct(over15,played),over25Rate:pct(over25,played),
    scoredFirst,concededFirst,
    scoreFirstRate:pct(scoredFirst,played),concedeFirstRate:pct(concededFirst,played),
    scoreFirstWinRate:pct(scoreFirstWins,scoredFirst),scoreFirstNonLossRate:pct(scoreFirstNonLosses,scoredFirst),
    leadHoldRate:pct(leadHeld,scoredFirst),
    comebackWinRate:pct(comebackWins,concededFirst),comebackNonLossRate:pct(comebackNonLosses,concededFirst),
    stayDownRate:pct(stayDown,concededFirst)
  }
}

function pass(value,min){return finite(value)&&Number(value)>=Number(min)}
function check(ok,key,label,value,required=true){return{ok:Boolean(ok),key,label,value:value??null,required}}

export function evaluateTransitionSafety({stronger,weaker,mode='win',strongerName='Stronger team',weakerName='Weaker team'}={}){
  const rules=mode==='not-lose'?TRANSITION_RULES.notLose:TRANSITION_RULES.win
  const checks=[]
  checks.push(check(stronger?.ready===true,'strong-sample',`${strongerName}: complete ordered-goal coverage for last 5`,stronger?.covered))
  checks.push(check(weaker?.ready===true,'weak-sample',`${weakerName}: complete ordered-goal coverage for last 5`,weaker?.covered))
  if(stronger?.ready!==true||weaker?.ready!==true){
    return{allowed:false,redirectGoals:false,mode,reason:'transition-evidence-incomplete',checks,stronger,weaker}
  }

  const leak=finite(stronger.concededMatchRate)&&Number(stronger.concededMatchRate)>TRANSITION_RULES.leakRedirectRate
  checks.push(check(!leak,'strong-leak',`${strongerName}: conceded in ${stronger.concededMatchRate}% of last 5; must not exceed 80% for a team-side pick`,stronger.concededMatchRate))

  checks.push(check(pass(weaker.concedeFirstRate,rules.weakConcedeFirstRate),'weak-concede-first',`${weakerName}: concedes first often enough`,weaker.concedeFirstRate))
  checks.push(check(pass(weaker.stayDownRate,rules.weakStayDownRate),'weak-stay-down',`${weakerName}: stays down after conceding first often enough`,weaker.stayDownRate))
  checks.push(check(pass(stronger.scoreFirstRate,rules.strongScoreFirstRate),'strong-score-first',`${strongerName}: scores first often enough`,stronger.scoreFirstRate))

  if(mode==='not-lose'){
    checks.push(check(pass(stronger.scoreFirstNonLossRate,rules.strongScoreFirstNonLossRate),'strong-score-first-nonloss',`${strongerName}: protects a score-first position`,stronger.scoreFirstNonLossRate))
    const comebackNeeded=Number(stronger.concededFirst||0)>=2
    checks.push(check(!comebackNeeded||pass(stronger.comebackNonLossRate,rules.strongComebackNonLossRate),'strong-comeback-nonloss',`${strongerName}: recovers to avoid defeat after conceding first`,stronger.comebackNonLossRate,comebackNeeded))
  }else{
    checks.push(check(pass(stronger.scoreFirstWinRate,rules.strongScoreFirstWinRate),'strong-score-first-win',`${strongerName}: converts score-first matches into wins`,stronger.scoreFirstWinRate))
    checks.push(check(pass(stronger.leadHoldRate,rules.strongLeadHoldRate),'strong-lead-hold',`${strongerName}: maintains the lead without surrendering it`,stronger.leadHoldRate))
    const comebackNeeded=Number(stronger.concededFirst||0)>=2
    checks.push(check(!comebackNeeded||pass(stronger.comebackWinRate,rules.strongComebackWinRate),'strong-comeback-win',`${strongerName}: comeback-to-win ability after conceding first`,stronger.comebackWinRate,comebackNeeded))
  }

  const allowed=!leak&&checks.filter(c=>c.required).every(c=>c.ok)
  return{
    allowed,redirectGoals:leak,mode,
    reason:leak?'stronger-team-leaks-over-80':allowed?'transition-safety-passed':'transition-safety-failed',
    checks,stronger,weaker
  }
}

export function bestQualifiedGoalFallback(candidates=[]){
  const goals=(candidates||[]).filter(c=>['both-teams-score','total-goals'].includes(c.market))
  const priority={'both-teams-score':3,'Over 2.5':2,'Over 1.5':1}
  goals.sort((a,b)=>(priority[b.market]||priority[b.selection]||0)-(priority[a.market]||priority[a.selection]||0)||Number(b.priority||0)-Number(a.priority||0))
  return goals[0]||null
}
