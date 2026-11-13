import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createOperations} from '../server/operations.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';
const token='0x1111111111111111111111111111111111111111';
const notes={story:'A community for open-source builders.',audience:'Helpful and clear.',roadmap:'Community demo next week.',commitments:'Publish a factual weekly recap.',boundaries:'Keep contributor email addresses private.'};
const response=()=>({content:JSON.stringify({summary:'Creator notes describe a builder community. No live price is available.',actions:[{kind:'task',title:'Collect demo submissions',rationale:'Supports the creator’s stated roadmap.',content:'Ask for a link to each community demo and record the actual responses.',dueAt:null,evidenceIds:[]},{kind:'update',title:'Invite community feedback',rationale:'A draft to review before sharing.',content:'What are you building this week? Share one useful lesson with the community.',dueAt:null,evidenceIds:[]}]})});
async function fixture(work){await mkdir('qa',{recursive:true});const dir=await mkdtemp(resolve('qa','operations-test-'));try{const store=createWorkspaceStore(dir),project={id:randomUUID(),owner:testWallet(61).address.toLowerCase(),chainId:4663,name:'Orbit Club',symbol:'ORBIT',description:'Builder community.',status:'draft',tokenAddress:null,published:false};await store.mutateProjects(records=>records.push(project));await work({store,project,dir});}finally{assert.ok(resolve(dir).startsWith(resolve('qa')+sep));await rm(dir,{recursive:true,force:true});}}

test('project memory, review, approval, publication and outcomes form a durable owner-scoped workflow',()=>fixture(async({store,project})=>{
 let calls=0;const operations=createOperations(store,{generate:async({facts})=>{calls++;assert.equal(facts.memory.roadmap,notes.roadmap);return response();}});
 let state=operations.get(project);assert.equal(state.settings.enabled,false);assert.equal(state.settings.autoDraft,false);assert.equal(state.usage.used,0);
 state=await operations.memory(project,{revision:state.revision,memory:notes});await assert.rejects(()=>operations.memory(project,{revision:0,memory:notes}),error=>error.status===409);
 const requestId=randomUUID();state=await operations.run(project,{requestId});assert.equal(calls,1);assert.equal(state.actions.length,2);assert.ok(state.actions.every(action=>action.status==='proposed'));assert.equal((await store.activity(project.id)).length,0);
 await operations.run(project,{requestId});assert.equal(calls,1,'duplicate request IDs cannot cause a second provider request');
 const repeated=await operations.run(project,{requestId:randomUUID()});assert.equal(calls,2);assert.equal(repeated.actions.length,2,'a model repeating the same open proposals cannot duplicate the queue');
 const task=state.actions.find(action=>action.kind==='task'),update=state.actions.find(action=>action.kind==='update');
 await assert.rejects(()=>operations.action(project,task.id,{action:'complete',revision:0,outcome:'Collected three demos.'}),/Approve/);
 state=await operations.action(project,task.id,{action:'approve',revision:0});assert.equal(state.actions.find(action=>action.id===task.id).status,'approved');assert.equal((await store.activity(project.id)).length,0);
 await assert.rejects(()=>operations.action(project,task.id,{action:'complete',revision:0,outcome:'Stale'}),error=>error.status===409);
 await operations.action(project,task.id,{action:'complete',revision:1,outcome:'Received three demo links and noted two unanswered questions.'});
 assert.equal((await operations.context(project)).recentOutcomes[0].title,task.title);
 await operations.action(project,update.id,{action:'approve',revision:0});
 await assert.rejects(()=>operations.action(project,update.id,{action:'publish',revision:1,confirm:true}),/verified project page/);assert.equal((await store.activity(project.id)).length,0);
 await store.mutateProjects(records=>Object.assign(records[0],{published:true,tokenAddress:token}));
 await assert.rejects(()=>operations.action(project,update.id,{action:'publish',revision:1}),/confirm/);
 state=await operations.action(project,update.id,{action:'edit',revision:1,title:'Revised invitation',content:'Share a demo you can show this week.',dueAt:null});assert.equal(state.actions.find(action=>action.id===update.id).status,'proposed');
 await assert.rejects(()=>operations.action(project,update.id,{action:'publish',revision:2,confirm:true}),/Approve/);
 await operations.action(project,update.id,{action:'approve',revision:2});state=await operations.action(project,update.id,{action:'publish',revision:3,confirm:true});assert.equal(state.actions.find(action=>action.id===update.id).shared,true);
 await assert.rejects(()=>operations.action(project,update.id,{action:'publish',revision:3,confirm:true}),error=>error.status===409);assert.equal((await store.activity(project.id)).length,1);
 const recreated=createOperations(store);assert.equal(recreated.get(project).memory.commitments,notes.commitments);assert.equal(recreated.get(project).usage.used,2);assert.ok(recreated.get(project).logs.some(log=>log.title==='Task outcome recorded'));
 assert.equal(operations.get({...project,owner:testWallet(62).address.toLowerCase()}).actions.length,0);
}));

