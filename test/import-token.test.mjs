import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImportedToken} from '../server/import-token.mjs';
const address='0x1111111111111111111111111111111111111111';
const client=()=>({getChainId:async()=>4663,getCode:async()=>'0x60006000',readContract:async({functionName})=>({name:'An independent token',symbol:'OWN',decimals:6,totalSupply:100000000n})[functionName]});

test('imports verify actual Robinhood ERC20 metadata without requiring pons registration',async()=>{
  const metadata=await verifyImportedToken(address,{client:client()});
  assert.deepEqual(metadata,{address,name:'An independent token',symbol:'OWN',decimals:6,totalSupply:'100000000',chainId:4663});
});

test('imports reject wallet addresses, non-token contracts and malformed metadata',async()=>{
  const wallet=client();wallet.getCode=async()=>'0x';await assert.rejects(()=>verifyImportedToken(address,{client:wallet}),error=>error.status===400&&/No token contract/.test(error.message));
  const nonToken=client();nonToken.readContract=async()=>{throw Object.assign(new Error('No return data'),{name:'ContractFunctionZeroDataError'});};await assert.rejects(()=>verifyImportedToken(address,{client:nonToken}),error=>error.status===400&&/verified as a token/.test(error.message));
  for(const invalid of [{decimals:256},{decimals:-1},{symbol:''},{name:null},{totalSupply:-1n}]){
    const malformed=client();malformed.readContract=async({functionName})=>({...{name:'Token',symbol:'TOK',decimals:18,totalSupply:1n},...invalid})[functionName];
    await assert.rejects(()=>verifyImportedToken(address,{client:malformed}),error=>error.status===400);
  }
});

test('RPC errors, another network and stalled reads leave imports retryable rather than saved',async()=>{
  const wrong=client();wrong.getChainId=async()=>56;await assert.rejects(()=>verifyImportedToken(address,{client:wrong}),error=>error.status===503);
  const offline=client();offline.readContract=async()=>{throw new Error('private RPC details');};await assert.rejects(()=>verifyImportedToken(address,{client:offline}),error=>error.status===503&&!/private/.test(error.message));
  const stalled=client();stalled.getCode=()=>new Promise(()=>{});await assert.rejects(()=>verifyImportedToken(address,{client:stalled,timeoutMs:20}),error=>error.status===503);
});
