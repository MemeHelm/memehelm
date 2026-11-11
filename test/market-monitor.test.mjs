import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {encodeAbiParameters,toEventSelector,zeroAddress} from 'viem';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createMarket} from '../server/market.mjs';
import {createMonitor} from '../server/monitor.mjs';
import {artifact} from '../server/chain.mjs';
import {NETWORK} from '../shared/config.mjs';
const token='0x1111111111111111111111111111111111111111',creator='0x2222222222222222222222222222222222222222';
async function directory(){await mkdir('qa',{recursive:true});return mkdtemp(resolve('qa','market-test-'));}
test('market discovery deduplicates receipts and preserves unavailable data instead of inventing metrics',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir),abi=(await artifact('IPortal')).abi;let clock=1800000000000,calls=0,explorerDown=false,chainId=NETWORK.id;
  const event=abi.find(item=>item.name==='TokenCreated'&&item.type==='event'),args={ts:1700000000n,creator,nonce:1n,token,name:'Verified Coin',symbol:'VC',meta:'Qm'+'1'.repeat(44)};
  const indexed={address:{hash:NETWORK.portal},data:encodeAbiParameters(event.inputs,event.inputs.map(input=>args[input.name])),topics:[toEventSelector(event)],transaction_hash:'0x'+'a'.repeat(64)};
  const client={getChainId:async()=>chainId,getBlockNumber:async()=>100000n,getLogs:async()=>[{args,transactionHash:indexed.transaction_hash}],readContract:async()=>{calls++;return {status:1,reserve:1000000000000000n,price:1000000000n,quoteTokenAddress:zeroAddress,progress:200000000000000000n,pool:zeroAddress,buyTaxRate:300n,sellTaxRate:200n};}};
  const fetcher=async url=>{if(explorerDown)throw new Error('offline');if(url.includes('/logs?'))return Response.json({items:[indexed,{...indexed,address:{hash:creator}}]});if(url.endsWith('/holders'))return Response.json({items:[{address:{hash:creator},value:'100000000000000000000'}]});return Response.json({name:'Verified Coin',symbol:'VC',holders_count:'1',decimals:'18',total_supply:'1000000000000000000000'});};
  try{
    const market=createMarket(store,{client,fetcher,now:()=>clock});const feed=await market.feed();assert.equal(feed.items.length,1);assert.equal(feed.items[0].tokenAddress,token);
    const data=await market.details(token);assert.equal(data.price,'1e-9');assert.ok(Math.abs(Number(data.marketCap)-0.000001)<1e-18);assert.equal(data.holdersCount,1);assert.equal(data.progress,20);assert.equal(data.volume,null);assert.equal(data.currency,'test ETH');assert.equal(market.history(token).length,1);
    await market.details(token);assert.equal(calls,1);clock+=61000;explorerDown=true;
    const missing=await market.details(token);assert.equal(missing.price,'1e-9');assert.equal(missing.holdersCount,null);assert.equal(missing.marketCap,null);assert.equal(missing.holderDataAvailable,false);assert.equal(market.history(token).length,2);
    assert.equal((await market.trades(token)).available,false);
    chainId=97;await assert.rejects(()=>market.details(creator),/another network/);
    await assert.rejects(()=>market.details('https://untrusted.example'),/valid token/);
  }finally{if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
test('monitor emits private deduplicated change alerts and preserves last facts when a read fails',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);let fail=false,clock=1800000000000;
  const initial={id:'watch-a',owner:'alice',address:token,symbol:'VC',enabled:true,priceThreshold:10,last:{price:'1',holdersCount:2,graduated:false}};
  try{
    await store.change('watches',records=>records.push(initial,{...initial,id:'watch-b',owner:'bob'},{...initial,id:'paused',owner:'alice',enabled:false}));
    const market={details:async()=>{if(fail)throw new Error('offline');return {symbol:'VC',price:'1.2',holdersCount:3,graduated:true,checkedAt:new Date(clock).toISOString()};}},monitor=createMonitor(store,market,{now:()=>clock});
    assert.equal((await monitor.check('alice')).checked,1);assert.equal(store.read('alerts').length,3);assert.ok(store.read('alerts').every(item=>item.owner==='alice'&&item.read===false));
    await monitor.check('alice');assert.equal(store.read('alerts').length,3);assert.equal(store.read('watches').find(item=>item.owner==='bob').last.price,'1');
    fail=true;clock+=60000;await monitor.check('alice');const watched=store.read('watches').find(item=>item.id==='watch-a');assert.equal(watched.last.price,'1.2');assert.match(watched.error,/could not be checked/);assert.equal(store.read('alerts').length,3);
    assert.equal((await createWorkspaceStore(dir).projects()).length,0);assert.equal(createWorkspaceStore(dir).read('alerts').length,3);
  }finally{if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
test('SQLite migration preserves legacy files and rolls back failed mutations',async()=>{
  const dir=await directory();try{await writeFile(resolve(dir,'projects.json'),JSON.stringify([{id:'legacy',chainId:97}]));const store=createWorkspaceStore(dir);assert.equal((await store.projects())[0].id,'legacy');await assert.rejects(()=>store.mutateProjects(records=>{records.push({id:'failed'});throw new Error('rollback');}),/rollback/);assert.equal((await store.projects()).length,1);await store.mutateProjects(records=>records.push({id:'saved',owner:'alice'}));assert.equal((await createWorkspaceStore(dir).projects()).length,2);}finally{if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
test('multiple trades in the same transaction retain their event order',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir),abi=(await artifact('IPortal')).abi,event=abi.find(item=>item.name==='TokenBought'&&item.type==='event');
  const log=index=>({address:{hash:NETWORK.portal},block_number:100,index,transaction_hash:'0x'+'b'.repeat(64),topics:[toEventSelector(event)],data:encodeAbiParameters(event.inputs,[1700000000n,token,creator,100n,100n,0n,BigInt(index+1)])});
  try{const market=createMarket(store,{fetcher:async url=>Response.json({items:url.includes(toEventSelector(event))?[log(1),log(3),log(2)]:[]})});const trades=await market.trades(token);assert.equal(trades.items.length,3);assert.ok(Number(trades.items[0].price)>Number(trades.items[1].price));assert.ok(Number(trades.items[1].price)>Number(trades.items[2].price));}finally{if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Test cleanup escaped QA.');await rm(dir,{recursive:true,force:true});}
});
