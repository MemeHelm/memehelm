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
import {pons} from '../server/pons.mjs';
import {signedClient} from './helpers/auth.mjs';

const valid={name:'Orbit Club',symbol:'ORBIT',description:'A community for builders.',image:'',website:'',x:'',telegram:'',creatorFeeRecipient:'0x1111111111111111111111111111111111111111',creatorTaxBps:0,configId:0,splitEnabled:false,projectTreasury:'0x1111111111111111111111111111111111111111',auditTreasury:'0x2222222222222222222222222222222222222222',auditBps:1000};
test('launch steps validate identity, fee destinations and creator economics',()=>{for(let step=0;step<3;step++)assert.deepEqual(launchStepErrors(valid,step),{});assert.doesNotThrow(()=>validateLaunch(valid));assert.ok(launchStepErrors({...valid,image:'javascript:alert(1)'},0).image);assert.ok(launchStepErrors({...valid,splitEnabled:true,auditTreasury:valid.projectTreasury},1).auditTreasury);assert.ok(launchStepErrors({...valid,creatorTaxBps:-1},2).creatorTaxBps);assert.ok(launchStepErrors({...valid,configId:-1},2).configId);assert.ok(launchStepErrors({...valid,snipeTaxExemptions:['0x123']},2).snipeTaxExemptions);assert.ok(launchStepErrors({...valid,snipeTaxExemptions:[valid.projectTreasury,valid.projectTreasury]},2).snipeTaxExemptions);assert.ok(launchStepErrors({...valid,snipeTaxExemptions:Array(33).fill(valid.projectTreasury)},2).snipeTaxExemptions);assert.deepEqual(launchStepErrors({...valid,snipeTaxExemptions:[valid.projectTreasury]},2),{});});
test('community links reject executable URLs, userinfo, and incorrect social hosts',()=>{
  assert.throws(()=>projectLink('javascript:alert(1)'));
  assert.throws(()=>projectLink('https://name:password@site.example'));
  assert.throws(()=>projectLink('https://x.com.evil.example/creator','x'));
  assert.equal(projectLink('https://x.com/memehelm','x'),'https://x.com/memehelm');
  assert.throws(()=>imageLink('data:image/svg+xml,<svg/>'));
  assert.equal(imageLink('ipfs://'+'Qm'+'1'.repeat(44)),'ipfs://'+'Qm'+'1'.repeat(44));
  assert.equal(publicProject({name:'Public',draft:{private:'hidden'},credential:'hidden'}).draft,undefined);
});
test('AI history persists concurrently and private drafts require explicit publication',async()=>{
  const qa=resolve('qa');await mkdir(qa,{recursive:true});const directory=await mkdtemp(resolve(qa,'workflow-'));
  const saved={...process.env},originalFetch=globalThis.fetch,originalChainId=publicClient.getChainId,originalCode=publicClient.getCode,originalReadContract=publicClient.readContract,originalLaunchRecord=pons.launchRecord;let server;
  try{
    process.env.DATA_DIRECTORY=directory;Object.assign(process.env,{AI_API_BASE:'https://model.example/v1',AI_API_KEY:'local-test-secret',AI_MODEL:'test-model'});
    let calls=0;globalThis.fetch=async(input,options)=>{if(String(input).startsWith('https://model.example/')){calls++;return new Response(JSON.stringify({choices:[{message:{content:'A private draft based on the project story.'}}]}),{status:200});}return originalFetch(input,options);};
    ({server}=await import(`../server/index.mjs?workflow-test=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
    const client=await signedClient(endpoint,undefined,originalFetch),post=client.post;
    const created=await (await post('/projects',{...valid,draft:valid})).json();
    const updated=await (await post('/projects',{...valid,name:'Orbit Updated',draftId:created.id,draft:{...valid,name:'Orbit Updated'}})).json();assert.equal(updated.id,created.id);
    assert.equal((await (await client.request(endpoint+'/api/projects')).json()).length,1);
    const generated=await post('/copilot',{projectId:created.id,task:'post'});assert.equal(generated.status,200);const result=await generated.json();assert.ok(result.activityId);assert.equal(calls,1);
    const history=await (await client.request(endpoint+`/api/projects/${created.id}/activity`)).json();assert.equal(history.length,1);assert.equal(history[0].public,false);
    assert.equal((await client.request(endpoint+`/api/public/projects/${created.id}`)).status,404);
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,400);
    assert.equal((await post(`/projects/${created.id}/activity/${history[0].id}/visibility`,{public:true})).status,400);
    for(let index=0;index<4;index++)assert.equal((await post('/copilot',{projectId:created.id,task:'brief'})).status,200);
    assert.equal((await post('/copilot',{projectId:created.id,task:'plan'})).status,429);assert.equal(calls,5);
    const store=createWorkspaceStore(directory);
    await store.mutateProjects(records=>{records[0].tokenAddress=valid.projectTreasury;records[0].launchHash='0x'+'1'.repeat(64);records[0].credential='must-not-leak';});
    publicClient.getChainId=async()=>4663;publicClient.getCode=async()=>'0x6000';publicClient.readContract=async({functionName})=>functionName==='symbol'?'WRONG':functionName==='decimals'?18:1000n;
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,400);
    pons.launchRecord=async()=>({deployer:client.account.address});publicClient.readContract=async({functionName})=>functionName==='symbol'?'ORBIT':functionName==='decimals'?18:1000n;
    assert.equal((await post(`/projects/${created.id}/publication`,{published:true})).status,200);
    const shared=await post(`/projects/${created.id}/activity/${history[0].id}/visibility`,{public:true});assert.equal(shared.status,200);
    const visible=await (await client.request(endpoint+`/api/public/projects/${created.id}`)).json();assert.equal(visible.activity.length,1);assert.equal(visible.project.draft,undefined);assert.equal(visible.project.credential,undefined);assert.equal(visible.activity[0].model,undefined);
    assert.equal((await post(`/projects/${created.id}/publication`,{published:false})).status,200);
    assert.equal((await client.request(endpoint+`/api/public/projects/${created.id}`)).status,404);
    await Promise.all(Array.from({length:8},(_,index)=>store.appendActivity(created.id,{kind:'brief',title:'Concurrent '+index,content:String(index),public:false})));
    assert.equal((await createWorkspaceStore(directory).activity(created.id)).length,13);
    await store.mutateProjects(records=>records.push({id:'11111111-1111-4111-8111-111111111111',name:'Old chain',symbol:'OLD',chainId:97,published:true,tokenAddress:valid.projectTreasury}));
    assert.equal((await (await client.request(endpoint+'/api/projects')).json()).length,1);
    assert.equal((await client.request(endpoint+'/api/public/projects/11111111-1111-4111-8111-111111111111')).status,404);
    assert.equal((await client.get('/projects/11111111-1111-4111-8111-111111111111/activity')).status,404);
  }finally{
    if(server){server.close();server.closeAllConnections();}
    globalThis.fetch=originalFetch;publicClient.getChainId=originalChainId;publicClient.getCode=originalCode;publicClient.readContract=originalReadContract;pons.launchRecord=originalLaunchRecord;process.env=saved;
    if(!resolve(directory).startsWith(qa+sep))throw new Error('Unsafe test cleanup path.');await rm(directory,{recursive:true,force:true});
  }
});
