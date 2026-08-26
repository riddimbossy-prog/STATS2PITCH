export const ENGINE_VERSION='stats2pitch-v5-var-tips'
export const MIN_ODD=Number(process.env.ENGINE_MIN_ODD||1.20)
export const MAX_ODD=Number(process.env.ENGINE_MAX_ODD||1.55)
export const MIN_CONSENSUS=Number(process.env.ENGINE_MIN_CONSENSUS||80)
export const FORM_SAMPLE=Math.max(3,Number(process.env.ENGINE_FORM_SAMPLE||5))
export const MAX_RELATIVE_DIFF=Math.max(0,Number(process.env.ODDS_VERIFY_MAX_RELATIVE_DIFF||0.15))
export const REQUIRE_CROSS_SOURCE=String(process.env.ODDS_REQUIRE_CROSS_SOURCE||'false').toLowerCase()==='true'
export const API_FOOTBALL_BASE=String(process.env.API_FOOTBALL_BASE||'https://v3.football.api-sports.io').replace(/\/+$/,'')
export const API_FOOTBALL_KEY=process.env.API_FOOTBALL_KEY||''
export const HISTORY_LAST=Math.max(20,Number(process.env.API_FOOTBALL_HISTORY_LAST||40))
export const ODDS_MAX_PAGES=Math.max(1,Number(process.env.API_FOOTBALL_ODDS_MAX_PAGES||8))
export const STATS_API_BASE=String(process.env.STATS_API_BASE_URL||'https://api.thestatsapi.com/api').replace(/\/+$/,'')
export const STATS_API_KEY=process.env.STATS_API_KEY||process.env.THESTATSAPI_KEY||''
export const APP_TIMEZONE=process.env.APP_TIMEZONE||'UTC'
export const FINISHED=new Set(['FT','AET','PEN'])
export const SCHEDULED=new Set(['NS','TBD'])
