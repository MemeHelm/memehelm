import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createOperations} from '../server/operations.mjs';

const base=resolve('qa'),token='0x1111111111111111111111111111111111111111';
const settings=(changes={})=>({enabled:true,autoDraft:false,intervalHours:1,dailyLimit:5,...changes});
const review=()=>({content:JSON.stringify({summary:'An offline review of recorded project outcomes.',actions:[{kind:'task',title:'Follow up on the recorded feedback',rationale:'Use the owner’s recorded outcome.',content:'Review the actual questions and record the next result.',dueAt:null,evidenceIds:[]}]})});
async function storeFixture(work){
  await mkdir(base,{recursive:true});const directory=await mkdtemp(resolve(base,'mate-core-'));
  try{const store=createWorkspaceStore(directory),project={id:randomUUID(),owner:'0x2222222222222222222222222222222222222222',name:'Offline Orbit',symbol:'ORBIT',chainId:4663,status:'draft',tokenAddress:token,published:false};await store.mutateProjects(rows=>rows.push(project));await work({store,project,directory});}
  finally{assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});}
}

test('pausing before observations finish prevents a scheduled review from starting paid AI',()=>storeFixture(async({store,project})=>{
  let finishObservation,entered;const started=new Promise(done=>{entered=done;}),gate=new Promise(done=>{finishObservation=done;});let providerCalls=0;
  const operations=createOperations(store,{observe:async()=>{entered();await gate;return{price:'1',currency:'ETH',phase:0,checkedAt:new Date().toISOString()};},generate:async()=>{providerCalls++;return review();}});
  await operations.settings(project,{revision:0,settings:settings({autoDraft:true})});const ticking=operations.tick();await started;
  await operations.settings(project,{revision:1,settings:settings({enabled:false,autoDraft:false})});finishObservation();await ticking;
  const state=operations.get(project);assert.equal(providerCalls,0,'pausing before the provider request must avoid paid generation');assert.equal(state.usage.used,0);assert.equal(state.actions.length,0);assert.equal(state.runs[0].status,'cancelled');assert.equal(state.running,false);assert.equal(state.nextCheckAt,null);
}));

test('changing project memory during observation prevents generation against superseded review context',()=>storeFixture(async({store,project})=>{
  let finishObservation,entered;const started=new Promise(done=>{entered=done;}),gate=new Promise(done=>{finishObservation=done;});let providerCalls=0;
  const operations=createOperations(store,{observe:async()=>{entered();await gate;return{price:'1',currency:'ETH',phase:0};},generate:async()=>{providerCalls++;return review();}});
  const running=operations.run(project,{requestId:randomUUID()});await started;await operations.memory(project,{revision:0,memory:{story:'The updated project story.'}});finishObservation();const state=await running;
  assert.equal(providerCalls,0);assert.equal(state.usage.used,0);assert.equal(state.runs[0].status,'cancelled');assert.equal(state.actions.length,0);
}));

test('observation-only scheduling and an exhausted explicit AI allowance never publish or retry paid work',()=>storeFixture(async({store,project})=>{
  let clock=Date.parse('2026-11-16T12:00:00Z'),observed=0,paid=0;const operations=createOperations(store,{now:()=>clock,observe:async()=>{observed++;return{price:'1',currency:'ETH',phase:0,checkedAt:new Date(clock).toISOString()};},generate:async()=>{paid++;throw Object.assign(new Error('Offline provider timed out.'),{status:503,code:'AI_TIMEOUT'});}});
  await operations.settings(project,{revision:0,settings:settings({dailyLimit:1})});await operations.tick();assert.equal(observed,1);assert.equal(paid,0);
  await operations.settings(project,{revision:1,settings:settings({autoDraft:true,dailyLimit:1})});await operations.tick();assert.equal(paid,1);const failed=operations.get(project);assert.equal(failed.usage.used,1);assert.equal(failed.runs[0].status,'failed');assert.equal(failed.actions.length,0);
  await operations.run(project,{requestId:failed.runs[0].id});assert.equal(paid,1,'unknown or failed reviews do not replay paid generation');clock+=3600001;await operations.tick();assert.equal(observed,3);assert.equal(paid,1);assert.equal(store.read('activity').length,0);assert.equal(store.read('social_posts').length,0);
}));

