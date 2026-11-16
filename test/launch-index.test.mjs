import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {zeroAddress} from 'viem';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createLaunchIndex,LAUNCH_INDEX_IDENTITY} from '../server/launch-index.mjs';
import {PONS} from '../shared/pons.mjs';

const address=number=>'0x'+number.toString(16).padStart(40,'0');
const digest=value=>'0x'+createHash('sha256').update(String(value)).digest('hex');
const date='2027-01-15T08:00:00.000Z';
const eventAt=(block,id=block,logIndex=0)=>({block,id,logIndex,token:address(id+100),curve:address(id+10000),deployer:address(2),pairToken:zeroAddress});

async function fixture(t,{head=20,events=[],options={}}={}){
  await mkdir('qa',{recursive:true});const directory=await mkdtemp(resolve('qa','launch-index-'));
  t.after(async()=>{assert.ok(resolve(directory).startsWith(resolve('qa')+sep));await rm(directory,{recursive:true,force:true});});
  let height=head,clock=Date.parse(date),forkAt=Infinity,version=0,chainId=4663,logReader=null,headerReader=null;
  const calls=[],ranges=[];let records=events;
  const hashOf=number=>digest(`block:${number}:fork:${number>=forkAt?version:0}`);
  const block=number=>({number:BigInt(number),hash:hashOf(number),parentHash:number?hashOf(number-1):digest('genesis'),timestamp:1800000000n+BigInt(number)});
  const log=item=>({address:PONS.factory.address,eventName:'TokenLaunched',removed:false,blockNumber:BigInt(item.block),blockHash:hashOf(item.block),transactionHash:digest('tx:'+item.id),logIndex:item.logIndex,args:{token:item.token,curve:item.curve,deployer:item.deployer,pairToken:item.pairToken,launchConfigId:0n,graduationThreshold:4200000000000000000n}});
  const client={
    getChainId:async()=>{calls.push('chain');return chainId;},
    getBlockNumber:async()=>{calls.push('head');return BigInt(height);},
    getBlock:async({blockNumber})=>{const number=Number(blockNumber);calls.push('header:'+number);return headerReader?headerReader(number,()=>block(number)):block(number);},
    getLogs:async request=>{
      assert.equal(request.address,PONS.factory.address);assert.equal(request.event.name,'TokenLaunched');
      const from=Number(request.fromBlock),to=Number(request.toBlock);calls.push(`logs:${from}-${to}`);ranges.push([from,to]);
      const read=()=>records.filter(item=>item.block>=from&&item.block<=to).map(log);
      return logReader?logReader({from,to,read}):read();
    },
  };
  const store=createWorkspaceStore(directory),settings={client,now:()=>clock,bootstrapBlocks:20n,batchSize:5,...options};
  let index=createLaunchIndex(store,settings);
  return{store,client,calls,ranges,block,log,hashOf,get index(){return index;},
    setHead:value=>height=value,setEvents:value=>records=value,setChainId:value=>chainId=value,
    setLogReader:value=>logReader=value,setHeaderReader:value=>headerReader=value,
    fork:value=>{forkAt=value;version++;},advance:value=>clock+=value,
    restart:()=>{const reopened=createWorkspaceStore(directory);index=createLaunchIndex(reopened,settings);return reopened;},
  };
}

