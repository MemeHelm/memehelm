import test from 'node:test';
import assert from 'node:assert/strict';
import {getAddress,zeroAddress} from 'viem';
import {validateLaunch,validateSplit} from '../shared/launch.mjs';
import {quoteCurveBuy,quoteCurveSell} from '../shared/pons.mjs';
const owner='0x1111111111111111111111111111111111111111',reserve='0x2222222222222222222222222222222222222222';
const draft={name:'Orbit Club',symbol:'orbit',creatorFeeRecipient:owner,configId:0,creatorTaxBps:200};
test('pons launch validates creator data without independent factory, premint or metadata CID',()=>{const clean=validateLaunch(draft);assert.equal(clean.symbol,'ORBIT');assert.equal(clean.creatorFeeRecipient,owner);assert.equal(clean.buybackEnabled,false);for(const override of [{name:'x'},{symbol:'$BAD'},{creatorFeeRecipient:reserve.slice(0,-1)},{creatorTaxBps:-1},{creatorTaxBps:1.5},{configId:-1},{buybackEnabled:true},{image:'javascript:alert(1)'},{x:'https://wrong.example/creator'}])assert.throws(()=>validateLaunch({...draft,...override}));});
test('split settings require distinct nonzero wallets and a matching recipient vault',()=>{assert.equal(validateSplit({projectTreasury:owner,auditTreasury:reserve,auditBps:1000}).auditBps,1000);for(const input of [{projectTreasury:owner,auditTreasury:owner,auditBps:1000},{projectTreasury:owner,auditTreasury:reserve,auditBps:10001}])assert.throws(()=>validateSplit(input));assert.throws(()=>validateLaunch({...draft,splitEnabled:true,projectTreasury:owner,auditTreasury:reserve,auditBps:1000}));});
test('holder payout mode requires its activated vault as fee recipient',()=>{assert.equal(validateLaunch({...draft,holdersEnabled:true,vaultAddress:owner,creatorFeeRecipient:owner}).holdersEnabled,true);assert.throws(()=>validateLaunch({...draft,holdersEnabled:true,vaultAddress:owner,creatorFeeRecipient:reserve}),/use it as fee recipient/i);assert.throws(()=>validateLaunch({...draft,holdersEnabled:true,creatorFeeRecipient:owner}),/Activate the holders vault/i);assert.throws(()=>validateLaunch({...draft,holdersEnabled:true,splitEnabled:true,vaultAddress:owner,creatorFeeRecipient:owner,projectTreasury:owner,auditTreasury:reserve,auditBps:1000}),/one fee destination/i);});
test('snipe tax exemptions accept up to 32 unique wallets and are normalized',()=>{
 const mixed='0x'+'aBc'.padStart(40,'0'),normalized=getAddress(mixed.toLowerCase());
 assert.deepEqual(validateLaunch(draft).snipeTaxExemptions,[]);
 assert.deepEqual(validateLaunch({...draft,snipeTaxExemptions:[owner,reserve]}).snipeTaxExemptions,[owner,reserve]);
 assert.deepEqual(validateLaunch({...draft,snipeTaxExemptions:[mixed.toLowerCase()]}).snipeTaxExemptions,[normalized]);
 assert.throws(()=>validateLaunch({...draft,snipeTaxExemptions:'0x'}),/list of wallets/);
 assert.throws(()=>validateLaunch({...draft,snipeTaxExemptions:[owner,owner]}),/listed once/);
 assert.throws(()=>validateLaunch({...draft,snipeTaxExemptions:Array(33).fill(owner)}),/at most 32/);
 assert.throws(()=>validateLaunch({...draft,snipeTaxExemptions:[zeroAddress]}),/Snipe exemption/);
 assert.throws(()=>validateLaunch({...draft,snipeTaxExemptions:['0x123']}),/Snipe exemption/);
});
test('community escrow mode requires its activated vault as fee recipient',()=>{assert.equal(validateLaunch({...draft,socialEnabled:true,vaultAddress:owner,creatorFeeRecipient:owner}).socialEnabled,true);assert.throws(()=>validateLaunch({...draft,socialEnabled:true,vaultAddress:owner,creatorFeeRecipient:reserve}),/use its vault as fee recipient/i);assert.throws(()=>validateLaunch({...draft,socialEnabled:true,creatorFeeRecipient:owner}),/Activate the community escrow/i);assert.throws(()=>validateLaunch({...draft,socialEnabled:true,splitEnabled:true,vaultAddress:owner,creatorFeeRecipient:owner,projectTreasury:owner,auditTreasury:reserve,auditBps:1000}),/one fee destination/i);assert.throws(()=>validateLaunch({...draft,socialEnabled:true,holdersEnabled:true,vaultAddress:owner,creatorFeeRecipient:owner}),/one fee destination/i);});
test('curve quotes preserve protocol integer fee order, capped snipe fees and partial refunds',()=>{
 const base={input:1000000n,quoteReserve:1680000000000000000n,tokenReserve:10n**27n,sellable:8n*10n**26n,feeBps:100n,taxBps:200n,snipeBps:0n};
 const quote=quoteCurveBuy(base),net=970000n;assert.equal(quote.output,net*base.tokenReserve/(base.quoteReserve+net));assert.equal(quote.refund,0n);
 const snipe=quoteCurveBuy({...base,snipeBps:9900n});assert.equal(snipe.snipeBps,9600n);assert.ok(snipe.output<quote.output);
 const clamped=quoteCurveBuy({...base,input:10n**20n});assert.equal(clamped.output,base.sellable);assert.ok(clamped.refund>0n);assert.equal(clamped.spent+clamped.refund,10n**20n);
 const sold=quoteCurveSell({...base,input:10n**22n}),gross=10n**22n*base.quoteReserve/(base.tokenReserve+10n**22n);assert.equal(sold,gross-gross/100n-gross*200n/10000n);assert.throws(()=>quoteCurveBuy({...base,sellable:0n}));
});
