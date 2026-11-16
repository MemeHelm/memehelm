export class ApiError extends Error{constructor(message:string,public status:number,public code?:string){super(message);this.name='ApiError';}}
let walletScope='guest';
const unresolvedAI=new Map<string,string>();
export function setApiWalletScope(wallet:string){walletScope=wallet.toLowerCase()||'guest';}
const aiPath=(path:string)=>path==='/copilot'||path==='/launch/assist'||path==='/watches/brief'||path==='/assistant/chat'||/^\/projects\/[a-f0-9-]+\/(?:chat|assistant\/plan)$/.test(path);
const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
async function aiIdentityKey(path:string,body:unknown,scope:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable({path,body}))));return `memehelm:4663:pons-v2:${scope}:ai-request:${Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')}`;}
function forgetIdentity(key:string){unresolvedAI.delete(key);try{localStorage.removeItem(key);}catch{}}
export async function resetAIRequest(path:string,body:unknown){const scope=walletScope;forgetIdentity(await aiIdentityKey(path,body,scope));}
export async function api<T>(path:string, body?:unknown,signal?:AbortSignal,timeoutMs=path.endsWith('/operations/run')||path.endsWith('/assistant/plan')?85000:path==='/watches/brief'?80000:path.includes('copilot')||path.endsWith('/brief')||path==='/launch/assist'||path.endsWith('/chat')?65000:20000):Promise<T> {
  const scope=walletScope;
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    let payload=body,identityKey:string|undefined;
    if(body&&typeof body==='object'&&aiPath(path)&&!('requestId' in body)){
      identityKey=await aiIdentityKey(path,body,scope);let id=unresolvedAI.get(identityKey);try{id=id||localStorage.getItem(identityKey)||undefined;}catch{}
      if(!id||!/^[a-f0-9-]{36}$/i.test(id))id=crypto.randomUUID();unresolvedAI.set(identityKey,id);try{localStorage.setItem(identityKey,id);}catch{}
      payload={...body,requestId:id};
    }
    const response=await fetch(`/api${path}`,payload===undefined?{signal:controller.signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const result=await response.json();
    if(identityKey&&!['AI_REQUEST_PENDING','AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED'].includes(result.code))forgetIdentity(identityKey);
    if(!response.ok){if(response.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('memehelm-session-expired'));throw new ApiError(result.error||`Request failed (${response.status}).`,response.status,result.code);}
    return result;
  }catch(error){if(timedOut&&!signal?.aborted)throw new Error('This request took too long. Please try again.');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export function saveFile(name:string, data:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);
}
