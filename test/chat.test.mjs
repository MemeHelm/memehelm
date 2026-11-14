import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {generateCopilot,chatTurns} from '../server/copilot.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';

const modelEnv={AI_API_BASE:'https://model.example/v1',AI_API_KEY:'local-test-secret',AI_MODEL:'test-model'};

test('chat turns are bounded, role-checked and always end on the question',()=>{
  assert.throws(()=>chatTurns(undefined),/Add a message/);
  assert.throws(()=>chatTurns([]),/Add a message/);
  assert.throws(()=>chatTurns([{role:'assistant',content:'Hi.'}]),/last message must be your question/);
  assert.throws(()=>chatTurns([{role:'system',content:'Instructions'}]),/last message must be your question/);
  assert.throws(()=>chatTurns([{role:'user',content:''}]),/needs text/);
  assert.throws(()=>chatTurns([{role:'user',content:'x'.repeat(12001)},{role:'user',content:'y'.repeat(12001)}]),/too long/);
  const trimmed=chatTurns([{role:'user',content:' '+('q'.repeat(4200))+' '}]);
  assert.equal(trimmed.length,1);assert.equal(trimmed[0].content.length,4000);
  const long=Array.from({length:15},(_,index)=>({role:index%2?'assistant':'user',content:'m'+index}));
  const kept=chatTurns(long);assert.equal(kept.length,12);assert.equal(kept[0].content,'m3');
  const mixed=chatTurns([{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'q2'}]);
  assert.deepEqual(mixed,[{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'q2'}]);
});

test('chat task replays the conversation after the factual context and keeps it read-only',async()=>{
  const saved={...process.env};Object.assign(process.env,modelEnv);
  try{
    const seen=[];
    const result=await generateCopilot({project:{name:'Orbit Club',symbol:'ORBIT',status:'draft'},facts:{operatingContext:{memory:{story:''}}},task:'chat',messages:[{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'What changed?'}]},async(url,options)=>{
      seen.push(JSON.parse(options.body));
      return new Response(JSON.stringify({choices:[{message:{content:'Observed facts only.'}}]}),{status:200});
    });
    assert.equal(result.content,'Observed facts only.');
    const request=seen[0];
    assert.equal(request.tools,undefined);assert.equal(request.max_tokens,1200);
    assert.equal(request.messages.length,5);
    assert.match(request.messages[0].content,/untrusted data/);
    assert.match(request.messages[1].content,/Answer the latest user message/);
    assert.deepEqual(request.messages.slice(2),[{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'What changed?'}]);
    await assert.rejects(()=>generateCopilot({project:{},facts:null,task:'chat',messages:[]},async()=>new Response('{}')),/Add a message/);
    await assert.rejects(()=>generateCopilot({project:{},facts:null,task:'chat'},async()=>new Response('{}')),/Add a message/);
  }finally{process.env=saved;}
});

test('the chat endpoint answers only for the project owner with server-owned history',async()=>{
  const qa=resolve('qa');await mkdir(qa,{recursive:true});const directory=await mkdtemp(resolve(qa,'chat-'));
  const saved={...process.env},originalFetch=globalThis.fetch;let server,calls=0,captured=null;
  try{
    process.env.DATA_DIRECTORY=directory;Object.assign(process.env,modelEnv);
    globalThis.fetch=async(input,options)=>{
      if(String(input).startsWith('https://model.example/')){
        calls++;const request=JSON.parse(options.body);
        if(calls===2)captured=request;
        return new Response(JSON.stringify({choices:[{message:{content:calls===1?'Observed: no token linked yet.':'Observed: still no token linked.'}}]}),{status:200});
      }
      return originalFetch(input,options);
    };
    ({server}=await import(`../server/index.mjs?chat-test=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
    const headers={'content-type':'application/json',origin:'http://127.0.0.1:4318'};
    assert.equal((await originalFetch(endpoint+'/api/projects/11111111-1111-4111-8111-111111111111/chat',{method:'POST',headers,body:JSON.stringify({content:'hi'})})).status,401);
    assert.equal((await originalFetch(endpoint+'/api/projects/11111111-1111-4111-8111-111111111111/chats',{headers})).status,401);
    const client=await signedClient(endpoint,undefined,originalFetch),bob=await signedClient(endpoint,testWallet(2),originalFetch);
    const created=await client.post('/projects',{name:'Orbit Club',symbol:'ORBIT',description:'A community for builders.'});
    assert.equal(created.status,201);const project=await created.json();
    assert.equal((await bob.post(`/projects/${project.id}/chat`,{content:'hi'})).status,404);
    assert.equal((await bob.get(`/projects/${project.id}/chats`)).status,404);
    assert.equal((await client.post(`/projects/${project.id}/chat`,{})).status,400);
    assert.equal((await client.post(`/projects/${project.id}/chat`,{content:''})).status,400);
    assert.equal((await client.post(`/projects/${project.id}/chat`,{content:'x'.repeat(4001)})).status,400);
    assert.equal((await client.post(`/projects/${project.id}/chat`,{content:'hi',chatId:'missing'})).status,404);
    assert.equal(calls,0);
    const first=await client.post(`/projects/${project.id}/chat`,{content:'What do you observe?'});
    assert.equal(first.status,200);const body=await first.json();
    assert.equal(body.reply,'Observed: no token linked yet.');assert.equal(body.coverage,null);assert.ok(body.chatId);assert.ok(body.generatedAt);
    assert.equal(body.model,undefined);assert.equal(body.messages.length,2);
    assert.equal(body.messages[0].role,'user');assert.equal(body.messages[1].content,body.reply);
    assert.equal(calls,1);
    const list=await(await client.get(`/projects/${project.id}/chats`)).json();
    assert.equal(list.items.length,1);assert.equal(list.items[0].id,body.chatId);assert.equal(list.items[0].messageCount,2);assert.equal(list.items[0].preview,'What do you observe?');
    const stored=await(await client.get(`/projects/${project.id}/chats/${body.chatId}`)).json();
    assert.equal(stored.id,body.chatId);assert.equal(stored.messages.length,2);
    const second=await client.post(`/projects/${project.id}/chat`,{chatId:body.chatId,content:'And now?'});
    assert.equal(second.status,200);const reply=await second.json();
    assert.equal(reply.reply,'Observed: still no token linked.');assert.equal(reply.chatId,body.chatId);assert.equal(reply.messages.length,4);
    assert.equal(calls,2);
    assert.equal(captured.messages.length,5);
    assert.deepEqual(captured.messages.slice(2),[{role:'user',content:'What do you observe?'},{role:'assistant',content:'Observed: no token linked yet.'},{role:'user',content:'And now?'}]);
    assert.match(captured.messages[1].content,/operatingContext/);
    assert.equal((await client.post(`/projects/${project.id}/chats/remove`,{chatId:'missing'})).status,404);
    assert.equal((await client.post(`/projects/${project.id}/chats/remove`,{chatId:body.chatId})).status,200);
    assert.equal((await client.get(`/projects/${project.id}/chats/${body.chatId}`)).status,404);
    assert.equal((await(await client.get(`/projects/${project.id}/chats`)).json()).items.length,0);
    const third=await client.post(`/projects/${project.id}/chat`,{content:'Fresh start.'});
    assert.equal(third.status,200);assert.notEqual((await third.json()).chatId,body.chatId);assert.equal(calls,3);
  }finally{
    if(server){server.close();server.closeAllConnections();}
    globalThis.fetch=originalFetch;process.env=saved;
    if(!resolve(directory).startsWith(qa+sep))throw new Error('Unsafe test cleanup path.');await rm(directory,{recursive:true,force:true});
  }
});
