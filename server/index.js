import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBearer, saveSnapshot, loadLatestSnapshot, loadSnapshotByDate, createConfirmedUser, accountExists } from './supabaseAdmin.js'
import { enrichDate } from './enrich.js'
import { getFixturesByDateFresh } from './apiFootball.js'
import { buildBoard } from './engine.js'
import { filterMatureFixtures, snapshotHasStrictMaturityPolicy, emptyMatureBoard, EARLY_SEASON_POLICY } from './maturity.js'
import { MIN_LEAGUE_GAMES } from './stats.js'
import { applyWinSafety, WIN_SAFETY_POLICY } from './winSafety.js'
import { buildLifecycleMap, mergeLifecycleBoard } from './lifecycle.js'

const VERSION='1.8.0'
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const publicDir=path.resolve(__dirname,'../public')
const port=Number(process.env.PORT||3000)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function authed(req,res){const u=await verifyBearer(req.headers.authorization);if(!u){json(res,401,{error:'Authentication required.'});return null}return u}
async function serve(req,res){let p=new URL(req.url,'http://local').pathname;if(p==='/')p='/index.html';const target=path.normalize(path.join(publicDir,p));if(!target.startsWith(publicDir)){res.writeHead(403);return res.end('Forbidden')}try{const body=await fs.readFile(target);const ext=path.extname(target);const noStore=['.html','.js','.css','.webmanifest'].includes(ext);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':noStore?'no-store, max-age=0':'public, max-age=86400, immutable','X-Stats2Pitch-Version':VERSION});res.end(body)}catch{try{const body=await fs.readFile(path.join(publicDir,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Stats2Pitch-Version':VERSION});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}}

const signupBuckets=new Map()
const lookupBuckets=new Map()
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function allowBucket(map,ip,max,windowMs=60*60*1000){const now=Date.now();const item=map.get(ip);if(!item||now-item.start>windowMs){map.set(ip,{start:now,count:1});return true}if(item.count>=max)return false;item.count++;return true}
function allowSignupAttempt(ip){return allowBucket(signupBuckets,ip,6)}
function allowLookupAttempt(ip){return allowBucket(lookupBuckets,ip,20)}
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20_000)throw new Error('Request too large.')}try{return JSON.parse(raw||'{}')}catch{throw new Error('Invalid JSON.')}}
const normalizedSupabaseUrl=()=>{const raw=String(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'');return raw&&!/^https?:\/\//i.test(raw)?`https://${raw}`:raw}

const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local')
 if(u.pathname==='/api/health')return json(res,200,{ok:true,brand:'Stats2Pitch.com',version:VERSION,time:new Date().toISOString()})
 if(u.pathname==='/api/config')return json(res,200,{brand:'Stats2Pitch.com',version:VERSION,supabaseUrl:normalizedSupabaseUrl(),supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',allowPublicSignup:String(process.env.ALLOW_PUBLIC_SIGNUP||'true')!=='false'})
 if(u.pathname==='/api/auth/account-status'&&req.method==='POST'){
  if(String(process.env.ALLOW_PUBLIC_SIGNUP||'true')==='false')return json(res,200,{needsAccount:false})
  const ip=clientIp(req);if(!allowLookupAttempt(ip))return json(res,429,{error:'Too many attempts. Try again later.'})
  try{const body=await readJson(req);const email=String(body.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});const exists=await accountExists(email);return json(res,200,{needsAccount:!exists})}catch(e){console.error('Account status lookup failed:',e.message);return json(res,200,{needsAccount:false})}
 }
 if(u.pathname==='/api/auth/signup'&&req.method==='POST'){
  if(String(process.env.ALLOW_PUBLIC_SIGNUP||'true')==='false')return json(res,403,{error:'Account creation is disabled.'})
  const ip=clientIp(req);if(!allowSignupAttempt(ip))return json(res,429,{error:'Too many account-creation attempts. Try again later.'})
  try{const body=await readJson(req);const email=String(body.email||'').trim().toLowerCase();const password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters.'});const user=await createConfirmedUser(email,password);return json(res,201,{ok:true,userId:user.id,email:user.email,confirmed:true})}catch(e){const msg=String(e.message||'Signup failed.');const duplicate=/already|registered|exists/i.test(msg);return json(res,duplicate?409:400,{error:duplicate?'An account with this email already exists.':'Account could not be created right now. Please try again.'})}
 }
 if(u.pathname==='/api/me'){const user=await authed(req,res);if(user)return json(res,200,{id:user.id,email:user.email});return}
 if(u.pathname==='/api/board'){
  if(!await authed(req,res))return
  const board=await loadLatestSnapshot()
  if(board&&!snapshotHasStrictMaturityPolicy(board))return json(res,200,emptyMatureBoard({
    date:board?.meta?.date||null,
    generatedAt:board?.meta?.generatedAt||null,
    sourceFixtures:board?.meta?.sourceFixtures??board?.meta?.fixturesScanned??0,
    stale:true,
    maturityReason:`Saved board was built before the ${MIN_LEAGUE_GAMES}-game league maturity rule. Refresh real data.`
  }))
  return json(res,200,board||emptyMatureBoard())
 }
 if(u.pathname==='/api/refresh'&&req.method==='POST'){
  if(!await authed(req,res))return
  if(String(process.env.ALLOW_MANUAL_REFRESH||'true')!=='true')return json(res,403,{error:'Manual refresh is disabled.'})
  try{
    const requested=u.searchParams.get('date')||''
    const {date,fixtures,rawCount}=await enrichDate(requested)
    const matureFixtures=filterMatureFixtures(fixtures)
    const baseBoard=buildBoard(matureFixtures,{
      date,
      fixturesScanned:matureFixtures.length,
      sourceFixtures:rawCount,
      generatedAt:new Date().toISOString(),
      earlySeasonPolicy:EARLY_SEASON_POLICY,
      minimumLeagueGames:MIN_LEAGUE_GAMES,
      maturityPolicy:EARLY_SEASON_POLICY,
      minLeagueGames:MIN_LEAGUE_GAMES
    })
    const safeBoard=applyWinSafety(baseBoard,matureFixtures)

    // Status/score truth bypasses the long enrichment cache so Live and Settled
    // reflect the latest API-Football state whenever the user refreshes.
    const statusFixtures=await getFixturesByDateFresh(date)
    const lifecycleMap=buildLifecycleMap(statusFixtures)
    const previous=await loadSnapshotByDate(date).catch(()=>null)
    const compatiblePrevious=previous?.meta?.winSafetyPolicy===WIN_SAFETY_POLICY?previous:null
    const board=mergeLifecycleBoard(safeBoard,compatiblePrevious,lifecycleMap)

    await saveSnapshot(board,date)
    return json(res,200,board)
  }catch(e){
    console.error(e)
    try{
      const previous=await loadLatestSnapshot()
      if(previous&&snapshotHasStrictMaturityPolicy(previous))return json(res,200,{...previous,meta:{...previous.meta,stale:true,refreshError:e.message}})
    }catch{}
    return json(res,500,{error:'Matches could not be updated right now. Please try again.'})
  }
 }
 return serve(req,res)
}catch(e){console.error(e);json(res,500,{error:e.message})}})
server.listen(port,()=>console.log(`Stats2Pitch.com v${VERSION} listening on ${port}`))
