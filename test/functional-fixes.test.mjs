import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {resolve,sep} from 'node:path';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createMonitor} from '../server/monitor.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';

async function withWorkspace(run){
  await mkdir('qa',{recursive:true});
  const directory=await mkdtemp(resolve('qa','functional-fixes-')),environment={...process.env},originalFetch=globalThis.fetch;
  let server;
  try{
    process.env.DATA_DIRECTORY=directory;
    ({server}=await import(`../server/index.mjs?fixes=${Date.now()}-${Math.random()}`));
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const endpoint=`http://127.0.0.1:${server.address().port}`;
    const alice=await signedClient(endpoint,testWallet(10),originalFetch),bob=await signedClient(endpoint,testWallet(11),originalFetch);
    await run({alice,bob,endpoint,store:createWorkspaceStore(directory),originalFetch});
  }finally{
    if(server){server.close();server.closeAllConnections();}
    globalThis.fetch=originalFetch;process.env=environment;
    if(!resolve(directory).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');
    await rm(directory,{recursive:true,force:true});
  }
}

test('a pre-launch split saves and restores as draft configuration without a verified token link',()=>withWorkspace(async({alice,bob})=>{
  const vault='0x1111111111111111111111111111111111111111';
  const draft={name:'Orbit Club',symbol:'ORBIT',splitEnabled:true,vaultAddress:vault,creatorFeeRecipient:vault,projectTreasury:alice.account.address,auditTreasury:bob.account.address,auditBps:1000,creatorTaxBps:100,configId:0};
  const response=await alice.post('/projects',{...draft,draft});assert.equal(response.status,201);
  const project=await response.json();assert.equal(project.status,'draft');assert.equal(project.tokenAddress,null);assert.equal(project.vaultAddress,null);assert.equal(project.launchHash,null);
  assert.equal(project.draft.vaultAddress,vault);assert.equal(project.draft.creatorFeeRecipient,vault);assert.equal(project.draft.splitEnabled,true);
  const restored=(await (await alice.get('/projects')).json())[0];assert.deepEqual(restored.draft,project.draft);
  assert.deepEqual(await (await bob.get('/projects')).json(),[]);
  assert.equal((await bob.post('/projects',{...draft,draft,draftId:project.id})).status,404);
  assert.equal((await alice.post('/projects',{name:'Bad vault',symbol:'BAD',vaultAddress:vault})).status,400);
  assert.equal((await alice.post('/projects',{name:'Bad draft',symbol:'BAD',draft:{vaultAddress:'0x123'}})).status,400);
  assert.equal((await alice.post('/projects',{...draft,draft,launchHash:'0x'+'1'.repeat(64)})).status,400);
  const updated=await (await alice.post('/projects',{...draft,draftId:project.id,draft:{...draft,description:'Restored and updated.'}})).json();
  assert.equal(updated.id,project.id);assert.equal(updated.draft.vaultAddress,vault);
}));

test('saving and restoring a draft preserves the latest assistant profile',()=>withWorkspace(async({alice,bob})=>{
  const draft={name:'Orbit Club',symbol:'ORBIT',description:'A community for builders.'};
  const project=await (await alice.post('/projects',{...draft,draft})).json();
  const profile={aiName:'Orbit Guide',aiVoice:'Playful & bold',aiGoal:'Welcome new builders.'};
  assert.equal((await alice.post(`/projects/${project.id}/assistant`,profile)).status,200);
  const response=await alice.post('/projects',{...draft,name:'Orbit Revised',draftId:project.id,draft:{...draft,name:'Orbit Revised'},aiName:'Unvalidated replacement'});
  assert.equal(response.status,201);const saved=await response.json();
  for(const [key,value] of Object.entries(profile))assert.equal(saved[key],value);
  assert.equal(saved.name,'Orbit Revised');assert.equal(saved.createdAt,project.createdAt);
  const restored=(await (await alice.get('/projects')).json())[0];for(const [key,value] of Object.entries(profile))assert.equal(restored[key],value);
  assert.equal((await bob.post(`/projects/${project.id}/assistant`,profile)).status,404);
  const imported=await (await alice.post('/projects',{...draft,draftId:project.id,tokenAddress:testWallet(12).address})).json();
  assert.equal(imported.status,'imported');assert.equal(imported.draft,undefined);
  for(const [key,value] of Object.entries(profile))assert.equal(imported[key],value);
}));

test('draft editing is owner-only, revision checked and private until the edited revision is reviewed',()=>withWorkspace(async({alice,bob,endpoint,store,originalFetch})=>{
  const project=await (await alice.post('/projects',{name:'Orbit Club',symbol:'ORBIT'})).json();
  const other=await (await bob.post('/projects',{name:'Other Club',symbol:'OTHER'})).json();
  // A public-page fixture avoids blockchain calls; no real project is published.
  await store.mutateProjects(records=>Object.assign(records.find(item=>item.id===project.id),{published:true,tokenAddress:'0x1111111111111111111111111111111111111111'}));
  const entry=await store.appendActivity(project.id,{kind:'post',title:'Social draft',content:'Original draft.',public:true});
  const edit=`/projects/${project.id}/activity/${entry.id}/content`,share=`/projects/${project.id}/activity/${entry.id}/visibility`;
  assert.equal((await originalFetch(endpoint+'/api'+edit,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  assert.equal((await bob.post(edit,{content:'Stolen',revision:0})).status,404);
  assert.equal((await bob.post(`/projects/${other.id}/activity/${entry.id}/content`,{content:'Stolen',revision:0})).status,404);
  for(const content of ['', '   ', 42, 'x'.repeat(20001)])assert.equal((await alice.post(edit,{content,revision:0})).status,400);
  const content='Reviewed words with **emphasis**, emoji 🌍 and a clear community question.';
  const response=await alice.post(edit,{content,revision:0});assert.equal(response.status,200);const revised=await response.json();
  assert.equal(revised.content,content);assert.equal(revised.revision,1);assert.equal(revised.public,false);assert.ok(revised.updatedAt);assert.equal(revised.createdAt,entry.createdAt);
  const page=()=>originalFetch(`${endpoint}/api/public/projects/${project.id}`).then(r=>r.json());
  assert.equal((await page()).activity.length,0);
  assert.equal((await alice.post(edit,{content:'Stale edit',revision:0})).status,409);
  assert.equal((await alice.post(share,{public:true,revision:0})).status,409);
  assert.equal((await alice.post(share,{public:true,revision:1})).status,200);
  assert.equal((await page()).activity[0].content,content);
  assert.equal((await page()).activity[0].updatedAt,revised.updatedAt);
  assert.equal((await (await alice.post(edit,{content,revision:1})).json()).public,true);
  // A valid 20,000-character Unicode draft exceeds the old 20KB request limit.
  const large=await alice.post(edit,{content:'界'.repeat(20000),revision:1});assert.equal(large.status,200);assert.equal((await large.json()).revision,2);
  assert.equal((await page()).activity.length,0);
  const competing=await Promise.all([alice.post(edit,{content:'First window',revision:2}),alice.post(edit,{content:'Second window',revision:2})]);
  assert.deepEqual(competing.map(item=>item.status).sort(),[200,409]);
  const recovered=(await (await alice.get(`/projects/${project.id}/activity`)).json()).find(item=>item.id===entry.id);
  assert.equal(recovered.revision,3);
  assert.equal((await alice.post(edit,{content:'Merged after loading the current version.',revision:recovered.revision})).status,200);
  // Split a multibyte character across TCP writes, as can happen on a real connection.
  const bytes=Buffer.from(JSON.stringify({content:'界🌍 — keep the complete text.',revision:4})),split=bytes.indexOf(Buffer.from('界'))+1;
  const unicode=await new Promise((resolve,reject)=>{const req=httpRequest(endpoint+'/api'+edit,{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:4318',cookie:alice.cookie,'content-length':bytes.length}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});req.on('error',reject);req.write(bytes.subarray(0,split));setImmediate(()=>req.end(bytes.subarray(split)));});
  assert.equal(unicode.status,200);assert.equal(unicode.data.content,'界🌍 — keep the complete text.');
  const system=await store.appendActivity(project.id,{kind:'launch',title:'Token launched',content:'Verified receipt.',public:true});
  assert.equal((await alice.post(`/projects/${project.id}/activity/${system.id}/content`,{content:'Fake receipt',revision:0})).status,400);
}));

test('global monitoring rotates batches, tolerates failures and keeps manual checks owner-scoped',async()=>{
  const state={watches:Array.from({length:205},(_,index)=>({id:String(index),owner:`owner-${Math.floor(index/20)}`,address:`local-token-${index}`,enabled:true,priceThreshold:10})),alerts:[]};
  const seen=[],store={read:key=>state[key],change:async(key,fn)=>fn(state[key])};
  const monitor=createMonitor(store,{observe:async address=>{seen.push(address);if(address==='local-token-99')throw new Error('offline');return {symbol:'LOCAL',price:'1',holdersCount:null,graduated:false,checkedAt:new Date().toISOString()};}});
  assert.equal((await monitor.check()).checked,99);assert.equal(seen.length,100);assert.equal(new Set(seen).size,100);
  seen.length=0;assert.equal((await monitor.check('owner-0')).checked,20);assert.ok(seen.every(address=>Number(address.split('-').at(-1))<20));
  seen.length=0;assert.equal((await monitor.check()).checked,100);assert.equal(seen[0],'local-token-100');assert.equal(seen.at(-1),'local-token-199');
  seen.length=0;await monitor.check();assert.equal(seen[0],'local-token-200');assert.ok(state.watches.every(item=>item.checkedAt||item.error));
  // Removing the cursor and disabling a rule still leaves subsequent passes usable.
  state.watches.splice(state.watches.findIndex(item=>item.id==='94'),1);state.watches[0].enabled=false;
  seen.length=0;await monitor.check();assert.ok(seen.length>0);assert.ok(!seen.includes(state.watches[0].address));
});

test('AI permission failures are safe, preserve history and allow a later successful retry',()=>withWorkspace(async({alice,originalFetch})=>{
  Object.assign(process.env,{AI_API_BASE:'https://provider-test.example/v1',AI_API_KEY:'test-only-not-a-live-key',AI_MODEL:'local-model'});
  let providerStatus=403;
  globalThis.fetch=async(input,options)=>String(input).startsWith('https://provider-test.example/')?Response.json(providerStatus===200?{choices:[{message:{content:'A recovered private draft.'}}]}:{error:{message:'Internal group and credential details must not reach users.'}},{status:providerStatus}):originalFetch(input,options);
  const project=await (await alice.post('/projects',{name:'Orbit Club',symbol:'ORBIT'})).json();
  for(const status of [401,403,429]){providerStatus=status;const response=await alice.post('/copilot',{projectId:project.id,task:'post'});assert.equal(response.status,status===429?429:503);const data=await response.json();assert.match(data.error,status===429?/busy/:/saved drafts/);assert.doesNotMatch(data.error,/Internal|credential|group|test-only/);}
  assert.deepEqual(await (await alice.get(`/projects/${project.id}/activity`)).json(),[]);
  providerStatus=200;assert.equal((await alice.post('/copilot',{projectId:project.id,task:'post'})).status,200);
  const history=await (await alice.get(`/projects/${project.id}/activity`)).json();assert.equal(history.length,1);assert.equal(history[0].public,false);
}));
