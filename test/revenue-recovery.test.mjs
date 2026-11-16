import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAbi,parseEther,zeroAddress,decodeFunctionData} from 'viem';
import {createPons} from '../server/pons.mjs';
import {PONS} from '../shared/pons.mjs';

const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222',token='0x3333333333333333333333333333333333333333',curve='0x4444444444444444444444444444444444444444',vault='0x5555555555555555555555555555555555555555',holder='0x6666666666666666666666666666666666666666',reject='0x7777777777777777777777777777777777777777';
const abi=parseAbi(['function distribute(address[] recipients,uint256[] amounts)','function execute(uint256 id)','function cancel(uint256 id)','function propose(address recipient,uint256 amount)']);
function fixture(kind='holders'){
 let time=1800000000000,rounds=0,balance=parseEther('1'),networkFailure=false,decimals=18;const simulations=[];
 const project={id:'project-a',owner,tokenAddress:token,vaultAddress:vault,chainId:4663};
 const artifacts={RevenueSplitVault:{deployedBytecode:'0x1111',abi},HoldersVault:{deployedBytecode:'0x2222',abi},SocialVault:{deployedBytecode:'0x3333',abi}};
 const client={getChainId:async()=>4663,getCode:async()=>kind==='holders'?'0x2222':'0x3333',getBlock:async()=>({timestamp:BigInt(Math.floor(time/1000))}),readContract:async({functionName,args=[]})=>{
  const values={feeEscrow:PONS.escrow.address,memeHook:PONS.hook.address,name:'Review',symbol:'REV',totalSupply:100n,decimals,getLaunchedToken:{token,curve,deployer:owner,creatorFeeRecipient:vault,pairToken:zeroAddress,buybackEnabled:false,phase:0,exists:true},balanceOf:0n,quoteFeeBalance:0n,creatorTaxBalance:0n,controller:owner,totalReceived:parseEther('1'),distributable:balance,totalDistributed:0n,rounds:BigInt(rounds),totalReleased:0n,proposalCount:23n,reviewWindow:172800n};
  if(functionName==='proposals')return[holder,parseEther('.1'),BigInt(Math.floor(time/1000)-172801),0];
  if(!(functionName in values))throw Error(functionName);return values[functionName];
 },simulateContract:async request=>{simulations.push(request);if(networkFailure)throw Error('RPC unavailable');if(request.functionName==='distribute'&&request.args[0].includes(reject))throw Error('Payout transfer failed');return{result:null};}};
 return{project,simulations,protocol:createPons({client,now:()=>time,loadArtifact:async name=>artifacts[name],checkCode:async()=>{}}),setTime:value=>time=value,setRounds:value=>rounds=value,setBalance:value=>balance=value,setNetworkFailure:value=>networkFailure=value,setDecimals:value=>decimals=value};
}
const holders={holderDataAvailable:true,holders:[{address:holder,balance:'70'},{address:reject,balance:'30'}],holdersCount:500,checkedAt:'2027-01-15T08:00:00.000Z',source:'Robinhood Blockscout token holders',snapshotBlock:null,paginationComplete:false,coverage:'partial'};

test('a failed holder transfer exposes a complete review and explicit exclusions keep original amounts',async()=>{
 const f=fixture(),review=await f.protocol.prepareDistribution(owner,f.project,holders);
 assert.equal(review.data,undefined);assert.match(review.simulationError,/recipient may reject ETH/);assert.equal(review.reviewRecipients.length,2);assert.equal(review.round.holdersCount,500);
 assert.deepEqual(review.failedRecipients,[reject]);assert.ok(f.simulations.length<=25);
 assert.equal(review.sampleAcknowledged,false);assert.equal(review.requiresSampleAcknowledgement,true);
 const revised=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:review.reviewId,confirmSampleCoverage:true,excludedRecipients:[reject]});
 assert.equal(revised.simulationError,null);assert.deepEqual(revised.recipients,[holder]);assert.deepEqual(revised.amounts,['0.7']);assert.equal(revised.total,'0.7');assert.equal(revised.retained,'0.3');
 const decoded=decodeFunctionData({abi,data:revised.data});assert.equal(decoded.functionName,'distribute');assert.deepEqual(decoded.args,[[holder],[parseEther('.7')]]);
 assert.deepEqual(revised.reviewRecipients,review.reviewRecipients);assert.equal(revised.sampleAcknowledged,true);assert.equal(revised.requiresSampleAcknowledgement,false);
 const adjusted=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:review.reviewId,excludedRecipients:[reject]});
 assert.ok(adjusted.data);assert.equal(adjusted.sampleAcknowledged,true);assert.deepEqual(adjusted.amounts,revised.amounts);
});

