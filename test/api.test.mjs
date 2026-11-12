import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { once } from 'node:events';
import {signedClient,testWallet} from './helpers/auth.mjs';

test('local API persists drafts and rejects hostile-origin writes',async()=>{
 const qa=resolve('qa');await (await import('node:fs/promises')).mkdir(qa,{recursive:true});
 const directory=await mkdtemp(resolve(qa,'api-'));
 const savedDirectory=process.env.DATA_DIRECTORY;process.env.DATA_DIRECTORY=directory;
 const {server}=await import(`../server/index.mjs?api-test=${Date.now()}`);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const endpoint=`http://127.0.0.1:${server.address().port}`;
 const alice=await signedClient(endpoint),bob=await signedClient(endpoint,testWallet(2));
 const post=(origin,input)=>alice.post('/projects',input,origin);
 try{
  const hostile=await post('https://untrusted.example',{name:'Hostile',symbol:'BAD'});assert.equal(hostile.status,400);
  assert.equal((await fetch(`${endpoint}/api/projects`)).status,401);
  assert.deepEqual(await (await alice.get('/projects')).json(),[]);
  const valid=await post('http://127.0.0.1:4317',{name:'Orbit Club',symbol:'ORBIT',description:'An English test project.'});assert.equal(valid.status,201);const project=await valid.json();assert.equal(project.status,'draft');assert.equal(project.chainId,4663);
  const list=await (await alice.get('/projects')).json();assert.equal(list.length,1);assert.equal(list[0].id,project.id);
  assert.equal(project.owner,alice.account.address.toLowerCase());
  assert.deepEqual(await (await bob.get('/projects')).json(),[]);
  for(const suffix of ['activity','snapshot'])assert.equal((await bob.get(`/projects/${project.id}/${suffix}`)).status,404);
  assert.equal((await bob.post(`/projects/${project.id}/publication`,{published:true})).status,404);
  assert.equal((await bob.post('/projects',{name:'Stolen',symbol:'STEAL',draftId:project.id})).status,404);
  assert.equal((await bob.post(`/projects/${project.id}/assistant`,{aiName:'Stolen'})).status,404);
  assert.equal((await alice.post(`/projects/${project.id}/assistant`,{aiName:'Orbit Guide',aiVoice:'Playful & bold',aiGoal:'Help new community members feel welcome.'})).status,200);
  assert.equal((await alice.post(`/projects/${project.id}/assistant`,{aiVoice:'Unknown voice'})).status,400);
  const concurrent=await Promise.all([alice.get('/projects').then(r=>r.json()),bob.get('/projects').then(r=>r.json())]);assert.equal(concurrent[0].length,1);assert.equal(concurrent[1].length,0);
  assert.equal(concurrent[0][0].aiName,'Orbit Guide');
  const wrongChain=await post('http://127.0.0.1:4317',{name:'Old chain',symbol:'OLD',chainId:97});assert.equal(wrongChain.status,400);
  const malformed=await post('http://127.0.0.1:4317',{name:'Wrong address',symbol:'TEST',tokenAddress:'0x123'});assert.equal(malformed.status,400);
  const snapshot=await alice.get(`/projects/${project.id}/snapshot`);assert.equal(snapshot.status,400);assert.match((await snapshot.json()).error,/Launch or import/);
  await alice.post('/auth/logout',{});assert.equal((await alice.get('/projects')).status,401);assert.equal((await bob.get('/projects')).status,200);
 }finally{
  server.close();server.closeAllConnections();
  if(savedDirectory===undefined)delete process.env.DATA_DIRECTORY;else process.env.DATA_DIRECTORY=savedDirectory;
  const checked=resolve(directory);if(!checked.startsWith(`${qa}${sep}`))throw new Error('Test cleanup target escaped the QA directory.');
  await rm(checked,{recursive:true,force:true});
 }
});