test('request allowance persists through failures and restart, resets at UTC midnight and rejects unsafe AI actions',()=>fixture(async({store,project})=>{
 let clock=Date.parse('2026-11-13T23:59:00Z'),calls=0,mode='failure';const options={now:()=>clock,generate:async()=>{calls++;if(mode==='failure')throw Object.assign(new Error('AI writing is unavailable.'),{code:'AI_ACCESS',status:503});if(mode==='unsafe')return{content:JSON.stringify({summary:'Unsafe suggestion',actions:[{kind:'transfer',title:'Send funds',content:'x',rationale:'x'}]})};return response();}};
 let operations=createOperations(store,options);await operations.settings(project,{revision:0,settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:2}});
 await assert.rejects(()=>operations.run(project,{requestId:randomUUID()}),/unavailable/);mode='unsafe';await assert.rejects(()=>operations.run(project,{requestId:randomUUID()}),/unsupported action/);assert.equal(operations.get(project).actions.length,0);assert.equal(operations.get(project).usage.used,2);
 operations=createOperations(store,options);mode='success';await assert.rejects(()=>operations.run(project,{requestId:randomUUID()}),error=>error.status===429);assert.equal(calls,2);assert.equal(operations.get(project).running,false);
 clock+=120000;const state=await operations.run(project,{requestId:randomUUID()});assert.equal(calls,3);assert.equal(state.usage.used,1);assert.equal(state.actions.length,2);
}));

test('a creator can add and finish an action without AI usage or implicit publication',()=>fixture(async({store,project})=>{
 const operations=createOperations(store);let state=await operations.add(project,{kind:'task',title:'Prepare community notes',content:'Write down the actual questions received.',dueAt:null});assert.equal(state.usage.used,0);assert.equal(state.actions[0].source,'creator');assert.equal(state.actions[0].status,'proposed');const item=state.actions[0];
 await operations.action(project,item.id,{action:'approve',revision:0});state=await operations.action(project,item.id,{action:'complete',revision:1,outcome:'Collected the questions in a private note.'});assert.equal(state.actions[0].status,'done');assert.equal(state.usage.used,0);assert.equal((await store.activity(project.id)).length,0);
 await assert.rejects(()=>operations.add(project,{kind:'transfer',title:'Bad',content:'No'}),/community task/);await assert.rejects(()=>operations.add(project,{kind:'task',title:'Bad',content:'Date',dueAt:'not-a-date'}),/valid due date/);
}));

test('pausing or changing memory during a review rejects late proposals and releases the in-flight slot',()=>fixture(async({store,project})=>{
 let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);const operations=createOperations(store,{generate:async()=>{entered();await gate;return response();}});
 await operations.settings(project,{revision:0,settings:{enabled:true,autoDraft:true,intervalHours:6,dailyLimit:2}});
 const request=operations.run(project,{requestId:randomUUID()});await started;await assert.rejects(()=>operations.run(project,{requestId:randomUUID()}),error=>error.status===409);
 await operations.settings(project,{revision:1,settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:2}});release();const state=await request;assert.equal(state.runs[0].status,'cancelled');assert.equal(state.actions.length,0);assert.equal(state.usage.used,1);assert.equal(state.running,false);assert.equal(state.settings.enabled,false);
 let releaseSecond,enterSecond;const secondGate=new Promise(resolve=>releaseSecond=resolve),secondStarted=new Promise(resolve=>enterSecond=resolve),second=createOperations(store,{generate:async()=>{enterSecond();await secondGate;return response();}});const next=second.run(project,{requestId:randomUUID()});await secondStarted;await second.memory(project,{revision:2,memory:notes});releaseSecond();const cancelled=await next;assert.equal(cancelled.runs[0].status,'cancelled');assert.equal(cancelled.actions.length,0);assert.equal(cancelled.usage.used,2);
}));

