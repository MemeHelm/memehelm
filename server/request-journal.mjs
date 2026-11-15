import {createHash} from 'node:crypto';

const fail=(message,status=409,code='AI_REQUEST_CONFLICT')=>Object.assign(new Error(message),{status,code});
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

/** Durable replay protection. An interrupted paid request is never automatically repeated. */
export function createRequestJournal(store,{now=()=>Date.now()}={}){
  const pending=new Map();
  async function execute({owner,scope,requestId,payload},work){
    // Older clients remain compatible; current clients always send a request ID.
    if(requestId===undefined||requestId===null)return work();
    if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId))throw fail('Start a new AI request and try again.',400);
    if(typeof owner!=='string'||!owner||typeof scope!=='string'||!scope)throw fail('Sign in before requesting AI assistance.',401);
    const key=JSON.stringify([owner.toLowerCase(),scope,requestId]),fingerprint=digest(payload);
    const active=pending.get(key);
    if(active){if(active.fingerprint!==fingerprint)throw fail('This request belongs to different text. Start a new request.');return active.promise;}
    let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
    // The caller may not have a second listener; avoid an unhandled rejection on failure.
    promise.catch(()=>{});pending.set(key,{fingerprint,promise});
    try{
      const replay=await store.change('ai_requests',records=>{
        const record=records.find(item=>item.key===key);
        if(record){
          if(record.fingerprint!==fingerprint)throw fail('This request belongs to different text. Start a new request.');
          if(record.status==='completed')return {value:record.result};
          if(record.status==='failed')throw fail(record.error.message,record.error.status,record.error.code);
          const interrupted=record.leaseUntil<=now();
          throw fail(interrupted?'This request was interrupted. Check your saved chats or drafts before starting a new request.':'Your earlier request is still being processed. Check your saved chats or drafts shortly.',409,interrupted?'AI_REQUEST_INTERRUPTED':'AI_REQUEST_PENDING');
        }
        records.push({key,owner:owner.toLowerCase(),scope,requestId,fingerprint,status:'running',createdAt:new Date(now()).toISOString(),leaseUntil:now()+120000});
        return null;
      });
      if(replay){resolve(replay.value);return replay.value;}
      let result;
      try{result=await work();}
      catch(error){
        // Upstream helpers already provide safe messages. Never persist raw provider errors.
        const safe={message:error?.status&&typeof error.message==='string'?error.message:'This AI request could not be completed. Check your saved work before trying again.',status:Number.isSafeInteger(error?.status)?error.status:503,code:typeof error?.code==='string'?error.code:'AI_REQUEST_FAILED'};
        await store.change('ai_requests',records=>{const record=records.find(item=>item.key===key);if(record)Object.assign(record,{status:'failed',error:safe,finishedAt:new Date(now()).toISOString()});});
        throw fail(safe.message,safe.status,safe.code);
      }
      await store.change('ai_requests',records=>{const record=records.find(item=>item.key===key);if(!record)throw fail('Your result could not be recorded. Check your saved work before starting another request.',503);Object.assign(record,{status:'completed',result,finishedAt:new Date(now()).toISOString()});});
      resolve(result);return result;
    }catch(error){reject(error);throw error;}
    finally{pending.delete(key);}
  }
  return {execute};
}
