import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {extname,join,normalize} from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyUser,loadBoard,publicConfig} from './store.js'
import {startRefresh,refreshStatus} from './refresh.js'
import {getFixturesByDateFresh} from './apiFootball.js'
import {ENGINE_VERSION,MIN_LEAGUE_GAMES,TEAM_RESULT_POLICY,GG_POLICY,ODDS_POLICY} from './engine.js'

const VERSION='2.0.0',PORT=Number(process.env.PORT||3000),PUBLIC=fileURLToPath(new URL('../public/',import.meta.url)),ttlMs=Math.max(5,Number(process.env.AUTO_REFRESH_TTL_MINUTES||45))*60000
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}
const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const send=(res,status,body,headers={})=>{const data=typeof body==='string'?body:JSON.stringify(body);res.writeHead(status,{'Content-Type':typeof body==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(data)}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw new Error('Request too large')}return raw?JSON.parse(raw):{}}
function token(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7):''}
async function user(req){return verifyUser(token(req))}
function emptyBoard(date){return{meta:{date,generatedAt:null,qualified:0,bestPicks:0,engineVersion:ENGINE_VERSION,requiresRefresh:true},groups:{single:[],two:[],threePlus:[]},priority:[],bestPicks:[],availableMarkets:[]}}
function stale(board){const t=Date.parse(board?.meta?.generatedAt||board?.meta?.storedAt||'');return !Number.isFinite(t)||Date.now()-t>ttlMs||Number(board?.meta?.sourceFixtures||0)===0}
function normalizeLive(rows){return(rows||[]).map(x=>({fixtureId:x?.fixture?.id,status:x?.fixture?.status?.short||'',statusLong:x?.fixture?.status?.long||'',minute:x?.fixture?.status?.elapsed??null,kickoff:x?.fixture?.date,league:x?.league?.name||'',country:x?.league?.country||'',leagueLogo:x?.league?.logo||null,countryFlag:x?.league?.flag||null,home:{id:x?.teams?.home?.id,name:x?.teams?.home?.name||'',logo:x?.teams?.home?.logo||null,score:x?.goals?.home??null},away:{id:x?.teams?.away?.id,name:x?.teams?.away?.name||'',logo:x?.teams?.away?.logo||null,score:x?.goals?.away??null}}))}
async function api(req,res,url){
  if(url.pathname==='/api/health')return send(res,200,{ok:true,version:VERSION,engineVersion:ENGINE_VERSION,minimumLeagueGames:MIN_LEAGUE_GAMES,teamResultPolicy:TEAM_RESULT_POLICY,ggPolicy:GG_POLICY,oddsPolicy:ODDS_POLICY})
  if(url.pathname==='/api/config')return send(res,200,{...publicConfig(),version:VERSION})
  let me;try{me=await user(req)}catch(e){return send(res,401,{error:'Authentication required'})}
  if(url.pathname==='/api/me')return send(res,200,{id:me.id,email:me.email||''})
  if(url.pathname==='/api/board'&&req.method==='GET'){
    const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):new Date().toISOString().slice(0,10),saved=await loadBoard(date),board=saved||emptyBoard(date)
    if(!saved||stale(saved))startRefresh(date)
    return send(res,200,{...board,meta:{...(board.meta||{}),date,refresh:refreshStatus(date)}})
  }
  if(url.pathname==='/api/refresh'&&req.method==='POST'){const b=await body(req),date=dateOk(b.date)?b.date:new Date().toISOString().slice(0,10);return send(res,202,{ok:true,job:startRefresh(date)})}
  if(url.pathname==='/api/refresh-status'&&req.method==='GET'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):new Date().toISOString().slice(0,10);return send(res,200,refreshStatus(date))}
  if(url.pathname==='/api/live-scores'&&req.method==='GET'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):new Date().toISOString().slice(0,10);try{return send(res,200,{date,fixtures:normalizeLive(await getFixturesByDateFresh(date))})}catch(e){return send(res,502,{error:'Live scores temporarily unavailable'})}}
  return send(res,404,{error:'Not found'})
}
async function staticFile(req,res,url){
  let path=url.pathname==='/'?'/index.html':url.pathname;path=normalize(path).replace(/^([.][.][/\\])+/, '');const file=join(PUBLIC,path)
  if(!file.startsWith(PUBLIC))return send(res,403,'Forbidden')
  try{const data=await readFile(file),type=mime[extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store, max-age=0','X-Stats2Pitch-Version':VERSION});res.end(data)}catch{try{const data=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store, max-age=0'});res.end(data)}catch{send(res,404,'Not found')}}
}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);try{if(url.pathname.startsWith('/api/'))await api(req,res,url);else await staticFile(req,res,url)}catch(e){console.error(e);send(res,500,{error:'Server error'})}})
server.listen(PORT,()=>console.log(`Stats2Pitch ${VERSION} listening on ${PORT}`))