test('the initial index covers exactly the recent 20,000 blocks and persists canonical launch time',async t=>{
  const f=await fixture(t,{head:25000,events:[eventAt(5000,1),eventAt(5001,2),eventAt(25000,3)],options:{bootstrapBlocks:20000n,batchSize:5000}});
  const result=await f.index.sync();
  assert.deepEqual(f.ranges,[[5001,10000],[10001,15000],[15001,20000],[20001,25000]]);
  assert.equal(result.coverage.fromBlock,'5001');assert.equal(result.coverage.toBlock,'25000');assert.equal(result.coverage.nextBlock,'25001');assert.equal(result.coverage.count,2);
  assert.equal(result.coverage.allTime,false);assert.equal(result.coverage.finality,'observed');assert.equal(result.coverage.status,'current');assert.equal(result.coverage.partial,false);
  assert.equal(result.coverage.factoryCodeHash,PONS.factory.codeHash);assert.ok(LAUNCH_INDEX_IDENTITY.id.includes(PONS.factory.codeHash.toLowerCase()));
  assert.equal(result.logs[0].createdAt,new Date(Number(f.block(25000).timestamp)*1000).toISOString());
  assert.equal(result.logs[0].blockNumber,25000n);assert.equal(result.logs[0].args.launchConfigId,0n);
  const savedTime=result.logs[0].createdAt;f.restart();assert.equal(f.index.snapshot().logs[0].createdAt,savedTime);
  assert.equal(f.store.read('launches').length,0,'Launch events use indexed tables, not an ever-growing document array.');
});

test('a failed range cannot advance the contiguous frontier and restart resumes the gap',async t=>{
  const f=await fixture(t,{head:100,events:[eventAt(82),eventAt(89),eventAt(100)]});
  f.setLogReader(({from,read})=>{if(from===86)throw Error('fixture provider secret');return read();});
  const partial=await f.index.sync();
  assert.equal(partial.coverage.fromBlock,'81');assert.equal(partial.coverage.toBlock,'85');assert.equal(partial.coverage.nextBlock,'86');assert.equal(partial.coverage.count,1);assert.equal(partial.stale,true);
  assert.deepEqual(partial.coverage.missingRanges,[{fromBlock:'86',toBlock:'100'}]);assert.ok(!JSON.stringify(partial.coverage).includes('secret'));assert.ok(!partial.error.includes('secret'));
  const committedAt=partial.coverage.lastSuccessAt;f.advance(1000);f.restart();f.setLogReader(null);
  const restored=await f.index.sync();
  assert.deepEqual(f.ranges,[[81,85],[86,90],[86,90],[91,95],[96,100]]);
  assert.equal(restored.coverage.count,3);assert.equal(restored.coverage.fromBlock,'81');assert.equal(restored.coverage.toBlock,'100');assert.equal(restored.error,null);assert.equal(restored.stale,false);
  assert.notEqual(restored.coverage.lastSuccessAt,committedAt);
});

test('retained history outlives the rolling bootstrap window and preview cap does not truncate coverage',async t=>{
  const f=await fixture(t,{head:20,events:Array.from({length:20},(_,i)=>eventAt(i+1)),options:{previewLimit:2}});
  let result=await f.index.sync();assert.equal(result.logs.length,2);assert.equal(result.coverage.count,20);
  f.setHead(30);f.setEvents([...Array.from({length:20},(_,i)=>eventAt(i+1)),eventAt(30)]);f.restart();result=await f.index.sync();
  assert.equal(result.coverage.fromBlock,'1');assert.equal(result.coverage.toBlock,'30');assert.equal(result.coverage.count,21);assert.equal(result.logs.length,2);
});

test('duplicate transaction logs are idempotent and conflicting copies invalidate the whole range',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2,7,0),eventAt(2,7,1)],options:{batchSize:5}});
  f.setLogReader(({read})=>{const result=read();return result.length?[result[1],result[0],result[0]]:[];});
  let result=await f.index.sync();assert.equal(result.coverage.count,2);assert.deepEqual(result.logs.map(item=>item.logIndex),[1,0]);
  f.setHead(10);f.setEvents([eventAt(7,8)]);
  f.setLogReader(({read})=>{const result=read();return[result[0],{...result[0],args:{...result[0].args,token:address(999)}}];});
  result=await f.index.sync();assert.equal(result.coverage.toBlock,'5');assert.equal(result.coverage.count,2);assert.equal(result.stale,true);assert.match(result.error,/Conflicting/);
});

