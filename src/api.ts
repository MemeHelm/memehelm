export class ApiError extends Error{constructor(message:string,public status:number,public code?:string){super(message);this.name='ApiError';}}
export async function api<T>(path:string, body?:unknown,signal?:AbortSignal,timeoutMs=path.endsWith('/operations/run')?85000:path==='/watches/brief'?80000:path.includes('copilot')||path.endsWith('/brief')?65000:20000):Promise<T> {
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    const response=await fetch(`/api${path}`,body===undefined?{signal:controller.signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const result=await response.json();
    if(!response.ok){if(response.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('memehelm-session-expired'));throw new ApiError(result.error||`Request failed (${response.status}).`,response.status,result.code);}
    return result;
  }catch(error){if(timedOut&&!signal?.aborted)throw new Error('This request took too long. Please try again.');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export function saveFile(name:string, data:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);
}