test('scheduled observation is opt-in, preserves missing data and only uses AI with explicit allowance',()=>fixture(async({store,project})=>{
 let clock=Date.parse('2026-11-13T09:00:00Z'),calls=0,observations=0,unavailable=false,price='1';project.tokenAddress=token;await store.mutateProjects(records=>Object.assign(records[0],project));
 const operations=createOperations(store,{now:()=>clock,observe:async()=>{observations++;if(unavailable)throw new Error('Offline');return{price,currency:'ETH',phase:0,holdersCount:null,checkedAt:new Date(clock).toISOString()};},generate:async()=>{calls++;return response();}});
 await operations.tick();assert.equal(observations,0);assert.equal(calls,0);
 await operations.settings(project,{revision:0,settings:{enabled:true,autoDraft:false,intervalHours:1,dailyLimit:1}});await operations.tick();assert.equal(observations,1);assert.equal(calls,0);assert.equal(operations.get(project).observations.length,1);
 unavailable=true;clock+=3600001;await operations.tick();assert.equal(operations.get(project).baseline.price,'1');assert.ok(operations.get(project).observations.some(item=>item.kind==='coverage'));assert.equal(calls,0);
 unavailable=false;price='1.2';await operations.settings(project,{revision:1,settings:{enabled:true,autoDraft:true,intervalHours:1,dailyLimit:1}});clock+=61000;await operations.tick();assert.equal(calls,1);assert.ok(operations.get(project).observations.some(item=>item.kind==='price'));assert.ok(operations.get(project).actions.every(action=>action.status==='proposed'));assert.equal((await store.activity(project.id)).length,0);
 clock+=3600001;await operations.tick();assert.equal(calls,1,'exhausted AI allowance still permits read-only observations');assert.equal(operations.get(project).usage.remaining,0);
}));

test('operations APIs isolate wallets and existing writing uses memory and the same persistent allowance',()=>fixture(async({store,project,dir})=>{
 const saved={...process.env},originalFetch=globalThis.fetch;let server,calls=0,lastPrompt='';
 try{
  Object.assign(process.env,{DATA_DIRECTORY:dir,AI_API_BASE:'https://operations-test.example/v1',AI_API_KEY:'test-key',AI_MODEL:'test-model'});
  globalThis.fetch=async(input,options)=>{if(String(input).startsWith('https://operations-test.example/')){calls++;const request=JSON.parse(options.body);lastPrompt=request.messages[1].content;return Response.json({choices:[{message:{content:lastPrompt.includes('Return ONLY valid JSON')?response().content:'A draft using the saved project memory.'}}]});}return originalFetch(input,options);};
  ({server}=await import(`../server/index.mjs?operations-api=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(61),originalFetch),bob=await signedClient(endpoint,testWallet(62),originalFetch),path=`/projects/${project.id}/operations`;
  assert.equal((await originalFetch(endpoint+'/api'+path)).status,401);assert.equal((await bob.get(path)).status,404);assert.equal((await bob.post(path+'/memory',{revision:0,memory:notes})).status,404);
  assert.equal((await alice.post(path+'/memory',{revision:0,memory:notes})).status,200);assert.equal((await alice.post(path+'/settings',{revision:1,settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:2}})).status,200);
  const requestId=randomUUID();const run=await alice.post(path+'/run',{requestId});assert.equal(run.status,200);const state=await run.json();assert.equal(state.actions.length,2);assert.match(lastPrompt,/weekly recap/);assert.equal(calls,1);assert.equal((await alice.post(path+'/run',{requestId})).status,200);assert.equal(calls,1);
  assert.equal((await bob.post(path+`/actions/${state.actions[0].id}`,{action:'approve',revision:0})).status,404);
  assert.equal((await alice.post('/copilot',{projectId:project.id,task:'post'})).status,200);assert.match(lastPrompt,/contributor email addresses private/);assert.equal(calls,2);
  assert.equal((await alice.post('/copilot',{projectId:project.id,task:'post'})).status,429);assert.equal(calls,2);assert.equal((await bob.get(`/projects/${project.id}/activity`)).status,404);
  assert.equal((await originalFetch(endpoint+`/api/public/projects/${project.id}`)).status,404);assert.ok(!(await (await alice.get(path)).text()).includes('test-key'));
 }finally{if(server){server.close();server.closeAllConnections();}globalThis.fetch=originalFetch;process.env=saved;}
}));