test('a network failure never labels a holder as rejecting ETH or invents a signable transaction',async()=>{
 const f=fixture();f.setNetworkFailure(true);const review=await f.protocol.prepareDistribution(owner,f.project,holders);
 assert.equal(review.data,undefined);assert.ok(review.simulationError);assert.deepEqual(review.failedRecipients,[]);assert.equal(f.simulations.length,1);
 const confirmed=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:review.reviewId,confirmSampleCoverage:true});
 assert.equal(confirmed.sampleAcknowledged,true);assert.equal(confirmed.data,undefined);assert.ok(confirmed.simulationError);assert.deepEqual(confirmed.failedRecipients,[]);
});

test('holder review is wallet/project bound, rejects spent rounds and expires without rebuilding allocations',async()=>{
 const f=fixture(),review=await f.protocol.prepareDistribution(owner,f.project,holders),input={reviewId:review.reviewId,excludedRecipients:[reject]};
 await assert.rejects(()=>f.protocol.prepareDistribution(other,f.project,null,input),/another wallet/);
 await assert.rejects(()=>f.protocol.prepareDistribution(owner,{...f.project,id:'project-b'},null,input),/expired/);
 await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,{...input,excludedRecipients:[other]}),/not in the reviewed payout/);
 f.setRounds(1);await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,input),/already signed/);f.setRounds(0);
 f.setBalance(parseEther('.6'));await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,input),/balance changed/);
 f.setBalance(parseEther('.9'));await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,input),/balance changed/);f.setBalance(parseEther('1'));
 f.setTime(1800000600001);await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,input),/expired/);
});

test('a new review requires a second explicit sample acknowledgement before returning any calldata',async()=>{
 const f=fixture(),sample={...holders,holders:[{address:holder,balance:'70'},{address:other,balance:'30'}]};
 const preview=await f.protocol.prepareDistribution(owner,f.project,sample,{confirmSampleCoverage:true});
 assert.equal(preview.data,undefined);assert.equal(preview.simulationError,null);assert.equal(preview.sampleAcknowledged,false);assert.equal(preview.requiresSampleAcknowledgement,true);
 assert.equal(preview.review.mode,'sample');assert.equal(preview.review.coverage,'partial');assert.match(preview.review.outsideSample,/outside this sample receive no payout/);
 assert.deepEqual(preview.review.evidence,{source:sample.source,checkedAt:sample.checkedAt,snapshotBlock:null,snapshotBlockHash:null,paginationComplete:false,balanceUnit:'token-base-units',tokenDecimals:18,sampled:2,returned:2,duplicateRows:0,denominatorBalance:'100',protocolExclusions:[curve,PONS.manager.address,vault],calculationVersion:'sample-pro-rata-v1'});
 const unconfirmed=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:preview.reviewId,confirmSampleCoverage:'true',excludedRecipients:[other]});
 assert.equal(unconfirmed.data,undefined);assert.equal(unconfirmed.sampleAcknowledged,false);assert.deepEqual(unconfirmed.amounts,['0.7']);
 // Fresh observations or mutations of a returned preview cannot replace the frozen sample.
 preview.review.evidence.denominatorBalance='1';preview.review.evidence.protocolExclusions.length=0;sample.holders[0].balance='1';
 const confirmed=await f.protocol.prepareDistribution(owner,f.project,{...sample,holders:[{address:other,balance:'999'}]},{reviewId:preview.reviewId,confirmSampleCoverage:true,excludedRecipients:[other]});
 assert.equal(confirmed.sampleAcknowledged,true);assert.equal(confirmed.requiresSampleAcknowledgement,false);assert.equal(confirmed.review.evidence.denominatorBalance,'100');assert.equal(confirmed.review.evidence.protocolExclusions.length,3);
 assert.deepEqual(confirmed.amounts,['0.7']);assert.equal(confirmed.total,'0.7');assert.equal(confirmed.retained,'0.3');
 assert.deepEqual(decodeFunctionData({abi,data:confirmed.data}).args,[[holder],[parseEther('.7')]]);
 const empty=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:preview.reviewId,excludedRecipients:[holder,other]});
 assert.equal(empty.sampleAcknowledged,true);assert.equal(empty.data,undefined);assert.match(empty.simulationError,/at least one recipient/);
});

