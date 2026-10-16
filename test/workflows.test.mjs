import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {launchStepErrors} from '../shared/launch-steps.mjs';
import {validateLaunch} from '../shared/launch.mjs';
import {imageLink,projectLink,publicProject} from '../shared/project.mjs';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {publicClient} from '../server/chain.mjs';

const valid={name:'Orbit Club',symbol:'ORBIT',description:'A community for builders.',meta:'Qm'+'1'.repeat(44),image:'',website:'',x:'',telegram:'',projectTreasury:'0x1111111111111111111111111111111111111111',auditTreasury:'0x2222222222222222222222222222222222222222',factory:'0x3333333333333333333333333333333333333333',auditBps:1000,buyTaxRate:300,sellTaxRate:300,taxDays:365,antiFarmerDays:3,initialBuy:'0'};
test('launch steps gate missing metadata, duplicate destinations and invalid economics',()=>{
  for(let step=0;step<3;step++)assert.deepEqual(launchStepErrors(valid,step),{});
  assert.doesNotThrow(()=>validateLaunch(valid));
  assert.ok(launchStepErrors({...valid,meta:'https://untrusted.example'},0).meta);
  assert.ok(launchStepErrors({...valid,auditTreasury:' '+valid.projectTreasury+' '},1).auditTreasury);
  assert.ok(launchStepErrors({...valid,buyTaxRate:0,initialBuy:'1.000000000000000001'},2).buyTaxRate);
  assert.ok(launchStepErrors({...valid,initialBuy:'1.000000000000000001'},2).initialBuy);
  for(const auditBps of [0,10000])assert.deepEqual(launchStepErrors({...valid,auditBps},1),{});
});
test('community links reject executable URLs, userinfo, and incorrect social hosts',()=>{
  assert.throws(()=>projectLink('javascript:alert(1)'));
  assert.throws(()=>projectLink('https://name:password@site.example'));
  assert.throws(()=>projectLink('https://x.com.evil.example/creator','x'));
  assert.equal(projectLink('https://x.com/memehelm','x'),'https://x.com/memehelm');
  assert.throws(()=>imageLink('data:image/svg+xml,<svg/>'));
  assert.equal(imageLink('ipfs://'+valid.meta),'ipfs://'+valid.meta);
  assert.equal(publicProject({name:'Public',draft:{private:'hidden'},credential:'hidden'}).draft,undefined);
});
test('AI history persists concurrently and private drafts require explicit publication',async()=>{
  const qa=resolve('qa');await mkdir(qa,{recursive:true});const directory=await mkdtemp(resolve(qa,'workflow-'));
  const saved={...process.env},originalFetch=globalThis.fetch,originalChainId=publicClient.getChainId,originalCode=publicClient.getCode,originalReadContract=publicClient.readContract;let server;
  try{
    process.env.DATA_DIRECTORY=directory;Object.assign(process.env,{AI_API_BASE:'https://model.example/v1',AI_API_KEY:'local-test-secret',AI_MODEL:'test-model'});
    let calls=0;globalThis.fetch=async(input,options)=>{if(String(input).startsWith('https://model.example/')){calls++;return new Response(JSON.stringify({choices:[{message:{content:'A private draft based on the project story.'}}]}),{status:200});}return originalFetch(input,options);};
    ({server}=await import(`../server/index.mjs?workflow-test=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
    const post=(path,value)=>originalFetch(endpoint+'/api'+path,{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:4318'},body:JSON.stringify(value)});
    const created=await (await post('/projects',{...valid,draft:valid})).json();
    const updated=await (await post('/projects',{...valid,name:'Orbit Updated',draftId:created.id,draft:{...valid,name:'Orbit Updated'}})).json();assert.equal(updated.id,created.id);
    assert.equal((await (await originalFetch(endpoint+'/api/projects')).json()).length,1);
    const generated=await post('/copilot',{projectId:created.id,task:'post'});assert.equal(generated.status,200);const result=await generated.json();assert.ok(result.activityId);assert.equal(calls,1);
    const history=await (await originalFetch(endpoint+`/api/projects/${created.id}/activity`)).json();assert.equal(history.length,1);assert.equal(history[0].public,false);
    assert.equal((await originalFetch(endpoint+`/api/public/projects/${created.id}`)).status,404);
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,400);
    assert.equal((await post(`/projects/${created.id}/activity/${history[0].id}/visibility`,{public:true})).status,400);
    for(let index=0;index<4;index++)assert.equal((await post('/copilot',{projectId:created.id,task:'brief'})).status,200);
    assert.equal((await post('/copilot',{projectId:created.id,task:'plan'})).status,429);assert.equal(calls,5);
    const store=createWorkspaceStore(directory);
    await store.mutateProjects(records=>{records[0].tokenAddress=valid.projectTreasury;records[0].credential='must-not-leak';});
    publicClient.getChainId=async()=>46630;publicClient.getCode=async()=>'0x6000';publicClient.readContract=async({functionName})=>functionName==='symbol'?'WRONG':functionName==='decimals'?18:1000n;
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,400);
    publicClient.readContract=async({functionName})=>functionName==='symbol'?'ORBIT':functionName==='decimals'?18:1000n;
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,200);
    const shared=await post(`/projects/${created.id}/activity/${history[0].id}/visibility`,{public:true});assert.equal(shared.status,200);
    const visible=await (await originalFetch(endpoint+`/api/public/projects/${created.id}`)).json();assert.equal(visible.activity.length,1);assert.equal(visible.project.draft,undefined);assert.equal(visible.project.credential,undefined);assert.equal(visible.activity[0].model,undefined);
    assert.equal((await post(`/projects/${created.id}/publication`,{published:false})).status,200);
    assert.equal((await originalFetch(endpoint+`/api/public/projects/${created.id}`)).status,404);
    await Promise.all(Array.from({length:8},(_,index)=>store.appendActivity(created.id,{kind:'brief',title:'Concurrent '+index,content:String(index),public:false})));
    assert.equal((await createWorkspaceStore(directory).activity(created.id)).length,13);
    await store.mutateProjects(records=>records.push({id:'11111111-1111-4111-8111-111111111111',name:'Old chain',symbol:'OLD',chainId:97,published:true,tokenAddress:valid.projectTreasury}));
    assert.equal((await (await originalFetch(endpoint+'/api/projects')).json()).length,1);
    assert.equal((await originalFetch(endpoint+'/api/public/projects/11111111-1111-4111-8111-111111111111')).status,404);
    assert.equal((await originalFetch(endpoint+'/api/projects/11111111-1111-4111-8111-111111111111/activity')).status,400);
  }finally{
    if(server){server.close();server.closeAllConnections();}
    globalThis.fetch=originalFetch;publicClient.getChainId=originalChainId;publicClient.getCode=originalCode;publicClient.readContract=originalReadContract;process.env=saved;
    if(!resolve(directory).startsWith(qa+sep))throw new Error('Unsafe test cleanup path.');await rm(directory,{recursive:true,force:true});
  }
});