test('no-project chat, explicit project creation, reviewed private targets and manual outcomes form one isolated API loop',async()=>{
  const {signedClient,testWallet}=await import('./helpers/auth.mjs');
  await mkdir(base,{recursive:true});const directory=await mkdtemp(resolve(base,'mate-core-api-')),previousEnv={...process.env},nativeFetch=globalThis.fetch,requests=[],blocked=[];let server,providerMode='general';
  const at=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+90000000).toISOString();
  try{
    Object.assign(process.env,{DATA_DIRECTORY:directory,AI_API_BASE:'https://mate-core-fixture.example/v1',AI_API_KEY:'fixture-only',AI_MODEL:'fixture-only'});delete process.env.X_CLIENT_ID;delete process.env.X_CLIENT_SECRET;delete process.env.SOCIAL_ENCRYPTION_KEY;
    globalThis.fetch=async(input,options)=>{
      const url=String(input);
      if(url==='https://mate-core-fixture.example/v1/chat/completions'){
        const request=JSON.parse(options.body);requests.push(request);let output;
        if(providerMode==='general')output={scope:'platform',reply:'An offline MATE reply. Use the project form to save a project explicitly.'};
        else if(providerMode==='plan')output={scope:'platform',reply:'Review these private drafts.',proposals:[{kind:'calendar',title:'First community update',rationale:'Prepare an update for the project.',payload:{items:[{title:'Builder question',content:'What useful lesson did you learn this week?',channel:'x',scheduledAt:at}]}},{kind:'event',title:'Community call',rationale:'Prepare a private invitation.',payload:{title:'Builder call',description:'Discuss the actual community questions.',startsAt:at,endsAt:end,capacity:null,url:''}}]};
        else output=JSON.parse(review().content);
        return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});
      }
      if(/^http:\/\/127\.0\.0\.1:\d+\//.test(url))return nativeFetch(input,options);
      blocked.push(url);throw new Error('No live AI, X, RPC or wallet requests are allowed in this integration test.');
    };
    ({server}=await import(`../server/index.mjs?mate-core=${randomUUID()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(410),nativeFetch),bob=await signedClient(endpoint,testWallet(411),nativeFetch),store=createWorkspaceStore(directory);
    const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json();};
    const generalInput={requestId:randomUUID(),content:'GENERAL_PRIVATE_ONLY: help me prepare a MemeHelm project, but do not create one.'};const general=await json(await alice.post('/assistant/chat',generalInput));assert.equal(store.read('projects').length,0);assert.equal(store.read('operations').length,0);assert.equal((await bob.get('/assistant/chats/'+general.chatId)).status,404);assert.deepEqual(await json(await alice.post('/assistant/chat',generalInput)),general);assert.equal(requests.length,1);
    const project=await json(await alice.post('/projects',{name:'Core Orbit',symbol:'CORE',description:'A project explicitly saved through its existing API.'}),201),other=await json(await alice.post('/projects',{name:'Other Orbit',symbol:'OTHER',description:'OTHER_PROJECT_PRIVATE_ONLY'}),201);assert.equal(project.published,false);assert.equal(store.read('projects').length,2);
    const root=`/projects/${project.id}`,assistant=root+'/assistant';assert.equal((await alice.post(assistant+'/plan',{requestId:randomUUID(),chatId:general.chatId,content:'Bind a general chat to a project.'})).status,404);assert.equal(requests.length,1);
    providerMode='plan';const planInput={requestId:randomUUID(),content:'Prepare a content plan and private event for my MemeHelm project.'},plan=await json(await alice.post(assistant+'/plan',planInput));assert.equal(plan.items.length,2);assert.equal(store.read('content_calendar').length,0);assert.equal(store.read('community').length,0);assert.equal((await bob.get(assistant+'/actions')).status,404);
    const calendarAction=plan.items.find(item=>item.kind==='calendar'),eventAction=plan.items.find(item=>item.kind==='event'),actionPath=assistant+'/actions/'+calendarAction.id;
    const edited=await json(await alice.post(actionPath,{action:'edit',revision:0,title:'Owner-reviewed update',payload:{items:[{...calendarAction.payload.items[0],content:'Owner-reviewed project question.'}]}}));assert.equal(edited.action.status,'proposed');assert.equal((await alice.post(actionPath,{action:'apply',revision:1})).status,400);assert.equal((await alice.post(actionPath,{action:'apply',revision:0,confirm:true})).status,409);assert.equal((await bob.post(actionPath,{action:'apply',revision:1,confirm:true})).status,404);assert.equal(store.read('content_calendar').length,0);
    const applied=await json(await alice.post(actionPath,{action:'apply',revision:1,confirm:true}));assert.deepEqual(await json(await alice.post(actionPath,{action:'apply',revision:1,confirm:true})),applied);assert.equal(store.read('content_calendar').length,1);const eventSaved=await json(await alice.post(assistant+'/actions/'+eventAction.id,{action:'apply',revision:0,confirm:true}));assert.equal(eventSaved.result.kind,'event');assert.equal(store.read('community')[0].events[0].publishedDetails,null);assert.equal(store.read('activity').length,0);
    const replay=await json(await alice.post(assistant+'/plan',planInput));assert.ok(replay.items.every(item=>item.status==='applied'));assert.equal(requests.length,2);
    const calendar=await json(await alice.get(root+'/calendar')),item=calendar.items[0];assert.equal(item.body,'Owner-reviewed project question.');assert.equal((await bob.post(root+'/calendar/'+item.id,{action:'complete',revision:0,outcome:'OTHER_WALLET_FALSE_RESULT'})).status,404);
    const outcome='Three builders shared practical lessons; two asked for a follow-up.';await json(await alice.post(root+'/calendar/'+item.id,{action:'complete',revision:0,outcome}));assert.equal((await alice.post(`/projects/${other.id}/calendar/${item.id}`,{action:'complete',revision:1,outcome:'OTHER_PROJECT_FALSE_RESULT'})).status,404);
    let social=await json(await alice.post(root+'/community/x',{text:item.body}));assert.equal(social.available,false);const post=social.posts[0];social=await json(await alice.post(root+'/community/x/'+post.id,{action:'record',revision:post.revision,confirm:true,url:'https://x.com/fixture/status/123456789',publishedAt:null,notes:'Publication link entered manually for this offline test.'}));const recorded=social.posts[0];await json(await alice.post(root+'/community/x/'+post.id,{action:'report',revision:recorded.revision,observedAt:new Date().toISOString(),counts:{likes:0,views:null},notes:'Creator-recorded feedback, not X API evidence.'}));
    providerMode='review';await json(await alice.post(root+'/operations/run',{requestId:randomUUID()}));const contextPrompt=requests.at(-1).messages[1].content;assert.match(contextPrompt,new RegExp(outcome));assert.match(contextPrompt,/"outcomeSource":"creator"/);assert.match(contextPrompt,/"outcomeVerified":false/);assert.match(contextPrompt,/"publicationVerified":false/);assert.match(contextPrompt,/"publicMetrics":null/);assert.match(contextPrompt,/"views":null/);assert.match(contextPrompt,/"likes":0/);assert.doesNotMatch(contextPrompt,/GENERAL_PRIVATE_ONLY|OTHER_PROJECT_PRIVATE_ONLY|OTHER_WALLET_FALSE_RESULT|OTHER_PROJECT_FALSE_RESULT/);
    assert.equal(store.read('activity').length,0);assert.ok(store.read('projects').every(record=>record.published===false));assert.ok(store.read('social_posts').every(record=>record.status==='recorded'&&!record.receipt));assert.deepEqual(blocked,[]);assert.equal(requests.length,3);assert.equal((await bob.get(root+'/operations')).status,404);assert.equal((await alice.get('/assistant/chats/'+general.chatId)).status,200);
  }finally{if(server){server.close();server.closeAllConnections();}globalThis.fetch=nativeFetch;process.env=previousEnv;assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});}
});
