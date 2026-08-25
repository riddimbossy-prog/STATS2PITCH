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
  return text(row?.displaySelection)||text(row?.selectionLabel)||text(row?.pick)||text(row?.selection)||'Selection'
}

function finalMarket(row){
  const market=text(row?.market)
  if(market==='both-teams-score'||market==='BTTS')return'Both Teams To Score'
  if(market==='match-winner'||market==='1X2')return'Match winner'
  if(market==='away-team-goals')return'Away team goals'
  if(market==='home-team-goals')return'Home team goals'
  if(market==='total-goals')return'Total goals'
  if(market==='DNB')return'Draw No Bet'
  if(market==='DC')return text(row?.downgradeMarket)||'Double Chance'
  return market||text(row?.marketLabel)||'Market'
}

function priorityClass(row){
  const classification=text(row?.classification)
  if(classification==='elite_strong')return'elite_strong'
  if(classification==='elite_supported')return'elite_supported'
  const rating=number(row?.engineRating)??number(row?.elite_score)??0
  return rating>=78?'elite_strong':'elite_supported'
}

function reason(row){
  const direct=text(row?.shortReason)||text(row?.reason)
  if(direct)return direct
  if(Array.isArray(row?.reasons)&&row.reasons.length)return row.reasons.map(text).filter(Boolean).slice(0,8).join(' • ')
  return'Qualified by the Away-Fav Streak engine.'
}

export function buildEliteFeed(board,{date,limit=10}={}){
  const safeLimit=Math.max(1,Math.min(10,Number(limit)||10))
  const rows=(Array.isArray(board?.bestPicks)?board.bestPicks:[])
    .filter(row=>text(row?.engine||'')==='away-fav-streak-v1')
    .filter(row=>['btts','away-win','away-o15','over-15'].includes(text(row?.route)))
    .filter(row=>(number(row?.engineRating)??number(row?.elite_score)??0)>=64)
    .filter(row=>text(row?.contradiction||'LOW').toUpperCase()!=='HIGH')
    .slice(0,safeLimit)
    .map((row,index)=>{
      const home=teamName(row?.home,text(row?.homeTeam||row?.home_team))
      const away=teamName(row?.away,text(row?.awayTeam||row?.away_team))
      return{
        id:`stats2pitch-${text(row?.fixtureId)||index}-${text(row?.market)||'market'}`,
        source:'stats2pitch',
        engine:'away-fav-streak-v1',
        source_fixture_id:text(row?.fixtureId)||null,
        prediction_date:date||board?.meta?.date||null,
        fixture:fixtureName(row),
        home_team:home||null,
        away_team:away||null,
        home_logo:text(row?.homeLogo||row?.home_logo||row?.home?.logo)||null,
        away_logo:text(row?.awayLogo||row?.away_logo||row?.away?.logo)||null,
        league_logo:text(row?.leagueLogo||row?.league_logo)||null,
        league:text(row?.league||row?.competition)||null,
        country:text(row?.country)||null,
        kickoff:row?.kickoff||row?.date||row?.fixtureDate||null,
        market:finalMarket(row),
        pick:finalSelection(row),
        average_odds:number(row?.odds),
        classification:priorityClass(row),
        label:'Away-Fav Streak',
        elite_score:Math.round(number(row?.engineRating)??number(row?.elite_score)??70),
        engine_rating:number(row?.engineRating)??number(row?.elite_score),
        family_count:number(row?.familyCount)??(Array.isArray(row?.families)?row.families.length:null),
        families:Array.isArray(row?.filterFamilies)?row.filterFamilies:Array.isArray(row?.families)?row.families:[],
        contradiction:text(row?.contradiction||'LOW').toUpperCase(),
        status:'upcoming',
        reason:reason(row),
        last_verified_at:board?.meta?.generatedAt||new Date().toISOString()
      }
    })
  return{
    version:4,
    source:'stats2pitch',
    engine:'away-fav-streak-v1',
    date:date||board?.meta?.date||null,
    generated_at:board?.meta?.generatedAt||null,
    count:rows.length,
    max:10,
    items:rows
  }
}
