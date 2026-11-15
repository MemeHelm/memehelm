import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenResearch} from '../server/token-research.mjs';
import {PONS} from '../shared/pons.mjs';
const token='0x1111111111111111111111111111111111111111',creator='0x2222222222222222222222222222222222222222',other='0x3333333333333333333333333333333333333333';
const tx=n=>'0x'+String(n).padStart(64,'0');
const date='2026-11-15T00:00:00.000Z',instant=Date.parse(date);
const event=(asset,number,extra={})=>({args:{token:asset,deployer:creator},blockNumber:BigInt(number),logIndex:0,transactionHash:tx(number),...extra});
const trade=(kind,wallet,number,extra={})=>({kind,wallet,amount:'123.456789',value:'0.025',currency:'ETH',transactionHash:tx(number),checkedAt:date,poolTrade:false,...extra});
function fixture({forensics,events=[],trades=[],partial=false,available=true}={}){
  const calls={registry:0,trades:0,logs:[]};
  const market={async forensics(){calls.registry++;return forensics??{checkedAt:date,registration:{registered:true,deployer:creator}};},async trades(){calls.trades++;return{available,items:trades,currency:'ETH',fromBlock:'1',toBlock:'20000',partial,scope:'Latest 60 executions within 20,000 blocks.'};}};
  const client={async getBlockNumber(){return 25000n;},async getLogs(input){calls.logs.push(input);return events.filter(log=>log.blockNumber>=input.fromBlock&&log.blockNumber<=input.toBlock);},async readContract({functionName}){return functionName==='name'?'Example Coin':'EX';},async getBlock(){return{timestamp:BigInt(instant/1000)};}};
  return{calls,client,market};
}

test('research bounds creator launch history, retains receipt evidence and does not attribute pool routers',async()=>{
  const f=fixture({events:[event(token,24000),event(other,18000),event(other,18000),event(other,18001,{removed:true}),event(token,4999)],trades:[trade('buy',creator,1),trade('sell',creator,2),trade('sell',creator,3,{poolTrade:true}),trade('buy',other,4)]});
  const report=await createTokenResearch({...f,now:()=>instant}).research(token);
  assert.equal(report.chainId,4663);assert.equal(report.registration.deployer,creator);assert.equal(report.launchHistory.count,2);assert.equal(report.launchHistory.items[0].current,true);assert.equal(report.launchHistory.items[0].name,'Example Coin');
  assert.deepEqual(f.calls.logs.map(page=>[String(page.fromBlock),String(page.toBlock)]),[['5001','10000'],['10001','15000'],['15001','20000'],['20001','25000']]);
  assert.ok(f.calls.logs.every(page=>page.address===PONS.factory.address&&page.args.deployer===creator&&page.event.name==='TokenLaunched'));
  assert.equal(report.creatorTrading.count,2);assert.equal(report.creatorTrading.buys,1);assert.equal(report.creatorTrading.sells,1);assert.equal(report.creatorTrading.poolEventsNotAttributed,1);
  assert.equal(report.evidence.length,5);assert.equal(report.evidence[0].transactionHash,null);
  for(const receipt of report.evidence.filter(item=>item.kind!=='registry')){assert.equal(receipt.url,'https://robinhoodchain.blockscout.com/tx/'+receipt.transactionHash);assert.equal(receipt.timestamp,date);assert.equal(receipt.checkedAt,date);assert.ok(receipt.coverage.scope);}
  assert.equal(report.fundingRelationships.status,'unknown');assert.match(report.fundingRelationships.message,/not been established/);assert.equal(report.score,undefined);assert.equal(report.safe,undefined);
});

test('source failures and timeouts stay unavailable rather than zero launches or trades',async()=>{
  const f=fixture();f.market.forensics=()=>new Promise(()=>{});f.market.trades=()=>new Promise(()=>{});
  const service=createTokenResearch({...f,deadlines:{forensics:8,trades:8,total:100}}),start=performance.now();
  const report=await service.research(token);
  assert.ok(performance.now()-start<250);assert.equal(report.registration.registered,null);assert.equal(report.launchHistory.count,null);assert.equal(report.creatorTrading.count,null);assert.equal(report.creatorTrading.buys,null);assert.deepEqual(report.evidence,[]);assert.equal(f.calls.logs.length,0);
});

test('factory all-failed queries retain unknown counts and are retried, not cached',async()=>{
  const f=fixture();let logs=0;f.client.getLogs=async()=>{logs++;throw new Error('RPC unavailable');};
  const service=createTokenResearch({...f});
  for(let i=0;i<2;i++){const report=await service.research(token);assert.equal(report.launchHistory.status,'unavailable');assert.equal(report.launchHistory.count,null);assert.deepEqual(report.launchHistory.items,[]);}
  assert.equal(logs,8);assert.equal(f.calls.registry,2);
});

