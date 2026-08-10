import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBearer, saveSnapshot, loadSnapshotByDate, createConfirmedUser, accountExists } from './supabaseAdmin.js'
import { enrichDate } from './enrich.js'
import { getFixturesByDateFresh } from './apiFootball.js'
import { buildBoard } from './engine.js'
import { filterMatureFixtures, snapshotHasStrictMaturityPolicy, snapshotHasStrictSplitPolicy, snapshotHasEngineIntegrityPolicy, emptyMatureBoard, EARLY_SEASON_POLICY } from './maturity.js'
import { MIN_LEAGUE_GAMES, SPLIT_ENGINE_POLICY, ENGINE_INTEGRITY_POLICY } from './stats.js'
import { applyWinSafety, WIN_SAFETY_POLICY } from './winSafety.js'
import { buildLifecycleMap, mergeLifecycleBoard } from './lifecycle.js'
import { createRefreshJobs } from './refreshJobs.js'
import { claimRefreshJob, saveRefreshJob, loadRefreshJob, refreshStoreMode } from './refreshStore.js'
import { withDeadline } from './providerFetch.js'
import { getDailyLiveScores } from './liveScores.js'

const VERSION='1.11.3'
const __dirname=path.dirname(fileURLToPath(import.meta.url)),publicDir=path.resolve(__dirname,'../public'),port=Number(process.env.PORT||3000)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function authed(req,res){const u=await verifyBearer(req.headers.authorization);if(!u){json(res,401,{error:'Authentication required.'});return null}return u}
async function serve(req,res){let p=new URL(req.url,'http://local').pathname;if(p==='/')p='/index.html';const target=path.normalize(path.join(publicDir,p));if(!target.startsWith(publicDir)){res.writeHead(403);return res.end('Forbidden')}try{const body=await fs.readFile(target),ext=path.extname(target),noStore=['.html','.js','.css','.webmanifest'].includes(ext);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':noStore?'no-store, max-age=0':'public, max-age=86400, immutable','X-Stats2Pitch-Version':VERSION});res.end(body)}catch{try{const body=await fs.readFile(path.join(publicDir,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Stats2Pitch-Version':VERSION});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}}
const signupBuckets=new Map(),lookupBuckets=new Map()
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function allowBucket(map,ip,max,windowMs=3600000){const now=Date.now(),item=map.get(ip);if(!item||now-item.start>windowMs){map.set(ip,{start:now,count:1});return true}if(item.count>=max)return false;item.count++;return true}
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Request too large.')}try{return JSON.parse(raw||'{}')}catch{throw new Error('Invalid JSON.')}}
const normalizedSupabaseUrl=()=>{const raw=String(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,'');return raw&&!/^https?:\/\//i.test(raw)?`https://${raw}`:raw}
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const normalizeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):localDate()