test('impossible block positions and one transaction attributed to different blocks reject the whole range',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2),eventAt(3)]});
  f.setLogReader(({read})=>{const logs=read();return[logs[0],{...logs[0],transactionHash:digest('another transaction')}];});
  let result=await f.index.sync();assert.equal(result.coverage.toBlock,null);assert.match(result.error,/positions/);
  f.setLogReader(({read})=>{const logs=read();return[logs[0],{...logs[1],transactionHash:logs[0].transactionHash,logIndex:1}];});
  result=await f.index.sync();assert.equal(result.coverage.toBlock,null);assert.equal(result.coverage.count,0);assert.match(result.error,/positions/);
});

test('malformed emitters, hashes, addresses, amounts and positions never advance or silently skip a log',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)]});
  const changes=[
    log=>({...log,address:address(999)}),log=>({...log,address:undefined}),log=>({...log,eventName:'Other'}),log=>({...log,removed:true}),
    log=>({...log,transactionHash:'0x1234'}),log=>({...log,blockHash:null}),log=>({...log,blockNumber:-1n}),log=>({...log,blockNumber:6n}),
    log=>({...log,logIndex:-1}),log=>({...log,logIndex:1.5}),log=>({...log,args:{...log.args,token:zeroAddress}}),
    log=>({...log,args:{...log.args,curve:'invalid'}}),log=>({...log,args:{...log.args,deployer:undefined}}),log=>({...log,args:{...log.args,pairToken:'bad'}}),
    log=>({...log,args:{...log.args,launchConfigId:undefined}}),log=>({...log,args:{...log.args,graduationThreshold:'-1'}}),
  ];
  for(const change of changes){
    f.setLogReader(({read})=>[change(read()[0])]);const result=await f.index.sync();
    assert.equal(result.logs.length,0);assert.equal(result.coverage.toBlock,null);assert.equal(result.coverage.nextBlock,'0');assert.equal(result.stale,true);
  }
  f.setLogReader(null);const recovered=await f.index.sync();assert.equal(recovered.coverage.count,1);assert.equal(recovered.coverage.toBlock,'5');
});

test('a log hash must match a canonical numbered header with a valid timestamp',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)]});
  for(const change of [header=>({...header,number:3n}),header=>({...header,hash:digest('wrong block')}),header=>({...header,timestamp:undefined})]){
    f.setHeaderReader((number,read)=>number===2?change(read()):read());
    const result=await f.index.sync();assert.equal(result.logs.length,0);assert.equal(result.coverage.toBlock,null);assert.equal(result.coverage.partial,true);
  }
});

test('a shallow reorg removes orphan logs and replays from the last matching checkpoint',async t=>{
  const f=await fixture(t,{head:20,events:[eventAt(2),eventAt(17)],options:{batchSize:10}});
  const first=await f.index.sync();assert.equal(first.coverage.count,2);
  f.fork(16);f.setEvents([eventAt(2),eventAt(18)]);f.advance(1000);
  const result=await f.index.sync();
  assert.equal(result.coverage.reorg.kind,'rollback');assert.equal(result.coverage.reorg.fromBlock,'11');assert.equal(result.coverage.count,2);
  assert.deepEqual(result.logs.map(item=>item.blockNumber),[18n,2n]);assert.ok(!result.logs.some(item=>item.args.token===address(117)));
  assert.equal(result.coverage.toBlock,'20');assert.equal(result.coverage.invalidated,false);
});

test('a deep reorg resets the observed window and never labels a rebuilt slice as all-time coverage',async t=>{
  const f=await fixture(t,{head:20,events:[eventAt(2),eventAt(17)],options:{maxReorgChecks:2}});
  await f.index.sync();f.fork(0);f.setHead(30);f.setEvents([eventAt(2),eventAt(12),eventAt(29)]);
  const result=await f.index.sync();
  assert.equal(result.coverage.reorg.kind,'reset');assert.equal(result.coverage.bootstrapFromBlock,'11');assert.equal(result.coverage.fromBlock,'11');assert.equal(result.coverage.toBlock,'30');
  assert.deepEqual(result.logs.map(item=>item.blockNumber),[29n,12n]);assert.equal(result.coverage.allTime,false);assert.equal(result.coverage.count,2);
});

