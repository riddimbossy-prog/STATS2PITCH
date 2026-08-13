export async function fetchJson(url,options={},timeoutMs=15000){
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{
    const res=await fetch(url,{...options,signal:controller.signal})
    const body=await res.json().catch(()=>null)
    if(!res.ok)throw new Error(`${res.status} ${res.statusText}`)
    return body
  }finally{clearTimeout(timer)}
}
