import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBearer, saveSnapshot, loadLatestSnapshot } from './supabaseAdmin.js'
import { enrichDate } from './enrich.js'
import { buildBoard } from './engine.js'

const __dirname=path.dirname(fileURLToPath(import.meta.url));const publicDir=path.resolve(__dirname,'../public');const port=Number(process.env.PORT||3000)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function authed(req,res){const u=await verifyBearer(req.headers.authorization);if(!u){json(res,401,{error:'Authentication required.'});return null}return u}
async function serve(req,res){let p=new URL(req.url,'http://local').pathname;if(p==='/')p='/index.html';const target=path.normalize(path.join(publicDir,p));if(!target.startsWith(publicDir)){res.writeHead(403);return res.end('Forbidden')}try{const body=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':p==='/index.html'?'no-cache':'public, max-age=3600'});res.end(body)}catch{try{const body=await fs.readFile(path.join(publicDir,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}}

const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/api/health')return json(res,200,{ok:true,time:new Date().toISOString()})
 if(u.pathname==='/api/config')return json(res,200,{supabaseUrl:process.env.SUPABASE_URL||'',supabaseAnonKey:process.env.SUPABASE_ANON_KEY||''})
 if(u.pathname==='/api/me'){const user=await authed(req,res);if(user)return json(res,200,{id:user.id,email:user.email});return}
 if(u.pathname==='/api/board'){if(!await authed(req,res))return;const board=await loadLatestSnapshot();return json(res,200,board||{meta:{fixturesScanned:0,qualified:0,generatedAt:null},groups:{single:[],two:[],threePlus:[]},priority:[]})}
 if(u.pathname==='/api/refresh'&&req.method==='POST'){
  if(!await authed(req,res))return;if(String(process.env.ALLOW_MANUAL_REFRESH||'true')!=='true')return json(res,403,{error:'Manual refresh is disabled.'})
  try{const requested=u.searchParams.get('date')||'';const {date,fixtures,rawCount}=await enrichDate(requested);const board=buildBoard(fixtures,{date,fixturesScanned:fixtures.length,sourceFixtures:rawCount,generatedAt:new Date().toISOString()});await saveSnapshot(board,date);return json(res,200,board)}catch(e){console.error(e);try{const previous=await loadLatestSnapshot();if(previous)return json(res,200,{...previous,meta:{...previous.meta,stale:true,refreshError:e.message}})}catch{}return json(res,500,{error:e.message})}
 }
 return serve(req,res)
}catch(e){console.error(e);json(res,500,{error:e.message})}})
server.listen(port,()=>console.log(`Modular Football Agent listening on ${port}`))
