import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {join,extname,normalize} from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadBoard,clearBoard} from './store.js'
import {startRefresh,refreshStatus} from './refresh.js'
import {ENGINE_VERSION} from './config.js'

const PORT=Number(process.env.PORT||3000),PUBLIC=fileURLToPath(new URL('../public/',import.meta.url))
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8'}
const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))
const today=()=>new Date().toISOString().slice(0,10)
const send=(res,status,body)=>{const s=typeof body==='string'?body:JSON.stringify(body);res.writeHead(status,{'Content-Type':typeof body==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(s)}
async function json(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}}
async function api(req,res,url){
  if(url.pathname==='/api/health')return send(res,200,{ok:true,engineVersion:ENGINE_VERSION})
  if(url.pathname==='/api/board'){
    const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today(),board=await loadBoard(date)
    if(!board)startRefresh(date)
    return send(res,200,board||{meta:{date,engineVersion:ENGINE_VERSION,refresh:refreshStatus(date)},priority:[],bestPicks:[],fixtures:[],availableMarkets:[]})
  }
  if(url.pathname==='/api/refresh'&&req.method==='POST'){const b=await json(req),date=dateOk(b.date)?b.date:today();await clearBoard(date);return send(res,202,{ok:true,job:startRefresh(date)})}
  if(url.pathname==='/api/refresh-status'){const date=dateOk(url.searchParams.get('date'))?url.searchParams.get('date'):today();return send(res,200,refreshStatus(date))}
  return send(res,404,{error:'Not found'})
}
async function staticFile(req,res,url){
  let p=url.pathname==='/'?'index.html':normalize(url.pathname).replace(/^\/+/,'')
  const file=join(PUBLIC,p)
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)}
  catch{const data=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});res.end(data)}
}
http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);try{if(url.pathname.startsWith('/api/'))await api(req,res,url);else await staticFile(req,res,url)}catch(e){console.error(e);send(res,500,{error:'Server error'})}}).listen(PORT,()=>console.log(`Stats2Pitch ${ENGINE_VERSION} on ${PORT}`))
