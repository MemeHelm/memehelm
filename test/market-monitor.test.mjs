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

test('token forensics reports bounded observations with coverage, never scores',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);
  const buyer='0x3333333333333333333333333333333333333333',curve='0x4444444444444444444444444444444444444444',zero='0x'+'0'.repeat(40);
  const launch={exists:true,token,curve,deployer:creator,creatorFeeRecipient:creator,pairToken:zero,graduationThreshold:42n*10n**16n,creatorTaxBps:200n,buybackEnabled:false,phase:0};
  const client={getBlockNumber:async()=>5000n,getBlock:async()=>({timestamp:1700000000n}),getCode:async()=>'0x',
    getLogs:async parameters=>parameters.fromBlock===0n?[{blockNumber:10n,logIndex:0n,transactionHash:'0x'+'a'.repeat(64),eventName:'CurveBuy',args:{buyer:creator,quoteIn:10n**18n,tokensOut:5n*10n**20n}},{blockNumber:20n,logIndex:0n,transactionHash:'0x'+'b'.repeat(64),eventName:'CurveSell',args:{seller:buyer,tokensIn:10n**20n,quoteOut:5n**16n}},{blockNumber:30n,logIndex:0n,transactionHash:'0x'+'c'.repeat(64),eventName:'CurveBuy',args:{buyer,quoteIn:10n**17n,tokensOut:5n*10n**19n}}]:[],
    readContract:async({functionName})=>({name:'Verified Coin',symbol:'VC',totalSupply:10n**27n,decimals:18n,getLaunchedToken:launch}[functionName])};
  const protocol={verify:async()=>{},launchRecord:async()=>launch,marketState:async()=>({phase:0,price:'0.001',reserve:'1',progress:1,graduated:false,buyTaxBps:200,sellTaxBps:200,currency:'ETH',pairToken:zero,readyToGraduate:false}),quoteAsset:async()=>({address:zero,symbol:'ETH',decimals:18})};
  const fetcher=async url=>url.endsWith('/holders')?Response.json({items:[{address:{hash:creator},value:String(3n*10n**26n)},{address:{hash:buyer},value:String(10n**26n)}]}):Response.json({holders_count:'12'});
  try{
    const market=createMarket(store,{client,protocol,fetcher,now:()=>1800000000000}),report=await market.forensics(token);
    assert.equal(report.registration.registered,true);assert.equal(report.registration.phase,0);
    assert.equal(report.creatorEconomics.creatorTaxBps,200);assert.equal(report.creatorEconomics.recipientIsContract,false);assert.equal(report.creatorEconomics.buybackEnabled,false);
    assert.equal(report.concentration.share,40);assert.equal(report.concentration.largestCount,2);assert.equal(report.concentration.holdersCount,12);
    assert.match(report.concentration.note,/not a whale or ownership verdict/);
    assert.equal(report.observedTrading.buys,2);assert.equal(report.observedTrading.sells,1);assert.equal(report.observedTrading.distinctWallets,2);
    assert.equal(report.observedTrading.coverage.fromBlock,'0');assert.equal(report.observedTrading.coverage.toBlock,'5000');
    assert.equal(report.launcherActivity.buys,1);assert.equal(report.launcherActivity.sells,0);
    assert.deepEqual(report.flags.map(flag=>flag.id),['creator-fee','concentration','launcher-traded']);
    assert.match(report.flags[0].label,/Creator fee 2%/);assert.match(report.flags[1].label,/Top 2 balances hold 40%/);assert.match(report.flags[2].label,/Launching wallet traded 1×/);
    assert.ok(report.flags.every(flag=>typeof flag.label==='string'&&!/score|risk/i.test(flag.id)));
    assert.match(report.scope,/20,000 blocks/);assert.match(report.disclaimer,/not an independent audit/i);
    assert.equal(report.score,undefined);assert.equal(report.riskScore,undefined);
  }finally{await cleanup(dir);}
});

test('unregistered tokens get honest forensics without invented protocol facts',async()=>{
  const dir=await directory(),store=createWorkspaceStore(dir);
  const zero='0x'+'0'.repeat(40),buyer='0x3333333333333333333333333333333333333333';
  const client={getBlockNumber:async()=>5000n,getBlock:async()=>({timestamp:1700000000n}),getLogs:async()=>[],
    readContract:async({functionName})=>({name:'Outside Coin',symbol:'OC',totalSupply:10n**27n,decimals:18n,getLaunchedToken:{exists:false}}[functionName])};
  const protocol={verify:async()=>{},launchRecord:async()=>{throw new Error('not issued');},quoteAsset:async()=>({address:zero,symbol:'ETH',decimals:18})};
  const fetcher=async url=>url.endsWith('/holders')?Response.json({items:[{address:{hash:buyer},value:String(10n**26n)}]}):Response.json({holders_count:'1'});
  try{
    const report=await createMarket(store,{client,protocol,fetcher,now:()=>1800000000000}).forensics(token);
    assert.equal(report.registration.registered,false);
    assert.deepEqual(report.flags.map(flag=>flag.id),['unregistered']);assert.match(report.flags[0].label,/Not a pons v2 launch/);
    assert.equal(report.creatorEconomics,null);assert.equal(report.observedTrading,null);assert.equal(report.launcherActivity,null);
    assert.equal(report.concentration.share,10);
    assert.match(report.disclaimer,/not an independent audit/i);
  }finally{await cleanup(dir);}
});
