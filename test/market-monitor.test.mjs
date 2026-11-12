import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createMarket} from '../server/market.mjs';
import {createMonitor} from '../server/monitor.mjs';
import {artifact} from '../server/chain.mjs';
import {NETWORK} from '../shared/config.mjs';
const token='0x1111111111111111111111111111111111111111',creator='0x2222222222222222222222222222222222222222',factory='0x3333333333333333333333333333333333333333',vault='0x4444444444444444444444444444444444444444';
async function directory(){await mkdir('qa',{recursive:true});return mkdtemp(resolve('qa','market-test-'));}
async function cleanup(dir){if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Unsafe test cleanup.');await rm(dir,{recursive:true,force:true});}
test('discovery indexes only bytecode-verified MemeHelm factories and deduplicates their own receipts',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir),compiled=await artifact('MemeHelmLaunchFactory'),event=compiled.abi.find(item=>item.type==='event'&&item.name==='TokenCreated');
  const saved=process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS;process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS=factory;
  const args={token,vault,creator,name:'Verified Coin',symbol:'VC',totalSupply:10n**27n,ts:1700000000n};
  const indexed={address:{hash:factory},topics:encodeEventTopics({abi:[event],eventName:'TokenCreated',args:{token,vault,creator}}),data:encodeAbiParameters(event.inputs.filter(input=>!input.indexed),event.inputs.filter(input=>!input.indexed).map(input=>args[input.name])),transaction_hash:'0x'+'a'.repeat(64)};
  const client={getChainId:async()=>NETWORK.id,getBlockNumber:async()=>100000n,getCode:async()=>compiled.deployedBytecode,getLogs:async()=>[{address:factory,args,transactionHash:indexed.transaction_hash}]};
  try{
    const market=createMarket(store,{client,fetcher:async()=>Response.json({items:[indexed,{...indexed,address:{hash:creator}}]})});const feed=await market.feed();assert.equal(feed.items.length,1);assert.equal(feed.items[0].tokenAddress,token);assert.equal(feed.items[0].source,'MemeHelm');
    const stale=createMarket(store,{client:{...client,getCode:async()=>'0x6000'}});await assert.rejects(()=>stale.feed(),/could not be loaded/);
    delete process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS;await store.mutateProjects(records=>records.push({owner:'alice',chainId:NETWORK.id,launchFactory:factory,launchHash:'0x'+'a'.repeat(64),published:false}));assert.equal((await createMarket(store).feed()).items.length,0);
  }finally{if(saved===undefined)delete process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS;else process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS=saved;await cleanup(dir);}
});
test('generic Robinhood ERC20 lookup reads actual supply and never invents pool prices or trades',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);let clock=1800000000000,calls=0,explorerDown=false,chainId=NETWORK.id;
  const client={getChainId:async()=>chainId,getCode:async()=>'0x6000',readContract:async({functionName})=>{calls++;return {name:'Verified Coin',symbol:'VC',totalSupply:10n**27n,decimals:18}[functionName];}};
  const fetcher=async url=>{if(explorerDown)throw new Error('offline');return Response.json(url.endsWith('/holders')?{items:[{address:{hash:creator},value:'100'}]}:{holders_count:'1'});};
  try{
    // Stale protocol cache entries must not be reused after migration.
    await store.change('market',records=>records.push({address:token,fetchedAt:clock,data:{source:'legacy',price:'100'}}));
    const market=createMarket(store,{client,fetcher,now:()=>clock}),data=await market.details(token);assert.equal(data.name,'Verified Coin');assert.equal(data.totalSupply,'1000000000000000000000000000');assert.equal(data.holdersCount,1);
    for(const field of ['price','marketCap','volume','progress','graduated','buyTaxBps'])assert.equal(data[field],null);assert.equal(market.history(token).length,1);assert.equal((await market.trades(token)).available,false);
    await market.details(token);assert.equal(calls,4);clock+=61000;explorerDown=true;const missing=await market.details(token);assert.equal(missing.holdersCount,null);assert.equal(missing.holderDataAvailable,false);assert.equal(missing.totalSupply,data.totalSupply);
    chainId=97;await assert.rejects(()=>market.details(creator),/another network/);await assert.rejects(()=>market.details('https://untrusted.example'),/valid token/);
  }finally{await cleanup(dir);}
});
test('monitor keeps alerts private, ignores missing prices and preserves facts on failed reads',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);let fail=false,clock=1800000000000;
  const initial={id:'watch-a',owner:'alice',address:token,symbol:'VC',enabled:true,priceThreshold:10,last:{price:'1',holdersCount:2,graduated:false}};
  try{
    await store.change('watches',records=>records.push(initial,{...initial,id:'watch-b',owner:'bob'},{...initial,id:'paused',owner:'alice',enabled:false}));
    const market={details:async()=>{if(fail)throw new Error('offline');return {symbol:'VC',price:null,holdersCount:3,graduated:null,checkedAt:new Date(clock).toISOString()};}},monitor=createMonitor(store,market,{now:()=>clock});
    assert.equal((await monitor.check('alice')).checked,1);assert.equal(store.read('alerts').length,1);assert.ok(store.read('alerts').every(item=>item.owner==='alice'&&item.read===false&&item.kind==='holders'));
    await monitor.check('alice');assert.equal(store.read('alerts').length,1);assert.equal(store.read('watches').find(item=>item.owner==='bob').last.price,'1');
    fail=true;clock+=60000;await monitor.check('alice');const watched=store.read('watches').find(item=>item.id==='watch-a');assert.equal(watched.last.holdersCount,3);assert.equal(watched.priceAvailable,false);assert.match(watched.error,/could not be checked/);assert.equal(store.read('alerts').length,1);
  }finally{await cleanup(dir);}
});
test('SQLite migration preserves legacy files and rolls back failed mutations',async()=>{
  const dir=await directory();try{await writeFile(resolve(dir,'projects.json'),JSON.stringify([{id:'legacy',chainId:97}]));const store=createWorkspaceStore(dir);assert.equal((await store.projects())[0].id,'legacy');await assert.rejects(()=>store.mutateProjects(records=>{records.push({id:'failed'});throw new Error('rollback');}),/rollback/);assert.equal((await store.projects()).length,1);await store.mutateProjects(records=>records.push({id:'saved',owner:'alice'}));assert.equal((await createWorkspaceStore(dir).projects()).length,2);}finally{await cleanup(dir);}
});
