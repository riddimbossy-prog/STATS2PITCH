import {num,odd,FAMILY,PROFILE_SOURCE} from './engineConfig.js'
import {pickBase} from './pickUtils.js'
const names={'O1.5':'Over 1.5 goals','U1.5':'Under 1.5 goals','O2.5':'Over 2.5 goals','U2.5':'Under 2.5 goals','O3.5':'Over 3.5 goals','U3.5':'Under 3.5 goals'},keys={'O1.5':'over15','U1.5':'under15','O2.5':'over25','U2.5':'under25','O3.5':'over35','U3.5':'under35'}
function formTableReady(t){return t?.source===PROFILE_SOURCE&&t?.formTableReady===true&&Number(t?.formTableSample)===5}
function confirm(h,a,m){const line=Number(m.slice(1)),over=m.startsWith('O'),p=[num(h.goalsScored)!==null&&num(a.goalsScored)!==null?h.goalsScored+a.goalsScored:null,num(h.goalsConceded)!==null&&num(a.goalsConceded)!==null?h.goalsConceded+a.goalsConceded:null].filter(Number.isFinite);if(p.length<2)return false;return over?p.every(v=>v>line):p.every(v=>v<line)}
export function goalPicks(f){
  const out=[]
  if(!formTableReady(f.home)||!formTableReady(f.away))return out
  for(const m of Object.keys(keys)){
    const k=keys[m],hr=num(f.home[k]),ar=num(f.away[k]),price=odd(f.odds[k])
    if(hr===null||ar===null||hr<60||ar<60||price===null||f.home.goalsSample<5||f.away.goalsSample<5||!confirm(f.home,f.away,m))continue
    const reasons=[`${names[m]} landed in ${hr}% of ${f.home.name}'s HOME Form Table sample`,`${names[m]} landed in ${ar}% of ${f.away.name}'s AWAY Form Table sample`,'The same HOME/AWAY Form Table attack and defence numbers confirm this goal direction'],strength=+(2.1+(hr>=80?.3:0)+(ar>=80?.3:0)).toFixed(2)
    out.push(pickBase(f,{market:m,selection:names[m],odds:price,filterCount:3,familyCount:1,filterFamilies:[FAMILY.GOALS],familyStrength:strength,negativeFamilyStrength:0,contradiction:'LOW',score:+(4+strength+(hr+ar)/200).toFixed(3),reasons,warnings:[],safety:'form-table-goal-agreement'}))
  }
  return out
}
export function ggPick(f){
  const h=f.home,a=f.away
  if(!formTableReady(h)||!formTableReady(a))return null
  const hr=num(h.bttsRate),ar=num(a.bttsRate),price=odd(f.odds.bttsYes)
  if(hr===null||ar===null||hr<60||ar<60||price===null||h.goalsSample<5||a.goalsSample<5)return null
  const core=[h.goalsScored,a.goalsScored,h.goalsConceded,a.goalsConceded]
  if(core.some(v=>num(v)===null||v<1))return null
  if((num(h.failedToScoreRate)!==null&&h.failedToScoreRate>=40)||(num(a.failedToScoreRate)!==null&&a.failedToScoreRate>=40)||(num(h.cleanSheetRate)!==null&&h.cleanSheetRate>=60)||(num(a.cleanSheetRate)!==null&&a.cleanSheetRate>=60))return null
  return pickBase(f,{market:'BTTS',selection:'GG — Both teams to score',odds:price,filterCount:4,familyCount:3,filterFamilies:[FAMILY.GOALS,FAMILY.ATTACK,FAMILY.DEFENCE],familyStrength:3.4,negativeFamilyStrength:0,contradiction:'LOW',score:+(7+(hr+ar)/200).toFixed(3),reasons:[`BTTS landed in ${hr}% of ${h.name}'s HOME Form Table sample`,`BTTS landed in ${ar}% of ${a.name}'s AWAY Form Table sample`,'Both teams average at least 1 goal scored in their relevant Form Table','Both teams average at least 1 goal conceded in their relevant Form Table'],warnings:[],safety:'form-table-strict-gg'})
}
