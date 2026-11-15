import test from 'node:test';
import assert from 'node:assert/strict';
import * as viem from 'viem';
import {PONS} from '../shared/pons-addresses.mjs';
import {NETWORK} from '../shared/config.mjs';
import {componentHarness,textOf as renderedText,findNode} from './helpers/component-harness.mjs';
const textOf=node=>renderedText(node).replace(/\s+/g,' ');

const owner='0x1111111111111111111111111111111111111111',recipient='0x2222222222222222222222222222222222222222';
const config={id:0,supply:'1000000000000000000000000001',curveFeeBps:100,graduationThreshold:'3000000000000000000',poolFee:0,tickSpacing:60,enabled:true};
const draft={name:'Orbit',symbol:'ORB',creatorFeeRecipient:recipient,creatorTaxBps:50,configId:0,splitEnabled:false,holdersEnabled:false,socialEnabled:false,snipeTaxExemptions:[]};
const options={chainId:4663,factory:PONS.factory.address,fee:'1000000000000000',feeETH:'0.001',canLaunch:true,configs:[config],snipeTaxStartBps:9900,snipeTaxSeconds:5,checkedAt:'2026-11-15T12:00:00Z'};
function render(input={}){
 const props={draft:{...draft},wallet:owner,options,prepared:null,...input};
 const harness=componentHarness(new URL('../src/LaunchRules.tsx',import.meta.url),'LaunchRules',props,{'viem':viem,'../shared/pons-addresses.mjs':{PONS},'../shared/config.mjs':{NETWORK}});
 return harness.render();
}
function prepared(extra={}){return{chainId:4663,to:PONS.factory.address,value:'2000000000000000',settings:{...draft},config,...extra};}

test('launch rules preserve exact supply and fees, without creator-allocation or safety claims',()=>{
 const node=render(),text=textOf(node);
 assert.match(text,/1,000,000,000\.000000000000000001/);
 assert.match(text,/0\.001 ETH/);assert.match(text,/Additional creator fee 0\.5%/);assert.match(text,/Base curve trading fee 1%/);assert.match(text,/3 ETH/);
 assert.match(text,/All tokens start in the bonding curve, with no creator preallocation/);
 assert.doesNotMatch(text,/Sentinel|anti-dump|guaranteed safe|1 minutes/);
 assert.equal(findNode(node,item=>item.type==='a'&&item.props.children==='View launch contract').props.href,`${NETWORK.explorer}/address/${PONS.factory.address}`);
});

test('the opening protection explanation keeps seconds precise and uses the actual recipient quote',()=>{
 assert.match(textOf(render()),/up to 99% decays to zero over 5 seconds/);
 assert.match(textOf(render()),/actual rate for its recipient/);
 assert.match(textOf(render({options:{...options,snipeTaxStartBps:0,snipeTaxSeconds:0}})),/No opening anti-snipe fee is configured/);
 assert.match(textOf(render({options:{...options,snipeTaxSeconds:120}})),/2 minutes/);
});

test('prepared terms override edited drafts and old options in the final signing review',()=>{
 const text=textOf(render({draft:{...draft,name:'Edited',creatorTaxBps:200,snipeTaxExemptions:[owner]},prepared:prepared({settings:{...draft,name:'Pinned'},protocolRules:{snipeTaxStartBps:1500,snipeTaxSeconds:15,checkedAt:'2026-11-15T12:00:01Z',block:'12345'}})}));
 assert.match(text,/Pinned/);assert.doesNotMatch(text,/Edited|up to 99%/);assert.match(text,/up to 15% decays to zero over 15 seconds/);
 assert.match(text,/0\.002 ETH/);assert.match(text,/Additional creator fee 0\.5%/);assert.match(text,/block 12345/);assert.match(text,/No additional exempt wallets/);
});

test('an older prepared transaction never borrows a newer or older options opening-fee snapshot',()=>{
 const text=textOf(render({prepared:prepared()}));
 assert.match(text,/Opening protection is unavailable/);assert.doesNotMatch(text,/up to 99%|decays to zero over 5 seconds/);
});

test('every additional exempt address is inspectable and automatic roles are not counted as additions',()=>{
 const wallets=Array.from({length:32},(_,index)=>'0x'+(index+100).toString(16).padStart(40,'0'));
 const text=textOf(render({draft:{...draft,creatorFeeRecipient:owner,snipeTaxExemptions:wallets}}));
 assert.match(text,/32 additional wallets/);assert.match(text,/Launching wallet · Fee recipient/);
 for(const value of wallets)assert.ok(text.includes(value),`missing exempt address ${value}`);
 assert.match(text,/Additional wallet 32/);
});

test('missing or mismatched protocol reads remain unavailable and never assert pons guarantees',()=>{
 for(const input of [{options:null},{options:{...options,chainId:1}},{options:{...options,factory:recipient}},{prepared:prepared({to:recipient})}]){
  const text=textOf(render(input));assert.match(text,/Live rules are unavailable/);assert.doesNotMatch(text,/Base curve trading fee|permanently locked|No opening anti-snipe fee/);
 }
 const partial=textOf(render({options:{...options,configs:[],snipeTaxStartBps:undefined,snipeTaxSeconds:undefined}}));
 assert.match(partial,/Fixed token supply Unavailable/);assert.match(partial,/Opening protection is unavailable/);assert.doesNotMatch(partial,/Base curve trading fee 0%/);
});

test('each revenue mode exposes its actual authority and does not imply autonomous payouts',()=>{
 const split=textOf(render({draft:{...draft,splitEnabled:true,auditBps:2500,projectTreasury:owner,auditTreasury:recipient}}));
 assert.match(split,/Project wallet · 75%/);assert.match(split,/Reserve wallet · 25%/);assert.match(split,/recipients and percentages are fixed/);
 const holders=textOf(render({draft:{...draft,holdersEnabled:true}}));assert.match(holders,/reviewed balance snapshot/);assert.match(holders,/controller wallet’s signature/);assert.match(holders,/not redistributed/);
 const social=textOf(render({draft:{...draft,socialEnabled:true}}));assert.match(social,/waits 48 hours/);assert.match(social,/does not verify a social identity or give the community a veto/);
 for(const text of [split,holders,social])assert.match(text,/creator can redirect future creator fees/);
 assert.match(textOf(render()),/fees are not automatically pushed/);
});
