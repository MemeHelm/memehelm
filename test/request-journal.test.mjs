import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createRequestJournal} from '../server/request-journal.mjs';

async function fixture(run){const base=resolve('qa');await mkdir(base,{recursive:true});const directory=await mkdtemp(resolve(base,'request-journal-'));try{await run(createWorkspaceStore(directory),directory);}finally{assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});}}
const input=()=>({owner:'0xOWNER',scope:'chat:project-1',requestId:randomUUID(),payload:{chatId:'chat-1',content:'What changed?'}});

test('AI request results replay after restart without another model call or result write',()=>fixture(async(store,directory)=>{
  const request=input();let calls=0;const first=createRequestJournal(store);
  const work=async()=>{calls++;return {chatId:'chat-1',reply:'Observed facts.',messages:[{role:'user',content:'What changed?'}]};};
  const result=await first.execute(request,work);
  const reopened=createRequestJournal(createWorkspaceStore(directory));assert.deepEqual(await reopened.execute({...request,payload:{content:'What changed?',chatId:'chat-1'}},work),result);assert.equal(calls,1);
  await assert.rejects(()=>reopened.execute({...request,payload:{content:'Different question'}},work),error=>error.status===409);
  assert.equal(calls,1);assert.equal(store.read('ai_requests')[0].payload,undefined);assert.match(store.read('ai_requests')[0].fingerprint,/^[a-f0-9]{64}$/);
}));

test('concurrent copies join one AI request while owner and project scopes stay separate',()=>fixture(async store=>{
  const request=input(),journal=createRequestJournal(store);let release,calls=0;const wait=new Promise(resolve=>{release=resolve;});
  const work=async()=>{calls++;await wait;return {reply:'One result'};};
  const first=journal.execute(request,work),second=journal.execute(request,work);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);release();assert.deepEqual(await first,await second);
  await journal.execute({...request,owner:'0xOTHER'},work);await journal.execute({...request,scope:'chat:project-2'},work);assert.equal(calls,3);
}));

test('interrupted or still-running paid requests never run again after process loss',()=>fixture(async store=>{
  let time=1000;const request=input(),original=createRequestJournal(store,{now:()=>time});let release,calls=0;const wait=new Promise(resolve=>{release=resolve;});
  const first=original.execute(request,async()=>{calls++;await wait;return {reply:'Late saved result'};});await new Promise(resolve=>setImmediate(resolve));
  const restarted=createRequestJournal(store,{now:()=>time});await assert.rejects(()=>restarted.execute(request,async()=>{calls++;}),error=>error.code==='AI_REQUEST_PENDING');
  time+=120001;await assert.rejects(()=>restarted.execute(request,async()=>{calls++;}),error=>error.code==='AI_REQUEST_INTERRUPTED');assert.equal(calls,1);
  release();await first;assert.deepEqual(await restarted.execute(request,async()=>{calls++;}),{reply:'Late saved result'});assert.equal(calls,1);
}));

test('failed requests replay safe failures and cannot consume allowance again',()=>fixture(async store=>{
  const request=input(),journal=createRequestJournal(store);let calls=0;
  const work=async()=>{calls++;throw new Error('private provider secret must never be persisted');};
  await assert.rejects(()=>journal.execute(request,work),error=>error.status===503&&!error.message.includes('secret'));
  await assert.rejects(()=>journal.execute(request,work),error=>error.code==='AI_REQUEST_FAILED');assert.equal(calls,1);assert.ok(!JSON.stringify(store.read('ai_requests')).includes('secret'));
  await assert.rejects(()=>journal.execute({...request,requestId:'bad'},work),error=>error.status===400);assert.equal(calls,1);
}));
