import test from 'node:test';
import assert from 'node:assert/strict';
import {NETWORK,CHAIN} from '../shared/config.mjs';
import {publicClient,verifyChain,verifyLaunchConfiguration,snapshot} from '../server/chain.mjs';

test('Robinhood configuration rejects stale network and disabled native quote settings',async()=>{
  assert.equal(CHAIN.id,46630);assert.equal(CHAIN.testnet,true);assert.equal(CHAIN.nativeCurrency.symbol,'ETH');
  const savedId=publicClient.getChainId,savedRead=publicClient.readContract;
  try{
    for(const id of [97,56,4663]){publicClient.getChainId=async()=>id;await assert.rejects(verifyChain,/network mismatch/);}
    publicClient.getChainId=async()=>46630;await verifyChain();
    publicClient.readContract=async()=>({enabled:1,defaultCurve:NETWORK.nativeQuoteCurve,dexId:0});await verifyLaunchConfiguration();
    for(const override of [{enabled:0},{defaultCurve:17},{dexId:1}]){publicClient.readContract=async()=>({enabled:1,defaultCurve:NETWORK.nativeQuoteCurve,dexId:0,...override});await assert.rejects(verifyLaunchConfiguration,/temporarily unavailable/);}
    await assert.rejects(()=>snapshot({chainId:97,tokenAddress:'0x1111111111111111111111111111111111111111'}),/another network/);
  }finally{publicClient.getChainId=savedId;publicClient.readContract=savedRead;}
});
