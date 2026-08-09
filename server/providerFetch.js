const sleep=ms=>new Promise(r=>setTimeout(r,ms))

function retryAfterMs(response){
  const raw=response?.headers?.get?.('retry-after')
  if(!raw)return null
  const sec=Number(raw)
  if(Number.isFinite(sec))return Math.max(0,sec*1000)
  const date=Date.parse(raw)
  return Number.isFinite(date)?Math.max(0,date-Date.now()):null
}

export async function fetchWithPolicy(url,options={},policy={}){
  const timeoutMs=Math.max(1000,Number(policy.timeoutMs||15000))
  const retries=Math.max(0,Number(policy.retries??2))
  const retryStatuses=new Set(policy.retryStatuses||[429,500,502,503,504])
  let lastError=null

  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(new Error(`Provider request timed out after ${timeoutMs}ms`)),timeoutMs)
    try{
      const response=await fetch(url,{...options,signal:controller.signal})
      clearTimeout(timer)
      if(!retryStatuses.has(response.status)||attempt===retries)return response
      const wait=retryAfterMs(response)??Math.min(8000,500*(2**attempt))
      await sleep(wait)
      continue
    }catch(error){
      clearTimeout(timer)
      lastError=error
      if(attempt===retries)throw error
      await sleep(Math.min(8000,500*(2**attempt)))
    }
  }
  throw lastError||new Error('Provider request failed')
}

export async function withDeadline(promise,ms,label='Operation'){
  const timeout=Math.max(1000,Number(ms||0))
  let timer
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} exceeded ${timeout}ms deadline`)),timeout)})
    ])
  }finally{clearTimeout(timer)}
}