async function runRefreshCore(requestedDate,progress=()=>{}){
  progress({phase:'start',message:'Starting fresh-provider integrity refresh.',current:0,total:null})
  const enriched=await enrichDate(requestedDate,{onProgress:progress,fresh:true})
  const {date,fixtures,rawFixtures,rawCount,upcomingCount,stalePreKickoffSkipped,maturityCandidates,maturityScanned,candidatesAttempted,attemptLimit,candidatePoolExhausted,enrichmentTargetReached,earlySeasonSkipped,standingsUnavailable,statsOddsFallbacks,statsFallbackCapSkipped,unpricedSkipped,shortSplitHistory,enrichmentErrors,freshProviderReads,refreshConcurrency}=enriched
  const matureFixtures=filterMatureFixtures(fixtures)
  progress({phase:'engine',message:`Running family-aware engine on ${matureFixtures.length} coherent-priced mature fixtures.`,current:matureFixtures.length,total:matureFixtures.length})
  const baseBoard=buildBoard(matureFixtures,{date,fixturesScanned:matureFixtures.length,sourceFixtures:rawCount,generatedAt:new Date().toISOString(),earlySeasonPolicy:EARLY_SEASON_POLICY,minimumLeagueGames:MIN_LEAGUE_GAMES,maturityPolicy:EARLY_SEASON_POLICY,minLeagueGames:MIN_LEAGUE_GAMES,splitPolicy:SPLIT_ENGINE_POLICY,splitPrimaryOnly:true,engineIntegrityPolicy:ENGINE_INTEGRITY_POLICY,splitDescription:'Home team uses home-only league stats/form; away team uses away-only league stats/form. Split strength is PPG-first. Overall stats are context only.'})
  const safeBoard=applyWinSafety(baseBoard,matureFixtures)
  let statusFixtures=Array.isArray(rawFixtures)?rawFixtures:[],lifecycleSource='loaded-fixtures'
  try{progress({phase:'lifecycle',message:'Updating live and settled match status.',current:0,total:1});statusFixtures=await getFixturesByDateFresh(date);lifecycleSource='fresh-status'}catch(e){console.warn('Fresh lifecycle status unavailable; using loaded fixture status:',e.message);progress({phase:'lifecycle',message:'Fresh status check unavailable; using already loaded fixture status.',current:1,total:1})}
  const lifecycleMap=buildLifecycleMap(statusFixtures),previous=await loadSnapshotByDate(date).catch(()=>null)
  const compatiblePrevious=previous?.meta?.winSafetyPolicy===WIN_SAFETY_POLICY&&snapshotHasStrictSplitPolicy(previous)&&snapshotHasEngineIntegrityPolicy(previous)?previous:null
  const merged=mergeLifecycleBoard(safeBoard,compatiblePrevious,lifecycleMap)
  const board={...merged,meta:{...merged.meta,stale:false,refreshVersion:VERSION,lifecycleClockPolicy:'kickoff-plus-15m-provider-sanity-v1',refreshPerformancePolicy:'parallel-maturity-and-enrichment-v1',refreshDiagnostics:{sourceFixtures:rawCount,upcomingFixtures:upcomingCount,stalePreKickoffSkipped,maturityScanned,maturityCandidates,candidatesAttempted,attemptLimit,candidatePoolExhausted,enrichmentTargetReached,pricedEnrichedFixtures:matureFixtures.length,earlySeasonSkipped,standingsUnavailable,unpricedSkipped,statsOddsFallbacks,statsFallbackCapSkipped,shortSplitHistory,enrichmentErrors,refreshConcurrency,engineCandidates:baseBoard?.meta?.qualified??0,finalQualified:merged?.meta?.qualified??0,bestPickCount:merged?.bestPicks?.length??0,straightWinsBlocked:safeBoard?.meta?.straightWinsBlocked??0,bottom3TeamResultBlocked:safeBoard?.meta?.bottom3TeamResultBlocked??0,highContradictionBlocked:safeBoard?.meta?.highContradictionBlocked??0,moderateContradictionBlocked:safeBoard?.meta?.moderateContradictionBlocked??0,moderateContradictionDowngraded:safeBoard?.meta?.moderateContradictionDowngraded??0,lastPlaceSampleBlocked:safeBoard?.meta?.lastPlaceSampleBlocked??0,seasonSplitWinFallbacks:safeBoard?.meta?.seasonSplitWinFallbacks??0,lifecycleSource,freshProviderReads,oddsPolicy:'single-bookmaker-coherent-v1',rankingPolicy:'family-diversity-first-v1'}}}
  progress({phase:'save',message:`Saving fresh board with ${board.meta?.qualified||0} qualified picks.`,current:0,total:1});await saveSnapshot(board,date);progress({phase:'save',message:`Fresh board saved with ${board.meta?.qualified||0} qualified picks.`,current:1,total:1});return board
}
async function runRefresh(date,progress){const maxMs=Math.max(60000,Number(process.env.REFRESH_MAX_RUNTIME_MS||12*60*1000));return withDeadline(runRefreshCore(date,progress),maxMs,'Stats2Pitch refresh')}
const refreshJobs=createRefreshJobs(runRefresh,{ttlMs:Number(process.env.REFRESH_JOB_TTL_MS||30*60*1000),staleMs:Number(process.env.REFRESH_JOB_STALE_MS||5*60*1000),store:{claim:claimRefreshJob,save:saveRefreshJob,load:loadRefreshJob}})

