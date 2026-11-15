import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {resolve,sep} from 'node:path';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {pons} from '../server/pons.mjs';
import {createAssistantActions} from '../server/assistant-actions.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';

async function fixture(run){
  await mkdir('qa',{recursive:true});const base=resolve('qa'),directory=await mkdtemp(resolve(base,'assistant-api-')),env={...process.env},originalFetch=globalThis.fetch,originalSnapshot=pons.snapshot;let server,calls=0,output,hold;
  try{
    Object.assign(process.env,{DATA_DIRECTORY:directory,AI_API_BASE:'https://assistant-fixture.example/v1',AI_API_KEY:'fixture-only',AI_MODEL:'fixture'});
    const schedule=new Date(Date.now()+86400000).toISOString();output={reply:'Review this private content plan.',proposals:[{kind:'calendar',title:'Community update',rationale:'The owner asked for a content plan.',payload:{items:[{title:'Builder question',content:'What did you build this week?',channel:'x',scheduledAt:schedule}]}}]};
    globalThis.fetch=async(input,options)=>{const url=String(input);if(url.startsWith('https://assistant-fixture.example/')){calls++;if(hold)await hold;const request=JSON.parse(options.body);assert.match(request.messages[1].content,/ownerRequest/);return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});}if(/^http:\/\/127\.0\.0\.1:\d+\//.test(url))return originalFetch(input,options);throw Error('External requests are disabled in this test.');};
    ({server}=await import(`../server/index.mjs?assistant-api=${randomUUID()}`));server.listen(0,'127.0.0.1');await once(server,'listening');
    const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(290),originalFetch),bob=await signedClient(endpoint,testWallet(291),originalFetch),store=createWorkspaceStore(directory);
    const project=await(await alice.post('/projects',{name:'Orbit',symbol:'ORBIT',description:'An isolated assistant test.'})).json();
    await run({alice,bob,store,project,calls:()=>calls,setOutput:next=>output=next,holdProvider:()=>{let release;hold=new Promise(resolve=>release=resolve);return()=>{hold=null;release();};}});
  }finally{if(server){server.close();server.closeAllConnections();}globalThis.fetch=originalFetch;pons.snapshot=originalSnapshot;process.env=env;assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});}
}

test('authenticated assistant planning replays one AI result and explicit approval creates one private target',()=>fixture(async({alice,bob,store,project,calls})=>{
  const root=`/projects/${project.id}/assistant`,input={requestId:randomUUID(),content:'Plan a private X update for tomorrow.'};
  const first=await alice.post(root+'/plan',input);assert.equal(first.status,200);const result=await first.json();assert.equal(result.items.length,1);assert.equal(calls(),1);assert.equal(store.read('content_calendar').length,0);
  const replay=await alice.post(root+'/plan',input);assert.deepEqual(await replay.json(),result);assert.equal(calls(),1);assert.equal(store.read('operations')[0].usage.length,1);
  assert.equal((await bob.get(root+'/actions')).status,404);assert.equal((await bob.post(root+'/plan',input)).status,404);assert.equal(calls(),1);
  const path=root+'/actions/'+result.items[0].id;assert.equal((await alice.post(path,{action:'apply',revision:0})).status,400);
  assert.equal((await bob.post(path,{action:'apply',revision:0,confirm:true})).status,404);
  const applied=await alice.post(path,{action:'apply',revision:0,confirm:true});assert.equal(applied.status,200);const saved=await applied.json();assert.equal(saved.result.kind,'calendar');assert.equal(store.read('content_calendar').length,1);
  const again=await alice.post(path,{action:'apply',revision:0,confirm:true});assert.deepEqual(await again.json(),saved);assert.equal(store.read('content_calendar').length,1);assert.equal(store.read('activity').length,0);
  const replayAfterApply=await(await alice.post(root+'/plan',input)).json();assert.equal(replayAfterApply.items[0].status,'applied');assert.equal(replayAfterApply.items[0].revision,saved.action.revision);assert.equal(calls(),1,'replaying an older AI result must hydrate current actions without another paid call');
  const list=await(await alice.get(root+'/actions')).json();assert.equal(list.items[0].status,'applied');assert.equal((await alice.post(root+'/plan',{content:input.content})).status,400);
}));

