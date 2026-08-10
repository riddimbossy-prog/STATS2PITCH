import { snapshotHasStrictMaturityPolicy, snapshotHasStrictSplitPolicy, snapshotHasEngineIntegrityPolicy } from './maturity.js'
import { WIN_SAFETY_POLICY } from './winSafety.js'

const text=value=>String(value??'').trim()
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null}
const allowedPriority=new Set(['ELITE','VERY HIGH','HIGH'])

export function eliteFeedAuthorized(req){
  const expected=text(process.env.STATS2PITCH_ELITE_FEED_TOKEN)
  if(!expected)return false
  const bearer=text(req.headers.authorization).replace(/^Bearer\s+/i,'')
  return bearer===expected
}

export function snapshotIsEliteCompatible(board){
  return Boolean(
    board&&
    snapshotHasStrictMaturityPolicy(board)&&
    snapshotHasStrictSplitPolicy(board)&&
    snapshotHasEngineIntegrityPolicy(board)&&
    board?.meta?.winSafetyPolicy===WIN_SAFETY_POLICY
  )
}

function finalSelection(row){
  return text(row?.selectionLabel)||text(row?.selectedTeam)||text(row?.pick)||text(row?.selection)||'Selection'
}

function finalMarket(row){
  const market=text(row?.market)
  if(market==='DNB')return 'Draw No Bet'
  if(market==='DC')return text(row?.downgradeMarket)||'Double Chance'
  return market||text(row?.marketLabel)||'Market'
}

function fixtureName(row){
  const direct=text(row?.fixture)
  if(direct)return direct
  const home=text(row?.homeTeam||row?.home_team||row?.home?.name)
  const away=text(row?.awayTeam||row?.away_team||row?.away?.name)
  return home&&away?`${home} vs ${away}`:home||away||'Fixture'
}

export function buildEliteFeed(board,{date,limit=10}={}){
  const safeLimit=Math.max(1,Math.min(10,Number(limit)||10))
  const rows=(Array.isArray(board?.bestPicks)?board.bestPicks:[])
    .filter(row=>text(row?.statusGroup||row?.lifecycle?.statusGroup||'upcoming').toLowerCase()==='upcoming')
    .filter(row=>text(row?.contradiction||'LOW').toUpperCase()!=='HIGH')
    .filter(row=>allowedPriority.has(text(row?.priorityLabel).toUpperCase()))
    .slice(0,safeLimit)
    .map((row,index)=>({
      id:`stats2pitch-${text(row?.fixtureId)||index}-${text(row?.market)||'market'}`,
      source:'stats2pitch',
      source_fixture_id:text(row?.fixtureId)||null,
      prediction_date:date||board?.meta?.date||null,
      fixture:fixtureName(row),
      home_team:text(row?.homeTeam||row?.home_team||row?.home?.name)||null,
      away_team:text(row?.awayTeam||row?.away_team||row?.away?.name)||null,
      league:text(row?.league||row?.competition)||null,
      country:text(row?.country)||null,
      kickoff:row?.kickoff||row?.date||row?.fixtureDate||null,
      market:finalMarket(row),
      pick:finalSelection(row),
      average_odds:number(row?.odds),
      classification:text(row?.priorityLabel).toUpperCase()==='ELITE'?'elite_strong':'elite_supported',
      label:'Stats2Pitch Elite',
      elite_score:Math.round(number(row?.engineRating)??70),
      engine_rating:number(row?.engineRating),
      family_count:number(row?.familyCount),
      families:Array.isArray(row?.families)?row.families:[],
      contradiction:text(row?.contradiction||'LOW').toUpperCase(),
      status:'upcoming',
      reason:text(row?.shortReason||row?.reason)||'Qualified by Stats2Pitch split-stat and market safety rules.',
      last_verified_at:board?.meta?.generatedAt||new Date().toISOString(),
      evidence:{source:'stats2pitch',win_safety:row?.winSafety||null}
    }))
  return{
    version:1,
    source:'stats2pitch',
    date:date||board?.meta?.date||null,
    generated_at:board?.meta?.generatedAt||null,
    count:rows.length,
    max:10,
    items:rows
  }
}
