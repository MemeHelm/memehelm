import test from 'node:test';
import assert from 'node:assert/strict';
import {formatUnits} from 'viem';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const wallet='0x1111111111111111111111111111111111111111',holder='0x2222222222222222222222222222222222222222',vault='0x3333333333333333333333333333333333333333';
const review={mode:'sample',coverage:'partial',evidence:{source:'Blockscout token holder balances',checkedAt:'2026-11-16T15:00:00Z',snapshotBlock:null,snapshotBlockHash:null,paginationComplete:false,balanceUnit:'token-base-units',tokenDecimals:6,sampled:2,returned:3,duplicateRows:1,denominatorBalance:'100000001',protocolExclusions:[vault],calculationVersion:'sample-pro-rata-v1'},outsideSample:'Wallets outside this sample receive no payout in this round.',unallocatedIncoming:'0'};
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node).trim()===label);
const checkbox=(tree,text)=>findNode(findNode(tree,node=>node.type==='label'&&textOf(node).includes(text)),node=>node.type==='input'&&node.props.type==='checkbox');
const clone=value=>structuredClone(value),noop=()=>null;

test('coverage names the sample denominator and never treats pagination as a fixed-block guarantee',()=>{
 const props={review:clone(review),symbol:'SAMPLE'},component=componentHarness(new URL('../src/PayoutCoverage.tsx',import.meta.url),'PayoutCoverage',props,{viem:{formatUnits}});
 let copy=textOf(component.render());assert.match(copy,/This is a sample payout/);assert.match(copy,/Wallets outside this sample receive no payout/);assert.match(copy,/100\.000001 SAMPLE/);assert.match(copy,/More pages not included/);assert.match(copy,/Not established/);
 props.review.evidence.paginationComplete=true;copy=textOf(component.render());assert.match(copy,/No more pages reported/);assert.match(copy,/does not establish a complete fixed-block snapshot/);
 props.review.evidence.tokenDecimals=null;assert.match(textOf(component.render()),/100000001 base units/);
 props.review.unallocatedIncoming='0.25';assert.match(textOf(component.render()),/0\.25\s+ETH arrived after this review/);
 props.review=undefined;copy=textOf(component.render());assert.match(copy,/Coverage unknown/);assert.match(copy,/Not available/);assert.doesNotMatch(copy,/0 SAMPLE/);
 component.unmount();
});

function treasuryFixture(t){
 let component;const savedWindow=globalThis.window;globalThis.window=new EventTarget();t.after(()=>{component?.unmount();if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;});
 const calls=[],walletCalls=[],props={project:{id:'sample-project',name:'Sample',symbol:'SAMPLE',tokenAddress:holder,owner:wallet},wallet,selector:null,createProject:noop};let fail=false;
 const preview={chainId:4663,to:vault,value:'0',label:'distribute',expiresAt:new Date(Date.now()+60000).toISOString(),reviewId:'review-ui',reviewExpiresAt:new Date(Date.now()+600000).toISOString(),total:'1',retained:'0',snapshotTotal:'1',recipients:[wallet,holder],amounts:['0.7','0.3'],reviewRecipients:[{address:wallet,amount:'0.7'},{address:holder,amount:'0.3'}],excludedRecipients:[],sampleAcknowledged:false,requiresSampleAcknowledgement:true,review:clone(review),round:{included:2,eligible:2,sampled:2,holdersCount:600,checkedAt:review.evidence.checkedAt,minimum:'0.001',coveredBalance:'100000001',dropped:[]}};
 const api=async(path,body)=>{
  calls.push({path,body});
  if(path.endsWith('/snapshot'))return{symbol:'SAMPLE',vault:{kind:'holders',address:vault,controller:wallet,distributable:'1',totalReceived:'1',totalDistributed:'0',rounds:0},revenue:null};
  if(path.endsWith('/distribution/prepare')){if(fail)throw Error('The vault balance changed. Prepare a new snapshot.');const result=clone(preview);if(body.reviewId&&body.confirmSampleCoverage===true){Object.assign(result,{data:'0x1234',sampleAcknowledged:true,requiresSampleAcknowledgement:false,excludedRecipients:body.excludedRecipients||[]});}return result;}
  throw Error('Unexpected fixture request');
 };
 component=componentHarness(new URL('../src/TreasuryWorkspace.tsx',import.meta.url),'TreasuryWorkspace',props,{'./api':{api},'./wallet':{sendTransaction:async()=>{walletCalls.push('send');return{transactionHash:'0xfixture',recoveryId:'fixture'};},completeTransaction:noop},'./Brand':{Arrow:noop},'./PayoutCoverage':{PayoutCoverage:noop}});
 async function cycle(){for(let i=0;i<3;i++){component.render();component.effects();await settle();}return component.render();}
 async function start(){let tree=await cycle();await button(tree,'Preview sample payout').props.onClick();return cycle();}
 async function acknowledge(tree){checkbox(tree,'I understand this is a sample payout').props.onChange({target:{checked:true}});tree=await cycle();await button(tree,'Check selected payout').props.onClick();return cycle();}
 return{calls,walletCalls,component,cycle,start,acknowledge,setFailure:value=>fail=value};
}

test('a payout preview needs separate sample acknowledgement and a fresh check before wallet approval',async t=>{
 const f=treasuryFixture(t);let tree=await f.start();assert.equal(button(tree,'Check selected payout').props.disabled,true);assert.equal(button(tree,'Confirm in wallet').props.disabled,true);assert.equal(checkbox(tree,'I reviewed this mainnet action').props.disabled,true);
 await button(tree,'Confirm in wallet').props.onClick();assert.deepEqual(f.walletCalls,[]);
 tree=await f.acknowledge(tree);assert.equal(f.calls.at(-1).body.confirmSampleCoverage,true);assert.equal(f.calls.at(-1).body.reviewId,'review-ui');assert.equal(checkbox(tree,'I reviewed this mainnet action').props.disabled,false);assert.equal(button(tree,'Confirm in wallet').props.disabled,true);
 checkbox(tree,'I reviewed this mainnet action').props.onChange({target:{checked:true}});tree=await f.cycle();assert.equal(button(tree,'Confirm in wallet').props.disabled,false);
 checkbox(tree,'I understand this is a sample payout').props.onChange({target:{checked:false}});tree=await f.cycle();assert.equal(button(tree,'Confirm in wallet').props.disabled,true);await button(tree,'Confirm in wallet').props.onClick();assert.deepEqual(f.walletCalls,[]);
});

test('changing the reviewed list or a failed recheck cannot reuse earlier signable terms',async t=>{
 const f=treasuryFixture(t);let tree=await f.acknowledge(await f.start());checkbox(tree,'I reviewed this mainnet action').props.onChange({target:{checked:true}});tree=await f.cycle();
 const recipient=findNode(tree,node=>node.type==='label'&&node.props.className==='payout-recipient'&&textOf(node).includes(holder));findNode(recipient,node=>node.type==='input').props.onChange({target:{checked:false}});tree=await f.cycle();assert.equal(button(tree,'Confirm in wallet').props.disabled,true);
 f.setFailure(true);await button(tree,'Check selected payout').props.onClick();tree=await f.cycle();assert.match(textOf(tree),/vault balance changed/);assert.equal(checkbox(tree,'I reviewed this mainnet action').props.disabled,true);
 checkbox(tree,'I reviewed this mainnet action').props.onChange({target:{checked:true}});tree=await f.cycle();await button(tree,'Confirm in wallet').props.onClick();assert.deepEqual(f.walletCalls,[]);
});
