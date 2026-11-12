import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAIN,NETWORK} from '../shared/config.mjs';
import {publicClient,verifyChain,artifact} from '../server/chain.mjs';
import {createPons,verifyDeployment} from '../server/pons.mjs';
test('mainnet configuration rejects all legacy networks and unverified contract code',async()=>{
 assert.equal(CHAIN.id,4663);assert.equal(CHAIN.testnet,false);assert.equal(NETWORK.rpc,'https://rpc.mainnet.chain.robinhood.com');
 const original=publicClient.getChainId;try{for(const id of [97,56,46630]){publicClient.getChainId=async()=>id;await assert.rejects(verifyChain,/network mismatch/);}publicClient.getChainId=async()=>4663;await verifyChain();}finally{publicClient.getChainId=original;}
 for(const code of [undefined,'0x','0x6000'])await assert.rejects(()=>verifyDeployment({getCode:async()=>code},'factory'),/contracts changed/);
 await assert.rejects(()=>artifact('MemeHelmLaunchFactory'),/Unknown contract/);
 const protocol=createPons({client:{getChainId:async()=>46630}});await assert.rejects(()=>protocol.options(),/Switch to Robinhood/);
});
