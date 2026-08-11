export const ENGINE_VERSION='form-table-home-away-v2'
export const FORM_TABLE_SAMPLE=5
// Compatibility names now point to the same strict Form Table sample.
// No engine calculation is allowed to fall back to the normal season table.
export const MIN_LEAGUE_GAMES=FORM_TABLE_SAMPLE
export const MIN_SPLIT_TABLE_SAMPLE=FORM_TABLE_SAMPLE
export const MIN_SPLIT_FORM_SAMPLE=FORM_TABLE_SAMPLE
export const SPLIT_LONG_SAMPLE=FORM_TABLE_SAMPLE
export const TEAM_RESULT_POLICY='form-table-top3-only'
export const GG_POLICY='form-table-btts-60-profile'
export const ODDS_POLICY='single-bookmaker-coherent-v1'
export const PROFILE_SOURCE='venue-form-table-last5'
export const FAMILY={TABLE:'Form Table Strength',FORM:'Form',ATTACK:'Attack',DEFENCE:'Defence',MARKET:'Market/Odds',OPP:'Opponent Weakness',GOALS:'Goal Pattern'}
export const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null)
export const odd=v=>{const n=num(v);return n!==null&&n>1.001&&n<1000?n:null}
export const pct=(n,d)=>d?Math.round((n/d)*100):null
export const avg=vals=>{const rows=vals.filter(Number.isFinite);return rows.length?+(rows.reduce((a,b)=>a+b,0)/rows.length).toFixed(2):null}
export const isTop3=t=>t?.positionSampleReady===true&&num(t?.position)!==null&&t.position<=3
export const isBottom3=t=>num(t?.position)!==null&&num(t?.leagueSize)!==null&&t.position>t.leagueSize-3
export function familyStrength(signals){const by=new Map();for(const s of signals||[]){if(!by.has(s.family))by.set(s.family,[]);by.get(s.family).push(Number(s.weight||0))}let total=0;for(const ws of by.values()){ws.sort((a,b)=>b-a);total+=Math.min(1.8,(ws[0]||0)+Math.min(.35,(ws[1]||0)*.25))}return +total.toFixed(3)}
export const families=signals=>[...new Set((signals||[]).map(x=>x.family).filter(Boolean))]
export function contradiction(pos,neg){const p=familyStrength(pos),n=familyStrength(neg),nf=families(neg).length;if(nf>=3||n>=3||(p>0&&n/p>=.75))return'HIGH';if(nf>=2||n>=1.4||(p>0&&n/p>=.35))return'MODERATE';return'LOW'}
