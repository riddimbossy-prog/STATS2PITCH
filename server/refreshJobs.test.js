import { createRefreshJobs } from './refreshJobs.js'

const remote=new Map()
const store={
  async claim(date,owner){const current=remote.get(date);if(current?.status==='running')return{supported:true,claimed:false};remote.set(date,{date,status:'running',ownerId:owner,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),progress:{phase:'queued'}});return{supported:true,claimed:true}},
  async save(job){remote.set(job.date,{...job,board:null,persistent:true});return true},
  async load(date){return remote.get(date)||null}
}

let calls=0,release
const blocker=new Promise(resolve=>{release=resolve})
const runner=async(date,progress)=>{calls++;progress({phase:'testing',message:'Testing background refresh.',current:1,total:2});await blocker;return{meta:{date},groups:{single:[],two:[],threePlus:[]},priority:[],bestPicks:[]}}
const jobs=createRefreshJobs(runner,{ttlMs:60_000,store})
const first=await jobs.start('2026-08-09')
const duplicate=await jobs.start('2026-08-09')
if(first.status!=='running'||duplicate.status!=='running')throw new Error('Refresh did not start in running state')
await Promise.resolve()
if(calls!==1)throw new Error(`Duplicate local refresh was not deduplicated; runner called ${calls} times`)
await new Promise(resolve=>setTimeout(resolve,5))
const mid=await jobs.get('2026-08-09')
if(mid?.progress?.phase!=='testing')throw new Error('Refresh progress was not retained')

const secondInstance=createRefreshJobs(async()=>{throw new Error('Second instance must not run an already claimed refresh')},{ttlMs:60_000,store})
const observed=await secondInstance.start('2026-08-09')
if(observed.status!=='running')throw new Error('Second instance did not observe persistent running job')
release()
await new Promise(resolve=>setTimeout(resolve,15))
const done=await jobs.get('2026-08-09')
if(done?.status!=='complete'||done?.board?.meta?.date!=='2026-08-09')throw new Error(`Refresh did not complete correctly: ${done?.status}`)
if(remote.get('2026-08-09')?.status!=='complete')throw new Error('Completed refresh state was not persisted')
console.log(JSON.stringify({ok:true,status:done.status,calls,persistent:remote.get('2026-08-09')?.status},null,2))
