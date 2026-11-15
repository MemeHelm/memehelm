const fail=message=>Object.assign(new Error(message),{status:400});
function integer(value,fallback,min,max,label){
  if(value===undefined||value===null)return fallback;
  if(typeof value==='string'&&!/^\d+$/.test(value))throw fail(`Choose a valid ${label}.`);
  const result=Number(value);if(!Number.isSafeInteger(result)||result<min||result>max)throw fail(`Choose a valid ${label}.`);return result;
}

/** Page the owner's stored history; pagination never changes or truncates storage. */
export function chatPage(chat,{before,limit}={}){
  const messages=Array.isArray(chat.messages)?chat.messages:[],size=integer(limit,40,1,100,'message page size');
  const end=Math.min(messages.length,integer(before,messages.length,0,Number.MAX_SAFE_INTEGER,'message position')),start=Math.max(0,end-size);
  return {id:chat.id,messages:messages.slice(start,end),createdAt:chat.createdAt,updatedAt:chat.updatedAt,totalMessages:messages.length,hasMore:start>0,before:start>0?start:null};
}

export function chatListPage(summaries,{offset,limit}={}){
  const start=integer(offset,0,0,Number.MAX_SAFE_INTEGER,'conversation position'),size=integer(limit,20,1,50,'conversation page size'),items=summaries.slice(start,start+size),next=start+items.length;
  return {items,hasMore:next<summaries.length,nextOffset:next<summaries.length?next:null,total:summaries.length};
}