const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local')
 if(u.pathname==='/api/health')return json(res,200,{ok:true,brand:'Stats2Pitch.com',version:VERSION,splitPolicy:SPLIT_ENGINE_POLICY,engineIntegrityPolicy:ENGINE_INTEGRITY_POLICY,winSafetyPolicy:WIN_SAFETY_POLICY,refreshMode:'background-job',refreshPersistence:refreshStoreMode(),candidatePolicy:'full-maturity-discovery-priced-enrichment',oddsPolicy:'single-bookmaker-coherent-v1',rankingPolicy:'family-diversity-first-v1',contradictionPolicy:'high-veto-moderate-safer-only',lifecycleClockPolicy:'kickoff-plus-15m-provider-sanity-v1',refreshPerformancePolicy:'parallel-maturity-and-enrichment-v1',liveScores:'api-football-20s-cache',time:new Date().toISOString()})
 if(u.pathname==='/api/config')return json(res,200,{brand:'Stats2Pitch.com',version:VERSION,supabaseUrl:normalizedSupabaseUrl(),supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',allowPublicSignup:String(process.env.ALLOW_PUBLIC_SIGNUP||'true')!=='false'})
 if(u.pathname==='/api/auth/account-status'&&req.method==='POST'){
  if(String(process.env.ALLOW_PUBLIC_SIGNUP||'true')==='false')return json(res,200,{needsAccount:false});const ip=clientIp(req);if(!allowBucket(lookupBuckets,ip,20))return json(res,429,{error:'Too many attempts. Try again later.'})
  try{const body=await readJson(req),email=String(body.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});return json(res,200,{needsAccount:!(await accountExists(email))})}catch(e){console.error('Account status lookup failed:',e.message);return json(res,200,{needsAccount:false})}
 }
 if(u.pathname==='/api/auth/signup'&&req.method==='POST'){
  if(String(process.env.ALLOW_PUBLIC_SIGNUP||'true')==='false')return json(res,403,{error:'Account creation is disabled.'});const ip=clientIp(req);if(!allowBucket(signupBuckets,ip,6))return json(res,429,{error:'Too many account-creation attempts. Try again later.'})
  try{const body=await readJson(req),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters.'});const user=await createConfirmedUser(email,password);return json(res,201,{ok:true,userId:user.id,email:user.email,confirmed:true})}catch(e){const msg=String(e.message||'Signup failed.'),duplicate=/already|registered|exists/i.test(msg);return json(res,duplicate?409:400,{error:duplicate?'An account with this email already exists.':'Account could not be created right now. Please try again.'})}
 }
 if(u.pathname==='/api/me'){const user=await authed(req,res);if(user)return json(res,200,{id:user.id,email:user.email});return}
 if(u.pathname==='/api/live-scores'&&req.method==='GET'){
  if(!await authed(req,res))return
  const date=normalizeDate(u.searchParams.get('date')||''),force=u.searchParams.get('fresh')==='1'
  try{return json(res,200,await getDailyLiveScores(date,{force}))}catch(e){console.error('Live scores failed:',e.message);return json(res,502,{error:'Live scores are temporarily unavailable.'})}
 }
 if(u.pathname==='/api/board'){
  if(!await authed(req,res))return;const date=normalizeDate(u.searchParams.get('date')||''),board=await loadSnapshotByDate(date)
  const staleMeta=reason=>({date:board?.meta?.date||date,generatedAt:board?.meta?.generatedAt||null,sourceFixtures:board?.meta?.sourceFixtures??board?.meta?.fixturesScanned??0,stale:true,...reason})
  if(board&&!snapshotHasStrictMaturityPolicy(board))return json(res,200,emptyMatureBoard(staleMeta({maturityReason:`Saved board predates the ${MIN_LEAGUE_GAMES}-game maturity rule. Refresh real data.`})))
  if(board&&!snapshotHasStrictSplitPolicy(board))return json(res,200,emptyMatureBoard(staleMeta({splitReason:'Saved board predates the strict split-integrity policy. Refresh real data.'})))
  if(board&&!snapshotHasEngineIntegrityPolicy(board))return json(res,200,emptyMatureBoard(staleMeta({integrityReason:'Saved board predates v1.10.0 engine integrity hardening. Refresh real data.'})))
  if(board&&board?.meta?.winSafetyPolicy!==WIN_SAFETY_POLICY)return json(res,200,emptyMatureBoard(staleMeta({safetyReason:'Saved board predates the current win-safety policy. Refresh real data.'})))
  return json(res,200,board||emptyMatureBoard({date,stale:true,noSnapshot:true}))
 }
 if(u.pathname==='/api/refresh-status'&&req.method==='GET'){if(!await authed(req,res))return;const date=normalizeDate(u.searchParams.get('date')||'');return json(res,200,(await refreshJobs.get(date))||{date,status:'idle',progress:null,error:null,board:null})}
 if(u.pathname==='/api/refresh'&&req.method==='POST'){if(!await authed(req,res))return;if(String(process.env.ALLOW_MANUAL_REFRESH||'true')!=='true')return json(res,403,{error:'Manual refresh is disabled.'});const date=normalizeDate(u.searchParams.get('date')||'');return json(res,202,await refreshJobs.start(date))}
 return serve(req,res)
}catch(e){console.error(e);json(res,500,{error:e.message})}})
server.listen(port,()=>console.log(`Stats2Pitch.com v${VERSION} listening on ${port}`))
