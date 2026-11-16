import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

async function fixture(work){
  const previousFetch=globalThis.fetch,previousStorage=globalThis.localStorage,previousWindow=globalThis.window;
  await mkdir('qa',{recursive:true});const directory=await mkdtemp(resolve('qa','api-identity-'));
  const source=ts.transpileModule(await readFile('src/api.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  await writeFile(resolve(directory,'api.mjs'),source);const records=new Map(),seen=[];let mode='timeout',sequence=0;
  globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,String(value)),removeItem:key=>records.delete(key)};
  globalThis.window={dispatchEvent(){}};
  globalThis.fetch=async(path,options)=>{
    const payload=options.body?JSON.parse(options.body):null;seen.push({path,payload});
    if(mode==='timeout'){await new Promise((_,reject)=>{const aborted=()=>reject(new DOMException('Request aborted','AbortError'));if(options.signal.aborted)aborted();else options.signal.addEventListener('abort',aborted,{once:true});});}
    if(mode==='success')return Response.json({content:'Saved response'});
    return Response.json({error:'Earlier request state',code:mode},{status:409});
  };
  const load=()=>import(pathToFileURL(resolve(directory,'api.mjs')).href+'?instance='+sequence++);
  try{await work({client:await load(),load,records,seen,setMode:value=>{mode=value;}});}
  finally{globalThis.fetch=previousFetch;if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(!resolve(directory).startsWith(resolve('qa')+sep))throw new Error('Unsafe test cleanup.');await rm(directory,{recursive:true,force:true});}
}
const walletA='0x1111111111111111111111111111111111111111',walletB='0x2222222222222222222222222222222222222222';
const path='/projects/12345678-1234-1234-1234-123456789abc/chat';
const prompt='Private launch strategy: secret community plan for next Friday.';

test('timed-out AI calls reuse a request ID across retries and reload without storing prompt text',()=>fixture(async({client,load,records,seen,setMode})=>{
  client.setApiWalletScope(walletA);const input={content:prompt,chatId:'chat-a',context:{story:'A private narrative',goal:'Welcome builders'}};
  await assert.rejects(()=>client.api(path,input,undefined,40),/took too long/);const id=seen[0].payload.requestId;assert.match(id,/^[a-f0-9-]{36}$/i);assert.equal(records.size,1);
  assert.equal(input.requestId,undefined,'adding request identity must not mutate the caller’s prompt');
  const stored=JSON.stringify([...records]);assert.doesNotMatch(stored,/Private launch strategy|secret community|private narrative|Welcome builders|chat-a/);assert.match([...records.keys()][0],new RegExp(`^memehelm:4663:pons-v2:${walletA}:ai-request:[a-f0-9]{64}$`));assert.equal([...records.values()][0],id);
  await assert.rejects(()=>client.api(path,{context:{goal:'Welcome builders',story:'A private narrative'},chatId:'chat-a',content:prompt},undefined,40),/took too long/);assert.equal(seen.at(-1).payload.requestId,id,'object key order does not change identity');
  const reloaded=await load();reloaded.setApiWalletScope(walletA);setMode('success');await reloaded.api(path,input);assert.equal(seen.at(-1).payload.requestId,id);assert.equal(records.size,0);
  await reloaded.api(path,input);assert.notEqual(seen.at(-1).payload.requestId,id,'a deliberate new request after success must have a fresh ID');
}));

test('AI identity is isolated by wallet scope and reset explicitly starts a fresh attempt',()=>fixture(async({client,records,seen,setMode})=>{
  const input={task:'post',projectId:'private-project',idea:prompt};setMode('AI_REQUEST_PENDING');
  client.setApiWalletScope(walletA);await assert.rejects(()=>client.api('/copilot',input),error=>error.code==='AI_REQUEST_PENDING');const a=seen.at(-1).payload.requestId;
  client.setApiWalletScope(walletB);await assert.rejects(()=>client.api('/copilot',input));const b=seen.at(-1).payload.requestId;assert.notEqual(a,b);assert.equal(records.size,2);
  client.setApiWalletScope(walletA.toUpperCase());await assert.rejects(()=>client.api('/copilot',input));assert.equal(seen.at(-1).payload.requestId,a);
  await client.resetAIRequest('/copilot',input);assert.equal(records.size,1);await assert.rejects(()=>client.api('/copilot',input));const fresh=seen.at(-1).payload.requestId;assert.notEqual(fresh,a);assert.notEqual(fresh,b);
  client.setApiWalletScope(walletB);await assert.rejects(()=>client.api('/copilot',input));assert.equal(seen.at(-1).payload.requestId,b,'resetting one wallet must not reset another’s unresolved request');
}));

test('assistant plans retain a separate request identity through an interrupted retry',()=>fixture(async({client,records,seen,setMode})=>{
  client.setApiWalletScope(walletA);setMode('AI_REQUEST_INTERRUPTED');
  const actionPath='/projects/12345678-1234-1234-1234-123456789abc/assistant/plan',input={content:prompt,chatId:'chat-a'};
  await assert.rejects(()=>client.api(actionPath,input),error=>error.code==='AI_REQUEST_INTERRUPTED');const id=seen.at(-1).payload.requestId;assert.ok(id);
  await assert.rejects(()=>client.api(actionPath,input));assert.equal(seen.at(-1).payload.requestId,id);
  await assert.rejects(()=>client.api(path,input));assert.notEqual(seen.at(-1).payload.requestId,id,'question and action requests must stay independent');
  await client.resetAIRequest(actionPath,input);assert.equal(records.size,1);setMode('success');await client.api(actionPath,input);assert.notEqual(seen.at(-1).payload.requestId,id);
  assert.doesNotMatch(JSON.stringify([...records]),/secret community|chat-a/);
}));

