import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {resolve,sep} from 'node:path';
import {publicClient} from '../server/chain.mjs';
import {pons} from '../server/pons.mjs';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';

const token='0x1111111111111111111111111111111111111111',vault='0x2222222222222222222222222222222222222222',eoa='0x3333333333333333333333333333333333333333';
async function fixture(run){
  const base=resolve('qa');await mkdir(base,{recursive:true});const directory=await mkdtemp(resolve(base,'audit-api-'));
  const savedEnv={...process.env},originalFetch=globalThis.fetch,savedClient={getChainId:publicClient.getChainId,getCode:publicClient.getCode,readContract:publicClient.readContract},savedPons={launchRecord:pons.launchRecord,verifyVault:pons.verifyVault};
  let server,calls=0,providerGate=null;const seenVaults=[];
  try{
    Object.assign(process.env,{DATA_DIRECTORY:directory,AI_API_BASE:'https://audit-model.example/v1',AI_API_KEY:'isolated-fixture-key',AI_MODEL:'fixture-model'});
    publicClient.getChainId=async()=>4663;
    publicClient.getCode=async({address})=>address.toLowerCase()===eoa?'0x':'0x6000';
    publicClient.readContract=async({functionName})=>({name:'Orbit Club',symbol:'ORBIT',decimals:18,totalSupply:1000000n})[functionName];
    pons.launchRecord=async()=>({creatorFeeRecipient:vault,deployer:testWallet(241).address,curve:token});
    pons.verifyVault=async(address,owner)=>{seenVaults.push({address,owner});if(address.toLowerCase()!==vault||owner.toLowerCase()!==testWallet(241).address.toLowerCase())throw Object.assign(new Error('This wallet does not control the token fee vault.'),{status:400});return {kind:'split'};};
    globalThis.fetch=async(input,options)=>{
      const url=String(input);
      if(url.startsWith('https://audit-model.example/')){
        calls++;if(providerGate)await providerGate;
        const prompt=JSON.parse(options.body).messages[1].content;
        return Response.json({choices:[{message:{content:prompt.includes('postText')?JSON.stringify({postText:'Share one useful thing you built this week.',factualBasis:'Private explanation from the supplied community goal.'}):'Observed facts: this project has no linked token.'}}]});
      }
      if(/^http:\/\/127\.0\.0\.1:\d+\//.test(url))return originalFetch(input,options);
      throw new Error('This isolated test does not allow external requests.');
    };
    ({server}=await import(`../server/index.mjs?audit-recovery=${randomUUID()}`));server.listen(0,'127.0.0.1');await once(server,'listening');
    const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(241),originalFetch),bob=await signedClient(endpoint,testWallet(242),originalFetch),store=createWorkspaceStore(directory);
    await run({alice,bob,store,endpoint,originalFetch,seenVaults,calls:()=>calls,holdProvider:()=>{let release;providerGate=new Promise(resolve=>{release=resolve;});return()=>{providerGate=null;release();};}});
  }finally{
    if(server){server.close();server.closeAllConnections();}
    Object.assign(publicClient,savedClient);Object.assign(pons,savedPons);globalThis.fetch=originalFetch;process.env=savedEnv;
    assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});
  }
}
const draft=async alice=>{const response=await alice.post('/projects',{name:'Orbit Club',symbol:'ORBIT',description:'An isolated community fixture.'});assert.equal(response.status,201);return response.json();};

