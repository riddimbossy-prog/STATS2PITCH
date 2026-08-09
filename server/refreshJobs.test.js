import { createRefreshJobs } from './refreshJobs.js'

let calls=0
let release
const blocker=new Promise(resolve=>{release=resolve})
const jobs=createRefreshJobs(async(date,progress)=>{
  calls++
  progress({phase:'testing',message:'Testing background refresh.',current:1,total:2})
  await blocker
  return{meta:{date},groups:{single:[],two:[],threePlus:[]},priority:[]}
},{ttlMs:60_000})

const first=jobs.start('2026-08-09')
const duplicate=jobs.start('2026-08-09')
if(first.status!=='running'||duplicate.status!=='running')throw new Error('Refresh did not start in running state')
await Promise.resolve()
if(calls!==1)throw new Error(`Duplicate refresh was not deduplicated; runner called ${calls} times`)
const mid=jobs.get('2026-08-09')
if(mid?.progress?.phase!=='testing')throw new Error('Refresh progress was not retained')
release()
await new Promise(resolve=>setTimeout(resolve,0))
const done=jobs.get('2026-08-09')
if(done?.status!=='complete')throw new Error(`Refresh did not complete: ${done?.status}`)
if(done?.board?.meta?.date!=='2026-08-09')throw new Error('Completed refresh did not expose the saved board')
console.log(JSON.stringify({ok:true,status:done.status,calls},null,2))