test('general chat reuses its request ID across timeout and reload without storing its private prompt',()=>fixture(async({client,load,records,seen,setMode})=>{
  client.setApiWalletScope(walletA);const generalPath='/assistant/chat',input={content:prompt,chatId:'general-private'};
  await assert.rejects(()=>client.api(generalPath,input,undefined,40),/took too long/);const id=seen.at(-1).payload.requestId;assert.match(id,/^[a-f0-9-]{36}$/i);assert.equal(records.size,1);assert.equal(input.requestId,undefined);
  await assert.rejects(()=>client.api(generalPath,{chatId:'general-private',content:prompt},undefined,40),/took too long/);assert.equal(seen.at(-1).payload.requestId,id);assert.doesNotMatch(JSON.stringify([...records]),/Private launch strategy|secret community|general-private/);
  const reloaded=await load();reloaded.setApiWalletScope(walletA);setMode('success');await reloaded.api(generalPath,input);assert.equal(seen.at(-1).payload.requestId,id);assert.equal(records.size,0);await reloaded.api(generalPath,input);assert.notEqual(seen.at(-1).payload.requestId,id);
}));

test('general request recovery stays isolated from project chat and another wallet',()=>fixture(async({client,records,seen,setMode})=>{
  const generalPath='/assistant/chat',input={content:prompt};setMode('AI_REQUEST_INTERRUPTED');client.setApiWalletScope(walletA);
  await assert.rejects(()=>client.api(generalPath,input),error=>error.code==='AI_REQUEST_INTERRUPTED');const generalId=seen.at(-1).payload.requestId;assert.ok(generalId);
  await assert.rejects(()=>client.api(path,input));const projectId=seen.at(-1).payload.requestId;assert.notEqual(projectId,generalId);
  client.setApiWalletScope(walletB);await assert.rejects(()=>client.api(generalPath,input));const otherWalletId=seen.at(-1).payload.requestId;assert.notEqual(otherWalletId,generalId);assert.equal(records.size,3);
  client.setApiWalletScope(walletA);await client.resetAIRequest(generalPath,input);assert.equal(records.size,2);await assert.rejects(()=>client.api(generalPath,input));assert.notEqual(seen.at(-1).payload.requestId,generalId);
  await assert.rejects(()=>client.api(path,input));assert.equal(seen.at(-1).payload.requestId,projectId);client.setApiWalletScope(walletB);await assert.rejects(()=>client.api(generalPath,input));assert.equal(seen.at(-1).payload.requestId,otherWalletId);
}));

test('a wallet change during digest cannot move a request or reset into the next wallet scope',()=>fixture(async({client,records,seen,setMode})=>{
  const digest=crypto.subtle.digest;let release;
  const hold=()=>{const gate=new Promise(resolve=>{release=resolve;});crypto.subtle.digest=async(...args)=>{await gate;return digest.apply(crypto.subtle,args);};};
  const input={task:'post',projectId:'private-project',idea:prompt};setMode('AI_REQUEST_PENDING');
  try{
    client.setApiWalletScope(walletA);hold();const pending=assert.rejects(()=>client.api('/copilot',input),error=>error.code==='AI_REQUEST_PENDING');client.setApiWalletScope(walletB);release();await pending;
    const a=seen.at(-1).payload.requestId;assert.equal(records.size,1);assert.ok([...records.keys()][0].includes(`:${walletA}:ai-request:`));
    crypto.subtle.digest=digest;await assert.rejects(()=>client.api('/copilot',input));const b=seen.at(-1).payload.requestId;assert.notEqual(a,b);assert.equal(records.size,2);
    client.setApiWalletScope(walletA);hold();const resetting=client.resetAIRequest('/copilot',input);client.setApiWalletScope(walletB);release();await resetting;assert.equal(records.size,1);assert.ok([...records.keys()][0].includes(`:${walletB}:ai-request:`));
    crypto.subtle.digest=digest;await assert.rejects(()=>client.api('/copilot',input));assert.equal(seen.at(-1).payload.requestId,b);
    client.setApiWalletScope(walletA);await assert.rejects(()=>client.api('/copilot',input));assert.notEqual(seen.at(-1).payload.requestId,a);
  }finally{crypto.subtle.digest=digest;}
}));

test('ambiguous server request states keep identity and unrelated API writes stay unmodified',()=>fixture(async({client,records,seen,setMode})=>{
  client.setApiWalletScope(walletA);const input={task:'identity',idea:prompt};let id;
  for(const code of ['AI_REQUEST_PENDING','AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED']){
    setMode(code);await assert.rejects(()=>client.api('/launch/assist',input),error=>error.code===code);id??=seen.at(-1).payload.requestId;assert.equal(seen.at(-1).payload.requestId,id);assert.equal(records.size,1);
  }
  setMode('success');const supplied='12345678-1234-1234-1234-123456789abc';await client.api('/watches/brief',{id:'watch-a',requestId:supplied});assert.equal(seen.at(-1).payload.requestId,supplied);assert.equal(records.size,1,'a caller-owned ID must not change an unrelated unresolved identity');
  await client.api('/projects',{name:'Coin',symbol:'COIN'});assert.deepEqual(seen.at(-1).payload,{name:'Coin',symbol:'COIN'});assert.equal(records.size,1);
}));
