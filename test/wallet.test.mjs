import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

test('wallet requests testnet and rechecks network/account before sending',async()=>{
  const directory=resolve('qa/wallet-module');await mkdir(directory,{recursive:true});const compiled=ts.transpileModule(await readFile('src/wallet.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../shared/config.mjs'","from '../../shared/config.mjs'");await writeFile(resolve(directory,'wallet.mjs'),compiled);
  const {sendTestnet,connectWallet}=await import(pathToFileURL(resolve(directory,'wallet.mjs')).href);
  const account='0x1111111111111111111111111111111111111111';const previous=globalThis.window;
  try{
    let chain='0x38',switched=false,sent=0,afterEstimate=false;
    globalThis.window={ethereum:{async request({method,params}){if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain'){assert.equal(params[0].chainId,'0xb626');chain='0xb626';switched=true;return null;}if(method==='eth_estimateGas')return '0x5208';if(method==='eth_sendTransaction'){sent++;return '0x'+'1'.repeat(64);}if(method==='eth_getTransactionReceipt')return {status:'0x1'};throw new Error(method);}}};
    assert.equal(await connectWallet(),account);assert.equal(switched,true);assert.equal(sent,0);
    for(const chainId of [97,4663])await assert.rejects(()=>sendTestnet(account,{to:account,chainId}),/another network/);
    assert.equal(sent,0);
    await sendTestnet(account,{to:account,value:'0'});assert.equal(sent,1);
    globalThis.window.ethereum.request=async({method})=>{if(method==='eth_accounts')return [account];if(method==='eth_chainId')return afterEstimate?'0x38':'0xb626';if(method==='eth_estimateGas'){afterEstimate=true;return '0x5208';}if(method==='eth_sendTransaction')sent++;};
    await assert.rejects(()=>sendTestnet(account,{to:account}),/network changed/);assert.equal(sent,1);
    afterEstimate=false;globalThis.window.ethereum.request=async({method})=>{if(method==='eth_accounts')return [afterEstimate?'0x2222222222222222222222222222222222222222':account];if(method==='eth_chainId')return '0xb626';if(method==='eth_estimateGas'){afterEstimate=true;return '0x5208';}if(method==='eth_sendTransaction')sent++;};
    await assert.rejects(()=>sendTestnet(account,{to:account}),/wallet changed/);assert.equal(sent,1);
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
