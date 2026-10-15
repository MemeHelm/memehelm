import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, parseEther, encodeAbiParameters, parseAbi, zeroAddress, parseEventLogs } from 'viem';
import { bscTestnet } from 'viem/chains';
import { compileContracts } from '../scripts/compile-contracts.mjs';
import { NETWORK } from '../shared/config.mjs';
const extra={'test/Receiver.sol':{content:`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
interface IVault { function release(address payable) external; }
contract RejectingReceiver { receive() external payable { revert("Reject"); } }
contract ReenteringReceiver { IVault public vault; bool public attempted; function set(address target) external { vault=IVault(target); } receive() external payable { attempted=true; try vault.release(payable(address(this))) {} catch {} } }
contract ForceSend { constructor() payable {} function force(address payable target) external { selfdestruct(target); } }
`}};
test('vault revenue accounting, isolation, factory guards and guardian upgrades',async t=>{
 const compiled=compileContracts(extra);
 const contracts=compiled['src/RevenueSplitVault.sol'];
 const provider=ganache.provider({chain:{chainId:97,hardfork:'shanghai'},wallet:{totalAccounts:6,unlockedAccounts:[NETWORK.vaultPortal,NETWORK.guardian]},logging:{quiet:true}});
 const transport=custom({request:({method,params})=>provider.request({method:method==='wallet_sendTransaction'?'eth_sendTransaction':method,params})}),chain=bscTestnet;
 const client=createPublicClient({chain,transport}),accounts=await provider.request({method:'eth_accounts',params:[]});
 const [deployer,project,audit,stranger]=accounts;
 const wallet=(account)=>createWalletClient({account,chain,transport});
 async function send(account,parameters){const hash=await wallet(account).writeContract({...parameters,gas:10000000n});return client.waitForTransactionReceipt({hash});}
  async function deploy(artifact,args=[],value=0n){const hash=await wallet(deployer).deployContract({abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,args,gas:10000000n,value});return (await client.waitForTransactionReceipt({hash})).contractAddress;}
 try{
  for(const account of [NETWORK.vaultPortal,NETWORK.guardian])await provider.request({method:'evm_setAccountBalance',params:[account,`0x${parseEther('100').toString(16)}`]});
  const factory=await deploy(contracts.RevenueSplitFactory);
  const factoryAbi=contracts.RevenueSplitFactory.abi,vaultAbi=contracts.RevenueSplitVault.abi;
  const token='0x7777777777777777777777777777777777777777';
  const data=(p=project,a=audit,bps=1000)=>encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint16'}],[p,a,bps]);
  const callNew=(input=data(),quote=zeroAddress)=>({address:factory,abi:factoryAbi,functionName:'newVault',args:[token,quote,deployer,input]});
  async function newVault(input=data()) { const receipt=await send(NETWORK.vaultPortal,callNew(input));return parseEventLogs({abi:factoryAbi,logs:receipt.logs,eventName:'VaultCreated'})[0].args.vault; }
  const vault=await newVault();
  const read=(name,args=[],address=vault)=>client.readContract({address,abi:vaultAbi,functionName:name,args});
  await t.test('rejects calls outside VaultPortal, unsupported quotes and malformed recipient data',async()=>{
   await assert.rejects(()=>client.simulateContract({...callNew(),account:stranger}),/Only VaultPortal/);
   await assert.rejects(()=>client.simulateContract({...callNew(data(),project),account:NETWORK.vaultPortal}),/Native BNB only/);
   await assert.rejects(()=>client.simulateContract({...callNew(data(project,project)),account:NETWORK.vaultPortal}),/Treasury addresses must differ/);
   await assert.rejects(()=>client.simulateContract({...callNew(data(project,audit,10001)),account:NETWORK.vaultPortal}),/Audit share exceeds/);
  });
  await t.test('rejects reinitialization and leaves implementation locked',async()=>{
   await assert.rejects(()=>client.simulateContract({address:vault,abi:vaultAbi,functionName:'initialize',args:[token,project,audit,1000],account:stranger}),/already initialized/);
  });
  await t.test('receives under the gas budget and pays fixed shares',async()=>{
   const hash=await wallet(deployer).sendTransaction({to:vault,value:parseEther('1')});const receipt=await client.waitForTransactionReceipt({hash});assert.ok(receipt.gasUsed<1000000n);
   assert.equal(await read('pending',[project]),parseEther('0.9'));assert.equal(await read('pending',[audit]),parseEther('0.1'));
   const before=await client.getBalance({address:audit});await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[audit]});assert.equal(await client.getBalance({address:audit}),before+parseEther('0.1'));
   await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[project]});assert.equal(await read('totalReceived'),parseEther('1'));assert.equal(await read('totalReleased'),parseEther('1'));
   await assert.rejects(()=>client.simulateContract({address:vault,abi:vaultAbi,functionName:'release',args:[stranger],account:stranger}),/Unknown recipient/);
   await assert.rejects(()=>client.simulateContract({address:vault,abi:vaultAbi,functionName:'release',args:[audit],account:stranger}),/No revenue/);
  });
  await t.test('later deposits and forced transfers cannot be double-claimed',async()=>{
   const force=await deploy(compiled['test/Receiver.sol'].ForceSend,[],10n);
   await send(deployer,{address:force,abi:compiled['test/Receiver.sol'].ForceSend.abi,functionName:'force',args:[vault]});
   assert.equal(await read('pending',[project]),9n);assert.equal(await read('pending',[audit]),1n);
   await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[project]});await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[audit]});
   const hash=await wallet(deployer).sendTransaction({to:vault,value:7n});await client.waitForTransactionReceipt({hash});
   assert.equal(await read('pending',[project]),7n);assert.equal(await read('pending',[audit]),0n);
   const second=await wallet(deployer).sendTransaction({to:vault,value:3n});await client.waitForTransactionReceipt({hash:second});assert.equal(await read('pending',[project]),9n);assert.equal(await read('pending',[audit]),1n);
   await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[project]});await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[audit]});assert.equal(await client.getBalance({address:vault}),0n);
  });
  await t.test('a rejecting recipient cannot block the other recipient',async()=>{
   const reject=await deploy(compiled['test/Receiver.sol'].RejectingReceiver);const other=await newVault(data(reject,audit));const hash=await wallet(deployer).sendTransaction({to:other,value:parseEther('1')});await client.waitForTransactionReceipt({hash});
   await assert.rejects(()=>client.simulateContract({address:other,abi:vaultAbi,functionName:'release',args:[reject],account:stranger}),/Revenue transfer failed/);
   await send(stranger,{address:other,abi:vaultAbi,functionName:'release',args:[audit]});assert.equal(await read('pending',[audit],other),0n);assert.equal(await read('pending',[reject],other),parseEther('0.9'));
  });
  await t.test('reentrancy cannot claim twice',async()=>{
   const receiver=await deploy(compiled['test/Receiver.sol'].ReenteringReceiver);const other=await newVault(data(receiver,audit));await send(deployer,{address:receiver,abi:compiled['test/Receiver.sol'].ReenteringReceiver.abi,functionName:'set',args:[other]});
   const hash=await wallet(deployer).sendTransaction({to:other,value:parseEther('1')});await client.waitForTransactionReceipt({hash});await send(stranger,{address:other,abi:vaultAbi,functionName:'release',args:[receiver]});assert.equal(await client.getBalance({address:receiver}),parseEther('0.9'));assert.equal(await read('pending',[receiver],other),0n);
  });
  await t.test('schemas match the declared ABI and native-only policy',async()=>{
   assert.ok((await read('description')).length>0);const schema=await read('vaultUISchema');assert.equal(schema.methods.length,9);assert.equal(schema.methods.at(-1).name,'release');assert.equal(schema.methods.at(-1).isWriteMethod,true);
   const factorySchema=await client.readContract({address:factory,abi:factoryAbi,functionName:'vaultDataSchema'});assert.deepEqual(factorySchema.fields.map(f=>f.fieldType),['address','address','uint16']);
   assert.equal(await client.readContract({address:factory,abi:factoryAbi,functionName:'isQuoteTokenSupported',args:[zeroAddress]}),true);
  });
  await t.test('only the Flap Guardian can upgrade the shared beacon',async()=>{
   const beacon=await client.readContract({address:factory,abi:factoryAbi,functionName:'beacon'}),abi=parseAbi(['function owner() view returns (address)','function upgradeTo(address)']);
   assert.equal((await client.readContract({address:beacon,abi,functionName:'owner'})).toLowerCase(),NETWORK.guardian.toLowerCase());
   const replacement=await deploy(contracts.RevenueSplitVault);
   await assert.rejects(()=>client.simulateContract({address:beacon,abi,functionName:'upgradeTo',args:[replacement],account:deployer}),/caller is not the owner/);
   await send(NETWORK.guardian,{address:beacon,abi,functionName:'upgradeTo',args:[replacement]});assert.equal(await read('taxToken'),token);
  });
 }catch(error){let cause=error;const details=[];for(let i=0;i<5&&cause;i++,cause=cause.cause)details.push([cause.name,cause.shortMessage,cause.details].filter(Boolean).map(v=>String(v).slice(0,500)).join(': '));throw new Error(details.join('\n'));}finally{await provider.disconnect();}
});
