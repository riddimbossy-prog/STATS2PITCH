import fs from 'node:fs'

const path='public/boardView.js'
let s=fs.readFileSync(path,'utf8')

if(!s.includes('function displaySelection(')){
  const anchor="const timeLabel=iso=>{if(!iso)return'—';try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return'—'}}"
  const helper=`${anchor}
function displaySelection(r){
  const market=String(r?.market||'').toLowerCase()
  const marketName=String(r?.marketName||'').toLowerCase()
  const selection=String(r?.selection||'')
  if(market==='first-half-goals'||marketName.includes('first-half goals'))return \`1H · \${selection}\`
  if(market==='first-half-winner'||marketName.includes('first-half winner'))return \`1H Result · \${selection}\`
  if(market==='home-team-goals'||marketName.includes('home team goals'))return \`Home Team · \${selection}\`
  if(market==='away-team-goals'||marketName.includes('away team goals'))return \`Away Team · \${selection}\`
  if(market==='team-goals'||marketName.includes('team goals'))return \`Team Total · \${selection}\`
  if(market==='both-teams-score'||marketName.includes('both teams to score'))return \`BTTS · \${selection}\`
  if(market==='double-chance'||marketName.includes('double chance'))return \`Double Chance · \${selection}\`
  if(market==='draw-no-bet'||marketName.includes('draw no bet'))return \`DNB · \${selection}\`
  if(market==='match-winner'||marketName.includes('match winner'))return \`1X2 · \${selection}\`
  return selection
}`
  if(!s.includes(anchor))throw new Error('Could not locate timeLabel anchor in public/boardView.js')
  s=s.replace(anchor,helper)
}

s=s.replaceAll('${esc(r.selection)}','${esc(displaySelection(r))}')
s=s.replaceAll('${esc(pick.selection)}','${esc(displaySelection(pick))}')

fs.writeFileSync(path,s)
console.log('Patched public/boardView.js market labels')
