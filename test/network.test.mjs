import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAIN} from '../shared/config.mjs';
import {publicClient,verifyChain,verifyFactory,snapshot,artifact} from '../server/chain.mjs';
test('network and exact factory-bytecode checks reject stale protocol deployments',async()=>{
  assert.equal(CHAIN.id,46630);assert.equal(CHAIN.testnet,true);assert.equal(CHAIN.nativeCurrency.symbol,'ETH');
  const savedId=publicClient.getChainId,savedCode=publicClient.getCode;
  try{
    for(const id of [97,56,4663]){publicClient.getChainId=async()=>id;await assert.rejects(verifyChain,/network mismatch/);}
    publicClient.getChainId=async()=>46630;await verifyChain();
    const address='0x1111111111111111111111111111111111111111';for(const code of ['0x','0x6000']){publicClient.getCode=async()=>code;await assert.rejects(()=>verifyFactory(address),/matching MemeHelm/);}
    publicClient.getCode=async()=>(await artifact('MemeHelmLaunchFactory')).deployedBytecode;await verifyFactory(address);
    await assert.rejects(()=>snapshot({chainId:97,tokenAddress:address}),/another network/);
    await assert.rejects(()=>artifact('IVaultPortal'),/Unknown contract/);
  }finally{publicClient.getChainId=savedId;publicClient.getCode=savedCode;}
});
