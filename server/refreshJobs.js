const nowIso=()=>new Date().toISOString()

function publicJob(job){
  if(!job)return null
  return{
    date:job.date,
    status:job.status,
    startedAt:job.startedAt,
    updatedAt:job.updatedAt,
    finishedAt:job.finishedAt||null,
    progress:job.progress||null,
    error:job.status==='failed'?job.error||'Refresh failed.':null,
    board:job.status==='complete'?job.board||null:null
  }
}

export function createRefreshJobs(runRefresh,{ttlMs=30*60*1000}={}){
  if(typeof runRefresh!=='function')throw new Error('Refresh runner is required.')
  const jobs=new Map()

  function clean(){
    const now=Date.now()
    for(const [key,job] of jobs){
      const t=Date.parse(job.finishedAt||job.updatedAt||job.startedAt||'')
      if(job.status!=='running'&&Number.isFinite(t)&&now-t>ttlMs)jobs.delete(key)
    }
  }

  function get(date){
    clean()
    return publicJob(jobs.get(String(date||'')))
  }

  function start(date){
    clean()
    const key=String(date||'')
    const active=jobs.get(key)
    if(active?.status==='running')return publicJob(active)

    const stamp=nowIso()
    const job={
      date:key,
      status:'running',
      startedAt:stamp,
      updatedAt:stamp,
      finishedAt:null,
      progress:{phase:'queued',message:'Refresh queued.',current:0,total:null},
      error:null,
      board:null
    }
    jobs.set(key,job)

    Promise.resolve().then(async()=>{
      try{
        const board=await runRefresh(key,progress=>{
          job.updatedAt=nowIso()
          job.progress={...(job.progress||{}),...(progress||{})}
        })
        job.board=board
        job.status='complete'
        job.updatedAt=nowIso()
        job.finishedAt=job.updatedAt
        job.progress={phase:'complete',message:'Fresh board saved.',current:1,total:1}
      }catch(error){
        console.error('Background refresh failed:',error)
        job.status='failed'
        job.error=String(error?.message||error||'Refresh failed.')
        job.updatedAt=nowIso()
        job.finishedAt=job.updatedAt
        job.progress={phase:'failed',message:'Refresh could not be completed.',current:0,total:1}
      }
    })

    return publicJob(job)
  }

  return{start,get}
}
