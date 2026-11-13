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
    const data={coreVersion:2,holderDataAvailable:true,holders:[],address,name:'Observed',symbol:'OBS',price:'1',holdersCount:2,graduated:null,source:'Pons v2 / Robinhood mainnet',checkedAt:new Date().toISOString()};await store.change('market',records=>records.push({address,fetchedAt:Date.now(),data}));
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

test('Signals preserves saved briefs after provider failures and permits an explicit retry on a paused watch',async()=>{
  await mkdir('qa',{recursive:true});const dir=await mkdtemp(resolve('qa','signals-recovery-')),saved={...process.env},originalFetch=globalThis.fetch,originalWarn=console.warn;let server,modelCalls=0,providerStatus=403;const diagnostics=[];
  const address='0x2222222222222222222222222222222222222222';
  try{
    Object.assign(process.env,{DATA_DIRECTORY:dir,AI_API_BASE:'https://signals-test.example/v1',AI_API_KEY:'signals-test-secret',AI_MODEL:'test'});
    console.warn=message=>diagnostics.push(message);
    globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://signals-test.example/')){modelCalls++;assert.match(JSON.parse(options.body).messages[1].content,/Observed chain data/);if(providerStatus==='timeout')throw new DOMException('private provider failure','TimeoutError');return Response.json(providerStatus===200?{choices:[{message:{content:'A recovered private signal brief.'}}]}:{error:{message:providerStatus===400?'Model "test" is not available for this group':'signals-test-secret and private provider internals'}},{status:providerStatus});}return originalFetch(url,options);};
    ({server}=await import(`../server/index.mjs?signals-recovery=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(41),originalFetch),bob=await signedClient(endpoint,testWallet(42),originalFetch),store=createWorkspaceStore(dir);
    const data={coreVersion:2,holderDataAvailable:true,holders:[],address,name:'Observed',symbol:'OBS',price:'1',holdersCount:2,graduated:null,source:'Pons v2 / Robinhood mainnet',checkedAt:new Date().toISOString()};await store.change('market',records=>records.push({address,fetchedAt:Date.now(),data}));
    const watch=await (await alice.post('/watches',{address,priceThreshold:10,enabled:false})).json();assert.equal(watch.enabled,false);
    const previous={id:'previous-private-brief',owner:alice.account.address.toLowerCase(),address,symbol:'OBS',content:'An earlier saved signal brief.',createdAt:new Date().toISOString()};await store.change('briefs',records=>records.push(previous));
    for(const [upstream,code] of [[400,'AI_ACCESS'],[502,'AI_UNAVAILABLE'],[429,'AI_BUSY'],['timeout','AI_TIMEOUT']]){
      providerStatus=upstream;const before=modelCalls,response=await alice.post('/watches/brief',{id:watch.id}),result=await response.json();assert.equal(response.status,upstream===429?429:503);assert.equal(result.code,code);assert.equal(modelCalls,before+1);assert.doesNotMatch(JSON.stringify(result),/signals-test-secret|provider internals/);
      const history=await (await alice.get('/watches/briefs')).json();assert.equal(history.length,1);assert.equal(history[0].content,previous.content);assert.deepEqual(await (await bob.get('/watches/briefs')).json(),[]);
    }
    assert.equal(diagnostics.length,4);assert.doesNotMatch(diagnostics.join(''),/signals-test-secret|private provider|An earlier saved/);
    providerStatus=200;const response=await alice.post('/watches/brief',{id:watch.id}),brief=await response.json();assert.equal(response.status,200);assert.equal(modelCalls,5);assert.equal(brief.content,'A recovered private signal brief.');
    const history=await (await alice.get('/watches/briefs')).json();assert.equal(history.length,2);assert.equal(history[0].id,brief.id);assert.equal((await (await alice.get('/watches')).json())[0].enabled,false);
    assert.deepEqual(await (await bob.get('/watches/briefs')).json(),[]);assert.equal((await bob.post('/watches/brief',{id:watch.id})).status,400);assert.equal(modelCalls,5);
  }finally{if(server){server.close();server.closeAllConnections();}globalThis.fetch=originalFetch;console.warn=originalWarn;process.env=saved;if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
