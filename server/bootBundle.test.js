import fs from 'node:fs'

const root=new URL('../',import.meta.url)
const read=p=>fs.readFileSync(new URL(p,root),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`boot bundle regression: ${message}`)}

const BUILD='1.14.0'
const index=read('public/index.html')
const boot=read(`public/s2p-boot-v${BUILD}.js`)
const ui=read(`public/s2p-ui-v${BUILD}.js`)
const styles=read(`public/s2p-styles-v${BUILD}.css`)
const cacheReset=read(`public/s2p-cache-reset-v${BUILD}.js`)
const supabase=read('server/supabaseAdmin.js')

/* ---- every asset index.html asks for must actually exist ---- */
const publicDir=new URL('public/',root)
const referenced=[...index.matchAll(/(?:src|href)="\/([^"?]+)/g)].map(m=>m[1])
for(const asset of new Set(referenced)){
  assert(fs.existsSync(new URL(asset,publicDir)),`index.html references /${asset} but the file is not in public/`)
}

/* ---- the page loads exactly one of each layer ---- */
const count=(haystack,needle)=>haystack.split(needle).length-1
assert(count(index,'<link rel="stylesheet"')===1,'index.html must load exactly one stylesheet')
assert(count(index,'rel="stylesheet" href="/s2p-styles-v'+BUILD)===1,'the single stylesheet must be the consolidated bundle')
assert(count(index,'<script src="/')===3,'index.html must load exactly three classic scripts (cache reset, boot bundle, UI bundle)')
assert(index.includes(`/s2p-cache-reset-v${BUILD}.js`),'cache reset must load first, in the head')
assert(index.includes(`/s2p-boot-v${BUILD}.js`),'boot bundle must load')
assert(index.includes(`/s2p-ui-v${BUILD}.js?v=${BUILD}" defer`),'UI bundle must load deferred')
assert(index.includes('<script type="module" src="/app.v1.5.0.js'),'app module must still load')
assert(index.indexOf(`/s2p-boot-v${BUILD}.js`)<index.indexOf('app.v1.5.0.js'),'boot bundle must run before the app module')
assert(index.indexOf('app.v1.5.0.js')<index.indexOf(`/s2p-ui-v${BUILD}.js`),'UI bundle must run after the app module')
assert(index.includes(`dataset.s2pUiBuild='${BUILD}'`),`index must expose UI build ${BUILD}`)
assert(index.includes(`content="${BUILD}"`),'build meta tag must match')

/* ---- retired boot layers must stay gone from disk ---- */
const publicFiles=fs.readdirSync(publicDir)
for(const retired of ['bootstrap-shell-v1.12.3.js','boot-resilience-v1.12.1.js','splash-animation.v1.5.1.js','board-v1.11.0.js']){
  assert(!publicFiles.includes(retired),`retired file ${retired} must not be shipped again`)
  assert(!index.includes(retired),`retired file ${retired} must stay out of index.html`)
}
const stale=publicFiles.filter(f=>(f.endsWith('.js')||f.endsWith('.css'))&&!f.startsWith('s2p-')&&f!=='app.v1.5.0.js')
assert(stale.length===0,`public/ must not accumulate unbundled scripts or styles again: ${stale.join(', ')}`)

/* ---- segments are isolated so one failure cannot stop the rest ---- */
for(const [name,src] of [['boot',boot],['ui',ui]]){
  const segments=count(src,'* segment: ')
  const guards=count(src,'catch(s2pSegmentError)')
  assert(segments>0,`${name} bundle must declare its segments`)
  assert(guards===segments,`${name} bundle: every segment must be wrapped in its own try/catch (${guards} guards for ${segments} segments)`)
}

/* ---- v1.13 deterministic boot behaviour, preserved in the bundle ---- */
assert(boot.includes('bootstrapBoardIssued=false'),'bootstrap board gate must be one-time')
assert(boot.includes("url?.pathname==='/api/board'&&!bootstrapBoardIssued"),'first board request must never depend on DOM timing')
assert(boot.includes('beginRealRead(input,init,key).catch(()=>{})'),'real board read must continue behind the immediate shell response')
assert(ui.includes("section.id='s2p-card-board'"),'loading surface must create the modern board host')
assert(ui.includes("section.dataset.s2pState='loading'"),'loading surface must advertise explicit loading state')
assert(ui.includes("window.dispatchEvent(new Event('s2p:tabchange'))"),'loading surface must wake the production runtime')
assert(ui.includes("window.addEventListener('s2p:tabchange'"),'production runtime must accept the wake event')
assert(ui.indexOf('segment: board-loading-surface')<ui.indexOf('segment: board-runtime'),'the loading surface must run before the board runtime')

/* ---- cascade order inside the stylesheet ---- */
const cssOrder=['styles.v1.5.0.css','ui.v1.6.0.css','board-v1.11.0.css','board-responsive-v1.11.2.css','ui-hard-cut-v1.11.4.css']
for(let i=1;i<cssOrder.length;i++){
  assert(styles.indexOf(`segment: ${cssOrder[i-1]}`)<styles.indexOf(`segment: ${cssOrder[i]}`),`stylesheet cascade order broken: ${cssOrder[i-1]} must come before ${cssOrder[i]}`)
}
assert(!/@import/.test(styles),'the consolidated stylesheet must not reintroduce @import')

/* ---- one-time cache cleanup runs for this build ---- */
assert(cacheReset.includes(`const BUILD='${BUILD}'`),'cache reset must run once for the new build')

/* ---- unchanged startup guarantees ---- */
assert(supabase.includes('fetchWithPolicy'),'Supabase reads must use the bounded fetch policy')
assert(supabase.includes('retries:0'),'startup Supabase reads must not stack retry windows')

console.log(`v${BUILD} consolidated boot/UI bundle checks passed`)
