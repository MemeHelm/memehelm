import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createMarket} from '../server/market.mjs';
import {PONS} from '../shared/pons.mjs';
const token='0x1111111111111111111111111111111111111111',owner='0x2222222222222222222222222222222222222222';
const hash='0x'+'a'.repeat(64),tx='0x'+'b'.repeat(64),date='2026-11-16T12:00:00.000Z';
const log={address:PONS.factory.address,blockNumber:100n,blockHash:hash,logIndex:1,transactionHash:tx,createdAt:date,args:{token,curve:owner,deployer:owner,pairToken:'0x'+'0'.repeat(40)}};
const coverage={fromBlock:'50',toBlock:'100',targetBlock:'100',count:1,partial:false,status:'current',lastSuccessAt:date,verifiedAt:date,scope:'Observed factory history. Not all-time.',missingRanges:[]};
const page=()=>({logs:[log],coverage:{...coverage},checkedAt:date,stale:false});
async function fixture(work){await mkdir('qa',{recursive:true});const dir=await mkdtemp(resolve('qa','launch-feed-'));try{await work(createWorkspaceStore(dir),dir);}finally{assert.ok(dir.startsWith(resolve('qa')+sep));await rm(dir,{recursive:true,force:true});}}

test('metadata outages preserve verified launch receipt, canonical time and actual coverage',()=>fixture(async store=>{
  const launchIndex={sync:async()=>page(),snapshot:page},client={readContract:async()=>{throw new Error('Metadata unavailable');}};
  const result=await createMarket(store,{launchIndex,client,protocol:{verify:async()=>{}}}).feed();
  assert.equal(result.items.length,1);assert.equal(result.items[0].tokenAddress,token);assert.equal(result.items[0].createdAt,date);assert.equal(result.items[0].transactionHash,tx);assert.equal(result.items[0].blockHash,hash);
  assert.equal(result.items[0].name,'Token details unavailable');assert.equal(result.items[0].metadataAvailable,false);assert.equal(result.metadataPartial,true);assert.equal(result.partial,false);assert.equal(result.coverage.toBlock,'100');assert.equal(result.scope,coverage.scope);
}));

test('restart retains observed token metadata and marks stale fallback when latest reads fail',()=>fixture(async(store,dir)=>{
  let clock=Date.parse(date),fail=false,reads=0;
  const client={readContract:async({functionName})=>{reads++;if(fail)throw new Error('Metadata unavailable');return functionName==='name'?'Observed Coin':functionName==='symbol'?'OBS':null;}};
  const options={launchIndex:{sync:async()=>page(),snapshot:page},client,protocol:{verify:async()=>{}},now:()=>clock};
  const initial=await createMarket(store,options).feed();assert.equal(initial.items[0].name,'Observed Coin');assert.equal(reads,3);
  fail=true;clock+=60000;
  const cached=await createMarket(createWorkspaceStore(dir),options).feed();assert.equal(cached.items[0].name,'Observed Coin');assert.equal(reads,3);
  clock+=900001;
  const fallback=await createMarket(createWorkspaceStore(dir),options).feed();assert.equal(fallback.items[0].name,'Observed Coin');assert.equal(fallback.items[0].metadataStale,true);assert.equal(fallback.metadataPartial,true);
  assert.equal(store.read('pons-launch-metadata-v1')[0].fetchedAt,Date.parse(date));
  client.readContract=async()=>'';clock+=60001;
  const malformed=await createMarket(createWorkspaceStore(dir),options).feed();assert.equal(malformed.items[0].name,'Observed Coin');assert.equal(malformed.items[0].metadataStale,true);assert.equal(store.read('pons-launch-metadata-v1')[0].fetchedAt,Date.parse(date));
}));

test('failed protocol verification serves labeled stored history without advancing the index',()=>fixture(async store=>{
  let syncs=0;
  const launchIndex={sync:async()=>{syncs++;return page();},snapshot:page};
  const result=await createMarket(store,{launchIndex,client:{readContract:async()=>{throw Error('Offline');}},protocol:{verify:async()=>{throw Error('Code changed');}}}).feed();
  assert.equal(syncs,0);assert.equal(result.stale,true);assert.equal(result.partial,true);assert.equal(result.coverage.status,'stale');assert.equal(result.coverage.lastSuccessAt,date);assert.match(result.notice,/saved launch history/);
  const missing={logs:[],coverage:{fromBlock:null,toBlock:null},checkedAt:null};
  await assert.rejects(()=>createMarket(store,{launchIndex:{snapshot:()=>missing},protocol:{verify:async()=>{throw Error('Offline');}}}).feed(),/temporarily unavailable/);
}));

test('reorg replacement cannot reuse orphaned metadata or receipt entries',()=>fixture(async store=>{
  let current=page(),clock=Date.parse(date);
  const client={readContract:async({functionName})=>functionName==='name'?'Old chain name':functionName==='symbol'?'OLD':null};
  const options={launchIndex:{sync:async()=>current,snapshot:()=>current},client,protocol:{verify:async()=>{}},now:()=>clock};
  await createMarket(store,options).feed();clock+=60001;
  current={...page(),logs:[{...log,blockHash:'0x'+'c'.repeat(64)}]};client.readContract=async()=>{throw Error('Unavailable');};
  const result=await createMarket(store,options).feed();assert.equal(result.items.length,1);assert.equal(result.items[0].metadataAvailable,false);assert.doesNotMatch(JSON.stringify(result.items),/Old chain name|OLD/);
}));

test('known reorg invalidation evicts the feed cache and returns an empty success to withdraw prior cards',()=>fixture(async store=>{
  let current=page();const launchIndex={sync:async()=>current,snapshot:()=>current};
  const market=createMarket(store,{launchIndex,client:{readContract:async({functionName})=>functionName==='name'?'Orphan name':'ORPHAN'},protocol:{verify:async()=>{}}});
  assert.equal((await market.feed()).items.length,1);
  current={logs:[],stale:true,checkedAt:null,coverage:{...coverage,fromBlock:null,toBlock:null,invalidated:true,status:'rebuilding',partial:true}};
  const result=await market.feed();assert.deepEqual(result.items,[]);assert.equal(result.coverage.invalidated,true);assert.equal(result.coverage.fromBlock,null);assert.doesNotMatch(JSON.stringify(result),/Orphan name|ORPHAN/);
}));
