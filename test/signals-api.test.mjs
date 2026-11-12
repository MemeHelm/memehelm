import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';
test('watch settings, alerts and requested AI briefs stay within the signed-in wallet',async()=>{
  await mkdir('qa',{recursive:true});const dir=await mkdtemp(resolve('qa','signals-api-')),saved={...process.env},originalFetch=globalThis.fetch;let server,modelCalls=0;
  const address='0x1111111111111111111111111111111111111111';
  try{
    Object.assign(process.env,{DATA_DIRECTORY:dir,AI_API_BASE:'https://test-model.example/v1',AI_API_KEY:'test-only-value',AI_MODEL:'test'});
    globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://test-model.example/')){modelCalls++;assert.match(JSON.parse(options.body).messages[1].content,/Observed chain data/);return Response.json({choices:[{message:{content:'Verified changes in a private signal brief.'}}]});}return originalFetch(url,options);};
    ({server}=await import(`../server/index.mjs?signals-test=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(4),originalFetch),bob=await signedClient(endpoint,testWallet(5),originalFetch),store=createWorkspaceStore(dir);
    const data={address,name:'Observed',symbol:'OBS',price:'1',holdersCount:2,graduated:null,source:'Robinhood RPC + Blockscout',checkedAt:new Date().toISOString()};await store.change('market',records=>records.push({address,fetchedAt:Date.now(),data}));
    assert.equal((await originalFetch(endpoint+'/api/watches')).status,401);
    const watch=await (await alice.post('/watches',{address,priceThreshold:10})).json();assert.ok(watch.id);assert.equal((await alice.get('/watches')).status,200);assert.deepEqual(await (await bob.get('/watches')).json(),[]);
    assert.equal((await bob.post('/watches/remove',{id:watch.id})).status,404);assert.equal((await alice.post('/watches',{address,priceThreshold:0})).status,400);
    await store.change('market',records=>{Object.assign(records[0].data,{price:'2',holdersCount:3,graduated:true});});
    assert.equal((await alice.post('/watches/check',{})).status,200);const alerts=await (await alice.get('/alerts')).json();assert.equal(alerts.length,2);assert.deepEqual(await (await bob.get('/alerts')).json(),[]);
    await bob.post('/alerts/read',{id:alerts[0].id});assert.equal((await (await alice.get('/alerts')).json()).filter(item=>item.read).length,0);
    await alice.post('/alerts/read',{});assert.ok((await (await alice.get('/alerts')).json()).every(item=>item.read));
    assert.equal((await bob.post('/watches/brief',{id:watch.id})).status,400);assert.equal(modelCalls,0);
    const brief=await alice.post('/watches/brief',{id:watch.id});assert.equal(brief.status,200);assert.equal(modelCalls,1);assert.equal((await (await alice.get('/watches/briefs')).json()).length,1);assert.deepEqual(await (await bob.get('/watches/briefs')).json(),[]);
    await alice.post('/watches',{address,priceThreshold:10,enabled:false});assert.equal((await (await alice.post('/watches/check',{})).json()).checked,0);
    await alice.post('/watches/remove',{id:watch.id});assert.deepEqual(await (await alice.get('/watches')).json(),[]);
  }finally{if(server){server.close();server.closeAllConnections();}globalThis.fetch=originalFetch;process.env=saved;if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
