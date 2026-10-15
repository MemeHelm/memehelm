import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { once } from 'node:events';

test('local API persists drafts and rejects hostile-origin writes',async()=>{
 const qa=resolve('qa');await (await import('node:fs/promises')).mkdir(qa,{recursive:true});
 const directory=await mkdtemp(resolve(qa,'api-'));
 const savedDirectory=process.env.DATA_DIRECTORY;process.env.DATA_DIRECTORY=directory;
 const {server}=await import(`../server/index.mjs?api-test=${Date.now()}`);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const endpoint=`http://127.0.0.1:${server.address().port}`;
 const post=(origin,input)=>fetch(`${endpoint}/api/projects`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)});
 try{
  const hostile=await post('https://untrusted.example',{name:'Hostile',symbol:'BAD'});assert.equal(hostile.status,400);
  assert.deepEqual(await (await fetch(`${endpoint}/api/projects`)).json(),[]);
  const valid=await post('http://127.0.0.1:4317',{name:'Orbit Club',symbol:'ORBIT',description:'An English test project.'});assert.equal(valid.status,201);const project=await valid.json();assert.equal(project.status,'draft');assert.equal(project.chainId,97);
  const list=await (await fetch(`${endpoint}/api/projects`)).json();assert.equal(list.length,1);assert.equal(list[0].id,project.id);
  const malformed=await post('http://127.0.0.1:4317',{name:'Wrong address',symbol:'TEST',tokenAddress:'0x123'});assert.equal(malformed.status,400);
  const snapshot=await fetch(`${endpoint}/api/projects/${project.id}/snapshot`);assert.equal(snapshot.status,400);assert.match((await snapshot.json()).error,/Launch or import/);
 }finally{
  server.close();server.closeAllConnections();
  if(savedDirectory===undefined)delete process.env.DATA_DIRECTORY;else process.env.DATA_DIRECTORY=savedDirectory;
  const checked=resolve(directory);if(!checked.startsWith(`${qa}${sep}`))throw new Error('Test cleanup target escaped the QA directory.');
  await rm(checked,{recursive:true,force:true});
 }
});
