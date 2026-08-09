import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBearer, saveSnapshot, loadLatestSnapshot, loadSnapshotByDate, createConfirmedUser, accountExists } from './supabaseAdmin.js'
import { enrichDate } from './enrich.js'
import { getFixturesByDateFresh } from './apiFootball.js'
import { buildBoard } from './engine.js'
import { filterMatureFixtures, snapshotHasStrictMaturityPolicy, snapshotHasStrictSplitPolicy, emptyMatureBoard, EARLY_SEASON_POLICY } from './maturity.js'
import { MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY } from './stats.js'
import { applyWinSafety, WIN_SAFETY_POLICY } from './winSafety.js'
import { buildLifecycleMap, mergeLifecycleBoard } from './lifecycle.js'
import { createRefreshJobs } from './refreshJobs.js'

const VERSION='1.9.2'
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
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const normalizeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):localDate()

async function runRefresh(requestedDate,progress=()=>{}){
  progress({phase:'start',message:'Starting real-data refresh.',current:0,total:null})
  const enriched=await enrichDate(requestedDate,{onProgress:progress})
  const {
    date,fixtures,rawFixtures,rawCount,upcomingCount,preflightLimit,maturityCandidates,candidatesAttempted,
    earlySeasonSkipped,standingsUnavailable,statsOddsFallbacks,statsFallbackCapSkipped,unpricedSkipped,
    shortSplitHistory,enrichmentErrors
  }=enriched
  const matureFixtures=filterMatureFixtures(fixtures)
  progress({phase:'engine',message:`Running prediction engine on ${matureFixtures.length} priced mature fixtures.`,current:matureFixtures.length,total:matureFixtures.length})

  const baseBoard=buildBoard(matureFixtures,{
    date,
    fixturesScanned:matureFixtures.length,
    sourceFixtures:rawCount,
    generatedAt:new Date().toISOString(),
    earlySeasonPolicy:EARLY_SEASON_POLICY,
    minimumLeagueGames:MIN_LEAGUE_GAMES,
    maturityPolicy:EARLY_SEASON_POLICY,
    minLeagueGames:MIN_LEAGUE_GAMES,
    splitPolicy:SPLIT_ENGINE_POLICY,
    splitPrimaryOnly:true,
    splitDescription:'Home team uses home-only league stats/form; away team uses away-only league stats/form. Overall stats are context only.'
  })
  const safeBoard=applyWinSafety(baseBoard,matureFixtures)

  let statusFixtures=Array.isArray(rawFixtures)?rawFixtures:[]
  let lifecycleSource='loaded-fixtures'
  try{
    progress({phase:'lifecycle',message:'Updating live and settled match status.',current:0,total:1})
    statusFixtures=await getFixturesByDateFresh(date)
    lifecycleSource='fresh-status'
  }catch(e){
    console.warn('Fresh lifecycle status unavailable; using loaded fixture status:',e.message)
    progress({phase:'lifecycle',message:'Fresh status check was unavailable; using the fixture status already loaded.',current:1,total:1})
  }

  const lifecycleMap=buildLifecycleMap(statusFixtures)
  const previous=await loadSnapshotByDate(date).catch(()=>null)
  const compatiblePrevious=previous?.meta?.winSafetyPolicy===WIN_SAFETY_POLICY&&snapshotHasStrictSplitPolicy(previous)?previous:null
  const merged=mergeLifecycleBoard(safeBoard,compatiblePrevious,lifecycleMap)
  const board={
    ...merged,
    meta:{
      ...merged.meta,
      stale:false,
      refreshVersion:VERSION,
      refreshDiagnostics:{
        sourceFixtures:rawCount,
        upcomingFixtures:upcomingCount,
        preflightLimit,
        maturityCandidates,
        candidatesAttempted,
        pricedEnrichedFixtures:matureFixtures.length,
        earlySeasonSkipped,
        standingsUnavailable,
        unpricedSkipped,
        statsOddsFallbacks,
        statsFallbackCapSkipped,
        shortSplitHistory,
        enrichmentErrors,
        engineCandidates:baseBoard?.meta?.qualified??0,
        finalQualified:merged?.meta?.qualified??0,
        straightWinsBlocked:safeBoard?.meta?.straightWinsBlocked??0,
        bottom3TeamResultBlocked:safeBoard?.meta?.bottom3TeamResultBlocked??0,
        seasonSplitWinFallbacks:safeBoard?.meta?.seasonSplitWinFallbacks??0,
        lifecycleSource
      }
    }
  }

  progress({phase:'save',message:`Saving fresh board with ${board.meta?.qualified||0} qualified picks.`,current:0,total:1})
  await saveSnapshot(board,date)
  progress({phase:'save',message:`Fresh board saved with ${board.meta?.qualified||0} qualified picks.`,current:1,total:1})
  return board
}

const refreshJobs=createRefreshJobs(runRefresh,{ttlMs:Number(process.env.REFRESH_JOB_TTL_MS||30*60*1000)})

const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local')
 if(u.pathname==='/api/health')return json(res,200,{ok:true,brand:'Stats2Pitch.com',version:VERSION,splitPolicy:SPLIT_ENGINE_POLICY,refreshMode:'background-job',candidatePolicy:'priced-after-maturity',time:new Date().toISOString()})
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
  if(board&&!snapshotHasStrictMaturityPolicy(board))return json(res,200,emptyMatureBoard({date:board?.meta?.date||null,generatedAt:board?.meta?.generatedAt||null,sourceFixtures:board?.meta?.sourceFixtures??board?.meta?.fixturesScanned??0,stale:true,maturityReason:`Saved board was built before the ${MIN_LEAGUE_GAMES}-game league maturity rule. Refresh real data.`}))
  if(board&&!snapshotHasStrictSplitPolicy(board))return json(res,200,emptyMatureBoard({date:board?.meta?.date||null,generatedAt:board?.meta?.generatedAt||null,sourceFixtures:board?.meta?.sourceFixtures??board?.meta?.fixturesScanned??0,stale:true,splitReason:'Saved board used overall/legacy football metrics. Refresh real data to build strict home-vs-away split predictions.'}))
  return json(res,200,board||emptyMatureBoard())
 }
 if(u.pathname==='/api/refresh-status'&&req.method==='GET'){
  if(!await authed(req,res))return
  const date=normalizeDate(u.searchParams.get('date')||'')
  const job=refreshJobs.get(date)
  return json(res,200,job||{date,status:'idle',progress:null,error:null,board:null})
 }
 if(u.pathname==='/api/refresh'&&req.method==='POST'){
  if(!await authed(req,res))return
  if(String(process.env.ALLOW_MANUAL_REFRESH||'true')!=='true')return json(res,403,{error:'Manual refresh is disabled.'})
  const date=normalizeDate(u.searchParams.get('date')||'')
  const job=refreshJobs.start(date)
  return json(res,202,job)
 }
 return serve(req,res)
}catch(e){console.error(e);json(res,500,{error:e.message})}})
server.listen(port,()=>console.log(`Stats2Pitch.com v${VERSION} listening on ${port}`))
