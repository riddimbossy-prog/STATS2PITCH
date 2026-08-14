const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))

function retryAfterMs(res,attempt,baseDelay){
  const raw=res.headers.get('retry-after')
  if(raw){
    const seconds=Number(raw)
    if(Number.isFinite(seconds)&&seconds>=0)return Math.max(1000,seconds*1000)
    const at=Date.parse(raw)
    if(Number.isFinite(at))return Math.max(1000,at-Date.now())
  }
  return Math.min(60000,baseDelay*(2**attempt))
}

export async function fetchJson(url,options={},timeoutMs=15000,retryOptions={}){
  const retries=Math.max(0,Number(retryOptions.retries??process.env.HTTP_RETRIES??5))
  const baseDelay=Math.max(500,Number(retryOptions.baseDelayMs??process.env.HTTP_RETRY_BASE_MS??2000))
  let lastError=null
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(),timeoutMs)
    try{
      const res=await fetch(url,{...options,signal:controller.signal})
      const body=await res.json().catch(()=>null)
      if(res.ok)return body
      const error=new Error(`${res.status} ${res.statusText}`)
      error.status=res.status
      error.body=body
      lastError=error
      if((res.status===429||res.status>=500)&&attempt<retries){
        const delay=retryAfterMs(res,attempt,baseDelay)+Math.floor(Math.random()*400)
        console.warn(`HTTP ${res.status}; retrying in ${delay}ms (${attempt+1}/${retries})`)
        await sleep(delay)
        continue
      }
      throw error
    }catch(error){
      lastError=error
      const retryable=error?.name==='AbortError'||error?.status===429||Number(error?.status)>=500
      if(retryable&&attempt<retries){
        const delay=Math.min(60000,baseDelay*(2**attempt))+Math.floor(Math.random()*400)
        console.warn(`${error?.message||'Request failed'}; retrying in ${delay}ms (${attempt+1}/${retries})`)
        await sleep(delay)
        continue
      }
      throw error
    }finally{clearTimeout(timer)}
  }
  throw lastError||new Error('Request failed')
}
