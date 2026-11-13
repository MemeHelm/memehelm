import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {createManualSocial} from './social-manual.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=value=>createHash('sha256').update(value).digest('hex');
const iso=time=>new Date(time).toISOString();
const SCOPES='tweet.read tweet.write users.read offline.access';
const checkRevision=(item,value)=>{if(!Number.isSafeInteger(value)||value!==item.revision)throw fail('This post changed. Refresh and review the saved version.',409);};
function postText(value){if(typeof value!=='string'||!value.trim()||Array.from(value).length>280)throw fail('Write a post between 1 and 280 characters.');return value.trim();}

export function createXSocial(store,{origin,clientId=process.env.X_CLIENT_ID,clientSecret=process.env.X_CLIENT_SECRET,encryptionKey=process.env.SOCIAL_ENCRYPTION_KEY,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}){
  const redirectUri=new URL('/api/social/x/callback',origin).href,pending=new Map(),locks=new Set();
  const key=Buffer.from(encryptionKey||'','base64');
  const configured=()=>!!clientId&&!!clientSecret&&key.length===32;
  const aad=project=>Buffer.from(`${project.owner}:${project.id}`);
  function seal(project,tokens){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(project));const data=Buffer.concat([cipher.update(JSON.stringify(tokens),'utf8'),cipher.final()]);return[iv,cipher.getAuthTag(),data].map(part=>part.toString('base64')).join('.');}
  function unseal(project,value){try{const [iv,tag,data]=value.split('.').map(part=>Buffer.from(part,'base64')),cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(project));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8'));}catch{throw fail('Reconnect your X account before publishing.',409);}}
  const connection=project=>store.read('social_x').find(item=>item.projectId===project.id&&item.owner===project.owner);
  const records=project=>store.read('social_posts').filter(item=>item.projectId===project.id&&item.owner===project.owner);
  function get(project){const item=connection(project);return{available:configured(),account:item?{id:item.account.id,username:item.account.username,name:item.account.name,connectedAt:item.connectedAt}:null,posts:records(project).map(({owner,projectId,...post})=>post)};}
  function prune(){for(const [state,flow] of pending)if(flow.expiresAt<=now())pending.delete(state);}
  function start(project){
    if(locks.has(project.id))throw fail('Wait for the current X request before changing accounts.',409);
    if(!configured())throw fail('X connection is unavailable right now. You can still open a reviewed draft in X.',503);prune();if(pending.size>=200)throw fail('Account connection is busy. Try again shortly.',429);
    for(const [id,flow] of pending)if(flow.project.id===project.id&&flow.project.owner===project.owner)pending.delete(id);
    const state=randomBytes(32).toString('base64url'),binding=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
    pending.set(digest(state),{project:{id:project.id,owner:project.owner},binding:digest(binding),verifier,expiresAt:now()+600000,status:'pending'});
    const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:SCOPES,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
    return{url:'https://x.com/i/oauth2/authorize?'+params,binding};
  }
  async function request(url,options={}){
    let response;try{response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw fail('X did not confirm the request. Check your X profile before trying anything again.',503);}
    if(!response.ok){await response.body?.cancel();const error=fail(response.status===429?'X is rate limiting requests. Try again later.':response.status===401?'Reconnect your X account before continuing.':response.status===402||response.status===403?'X did not allow this request. Check the account’s access on X.':'X could not complete this request.',response.status===429?429:503);error.definitive=response.status>=400&&response.status<500;error.providerStatus=response.status;throw error;}
    try{const reader=response.body.getReader();let content='',size=0;const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>64000)throw new Error();content+=decoder.decode(value,{stream:true});}content+=decoder.decode();return JSON.parse(content);}finally{await reader.cancel().catch(()=>{});}}catch{throw fail('X returned an unreadable response. Check your profile before publishing again.',503);}
  }
  const tokenRequest=values=>request('https://api.x.com/2/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic '+Buffer.from(`${clientId}:${clientSecret}`).toString('base64')},body:new URLSearchParams(values).toString()});
  function tokensFrom(data,previous){if(typeof data.access_token!=='string'||data.access_token.length>4096||!Number.isFinite(data.expires_in)||data.expires_in<1)throw fail('X account connection could not be completed.',503);if(data.scope&&!SCOPES.split(' ').every(scope=>data.scope.split(' ').includes(scope)))throw fail('X did not grant the requested account permissions.',503);return{access:data.access_token,refresh:data.refresh_token||previous?.refresh||null,expiresAt:now()+data.expires_in*1000};}
  async function callback(params,binding){
    prune();const state=params.get('state')||'',flow=pending.get(digest(state));
    if(!flow||flow.status!=='pending'||!binding||flow.binding!==digest(binding))throw fail('X connection expired. Start again from your project.',409);
    flow.status='exchanging';
    try{if(params.get('error')||!params.get('code')||params.get('code').length>2048)throw fail('X connection was cancelled.');
      const tokens=tokensFrom(await tokenRequest({grant_type:'authorization_code',code:params.get('code'),redirect_uri:redirectUri,code_verifier:flow.verifier}));
      const result=await request('https://api.x.com/2/users/me',{headers:{authorization:`Bearer ${tokens.access}`}}),account=result.data;
      if(!/^\d{1,30}$/.test(account?.id)||!/^\w{1,15}$/.test(account?.username))throw fail('X account details could not be verified.',503);
      flow.sealed=seal(flow.project,tokens);flow.account={id:account.id,username:account.username,name:String(account.name||account.username).slice(0,100)};flow.status='ready';delete flow.verifier;return{projectId:flow.project.id,ok:true};
    }catch{pending.delete(digest(state));return{projectId:flow.project.id,ok:false};}
  }
  async function finish(project,binding){if(locks.has(project.id))throw fail('Wait for the current X request before changing accounts.',409);prune();const pair=[...pending].find(([,flow])=>binding&&flow.binding===digest(binding)&&flow.project.id===project.id&&flow.project.owner===project.owner&&flow.status==='ready');if(!pair)throw fail('Sign in with the wallet that started this X connection, or connect again.',409);const [id,flow]=pair;
    await store.change('social_x',list=>{const index=list.findIndex(item=>item.projectId===project.id&&item.owner===project.owner);const item={projectId:project.id,owner:project.owner,account:flow.account,sealed:flow.sealed,connectedAt:iso(now()),generation:randomUUID()};if(index<0)list.push(item);else list[index]=item;});pending.delete(id);return get(project);
  }
  async function disconnect(project){if(locks.has(project.id))throw fail('Wait for the current X request to finish before disconnecting.',409);for(const [id,flow] of pending)if(flow.project.id===project.id&&flow.project.owner===project.owner)pending.delete(id);await store.change('social_x',list=>{const index=list.findIndex(item=>item.projectId===project.id&&item.owner===project.owner);if(index>=0)list.splice(index,1);});return get(project);}
  async function access(project,item){let tokens=unseal(project,item.sealed);if(tokens.expiresAt<=now()+30000){if(!tokens.refresh)throw fail('Reconnect your X account before continuing.',409);tokens=tokensFrom(await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh}),tokens);await store.change('social_x',list=>{const current=list.find(value=>value.projectId===project.id&&value.owner===project.owner);if(!current||current.generation!==item.generation)throw fail('X connection changed. Reconnect and review again.',409);current.sealed=seal(project,tokens);});}return tokens.access;}
  async function save(project,id,input){await store.change('social_posts',list=>{
    if(!id){if(records(project).length>=100)throw fail('This project supports up to 100 saved X posts.');let content=input.text;if(input.sourceActivityId){const source=store.read('activity').find(item=>item.id===input.sourceActivityId&&item.projectId===project.id&&item.kind==='post');if(!source)throw fail('Saved social draft not found.',404);content=source.content;}list.unshift({id:randomUUID(),projectId:project.id,owner:project.owner,text:postText(content),status:'draft',revision:0,createdAt:iso(now())});return;}
    const post=list.find(item=>item.id===id&&item.projectId===project.id&&item.owner===project.owner);if(!post)throw fail('Post not found.',404);checkRevision(post,input.revision);
    if(!['draft','approved','failed'].includes(post.status))throw fail('This post can no longer be edited or approved.');
    if(input.action==='edit'){post.text=postText(input.text);post.status='draft';delete post.approvedAccount;delete post.error;}
    else if(input.action==='approve'){const item=connection(project);if(!configured()||!item)throw fail('Connect an X account before approving an API post.');post.status='approved';post.approvedAccount=item.account.id;post.approvedGeneration=item.generation;delete post.error;}
    else throw fail('Choose an available post action.');post.revision++;post.updatedAt=iso(now());
  });return get(project);}
  async function publish(project,id,input){
    if(input.confirm!==true)throw fail('Confirm the exact post and X account before publishing.');if(!configured())throw fail('X publishing is temporarily unavailable.',503);if(locks.has(project.id))throw fail('An X request is already running for this project.',409);locks.add(project.id);
    let started=false,sent=false;
    try{const item=connection(project);if(!item)throw fail('Connect your X account first.');
      let post;await store.change('social_posts',list=>{post=list.find(value=>value.id===id&&value.projectId===project.id&&value.owner===project.owner);if(!post)throw fail('Post not found.',404);checkRevision(post,input.revision);if(post.status!=='approved'||post.approvedAccount!==item.account.id||post.approvedGeneration!==item.generation)throw fail('Review and approve this post for the connected X account.');post.status='sending';post.revision++;post.startedAt=iso(now());started=true;});
      const token=await access(project,item);sent=true;
      const result=await request('https://api.x.com/2/tweets',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({text:post.text})});
      if(!/^\d{1,30}$/.test(result.data?.id))throw fail('X did not return a post receipt. Check your profile before posting again.',503);
      await store.change('social_posts',list=>{const current=list.find(value=>value.id===id);Object.assign(current,{status:'published',receipt:{id:result.data.id,url:`https://x.com/${item.account.username}/status/${result.data.id}`,username:item.account.username,accountId:item.account.id},publishedAt:iso(now()),revision:current.revision+1});});
    }catch(error){if(started)await store.change('social_posts',list=>{const post=list.find(value=>value.id===id);if(post?.status==='sending'){post.status=sent&&!error.definitive?'uncertain':'failed';post.error=post.status==='uncertain'?'Delivery is unconfirmed. Check your X profile. This post will not be sent again automatically.':error.message;post.revision++;}});throw error;}finally{locks.delete(project.id);}return get(project);
  }
  async function metrics(project,id){if(locks.has(project.id))throw fail('An X request is already running.',409);locks.add(project.id);try{const post=records(project).find(item=>item.id===id),item=connection(project);if(post?.status!=='published'||!item||post.receipt.accountId!==item.account.id)throw fail('Connect the account that published this post.');const token=await access(project,item),result=await request(`https://api.x.com/2/tweets/${post.receipt.id}?tweet.fields=public_metrics,author_id`,{headers:{authorization:`Bearer ${token}`}});if(result.data?.id!==post.receipt.id||result.data?.author_id!==item.account.id||!result.data.public_metrics)throw fail('X post results could not be verified.',503);const values=Object.fromEntries(['like_count','reply_count','retweet_count','quote_count'].map(name=>{const value=result.data.public_metrics[name];if(!Number.isSafeInteger(value)||value<0)throw fail('X post results were incomplete.',503);return[name,value];}));await store.change('social_posts',list=>{const current=list.find(value=>value.id===id);current.metrics={...values,checkedAt:iso(now())};});return get(project);}finally{locks.delete(project.id);}}
  const manual=createManualSocial(store,{now,records,locked:id=>locks.has(id),checkRevision,get});
  function context(project){return records(project).filter(post=>post.status==='published'||post.status==='recorded').slice(0,8).map(post=>{
    const target=post.manualPublication||post.receipt;
    return{text:post.text,textSource:'saved draft; published text not checked',publishedAt:post.manualPublication?target.publishedAt:post.publishedAt,recordedAt:target.recordedAt||null,url:target.url,publicationSource:post.manualPublication?'creator':'X API receipt',publicationVerified:!post.manualPublication,publicMetrics:post.metrics||null,creatorReportedResults:(post.manualReports||[]).filter(item=>item.postId===(target.postId||target.id)).slice(0,5)};
  });}
  return{get,start,callback,finish,disconnect,save,publish,metrics,context,...manual};
}
