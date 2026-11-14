import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {launchAssist} from '../server/copilot.mjs';
import {signedClient} from './helpers/auth.mjs';

const modelEnv={AI_API_BASE:'https://model.example/v1',AI_API_KEY:'local-test-secret',AI_MODEL:'test-model'};
const respond=content=>new Response(JSON.stringify({choices:[{message:{content}}]}),{status:200});
const identityPayload=JSON.stringify({candidates:[
  {name:'Orbit Club',symbol:'orbit',story:'A community coin for builders, nothing promised.'},
  {name:'Loud Duck',symbol:'DUCK',story:'One loud duck, zero promises.'},
  {name:'Quiet Anchor',symbol:'ANCH',story:'Steady, boring, honest.'},
  {name:'Should Drop',symbol:'DROP',story:'A fourth candidate outside the limit.'},
]});

test('launch assist validates AI output and never invents fallback drafts',async()=>{
  const saved={...process.env};Object.assign(process.env,modelEnv);
  try{
    const result=await launchAssist({task:'identity',idea:'a fun builders coin',draft:{name:'ignored'}},async()=>respond('```json\n'+identityPayload+'\n```'));
    assert.equal(result.task,'identity');assert.equal(result.candidates.length,3);
    assert.deepEqual(result.candidates.map(candidate=>candidate.symbol),['ORBIT','DUCK','ANCH']);
    assert.equal(result.candidates[0].name,'Orbit Club');
    await assert.rejects(()=>launchAssist({task:'identity',idea:'a'},async()=>respond(identityPayload)),/Describe your coin idea/);
    await assert.rejects(()=>launchAssist({task:'identity',idea:'a fun coin'},async()=>respond('not json')),/could not be read/);
    await assert.rejects(()=>launchAssist({task:'identity',idea:'a fun coin'},async()=>respond(JSON.stringify({candidates:[{name:'X',symbol:'A',story:''}]}))),/incomplete/i);
    await assert.rejects(()=>launchAssist({task:'surprise',idea:'a fun coin'},async()=>respond('{}')),/Choose an available launch assist/);
    const fee=await launchAssist({task:'fee',facts:{maxCreatorTaxBps:1000}},async()=>respond(JSON.stringify({creatorTaxBps:250,rationale:'Low friction for early trading.'})));
    assert.equal(fee.task,'fee');assert.equal(fee.creatorTaxBps,250);assert.equal(fee.rationale,'Low friction for early trading.');
    await assert.rejects(()=>launchAssist({task:'fee',facts:{maxCreatorTaxBps:1000}},async()=>respond(JSON.stringify({creatorTaxBps:2000,rationale:'too high'}))),/outside the allowed range/);
    await assert.rejects(()=>launchAssist({task:'fee',facts:{maxCreatorTaxBps:1000}},async()=>respond(JSON.stringify({creatorTaxBps:1.5,rationale:'fractional'}))),/outside the allowed range/);
    await assert.rejects(()=>launchAssist({task:'fee',facts:{maxCreatorTaxBps:1000}},async()=>respond(JSON.stringify({creatorTaxBps:100,rationale:''}))),/incomplete/i);
  }finally{process.env=saved;}
});

test('the wizard assist endpoint requires a wallet session and returns validated drafts',async()=>{
  const qa=resolve('qa');await mkdir(qa,{recursive:true});const directory=await mkdtemp(resolve(qa,'assist-'));
  const saved={...process.env},originalFetch=globalThis.fetch;let server,calls=0;
  try{
    process.env.DATA_DIRECTORY=directory;Object.assign(process.env,modelEnv);
    globalThis.fetch=async(input,options)=>{if(String(input).startsWith('https://model.example/')){calls++;return respond(identityPayload);}return originalFetch(input,options);};
    ({server}=await import(`../server/index.mjs?assist-test=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
    const unauthenticated=await originalFetch(endpoint+'/api/launch/assist',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:4318'},body:JSON.stringify({task:'identity',idea:'a fun builders coin'})});
    assert.equal(unauthenticated.status,401);
    const client=await signedClient(endpoint,undefined,originalFetch);
    const reply=await client.post('/launch/assist',{task:'identity',idea:'a fun builders coin',draft:{name:'Old',symbol:'OLD',description:'Old story.'}});
    assert.equal(reply.status,200);const body=await reply.json();
    assert.equal(body.task,'identity');assert.equal(body.candidates.length,3);assert.equal(body.model,undefined);
    assert.equal(calls,1);
    const rejected=await client.post('/launch/assist',{task:'other',idea:'a fun builders coin'});
    assert.equal(rejected.status,400);
  }finally{
    if(server){server.close();server.closeAllConnections();}
    globalThis.fetch=originalFetch;process.env=saved;
    if(!resolve(directory).startsWith(qa+sep))throw new Error('Unsafe test cleanup path.');await rm(directory,{recursive:true,force:true});
  }
});
