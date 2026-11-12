import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {createPublicClient,createWalletClient,custom,parseEther} from 'viem';
import {compileContracts} from '../scripts/compile-contracts.mjs';
import {CHAIN} from '../shared/config.mjs';
import {PONS} from '../shared/pons.mjs';
const extra={'test/Receivers.sol':{content:`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
interface IVault {function release(address payable) external;}
contract RejectingReceiver {receive() external payable {revert("Reject");}}
contract ReenteringReceiver {IVault public vault;function set(address v) external{vault=IVault(v);}receive() external payable {try vault.release(payable(address(this))){}catch{}}}
contract ForceSend{constructor() payable{}function force(address payable target) external{selfdestruct(target);}}
contract MockEscrow{mapping(address=>uint256) public balanceOf;function credit(address who) external payable{balanceOf[who]+=msg.value;}function claim() external{uint256 amount=balanceOf[msg.sender];balanceOf[msg.sender]=0;(bool ok,)=msg.sender.call{value:amount}("");require(ok);}}
`}};
test('pons fee adapter claims its own escrow and conserves fixed ETH entitlements',async t=>{
 const compiled=compileContracts(extra),vaultArtifact=compiled['src/RevenueSplitVault.sol'].RevenueSplitVault,abi=vaultArtifact.abi;
 const provider=ganache.provider({chain:{chainId:4663,hardfork:'shanghai'},wallet:{totalAccounts:6},logging:{quiet:true}}),transport=custom({request:({method,params})=>provider.request({method:method==='wallet_sendTransaction'?'eth_sendTransaction':method,params})}),client=createPublicClient({chain:CHAIN,transport}),[owner,project,reserve,stranger]=await provider.request({method:'eth_accounts',params:[]});
 const wallet=account=>createWalletClient({account,chain:CHAIN,transport});
 async function deploy(artifact,args=[],value=0n){const hash=await wallet(owner).deployContract({abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,args,value,gas:10000000n}),receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt.contractAddress;}
 async function send(address,functionName,args=[],account=stranger,selectedAbi=abi,value=0n){const hash=await wallet(account).writeContract({address,abi:selectedAbi,functionName,args,value,gas:10000000n}),receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt;}
 const read=(address,name,args=[])=>client.readContract({address,abi,functionName:name,args});
 async function fund(address,value){await client.waitForTransactionReceipt({hash:await wallet(owner).sendTransaction({to:address,value,gas:100000n})});}
 try{
 const escrowArtifact=compiled['test/Receivers.sol'].MockEscrow;await provider.request({method:'evm_setAccountCode',params:[PONS.escrow.address,`0x${escrowArtifact.evm.deployedBytecode.object}`]});
 const vault=await deploy(vaultArtifact,[project,reserve,1000]);
 await t.test('runtime is identical for every constructor and only fixed external calls are present',async()=>{assert.equal((await client.getCode({address:vault})).toLowerCase(),`0x${vaultArtifact.evm.deployedBytecode.object}`.toLowerCase());assert.equal((await read(vault,'controller')).toLowerCase(),owner);for(const name of ['initialize','upgradeTo','execute','setRecipients','setEscrow'])assert.ok(!abi.some(f=>f.name===name));});
 await t.test('permissionless collection claims the vault ledger, never the caller ledger',async()=>{await send(PONS.escrow.address,'credit',[vault],owner,escrowArtifact.abi,parseEther('1'));await send(PONS.escrow.address,'credit',[stranger],owner,escrowArtifact.abi,123n);await send(vault,'claimFees');assert.equal(await read(vault,'totalReceived'),parseEther('1'));assert.equal(await client.readContract({address:PONS.escrow.address,abi:escrowArtifact.abi,functionName:'balanceOf',args:[stranger]}),123n);});
 await t.test('each fixed wallet receives its share and unknown wallets cannot be paid',async()=>{assert.equal(await read(vault,'pending',[project]),parseEther('.9'));assert.equal(await read(vault,'pending',[reserve]),parseEther('.1'));await assert.rejects(()=>client.simulateContract({address:vault,abi,functionName:'release',args:[stranger],account:stranger}),/Unknown recipient/);await send(vault,'release',[reserve]);await send(vault,'release',[project]);assert.equal(await read(vault,'totalReleased'),parseEther('1'));await assert.rejects(()=>client.simulateContract({address:vault,abi,functionName:'release',args:[project],account:stranger}),/No revenue/);});
 await t.test('forced ETH and rounding do not create or lose entitlement',async()=>{const force=await deploy(compiled['test/Receivers.sol'].ForceSend,[],7n);await send(force,'force',[vault],owner,compiled['test/Receivers.sol'].ForceSend.abi);await fund(vault,3n);assert.equal(await read(vault,'pending',[project]),9n);assert.equal(await read(vault,'pending',[reserve]),1n);});
 await t.test('one rejecting recipient does not block the other recipient',async()=>{const reject=await deploy(compiled['test/Receivers.sol'].RejectingReceiver),other=await deploy(vaultArtifact,[reject,reserve,1000]);await fund(other,100n);await assert.rejects(()=>client.simulateContract({address:other,abi,functionName:'release',args:[reject],account:stranger}),/Revenue transfer failed/);await send(other,'release',[reserve]);assert.equal(await read(other,'pending',[reject]),90n);});
 await t.test('a receiver cannot reenter and claim twice',async()=>{const receiverArtifact=compiled['test/Receivers.sol'].ReenteringReceiver,receiver=await deploy(receiverArtifact),other=await deploy(vaultArtifact,[receiver,reserve,1000]);await send(receiver,'set',[other],owner,receiverArtifact.abi);await fund(other,100n);await send(other,'release',[receiver]);assert.equal(await client.getBalance({address:receiver}),90n);assert.equal(await read(other,'pending',[receiver]),0n);});
 }finally{await provider.disconnect();}
});