test('authenticated chat and writing retries replay one paid request and one saved result',()=>fixture(async({alice,bob,store,calls})=>{
  const project=await draft(alice),chatPath=`/projects/${project.id}/chat`,chatInput={requestId:randomUUID(),content:'What do you observe?'};
  const firstResponse=await alice.post(chatPath,chatInput);assert.equal(firstResponse.status,200);const first=await firstResponse.json();
  const repeated=await alice.post(chatPath,chatInput);assert.equal(repeated.status,200);assert.deepEqual(await repeated.json(),first);assert.equal(calls(),1);
  assert.equal(store.read('chats').length,1);assert.equal(store.read('chats')[0].messages.length,2);assert.equal(store.read('operations')[0].usage.length,1);
  assert.equal((await bob.post(chatPath,chatInput)).status,404);assert.equal((await alice.post(chatPath,{...chatInput,content:'A different question'})).status,409);assert.equal(calls(),1);
  const writing={requestId:randomUUID(),projectId:project.id,task:'post'},response=await alice.post('/copilot',writing);assert.equal(response.status,200);const generated=await response.json();
  assert.equal((await bob.post('/copilot',writing)).status,404);
  const replay=await alice.post('/copilot',writing);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),generated);assert.equal(calls(),2);
  assert.equal(store.read('activity').length,1);assert.equal(store.read('operations')[0].usage.length,2);assert.equal(generated.content,'Share one useful thing you built this week.');assert.match(generated.factualBasis,/Private explanation/);
  assert.equal(store.read('activity')[0].content,generated.content);assert.equal(store.read('activity')[0].factualBasis,generated.factualBasis);
  // Public response projection is checked with isolated seeded publication, without a chain write.
  await store.mutateProjects(records=>Object.assign(records[0],{published:true,tokenAddress:token}));await store.change('activity',records=>{records[0].public=true;});
  const published=await(await alice.get(`/public/projects/${project.id}`)).json();assert.equal(published.activity[0].content,generated.content);assert.equal(published.activity[0].factualBasis,undefined);assert.ok(!JSON.stringify(published).includes(generated.factualBasis));
}));