test('review evidence keeps unknown coverage and decimals unknown without inventing a complete snapshot',async()=>{
 const f=fixture();f.setDecimals(undefined);
 const preview=await f.protocol.prepareDistribution(owner,f.project,{holderDataAvailable:true,holders:[{address:holder,balance:'100'}],holdersCount:1,coverage:'complete',paginationComplete:true});
 assert.equal(preview.review.coverage,'partial');assert.equal(preview.review.evidence.tokenDecimals,null);assert.equal(preview.review.evidence.source,null);assert.equal(preview.review.evidence.checkedAt,null);assert.equal(preview.review.evidence.snapshotBlock,null);
 const legacy=await f.protocol.prepareDistribution(owner,f.project,{holderDataAvailable:true,holders:[{address:holder,balance:'100'}]});
 assert.equal(legacy.review.coverage,'unknown');assert.equal(legacy.review.evidence.paginationComplete,null);assert.equal(legacy.round.holdersCount,null);
});

test('invalid and empty holder samples cannot create a signable payout review',async()=>{
 const f=fixture();
 for(const sample of [null,{holderDataAvailable:false}, {...holders,holders:[]},{...holders,holders:[{address:holder,balance:'0'}]},{...holders,holders:[{address:holder,balance:'70'},{address:holder,balance:'30'}]},{...holders,holders:[{address:holder,balance:'70'},{address:other}]}]){
  await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,sample),/Holder data|No eligible holder balances|Conflicting balances|holder balance/);
 }
 assert.equal(f.simulations.length,0);
});

test('a review near expiry never returns a transaction valid beyond its frozen sample lifetime',async()=>{
 const f=fixture(),preview=await f.protocol.prepareDistribution(owner,f.project,{...holders,holders:[{address:holder,balance:'100'}]});
 f.setTime(1800000599999);
 const tx=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:preview.reviewId,confirmSampleCoverage:true});
 assert.ok(tx.data);assert.equal(tx.expiresAt,preview.reviewExpiresAt);
 f.setTime(1800000600000);await assert.rejects(()=>f.protocol.prepareDistribution(owner,f.project,null,{reviewId:preview.reviewId,confirmSampleCoverage:true}),/expired/);
});

test('new vault deposits remain outside the frozen allocation instead of increasing any reviewed share',async()=>{
 const f=fixture(),preview=await f.protocol.prepareDistribution(owner,f.project,{...holders,holders:[{address:holder,balance:'70'},{address:other,balance:'30'}]});
 f.setBalance(parseEther('1.2'));
 const confirmed=await f.protocol.prepareDistribution(owner,f.project,null,{reviewId:preview.reviewId,confirmSampleCoverage:true,excludedRecipients:[other]});
 assert.ok(confirmed.data);assert.deepEqual(confirmed.amounts,['0.7']);assert.equal(confirmed.snapshotTotal,'1');assert.equal(confirmed.retained,'0.3');
 assert.equal(confirmed.review.unallocatedIncoming,'0.2');assert.match(confirmed.review.additionalFundsNote,/not allocated in this review/);
 assert.equal(parseEther(confirmed.total)+parseEther(confirmed.retained)+parseEther(confirmed.review.unallocatedIncoming),parseEther('1.2'));
 assert.deepEqual(confirmed.review.evidence,preview.review.evidence);
});

test('escrow proposal pagination retains access to every older open proposal',async()=>{
 const f=fixture('social'),first=await f.protocol.socialProposals(f.project),second=await f.protocol.socialProposals(f.project,{before:first.nextBefore}),last=await f.protocol.socialProposals(f.project,{before:second.nextBefore});
 assert.deepEqual(first.proposals.map(item=>item.id),[23,22,21,20,19,18,17,16,15,14]);assert.equal(first.nextBefore,14);
 assert.deepEqual(second.proposals.map(item=>item.id),[13,12,11,10,9,8,7,6,5,4]);assert.deepEqual(last.proposals.map(item=>item.id),[3,2,1]);assert.equal(last.nextBefore,null);
 assert.equal(new Set([...first.proposals,...second.proposals,...last.proposals].map(item=>item.id)).size,23);
 await assert.rejects(()=>f.protocol.socialProposals(f.project,{before:0}),/valid proposal page/);
});

test('escrow release requires explicit wallet-controller acknowledgement and preserves its onchain simulation',async()=>{
 const f=fixture('social');
 await assert.rejects(()=>f.protocol.socialEscrowAction(owner,f.project,'execute',{proposalId:1}),/controller wallet/);
 const prepared=await f.protocol.socialEscrowAction(owner,f.project,'execute',{proposalId:1,confirmWalletControl:true});
 assert.equal(prepared.label,'execute');assert.equal(prepared.to,vault);assert.equal(prepared.amount,'0.1');assert.equal(f.simulations.at(-1).functionName,'execute');assert.equal(f.simulations.at(-1).account,owner);
});
