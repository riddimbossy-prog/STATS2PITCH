import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBearer, saveSnapshot, loadLatestSnapshot, createConfirmedUser } from './supabaseAdmin.js'
import { enrichDate } from './enrich.js'
import { buildBoard } from './engine.js'

const __dirname=path.dirname(fileURLToPath(import.meta.url));const publicDir=path.resolve(__dirname,'../public');const port=Number(process.env.PORT||3000)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function authed(req,res){const u=await verifyBearer(req.headers.authorization);if(!u){json(res,401,{error:'Authentication required.'});return null}return u}
async function serve(req,res){let p=new URL(req.url,'http://local').pathname;if(p==='/')p='/index.html';const target=path.normalize(path.join(publicDir,p));if(!target.startsWith(publicDir)){res.writeHead(403);return res.end('Forbidden')}try{const body=await fs.readFile(target);const ext=path.extname(target);const noStore=['.html','.js','.css','.webmanifest'].includes(ext);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':noStore?'no-store, max-age=0':'public, max-age=86400, immutable','X-Stats2Pitch-Version':'1.1.1'});res.end(body)}catch{try{const body=await fs.readFile(path.join(publicDir,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Stats2Pitch-Version':'1.1.1'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}}

const signupBuckets=new Map();
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function allowSignupAttempt(ip){const now=Date.now(),windowMs=60*60*1000,max=6;const item=signupBuckets.get(ip);if(!item||now-item.start>windowMs){signupBuckets.set(ip,{start:now,count:1});return true}if(item.count>=max)return false;item.count++;return true}
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20_000)throw new Error('Request too large.')}try{return JSON.parse(raw||'{}')}catch{throw new Error('Invalid JSON.')}}

const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/api/health')return json(res,200,{ok:true,brand:'Stats2Pitch.com',version:'1.1.1',time:new Date().toISOString()})
 if(u.pathname==='/api/config')return json(res,200,{brand:'Stats2Pitch.com',version:'1.1.1',supabaseUrl:process.env.SUPABASE_URL||'',supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',allowPublicSignup:String(process.env.ALLOW_PUBLIC_SIGNUP||'true')!=='false',enableGithubLogin:String(process.env.ENABLE_GITHUB_LOGIN||'true')==='true'})
 if(u.pathname==='/api/auth/signup'&&req.method==='POST'){
  if(String(process.env.ALLOW_PUBLIC_SIGNUP||'true')==='false')return json(res,403,{error:'Account creation is disabled.'});
  const ip=clientIp(req);if(!allowSignupAttempt(ip))return json(res,429,{error:'Too many account-creation attempts. Try again later.'});
  try{const body=await readJson(req);const email=String(body.email||'').trim().toLowerCase();const password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters.'});const user=await createConfirmedUser(email,password);return json(res,201,{ok:true,userId:user.id,email:user.email,confirmed:true});}catch(e){const msg=String(e.message||'Signup failed.');const duplicate=/already|registered|exists/i.test(msg);return json(res,duplicate?409:400,{error:duplicate?'An account with this email already exists.':msg})}
 }
 if(u.pathname==='/api/me'){const user=await authed(req,res);if(user)return json(res,200,{id:user.id,email:user.email});return}
 if(u.pathname==='/api/board'){if(!await authed(req,res))return;const board=await loadLatestSnapshot();return json(res,200,board||{meta:{fixturesScanned:0,qualified:0,generatedAt:null},groups:{single:[],two:[],threePlus:[]},priority:[]})}
 if(u.pathname==='/api/refresh'&&req.method==='POST'){
  if(!await authed(req,res))return;if(String(process.env.ALLOW_MANUAL_REFRESH||'true')!=='true')return json(res,403,{error:'Manual refresh is disabled.'})
  try{const requested=u.searchParams.get('date')||'';const {date,fixtures,rawCount}=await enrichDate(requested);const board=buildBoard(fixtures,{date,fixturesScanned:fixtures.length,sourceFixtures:rawCount,generatedAt:new Date().toISOString()});await saveSnapshot(board,date);return json(res,200,board)}catch(e){console.error(e);try{const previous=await loadLatestSnapshot();if(previous)return json(res,200,{...previous,meta:{...previous.meta,stale:true,refreshError:e.message}})}catch{}return json(res,500,{error:e.message})}
 }
 return serve(req,res)
}catch(e){console.error(e);json(res,500,{error:e.message})}})
server.listen(port,()=>console.log(`Stats2Pitch.com listening on ${port}`))
