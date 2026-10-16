import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAbiParameters } from 'viem';
import { buildLaunchParams, validateLaunch } from '../shared/launch.mjs';
import { NETWORK } from '../shared/config.mjs';
const draft={name:'Orbit Club',symbol:'ORBIT',description:'A test community.',meta:'QmYwAPJzv5CZsnAzt8auVZRnGi2C1xYNwkGMxmMLNRSz6L',projectTreasury:'0x1111111111111111111111111111111111111111',auditTreasury:'0x2222222222222222222222222222222222222222',factory:'0x3333333333333333333333333333333333333333',auditBps:1000,buyTaxRate:300,sellTaxRate:300,taxDays:365,antiFarmerDays:3,initialBuy:'0'};
test('Robinhood testnet is the only configured network',()=>assert.equal(NETWORK.id,46630));
test('launch encodes the exact recipients and reserve split',()=>{
 const params=buildLaunchParams(draft,`0x${'0'.repeat(63)}1`);
 assert.deepEqual(decodeAbiParameters([{type:'address'},{type:'address'},{type:'uint16'}],params.vaultData),[draft.projectTreasury,draft.auditTreasury,1000]);
 assert.equal(params.quoteAmt,0n);assert.equal(params.tokenVersion,6);assert.equal(params.migratorType,1);assert.equal(params.dexThresh,1);assert.equal(params.mktBps,10000);
});
test('rejects invalid recipients and ambiguous percentage units',()=>{
 for(const override of [{auditTreasury:draft.projectTreasury},{projectTreasury:'0x0000000000000000000000000000000000000000'},{auditBps:10001},{auditBps:1.5},{sellTaxRate:0},{buyTaxRate:1001},{initialBuy:'-1'},{initialBuy:'2'},{taxDays:1},{meta:'https://example.com/meta.json'}])assert.throws(()=>validateLaunch({...draft,...override}));
});
test('0% and 100% audit splits remain deliberate valid configurations',()=>{assert.equal(validateLaunch({...draft,auditBps:0}).auditBps,0);assert.equal(validateLaunch({...draft,auditBps:10000}).auditBps,10000);});
