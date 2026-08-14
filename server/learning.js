const keyOf=(country,league,market)=>`${String(country||'').toLowerCase()}|${String(league||'').toLowerCase()}|${String(market||'').toLowerCase()}`
export const profileKey=pick=>keyOf(pick?.country,pick?.league,pick?.market)

export function buildLearningProfiles(boards=[],minSample=20){
  const groups=new Map()
  for(const board of boards||[])for(const p of board?.bestPicks||[]){
    const r=board?.results?.[String(p.fixtureId)]
    if(!r||!['won','lost','void'].includes(r.outcome)||r.outcome==='void')continue
    const k=profileKey(p),g=groups.get(k)||{key:k,country:p.country||'',league:p.league||'',market:p.market||'',wins:0,losses:0,sample:0}
    g.sample++;if(r.outcome==='won')g.wins++;else g.losses++;groups.set(k,g)
  }
  return[...groups.values()].map(g=>{
    const winRate=g.sample?Math.round(g.wins*1000/g.sample)/10:0
    let gate='standard',note='Keep the current qualification level.'
    if(g.sample>=30&&winRate<50){gate='skip';note='Temporarily hold this profile until performance improves.'}
    else if(g.sample>=minSample&&winRate<58){gate='100-only';note='Only allow full-agreement picks for this profile.'}
    return{...g,winRate,gate,note,ready:g.sample>=minSample}
  }).sort((a,b)=>b.sample-a.sample||b.winRate-a.winRate)
}

export function learningAllows(pick,profiles=[]){
  const p=profiles.find(x=>x.key===profileKey(pick))
  if(!p||!p.ready)return{allowed:true,profile:p||null}
  if(p.gate==='skip')return{allowed:false,profile:p}
  if(p.gate==='100-only'&&!(Number(pick.homeConsensus)===100&&Number(pick.awayConsensus)===100))return{allowed:false,profile:p}
  return{allowed:true,profile:p}
}