test('a confirmed checkpoint mismatch hides all potentially orphaned events even if ancestor lookup then fails',async t=>{
  const f=await fixture(t,{head:20,events:[eventAt(2),eventAt(17)],options:{batchSize:10}});await f.index.sync();
  f.fork(1);f.setHeaderReader((number,read)=>{if(number===10)throw Error('Ancestor RPC failed');return read();});
  const failed=await f.index.sync();
  assert.deepEqual(failed.logs,[]);assert.equal(failed.coverage.count,0);assert.equal(failed.coverage.fromBlock,null);assert.equal(failed.coverage.toBlock,null);assert.equal(failed.coverage.invalidated,true);assert.equal(failed.stale,true);
  f.restart();assert.deepEqual(f.index.snapshot().logs,[],'Restart cannot expose quarantined orphan records.');
  f.setHeaderReader(null);f.setEvents([eventAt(3)]);const repaired=await f.index.sync();assert.deepEqual(repaired.logs.map(item=>item.blockNumber),[3n]);assert.equal(repaired.coverage.invalidated,false);
});

test('a previous-checkpoint race invalidates persisted orphans in the same response',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)],options:{maxRanges:1}});await f.index.sync();f.setHead(10);f.setEvents([eventAt(2),eventAt(7)]);
  let first=true;f.setHeaderReader((number,read)=>{const result=read();if(number===4&&first){first=false;f.fork(1);}return result;});
  const result=await f.index.sync();assert.equal(result.coverage.invalidated,true);assert.deepEqual(result.logs,[]);assert.equal(result.coverage.count,0);assert.equal(result.stale,true);
  assert.match(result.error,/previous launch checkpoint/);
});

test('a changing batch endpoint cannot commit new events or leave known old orphans visible',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)],options:{maxRanges:1}});await f.index.sync();f.setHead(10);f.setEvents([eventAt(7)]);
  f.setLogReader(({read})=>{f.fork(1);return read();});
  const result=await f.index.sync();assert.equal(result.coverage.invalidated,true);assert.deepEqual(result.logs,[]);assert.equal(result.coverage.toBlock,null);
});

test('events, range checkpoints and cursor roll back together when a SQLite write fails',async t=>{
  const f=await fixture(t,{head:5});const repository=f.store.launchIndex,identity=LAUNCH_INDEX_IDENTITY;
  repository.initialize(identity,{fromBlock:0,targetBlock:5,at:date});
  const event={...f.log(eventAt(2)),blockNumber:2,createdAt:date,args:{token:address(102),curve:address(10002),deployer:address(2),pairToken:zeroAddress,launchConfigId:'0',graduationThreshold:'420'}};
  const broken={...event,transactionHash:digest('second tx'),args:{...event.args,launchConfigId:1n}};
  assert.throws(()=>repository.commitRange(identity,{fromBlock:0,toBlock:5,endHash:f.hashOf(5),events:[event,broken],at:date,targetBlock:5}),/BigInt/);
  assert.equal(repository.count(identity),0);assert.deepEqual(repository.ranges(identity),[]);assert.equal(repository.state(identity).nextBlock,0);
});

test('strict request budgets make bounded progress through dense ranges instead of skipping events',async t=>{
  const f=await fixture(t,{head:20,events:Array.from({length:20},(_,i)=>eventAt(i+1)),options:{batchSize:20,maxRequests:8}});
  let result=await f.index.sync();assert.ok(f.calls.length<=8);assert.equal(result.coverage.toBlock,'3');assert.equal(result.coverage.count,3);assert.equal(result.coverage.partial,true);
  const firstCalls=f.calls.length;result=await f.index.sync();assert.ok(f.calls.length-firstCalls<=8);assert.equal(result.coverage.nextBlock,'5');assert.equal(result.coverage.count,4);
});

