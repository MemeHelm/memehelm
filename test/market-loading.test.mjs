import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {zeroAddress} from 'viem';
import {createMarket} from '../server/market.mjs';
import {createPons} from '../server/pons.mjs';
import {createWorkspaceStore} from '../server/workspace.mjs';
const token='0x3333333333333333333333333333333333333333',curve='0x4444444444444444444444444444444444444444';
async function temporary(){await mkdir('qa',{recursive:true});return mkdtemp(resolve('qa','loading-test-'));}
async function cleanup(dir){assert.ok(resolve(dir).startsWith(resolve('qa')+sep));await rm(dir,{recursive:true,force:true});}
const never=()=>new Promise(()=>{});
test('market facts do not wait for a hung explorer or trade history; optional reads have deadlines',async()=>{
 const dir=await temporary();try{
  const store=createWorkspaceStore(dir);let explorerCalls=0;
  const launch={exists:true,token,curve,pairToken:zeroAddress,phase:0,poolFee:0,tickSpacing:200};
  const protocol={verify:async()=>{},marketState:async()=>({phase:0,price:'0.1',currency:'ETH',progress:1}),launchRecord:async()=>launch,quoteAsset:async()=>({symbol:'ETH',decimals:18})};
  const client={getBlockNumber:async()=>100n,getLogs:never,readContract:async({functionName})=>({name:'Fast facts',symbol:'FAST',decimals:18,totalSupply:10n**27n,getLaunchedToken:launch})[functionName]};
  const market=createMarket(store,{client,protocol,fetcher:()=>{explorerCalls++;return never();},deadlines:{core:200,holders:40,trades:40}});
  const data=await market.details(token);assert.equal(data.price,'0.1');assert.equal(data.phase,0);assert.equal(explorerCalls,0);
  const[holders,trades]=await Promise.all([market.holders(token),market.trades(token)]);assert.equal(holders.holderDataAvailable,false);assert.equal(trades.available,false);assert.equal(explorerCalls,2);
  assert.equal((await market.details(token)).price,'0.1');
 }finally{await cleanup(dir);}
});
test('a timed-out shared core request releases its slot and can be retried without late cache writes',async()=>{
 const dir=await temporary();try{
  const store=createWorkspaceStore(dir);let release,calls=0;const gate=new Promise(resolve=>release=resolve);
  const protocol={verify:async()=>{calls++;await gate;}};
  const client={readContract:async({functionName})=>({name:'Recovered',symbol:'OKAY',decimals:18,totalSupply:100n,getLaunchedToken:{exists:false}})[functionName]};
  const market=createMarket(store,{client,protocol,deadlines:{core:30}});
  const results=await Promise.allSettled([market.details(token),market.details(token)]);assert.equal(calls,1);assert.ok(results.every(r=>r.status==='rejected'&&/too long/.test(r.reason.message)));
  release();protocol.verify=async()=>{};const data=await market.details(token);assert.equal(data.name,'Recovered');assert.equal(store.read('market').length,1);
 }finally{await cleanup(dir);}
});
test('six-decimal quote assets and both pool currency orders retain the correct unit',async()=>{
 const quote='0x5555555555555555555555555555555555555555';let pairToken=quote,phase=0;
 const launch=()=>({exists:true,token,curve,pairToken,phase,creatorTaxBps:0,poolFee:0,tickSpacing:200,graduationThreshold:2000000n});
 const client={getChainId:async()=>4663,readContract:async({functionName})=>({feeEscrow:(await import('../shared/pons.mjs')).PONS.escrow.address,memeHook:(await import('../shared/pons.mjs')).PONS.hook.address,getLaunchedToken:launch(),symbol:'USDG',decimals:6,getReserves:[1000000n,1000n*10n**18n],realQuoteReserve:1000000n,readyToGraduate:false,feeBps:100n,creatorTaxBps:0n,getSlot0:[2n**96n,0,0,0],getLaunchFeePolicy:{hookFeeBps:100}})[functionName]};
 const protocol=createPons({client,checkCode:async()=>{}}),state=await protocol.marketState(token);assert.equal(state.currency,'USDG');assert.equal(state.reserve,'1');assert.equal(state.progress,50);assert.equal(Number(state.price),.001);
 phase=2;assert.equal(Number((await protocol.marketState(token)).price),1e12);
 pairToken='0x2222222222222222222222222222222222222222';assert.equal(Number((await protocol.marketState(token)).price),1e12);
 // A non-unit pool ratio differentiates inversion from decimal scaling.
 const previous=client.readContract;client.readContract=async args=>args.functionName==='getSlot0'?[2n**97n,0,0,0]:previous(args);
 assert.equal(Number((await protocol.marketState(token)).price),.25e12);pairToken=quote;assert.equal(Number((await protocol.marketState(token)).price),4e12);
 await assert.rejects(()=>protocol.nativeRecord(token),/ETH-paired/);
});
test('browser API aborts stalled headers and response bodies and permits retry',async()=>{
 const dir=await temporary(),originalFetch=globalThis.fetch;let server;
 try{
  const compiled=ts.transpileModule(await readFile('src/api.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;await writeFile(resolve(dir,'api.mjs'),compiled);const{api}=await import(pathToFileURL(resolve(dir,'api.mjs')).href);
  const seen=[];server=createServer((req,res)=>{seen.push(req.url);if(req.url==='/api/body'){res.writeHead(200,{'content-type':'application/json'});res.write('{"pending":');return;}if(req.url==='/api/headers')return;if(req.url==='/api/conflict'){res.writeHead(409,{'content-type':'application/json'});res.end('{"error":"This draft changed in another window."}');return;}res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');});server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`;
  globalThis.fetch=(input,options)=>originalFetch(new URL(input,endpoint),options);
  for(const path of ['/headers','/body'])await assert.rejects(()=>api(path,undefined,undefined,80),/took too long/);
  assert.ok(seen.includes('/api/body'));assert.deepEqual(await api('/ok',undefined,undefined,500),{ok:true});
  await assert.rejects(()=>api('/conflict',undefined,undefined,500),error=>error.name==='ApiError'&&error.status===409&&/another window/.test(error.message));
  const controller=new AbortController();controller.abort();await assert.rejects(()=>api('/ok',undefined,controller.signal),e=>e.name==='AbortError');
 }finally{globalThis.fetch=originalFetch;if(server){server.close();server.closeAllConnections();}await cleanup(dir);}
});
