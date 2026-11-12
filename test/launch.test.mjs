import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLaunchParams,validateLaunch} from '../shared/launch.mjs';
import {NETWORK} from '../shared/config.mjs';
const draft={name:'Orbit Club',symbol:'ORBIT',meta:'Qm'+'1'.repeat(44),projectTreasury:'0x1111111111111111111111111111111111111111',auditTreasury:'0x2222222222222222222222222222222222222222',factory:'0x3333333333333333333333333333333333333333',auditBps:1000,totalSupply:'1000000000',initialFunding:'0'};
test('Robinhood testnet config has no third-party launch protocol',()=>{assert.equal(NETWORK.id,46630);for(const field of ['portal','vaultPortal','guardian','taxTokenImplementation','flap'])assert.equal(NETWORK[field],undefined);});
test('independent launch encodes fixed supply, metadata and exact recipients',()=>{const params=buildLaunchParams(draft);assert.equal(params.totalSupply,10n**27n);assert.equal(params.projectTreasury,draft.projectTreasury);assert.equal(params.auditTreasury,draft.auditTreasury);assert.equal(params.auditBps,1000);assert.equal(params.metadataCID,draft.meta);assert.equal(params.vaultFactory,undefined);});
test('rejects invalid supply, recipients, funding and metadata',()=>{for(const override of [{totalSupply:'0'},{totalSupply:'-1'},{totalSupply:'1.5'},{totalSupply:'1e9'},{totalSupply:'1000000000000001'},{auditTreasury:draft.projectTreasury},{projectTreasury:'0x0000000000000000000000000000000000000000'},{auditBps:10001},{auditBps:1.5},{initialFunding:'-1'},{initialFunding:'2'},{meta:'https://example.com/meta.json'}])assert.throws(()=>validateLaunch({...draft,...override}));});
test('0 and 100 percent reserve splits remain valid',()=>{for(const auditBps of [0,10000])assert.equal(validateLaunch({...draft,auditBps}).auditBps,auditBps);});