test('a reorg search larger than its request budget resets conservatively and can make progress next time',async t=>{
  const f=await fixture(t,{head:20,events:[eventAt(2)],options:{batchSize:1,maxRanges:16,maxRequests:200,maxReorgChecks:32}});
  await f.index.sync();await f.index.sync();f.fork(0);
  const bounded=createLaunchIndex(f.store,{client:f.client,now:()=>Date.parse(date),bootstrapBlocks:20n,batchSize:5,maxRequests:8,maxReorgChecks:32});
  const before=f.calls.length,result=await bounded.sync();assert.ok(f.calls.length-before<=8);assert.equal(result.coverage.reorg.kind,'reset');assert.equal(result.coverage.toBlock,null);assert.deepEqual(result.logs,[]);
  const recovered=await bounded.sync();assert.equal(recovered.coverage.fromBlock,'1');assert.ok(Number(recovered.coverage.toBlock)>=5);
});

test('numeric RPC codes and spoofed internal codes cannot throw from error handling or expose raw provider messages',async t=>{
  const f=await fixture(t,{head:5});
  for(const code of [-32000,'INDEX_BUDGET']){
    f.setLogReader(()=>{throw Object.assign(Error('fixture provider secret URL'),{code});});
    const result=await f.index.sync();assert.equal(result.coverage.toBlock,null);assert.equal(result.stale,true);assert.ok(!result.error.includes('secret'));
  }
});

test('timeouts and caller cancellation cannot persist late logs or advance a checkpoint',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)],options:{syncTimeoutMs:30,requestTimeoutMs:30}});
  let release;f.setLogReader(({read})=>new Promise(resolve=>{release=()=>resolve(read());}));
  const result=await f.index.sync();assert.equal(result.logs.length,0);assert.equal(result.coverage.toBlock,null);assert.equal(result.stale,true);
  release();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.index.snapshot().coverage.toBlock,null);assert.equal(f.store.launchIndex.count(LAUNCH_INDEX_IDENTITY),0);
  f.setLogReader(null);let active=true;
  f.setHeaderReader((number,read)=>{if(number===2)active=false;return read();});
  await assert.rejects(()=>f.index.sync({assertActive:()=>{if(!active)throw Error('Fixture caller expired');}}),/caller expired/);
  assert.equal(f.index.snapshot().coverage.toBlock,null);
});

test('head verification refreshes verifiedAt without pretending a new range was persisted',async t=>{
  const f=await fixture(t,{head:5,events:[eventAt(2)]});const first=await f.index.sync();f.advance(1000);
  const next=await f.index.sync();assert.notEqual(next.coverage.verifiedAt,first.coverage.verifiedAt);assert.equal(next.coverage.lastSuccessAt,first.coverage.lastSuccessAt);
  f.advance(61000);assert.equal(f.index.snapshot().stale,true);
  f.setChainId(1);const wrong=await f.index.sync();assert.equal(wrong.stale,true);assert.match(wrong.error,/4663/);assert.equal(wrong.coverage.count,1);
});

test('missing persistence or canonical RPC primitives remain unavailable rather than fabricated verified coverage',async t=>{
  const missing=await createLaunchIndex({},{}).sync();assert.equal(missing.coverage.status,'unavailable');assert.deepEqual(missing.logs,[]);assert.equal(missing.coverage.fromBlock,null);assert.equal(missing.coverage.allTime,false);
  const f=await fixture(t);const unsupported=await createLaunchIndex(f.store,{client:{getBlockNumber:async()=>20n}}).sync();assert.equal(unsupported.coverage.status,'unavailable');assert.equal(unsupported.coverage.toBlock,null);assert.deepEqual(unsupported.logs,[]);
});
