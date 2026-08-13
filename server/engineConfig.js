export const ENGINE_VERSION='all-markets-consensus-v2'
export const FORM_TABLE_SAMPLE=5
export const MIN_LEAGUE_GAMES=FORM_TABLE_SAMPLE
export const MIN_SPLIT_TABLE_SAMPLE=FORM_TABLE_SAMPLE
export const MIN_SPLIT_FORM_SAMPLE=FORM_TABLE_SAMPLE
export const SPLIT_LONG_SAMPLE=FORM_TABLE_SAMPLE
export const MIN_ODD=1.20
export const MAX_ODD=1.55
export const MIN_CONSENSUS=80
export const TEAM_RESULT_POLICY='all-markets-strict-consensus'
export const GG_POLICY='all-markets-strict-consensus'
export const ODDS_POLICY='strict-1.20-to-1.55'
export const PROFILE_SOURCE='venue-form-table-last5'
export const FAMILY={MARKET:'Market/Odds',CONSENSUS:'Two-Team Consensus'}
export const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null)
export const odd=v=>{const n=num(v);return n!==null&&n>1.001&&n<1000?n:null}
export const pct=(n,d)=>d?Math.round((n/d)*100):null
export const avg=vals=>{const rows=vals.filter(Number.isFinite);return rows.length?+(rows.reduce((a,b)=>a+b,0)/rows.length).toFixed(2):null}
