import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createMarket} from '../server/market.mjs';
import {createMonitor} from '../server/monitor.mjs';
import {PONS} from '../shared/pons.mjs';
const token='0x1111111111111111111111111111111111111111',creator='0x2222222222222222222222222222222222222222';
async function directory(){await mkdir('qa',{recursive:true});return mkdtemp(resolve('qa','market-test-'));}
async function cleanup(dir){if(!resolve(dir).startsWith(resolve('qa')+sep))throw new Error('Unsafe test cleanup.');await rm(dir,{recursive:true,force:true});}

test('discovery queries only the official factory and discloses bounded event coverage',async()=>{const dir=await directory(),store=createWorkspaceStore(dir);try{const protocol={verify:async()=>{}},client={getBlockNumber:async()=>100000n,getBlock:async()=>({timestamp:1700000000n}),getLogs:async p=>{assert.equal(p.address,PONS.factory.address);return[{blockNumber:99999n,logIndex:0,transactionHash:'0x'+'a'.repeat(64),args:{token,curve:creator,deployer:creator,pairToken:'0x'+'0'.repeat(40)}}];},readContract:async p=>p.functionName==='name'?'Verified Coin':'VC'};const feed=await createMarket(store,{client,protocol}).feed();assert.equal(feed.items.length,1);assert.equal(feed.items[0].source,'Pons v2 / Robinhood mainnet');assert.equal(feed.fromBlock,'80000');assert.match(feed.scope,/20,000/);}finally{await cleanup(dir);}});

test('unregistered token lookup preserves supply without inventing prices, trades or graduation',async()=>{const dir=await directory(),store=createWorkspaceStore(dir);let clock=1800000000000,down=false;const protocol={verify:async()=>{},nativeRecord:async()=>{throw Error('Unregistered');}},client={readContract:async({functionName})=>({name:'Verified Coin',symbol:'VC',totalSupply:10n**27n,decimals:18,getLaunchedToken:{exists:false}})[functionName]};const fetcher=async url=>{if(down)throw Error('offline');return Response.json(url.endsWith('/holders')?{items:[{address:{hash:creator},value:'100'}]}:{holders_count:'1'});};try{await store.change('market',r=>r.push({address:token,fetchedAt:clock,data:{source:'legacy',price:'100'}}));const market=createMarket(store,{client,protocol,fetcher,now:()=>clock}),data=await market.observe(token);assert.equal(data.totalSupply,String(10n**27n));assert.equal(data.holdersCount,1);for(const field of ['price','marketCap','volume','progress','graduated'])assert.equal(data[field],null);assert.equal((await market.trades(token)).available,false);assert.equal(market.history(token).length,1);clock+=61000;down=true;assert.equal((await market.observe(token)).holdersCount,null);await assert.rejects(()=>market.details('https://bad.example'),/valid token/);}finally{await cleanup(dir);}});

test('monitor keeps alerts private, ignores missing prices and preserves facts on failed reads',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);let fail=false,clock=1800000000000;
  const initial={id:'watch-a',owner:'alice',address:token,symbol:'VC',enabled:true,priceThreshold:10,last:{price:'1',holdersCount:2,graduated:false}};
  try{
    await store.change('watches',records=>records.push(initial,{...initial,id:'watch-b',owner:'bob'},{...initial,id:'paused',owner:'alice',enabled:false}));
    const market={details:async()=>{if(fail)throw new Error('offline');return {symbol:'VC',price:null,holdersCount:3,graduated:null,checkedAt:new Date(clock).toISOString()};}},monitor=createMonitor(store,market,{now:()=>clock});
    assert.equal((await monitor.check('alice')).checked,1);assert.equal(store.read('alerts').length,1);assert.ok(store.read('alerts').every(item=>item.owner==='alice'&&item.read===false&&item.kind==='holders'));
    await monitor.check('alice');assert.equal(store.read('alerts').length,1);assert.equal(store.read('watches').find(item=>item.owner==='bob').last.price,'1');
    assert.equal(store.read('watches').find(item=>item.id==='watch-a').last.graduated,false);
    market.details=async()=>({symbol:'VC',price:'1.2',holdersCount:3,graduated:true,checkedAt:new Date(clock).toISOString()});await monitor.check('alice');assert.equal(store.read('alerts').length,3);assert.ok(store.read('alerts').some(item=>item.kind==='graduation'));
    market.details=async()=>{throw new Error('offline');};
    fail=true;clock+=60000;await monitor.check('alice');const watched=store.read('watches').find(item=>item.id==='watch-a');assert.equal(watched.last.holdersCount,3);assert.equal(watched.priceAvailable,true);assert.match(watched.error,/could not be checked/);assert.equal(store.read('alerts').length,3);
  }finally{await cleanup(dir);}
});
test('SQLite migration preserves legacy files and rolls back failed mutations',async()=>{
  const dir=await directory();try{await writeFile(resolve(dir,'projects.json'),JSON.stringify([{id:'legacy',chainId:97}]));const store=createWorkspaceStore(dir);assert.equal((await store.projects())[0].id,'legacy');await assert.rejects(()=>store.mutateProjects(records=>{records.push({id:'failed'});throw new Error('rollback');}),/rollback/);assert.equal((await store.projects()).length,1);await store.mutateProjects(records=>records.push({id:'saved',owner:'alice'}));assert.equal((await createWorkspaceStore(dir).projects()).length,2);}finally{await cleanup(dir);}
});
