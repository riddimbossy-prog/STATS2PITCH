const text=value=>String(value??'').trim()
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null}

export function eliteFeedAuthorized(req){
  const expected=text(process.env.STATS2PITCH_ELITE_FEED_TOKEN)
  if(!expected)return false
  const bearer=text(req.headers.authorization).replace(/^Bearer\s+/i,'')
  return bearer===expected
}

function teamName(value,fallback=''){
  if(typeof value==='string')return text(value)
  if(value&&typeof value==='object')return text(value.name||value.team_name||value.teamName)
  return text(fallback)
}

function fixtureName(row){
  const direct=text(row?.match)||text(row?.fixture)
  if(direct&&!/^(fixture|match)$/i.test(direct))return direct
  const home=teamName(row?.home,text(row?.homeTeam||row?.home_team))
  const away=teamName(row?.away,text(row?.awayTeam||row?.away_team))
  return home&&away?`${home} vs ${away}`:home||away||'Fixture'
}

function finalSelection(row){
  return text(row?.selectionLabel)||text(row?.selectedTeam)||text(row?.pick)||text(row?.selection)||'Selection'
}

function finalMarket(row){
  const market=text(row?.market)
  if(market==='DNB')return'Draw No Bet'
  if(market==='DC')return text(row?.downgradeMarket)||'Double Chance'
  return market||text(row?.marketLabel)||'Market'
}

function priorityClass(row){
  const priority=text(row?.priorityLabel).toUpperCase()
  if(priority==='ELITE')return'elite_strong'
  const rating=number(row?.engineRating)??number(row?.elite_score)??70
  return rating>=88?'elite_strong':'elite_supported'
}

function reason(row){
  const direct=text(row?.shortReason)||text(row?.reason)
  if(direct)return direct
  if(Array.isArray(row?.reasons)&&row.reasons.length)return row.reasons.map(text).filter(Boolean).slice(0,8).join(' • ')
  return'Qualified by Stats2Pitch split-stat and market-safety rules.'
}

export function buildEliteFeed(board,{date,limit=10}={}){
  const safeLimit=Math.max(1,Math.min(10,Number(limit)||10))
  const rows=(Array.isArray(board?.bestPicks)?board.bestPicks:[])
    .filter(row=>text(row?.contradiction||'LOW').toUpperCase()!=='HIGH')
    .slice(0,safeLimit)
    .map((row,index)=>{
      const home=teamName(row?.home,text(row?.homeTeam||row?.home_team))
      const away=teamName(row?.away,text(row?.awayTeam||row?.away_team))
      return{
        id:`stats2pitch-${text(row?.fixtureId)||index}-${text(row?.market)||'market'}`,
        source:'stats2pitch',
        source_fixture_id:text(row?.fixtureId)||null,
        prediction_date:date||board?.meta?.date||null,
        fixture:fixtureName(row),
        home_team:home||null,
        away_team:away||null,
        league:text(row?.league||row?.competition)||null,
        country:text(row?.country)||null,
        kickoff:row?.kickoff||row?.date||row?.fixtureDate||null,
        market:finalMarket(row),
        pick:finalSelection(row),
        average_odds:number(row?.odds),
        classification:priorityClass(row),
        label:'Stats2Pitch Elite',
        elite_score:Math.round(number(row?.engineRating)??70),
        engine_rating:number(row?.engineRating),
        family_count:number(row?.familyCount),
        families:Array.isArray(row?.filterFamilies)?row.filterFamilies:Array.isArray(row?.families)?row.families:[],
        contradiction:text(row?.contradiction||'LOW').toUpperCase(),
        status:'upcoming',
        reason:reason(row),
        last_verified_at:board?.meta?.generatedAt||new Date().toISOString()
      }
    })
  return{
    version:2,
    source:'stats2pitch',
    date:date||board?.meta?.date||null,
    generated_at:board?.meta?.generatedAt||null,
    count:rows.length,
    max:10,
    items:rows
  }
}