test('concurrent authenticated copies share one running chat without duplicate allowance or messages',()=>fixture(async({alice,store,calls,holdProvider})=>{
  const project=await draft(alice),input={requestId:randomUUID(),content:'One question, two interrupted tabs.'},release=holdProvider();
  const first=alice.post(`/projects/${project.id}/chat`,input);
  for(let tries=0;tries<50&&calls()===0;tries++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(calls(),1);
  const second=alice.post(`/projects/${project.id}/chat`,input);await new Promise(resolve=>setTimeout(resolve,10));release();
  const results=await Promise.all([first,second]);assert.deepEqual(results.map(item=>item.status),[200,200]);assert.deepEqual(await results[0].json(),await results[1].json());assert.equal(calls(),1);assert.equal(store.read('chats')[0].messages.length,2);assert.equal(store.read('operations')[0].usage.length,1);
}));

test('chat deletion removes replay payloads without resurrecting or charging, and rejects an in-flight turn',()=>fixture(async({alice,store,calls,holdProvider})=>{
  const project=await draft(alice),path=`/projects/${project.id}`,input={requestId:randomUUID(),content:'A question I will delete.'};
  const first=await alice.post(path+'/chat',input);assert.equal(first.status,200);const original=await first.json();assert.equal(calls(),1);
  const removed=await alice.post(path+'/chats/remove',{chatId:original.chatId});assert.equal(removed.status,200);assert.equal(store.read('chats').length,0);
  const tombstone=store.read('ai_requests').find(item=>item.requestId===input.requestId);assert.equal(tombstone.status,'failed');assert.equal(tombstone.error.code,'CHAT_DELETED');assert.equal(tombstone.result,undefined);assert.equal(typeof tombstone.fingerprint,'string');
  const repeated=await alice.post(path+'/chat',input);assert.equal(repeated.status,410);assert.equal((await repeated.json()).code,'CHAT_DELETED');assert.equal(store.read('chats').length,0);assert.equal(calls(),1);
  const created=await alice.post(path+'/chat',{requestId:randomUUID(),content:'A fresh conversation.'});assert.equal(created.status,200);const current=await created.json();assert.equal(calls(),2);
  const release=holdProvider(),pending=alice.post(path+'/chat',{requestId:randomUUID(),chatId:current.chatId,content:'An answer still being written.'});
  for(let tries=0;tries<50&&calls()<3;tries++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(calls(),3);
  try{const denied=await alice.post(path+'/chats/remove',{chatId:current.chatId});assert.equal(denied.status,409);assert.ok(store.read('chats').some(item=>item.id===current.chatId));}
  finally{release();}
  const finished=await pending;assert.equal(finished.status,200);assert.equal(store.read('chats').find(item=>item.id===current.chatId).messages.length,4);assert.equal(calls(),3);
}));

test('authenticated pagination and full export retain conversations beyond previous silent limits',()=>fixture(async({alice,bob,store,calls})=>{
  const project=await draft(alice),owner=alice.account.address.toLowerCase(),createdAt=new Date().toISOString();
  const seeded=Array.from({length:25},(_,index)=>({id:randomUUID(),projectId:project.id,owner,createdAt,updatedAt:new Date(Date.now()-index*1000).toISOString(),messages:Array.from({length:index===0?85:2},(_,turn)=>({role:turn%2?'assistant':'user',content:`Conversation ${index} message ${turn}`,createdAt}))}));
  await store.change('chats',records=>records.push(...seeded));
  const first=await(await alice.get(`/projects/${project.id}/chats`)).json();assert.equal(first.items.length,20);assert.equal(first.hasMore,true);assert.equal(first.nextOffset,20);
  const second=await(await alice.get(`/projects/${project.id}/chats?offset=${first.nextOffset}`)).json();assert.equal(second.items.length,5);assert.equal(second.hasMore,false);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,25);
  const path=`/projects/${project.id}/chats/${seeded[0].id}`,latest=await(await alice.get(path)).json(),middle=await(await alice.get(path+`?before=${latest.before}`)).json(),oldest=await(await alice.get(path+`?before=${middle.before}`)).json();
  assert.equal(latest.messages.length,40);assert.equal(latest.totalMessages,85);assert.deepEqual([...oldest.messages,...middle.messages,...latest.messages],seeded[0].messages);
  const exported=await(await alice.get(path+'/export')).json();assert.equal(exported.messages.length,85);assert.equal((await bob.get(path+'/export')).status,404);assert.equal((await bob.get(path)).status,404);
  const reply=await alice.post(`/projects/${project.id}/chat`,{requestId:randomUUID(),chatId:seeded[0].id,content:'One more question.'});assert.equal(reply.status,200);assert.equal((await reply.json()).totalMessages,87);assert.equal(store.read('chats').find(item=>item.id===seeded[0].id).messages.length,87);
  const newConversation=await alice.post(`/projects/${project.id}/chat`,{requestId:randomUUID(),content:'A new conversation beyond 25.'});assert.equal(newConversation.status,200);assert.equal(store.read('chats').length,26);assert.equal(calls(),2);
}));

test('token imports reject EOAs and restored vault links use the verified actual fee recipient and owner',()=>fixture(async({alice,bob,store,seenVaults,calls})=>{
  const rejected=await alice.post('/projects',{name:'Orbit Club',symbol:'ORBIT',tokenAddress:eoa});assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/No token contract/);assert.equal((await store.projects()).length,0);
  const imported=await alice.post('/projects',{name:'Orbit Club',symbol:'ORBIT',tokenAddress:token});assert.equal(imported.status,201);const project=await imported.json();assert.equal(project.vaultAddress,null);
  const path=`/projects/${project.id}/vault-link`;
  assert.equal((await bob.post(path,{confirm:true})).status,404);assert.equal(seenVaults.length,0);
  assert.equal((await alice.post(path,{confirm:false})).status,400);assert.equal(seenVaults.length,0);
  const linked=await alice.post(path,{confirm:true,vaultAddress:eoa});assert.equal(linked.status,200);assert.equal((await linked.json()).vaultAddress,vault);
  assert.deepEqual(seenVaults,[{address:vault,owner:alice.account.address.toLowerCase()}]);assert.equal((await store.projects())[0].vaultAddress,vault);
  const trackedByBob=await bob.post('/projects',{name:'Orbit Club',symbol:'ORBIT',tokenAddress:token});assert.equal(trackedByBob.status,201);const bobProject=await trackedByBob.json();
  const denied=await bob.post(`/projects/${bobProject.id}/vault-link`,{confirm:true});assert.equal(denied.status,400);assert.match((await denied.json()).error,/does not control/);assert.equal((await store.projects()).find(item=>item.id===bobProject.id).vaultAddress,null);
  assert.deepEqual(seenVaults[1],{address:vault,owner:bob.account.address.toLowerCase()});assert.equal(calls(),0);
}));
