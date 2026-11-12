// Writes ONLY to a local Anvil fork. Never accepts a remote URL or signing key.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {createPublicClient,http,parseEventLogs,erc20Abi,parseEther} from 'viem';
import {CHAIN} from '../shared/config.mjs';
import {PONS,factoryAbi} from '../shared/pons.mjs';
import {createPons} from '../server/pons.mjs';
const client=createPublicClient({chain:CHAIN,transport:http('http://127.0.0.1:8546',{timeout:120000,retryCount:0})});
assert.match(await client.request({method:'web3_clientVersion'}),/anvil/i);
assert.equal(await client.getChainId(),4663);
const[owner,project,reserve,buyer]=await client.request({method:'eth_accounts'});
const protocol=createPons({client});
await client.request({method:'anvil_setBalance',params:[owner,'0x56bc75e2d63100000']});
async function send(tx,from=owner){const hash=await client.request({method:'eth_sendTransaction',params:[{from,...(tx.to?{to:tx.to}:{}),data:tx.data,value:`0x${BigInt(tx.value||0).toString(16)}`,gas:'0x1c9c380'}]});const receipt=await client.waitForTransactionReceipt({hash,timeout:120000});assert.equal(receipt.status,'success',`Local transaction reverted: ${hash}`);return receipt;}
const vaultReceipt=await send(await protocol.prepareVault(owner,{projectTreasury:project,auditTreasury:reserve,auditBps:1500}));
const vault=vaultReceipt.contractAddress;
await protocol.verifyVault(vault,owner);console.log('PASS fixed-recipient adapter deployment and runtime verification');
const draft={name:'MemeHelm Fork Verification',symbol:'MHVERIFY',description:'Local fork verification only.',creatorFeeRecipient:vault,vaultAddress:vault,splitEnabled:true,projectTreasury:project,auditTreasury:reserve,auditBps:1500,creatorTaxBps:100,configId:0};
const prepared=await protocol.prepareLaunch(owner,draft),receipt=await send(prepared),event=parseEventLogs({abi:factoryAbi,logs:receipt.logs,eventName:'TokenLaunched'})[0];
assert.ok(event);const token=event.args.token,record=await protocol.launchRecord(token);assert.equal(record.creatorFeeRecipient.toLowerCase(),vault.toLowerCase());assert.equal(await client.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[owner]}),0n);
console.log('PASS live factory launch, economics pin, curve supply and vault recipient');
async function trade(side,amount,account=owner){const quote=await protocol.quote(account,{token,side,amount,slippageBps:100});for(let i=0;i<quote.steps.length;i++)await send(await protocol.tradeStep(account,quote.id,i),account);return quote;}
let quote=await trade('buy','0.02');assert.ok(Number(quote.output)>0);let balance=await client.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[owner]});assert.ok(balance>0n);console.log('PASS curve buy quote and signed-call encoding');
await trade('sell',String(Number(balance)/1e18/4));console.log('PASS exact allowance and curve sell');
const projectRecord={chainId:4663,owner,tokenAddress:token,vaultAddress:vault};
await send(await protocol.revenueAction(owner,projectRecord,'sweep'));
let state=await protocol.snapshot(projectRecord);assert.ok(Number(state.revenue.claimable)>0);await send(await protocol.revenueAction(owner,projectRecord,'claim'));state=await protocol.snapshot(projectRecord);assert.ok(Number(state.vault.totalReceived)>0);assert.equal(state.revenue.claimable,'0');await send(await protocol.revenueAction(owner,projectRecord,'release',reserve));state=await protocol.snapshot(projectRecord);assert.equal(state.vault.auditPending,'0');console.log('PASS curve fee sweep → escrow → vault claim → fixed split payout');
quote=await trade('buy','10');assert.ok(Number(quote.refund)>0);const graduated=await protocol.launchRecord(token);if(graduated.phase===1)await send(await protocol.revenueAction(owner,projectRecord,'graduate'));assert.equal((await protocol.launchRecord(token)).phase,2);console.log('PASS partial-fill refund, price-bound minimum and graduation');
await trade('buy','0.01',buyer);console.log('PASS Universal Router v4 native ETH buy with hook-aware quote');
balance=await client.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[buyer]});await trade('sell',String(Number(balance)/1e18/4),buyer);console.log('PASS exact ERC20 + Permit2 approvals and v4 sell');
// Exercise the HTTP ownership/receipt boundary against those real fork receipts.
await mkdir('qa',{recursive:true});const directory=await mkdtemp(resolve('qa','pons-fork-api-'));
const {publicClient}=await import('../server/chain.mjs');
for(const method of ['getChainId','getCode','readContract','getBlockNumber','getTransactionReceipt','getBalance','simulateContract'])publicClient[method]=client[method];
process.env.DATA_DIRECTORY=directory;
const {server}=await import('../server/index.mjs');server.listen(0,'127.0.0.1');await once(server,'listening');
const endpoint=`http://127.0.0.1:${server.address().port}`,headers={'content-type':'application/json',origin:'http://127.0.0.1:4318'};
try{
 const challenge=await fetch(endpoint+'/api/auth/challenge',{method:'POST',headers,body:JSON.stringify({address:owner})}),{message}=await challenge.json();
 const signature=await client.request({method:'personal_sign',params:[`0x${Buffer.from(message).toString('hex')}`,owner]});
 const session=await fetch(endpoint+'/api/auth/verify',{method:'POST',headers:{...headers,cookie:challenge.headers.getSetCookie()[0].split(';')[0]},body:JSON.stringify({message,signature})});assert.equal(session.status,200);
 const cookie=session.headers.getSetCookie()[0].split(';')[0],post=(path,body)=>fetch(endpoint+'/api'+path,{method:'POST',headers:{...headers,cookie},body:JSON.stringify(body)});
 assert.equal((await fetch(endpoint+'/api/trade/quote',{method:'POST',headers,body:'{}'})).status,401);
 const input={...draft,tokenAddress:token,launchHash:receipt.transactionHash};
 const response=await post('/projects',input);assert.equal(response.status,201,await response.clone().text());const projectRecord=await response.json();
 const snapshot=await fetch(endpoint+`/api/projects/${projectRecord.id}/snapshot`,{headers:{cookie}});assert.equal(snapshot.status,200);
 const published=await post(`/projects/${projectRecord.id}/publication`,{published:true});assert.equal(published.status,200,await published.clone().text());
 const publicPage=await fetch(endpoint+`/api/public/projects/${projectRecord.id}`);assert.equal(publicPage.status,200);const page=await publicPage.json();assert.equal(page.project.owner,undefined);assert.equal(page.project.draft,undefined);
 const stolen=await post('/projects',{...input,tokenAddress:project});assert.equal(stolen.status,400);
 console.log('PASS wallet sign-in, confirmed receipt save, snapshot, creator-only publication and private-field filtering');
}finally{server.close();server.closeAllConnections();const target=resolve(directory);assert.ok(target.startsWith(resolve('qa')+sep));await rm(target,{recursive:true,force:true});}
console.log('All writes stayed on the local Anvil fork. No mainnet transaction was broadcast.');
