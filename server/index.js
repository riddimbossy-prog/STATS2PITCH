import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {join,extname,normalize} from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadBoard,listBoards,clearBoard} from './store.js'
import {startRefresh,refreshStatus} from './refresh.js'
import {sportyEventFixtures,sportyFixturesByDate} from './sportyBet.js'
import {gismoMatches} from './sportyStats.js'
import {normalizeFixtureStatus,settlePick} from './settlement.js'
import {buildLearningProfiles} from './learning.js'
import {ENGINE_VERSION} from './config.js'
import {eliteFeedAuthorized,buildEliteFeed} from './eliteExport.js'

const PORT=Number(process.env.PORT||3000),PUBLIC=fileURLToPath(new URL('../public/',import.meta.url))
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4'}
const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const today=()=>new Date().toISOString().slice(0,10)
const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const send=(res,status,body)=>{const s=typeof body==='string'?body:JSON.stringify(body);res.writeHead(status,{'Content-Type':typeof body==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(s)}
async function json(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}}
function performance(boards){const summary={picks:0,won:0,lost:0,void:0,pending:0,winRate:0},groups=new Map();for(const b of boards)for(const p of b?.bestPicks||[]){const r=b?.results?.[String(p.fixtureId)],o=r?.outcome||'pending';summary.picks++;if(o==='won')summary.won++;else if(o==='lost')summary.lost++;else if(o==='void')summary.void++;else summary.pending++;if(!['won','lost'].includes(o))continue;for(const dimension of ['market','country','league','confidence']){const value=dimension==='confidence'?(Number(p?.consensus)===100?'100%':`${Number(p?.consensus)||0}%`):String(p?.[dimension]||'Unknown'),k=`${dimension}|${value}`,g=groups.get(k)||{dimension,value,picks:0,won:0,lost:0};g.picks++;if(o==='won')g.won++;else g.lost++;groups.set(k,g)}}const decided=summary.won+summary.lost;summary.winRate=decided?Math.round(summary.won*1000/decided)/10:0;return{summary,groups:[...groups.values()].map(g=>({...g,winRate:Math.round(g.won*1000/g.picks)/10})).sort((a,b)=>b.picks-a.picks)}}
async function resultPayload(date){
  const board=await loadBoard(date)||{bestPicks:[],varTips:[],filterTips:[],goalsBankers:[],results:{}}
  const published=[...(board.bestPicks||[]),...(board.varTips||[]),...(board.filterTips||[]),...(board.goalsBankers||[])]
  const eventIds=published.map(p=>p.sportyEventId).filter(Boolean)
  let fixtures=[]
  try{if(eventIds.length)fixtures=await sportyEventFixtures(eventIds)}catch{}
  if(!fixtures.length){try{fixtures=await sportyFixturesByDate(date)}catch{}}
  const have=new Set(fixtures.map(f=>String(f?.fixture?.id||'')))
  const missing=published.map(p=>p.fixtureId).filter(id=>id!=null&&!have.has(String(id)))
  if(missing.length){try{fixtures=fixtures.concat(await gismoMatches(missing))}catch{}}
  const map=new Map(fixtures.map(f=>{const n=normalizeFixtureStatus(f);return[String(n.fixtureId),n]}))
  const pending=p=>({outcome:'pending',matchState:Date.parse(p.kickoff)>Date.now()?'upcoming':'pending'})
  const withResult=(p,stored)=>{
    if(map.has(String(p.fixtureId)))return{...p,result:settlePick(p,map.get(String(p.fixtureId)))}
    return{...p,result:stored||pending(p)}
  }
  const picks=(board.bestPicks||[]).map(p=>withResult(p,board.results?.[String(p.fixtureId)]))
  const varTips=(board.varTips||[]).map(p=>withResult(p,null))
  const filterTips=(board.filterTips||[]).map(p=>withResult(p,null))
  const goalsBankers=(board.goalsBankers||[]).map(p=>withResult(p,null))
  return{date,picks,varTips,filterTips,goalsBankers,fixtures:[...map.values()]}
}
async function api(req,res,url){
  if(url.pathname==='/api/health')return send(res,200,{ok:true,engineVersion:ENGINE_VERSION,version:'4.0.0'})
  if(url.pathname==='/api/board'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today(),board=await loadBoard(date);if(!board)startRefresh(date);return send(res,200,board||{meta:{date,engineVersion:ENGINE_VERSION,refresh:refreshStatus(date)},priority:[],bestPicks:[],varTips:[],filterTips:[],goalsBankers:[],fixtures:[],results:{},availableMarkets:[]})}
  if(url.pathname==='/api/results'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today();return send(res,200,await resultPayload(date))}
  if(url.pathname==='/api/live-scores'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today();const r=await resultPayload(date);return send(res,200,{date,fixtures:r.fixtures})}
  if(url.pathname==='/api/performance'){const days=Math.max(1,Math.min(90,Number(url.searchParams.get('days')||30))),to=today(),from=addDays(to,-days+1),rows=await listBoards(from,to),boards=rows.map(x=>x.payload).filter(Boolean);return send(res,200,{days,...performance(boards),learning:buildLearningProfiles(boards)})}
  if(url.pathname==='/api/refresh'&&req.method==='POST'){const b=await json(req),date=dateOk(b.date)?b.date:today();await clearBoard(date);return send(res,202,{ok:true,job:startRefresh(date)})}
  if(url.pathname==='/api/refresh-status'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today();return send(res,200,refreshStatus(date))}
  if(url.pathname==='/api/export/elite'){
    if(!eliteFeedAuthorized(req))return send(res,401,{error:'unauthorized'})
    const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today()
    const board=await loadBoard(date)
    if(!board?.meta?.generatedAt)return send(res,409,{error:'missing-snapshot',date})
    return send(res,200,buildEliteFeed(board,{date}))
  }
  if(url.pathname==='/api/export/elite/refresh'&&req.method==='POST'){
    if(!eliteFeedAuthorized(req))return send(res,401,{error:'unauthorized'})
    const body=await json(req).catch(()=>({}))
    const date=dateOk(body.date||url.searchParams.get('date'))?String(body.date||url.searchParams.get('date')):today()
    const board=await loadBoard(date)
    if(board?.meta?.generatedAt)return send(res,200,{status:'ready',date,generated_at:board.meta.generatedAt})
    return send(res,202,{status:'started',date,job:startRefresh(date)})
  }
  if(url.pathname==='/api/export/elite/refresh-status'){
    if(!eliteFeedAuthorized(req))return send(res,401,{error:'unauthorized'})
    const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today()
    const job=refreshStatus(date)
    if(job?.state==='complete')return send(res,200,{status:'complete',date,result:job.result||null})
    if(job?.state==='failed')return send(res,200,{status:'failed',date,error:job.error||'refresh failed'})
    if(job?.state==='running')return send(res,200,{status:'running',date,progress:job.progress||null})
    const board=await loadBoard(date)
    if(board?.meta?.generatedAt)return send(res,200,{status:'complete',date,generated_at:board.meta.generatedAt})
    return send(res,200,{status:'idle',date})
  }
  return send(res,404,{error:'Not found'})
}
async function staticFile(req,res,url){let p=url.pathname==='/'?'index.html':normalize(url.pathname).replace(/^\/+/,''),file=join(PUBLIC,p);try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-store':'public, max-age=300'});res.end(data)}catch{const data=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});res.end(data)}}
http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);try{if(url.pathname.startsWith('/api/'))await api(req,res,url);else await staticFile(req,res,url)}catch(e){console.error(e);send(res,500,{error:'Server error'})}}).listen(PORT,()=>console.log(`Stats2Pitch ${ENGINE_VERSION} on ${PORT}`))