test('a history deadline returns unknown and a late block result cannot start more reads',async()=>{
  const f=fixture();let finish;f.client.getBlockNumber=()=>new Promise(resolve=>finish=resolve);
  const service=createTokenResearch({...f,deadlines:{history:8,total:100}});
  const report=await service.research(token);assert.equal(report.launchHistory.status,'unavailable');assert.equal(report.launchHistory.count,null);
  finish(25000n);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.logs.length,0);
});

test('partial factory ranges are explicitly lower-bound evidence and metadata failure does not erase receipts',async()=>{
  const f=fixture({events:[event(token,24000)]}),original=f.client.getLogs;
  f.client.getLogs=async input=>{if(input.fromBlock===10001n)throw new Error('range down');return original(input);};
  f.client.readContract=async()=>{throw new Error('metadata down');};f.client.getBlock=async()=>{throw new Error('block time down');};
  const report=await createTokenResearch({...f}).research(token);
  assert.equal(report.launchHistory.status,'available');assert.equal(report.launchHistory.count,1);assert.equal(report.launchHistory.coverage.partial,true);assert.match(report.launchHistory.message,/lower bound/);assert.equal(report.launchHistory.items[0].timestamp,null);assert.equal(report.launchHistory.items[0].name,null);assert.ok(report.evidence.some(item=>item.transactionHash===tx(24000)));
});

test('a confirmed non-pons token is outside scope and never triggers guessed creator attribution',async()=>{
  const f=fixture({forensics:{checkedAt:date,registration:{registered:false,deployer:creator}},trades:[trade('sell',creator,1)]});
  const report=await createTokenResearch({...f}).research(token);
  assert.equal(report.registration.registered,false);assert.equal(report.registration.deployer,null);assert.equal(report.launchHistory.status,'outside-scope');assert.equal(report.creatorTrading.status,'outside-scope');assert.equal(report.creatorTrading.count,null);assert.equal(f.calls.logs.length,0);assert.equal(report.evidence.length,1);
});

test('short cache, explicit refresh and in-flight coalescing avoid redundant reads',async()=>{
  const f=fixture();let now=instant;
  const service=createTokenResearch({...f,now:()=>now,ttlMs:30000});
  const first=await Promise.all([service.research(token),service.research(token.toUpperCase().replace('0X','0x'))]);assert.equal(first[0],first[1]);assert.equal(f.calls.registry,1);
  assert.equal(await service.research(token),first[0]);assert.equal(f.calls.registry,1);
  await service.research(token,{refresh:true});assert.equal(f.calls.registry,2);
  now+=30001;await service.research(token);assert.equal(f.calls.registry,3);
});

test('history output is capped, all receipt names are escaped by consumers, and bad input never reads chain',async()=>{
  const events=Array.from({length:15},(_,index)=>event('0x'+String(index+4).padStart(40,'0'),24000+index));
  const f=fixture({events});f.client.readContract=async()=>'<script>not markup</script>';
  const service=createTokenResearch({...f});
  await assert.rejects(()=>service.research('not-an-address'),error=>error.statusCode===400);assert.equal(f.calls.registry,0);
  const report=await service.research(token);assert.equal(report.launchHistory.count,15);assert.equal(report.launchHistory.items.length,12);assert.equal(report.launchHistory.truncated,true);assert.equal(report.evidence.filter(item=>item.kind==='launch').length,12);
});

test('invalid event source fields and unproven trade receipts are excluded, not fabricated',async()=>{
  const f=fixture({events:[event(token,24000,{transactionHash:'https://malicious.example/'}),event(other,24001,{args:{token:other,deployer:other}})],trades:[trade('sell',creator,1,{transactionHash:'javascript:evil'})]});
  const report=await createTokenResearch({...f}).research(token);assert.equal(report.launchHistory.coverage.partial,true);assert.equal(report.launchHistory.count,0);assert.equal(report.creatorTrading.count,0);assert.ok(report.evidence.every(item=>item.kind==='registry'));
});

test('a provided emitter must match the factory even when the RPC query was already factory-scoped',async()=>{
  const f=fixture({events:[event(token,24000,{address:other}),event(other,24001,{address:PONS.factory.address})]});
  const report=await createTokenResearch({...f}).research(token);
  assert.equal(report.launchHistory.count,1);assert.equal(report.launchHistory.items[0].token,other);assert.equal(report.launchHistory.coverage.partial,true);assert.equal(report.evidence.some(item=>item.transactionHash===tx(24000)),false);
});
