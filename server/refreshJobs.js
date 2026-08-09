const nowIso=()=>new Date().toISOString()
const ownerId=()=>globalThis.crypto?.randomUUID?.()||`${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
function publicJob(job){if(!job)return null;return{date:job.date,status:job.status,startedAt:job.startedAt,updatedAt:job.updatedAt,finishedAt:job.finishedAt||null,progress:job.progress||null,error:job.status==='failed'?job.error||'Refresh failed.':null,board:job.status==='complete'?job.board||null:null,persistent:job.persistent===true}}

export function createRefreshJobs(runRefresh,{ttlMs=30*60*1000,staleMs=5*60*1000,store=null}={}){
  if(typeof runRefresh!=='function')throw new Error('Refresh runner is required.')
  const jobs=new Map(),instance=ownerId()
  function clean(){const now=Date.now();for(const[key,job]of jobs){const t=Date.parse(job.finishedAt||job.updatedAt||job.startedAt||'');if(job.status!=='running'&&Number.isFinite(t)&&now-t>ttlMs)jobs.delete(key)}}
  function stale(job){const t=Date.parse(job?.updatedAt||job?.startedAt||'');return job?.status==='running'&&Number.isFinite(t)&&Date.now()-t>staleMs}
  async function persist(job,force=false){if(!store?.save)return;const now=Date.now();if(!force&&job._lastPersist&&now-job._lastPersist<1500)return;job._lastPersist=now;await store.save(job).catch(()=>false)}
  async function get(date){
    clean();const key=String(date||''),local=jobs.get(key);if(local)return publicJob(local)
    if(store?.load){const remote=await store.load(key).catch(()=>null);if(remote){if(stale(remote))return publicJob({...remote,status:'failed',error:'The previous refresh lost its worker heartbeat and can be retried.',finishedAt:nowIso()});return publicJob(remote)}}
    return null
  }
  async function start(date){
    clean();const key=String(date||''),active=jobs.get(key);if(active?.status==='running')return publicJob(active)
    if(store?.claim){const claim=await store.claim(key,instance,Math.ceil(staleMs/1000)).catch(()=>({supported:false,claimed:true}));if(claim?.supported&&!claim.claimed){const remote=await store.load?.(key).catch(()=>null);if(remote)return publicJob(remote)}}
    const stamp=nowIso(),job={date:key,status:'running',ownerId:instance,startedAt:stamp,updatedAt:stamp,finishedAt:null,progress:{phase:'queued',message:'Refresh queued.',current:0,total:null},error:null,board:null,persistent:Boolean(store)}
    jobs.set(key,job);await persist(job,true)
    Promise.resolve().then(async()=>{
      try{const board=await runRefresh(key,progress=>{job.updatedAt=nowIso();job.progress={...(job.progress||{}),...(progress||{})};persist(job,false).catch(()=>{})});job.board=board;job.status='complete';job.updatedAt=nowIso();job.finishedAt=job.updatedAt;job.progress={phase:'complete',message:'Fresh board saved.',current:1,total:1};await persist(job,true)}
      catch(error){console.error('Background refresh failed:',error);job.status='failed';job.error=String(error?.message||error||'Refresh failed.');job.updatedAt=nowIso();job.finishedAt=job.updatedAt;job.progress={phase:'failed',message:'Refresh could not be completed.',current:0,total:1};await persist(job,true)}
    })
    return publicJob(job)
  }
  return{start,get}
}