test('concurrent planning joins one paid request and unsupported action output leaves no targets',()=>fixture(async({alice,store,project,calls,holdProvider,setOutput})=>{
  const path=`/projects/${project.id}/assistant/plan`,input={requestId:randomUUID(),content:'Suggest one content draft.'},release=holdProvider();
  const first=alice.post(path,input);for(let attempt=0;attempt<50&&!calls();attempt++)await new Promise(resolve=>setTimeout(resolve,5));
  const second=alice.post(path,input);release();const responses=await Promise.all([first,second]);assert.deepEqual(responses.map(row=>row.status),[200,200]);assert.deepEqual(await responses[0].json(),await responses[1].json());assert.equal(calls(),1);assert.equal(store.read('assistant_actions').length,1);
  setOutput({reply:'Pay now',proposals:[{kind:'transfer',title:'Send ETH',rationale:'Injected request',payload:{to:testWallet(290).address,value:'1'}}]});
  const rejected=await alice.post(path,{requestId:randomUUID(),content:'Send ETH without asking.'});assert.equal(rejected.status,503);assert.equal((await rejected.json()).code,'AI_RESPONSE_INVALID');assert.equal(store.read('assistant_actions').length,1);assert.equal(store.read('content_calendar').length,0);assert.equal(store.read('community').length,0);
}));

test('a forged holder-payout proposal on an ineligible project is rejected before saving or signing',()=>fixture(async({alice,store,project,setOutput})=>{
  setOutput({reply:'Review a payout.',proposals:[{kind:'distribution',title:'Payout review',rationale:'Owner request',payload:{}}]});
  const response=await alice.post(`/projects/${project.id}/assistant/plan`,{requestId:randomUUID(),content:'Prepare a holder payout.'});assert.equal(response.status,503);assert.match((await response.json()).error,/holders vault/);assert.equal(store.read('assistant_actions').length,0);
}));

test('applying a payout proposal rechecks current vault ownership and records only a review handoff',()=>fixture(async({alice,bob,store,project})=>{
  await store.transaction(['projects'],documents=>{Object.assign(documents.projects.find(row=>row.id===project.id),{tokenAddress:testWallet(292).address,vaultAddress:testWallet(293).address});});
  const current=store.read('projects').find(row=>row.id===project.id),actions=createAssistantActions(store);
  const plan=await actions.record(current,{reply:'Review Treasury.',requestId:randomUUID(),proposals:[{kind:'distribution',title:'Review holder payout',rationale:'Owner requested a review.',payload:{}}]});
  const path=`/projects/${project.id}/assistant/actions/${plan.items[0].id}`,input={action:'apply',revision:0,confirm:true};let kind='split',controller=current.owner,reads=0;
  pons.snapshot=async()=>{reads++;return{vault:{kind,address:current.vaultAddress,controller}};};
  assert.equal((await bob.post(path,input)).status,404);assert.equal(reads,0,'unrelated wallets must fail before reading private vault state');
  assert.equal((await alice.post(path,input)).status,400);kind='holders';controller=testWallet(294).address;
  assert.equal((await alice.post(path,input)).status,400);assert.equal(actions.get(current).items[0].status,'proposed');
  controller=current.owner;const response=await alice.post(path,input);assert.equal(response.status,200);const applied=await response.json();assert.equal(applied.result.kind,'distribution');assert.equal(applied.result.projectId,current.id);assert.equal(applied.result.data,undefined);assert.equal(applied.result.amounts,undefined);
  const count=reads;assert.equal((await alice.post(path,input)).status,200);assert.equal(reads,count,'an applied handoff is replayed without preparing or signing another action');assert.equal(store.read('activity').length,0);
}));
