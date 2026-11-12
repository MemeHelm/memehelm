import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {createPublicClient,createWalletClient,custom,parseEther,parseEventLogs,zeroAddress} from 'viem';
import {compileContracts} from '../scripts/compile-contracts.mjs';
import {NETWORK,CHAIN} from '../shared/config.mjs';
import {privateKeyToAccount} from 'viem/accounts';
import {publicClient} from '../server/chain.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
const extra={'test/Receiver.sol':{content:`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
interface IVault { function release(address payable) external; }
contract RejectingReceiver { receive() external payable { revert("Reject"); } }
contract ReenteringReceiver { IVault public vault; function set(address target) external { vault=IVault(target); } receive() external payable { try vault.release(payable(address(this))) {} catch {} } }
contract ForceSend { constructor() payable {} function force(address payable target) external { selfdestruct(target); } }
`}};

test('independent issuance and non-upgradeable revenue accounting',async t=>{
  const compiled=compileContracts(extra),factoryArtifact=compiled['src/MemeHelmLaunchFactory.sol'].MemeHelmLaunchFactory,tokenAbi=compiled['src/MemeHelmLaunchFactory.sol'].MemeHelmToken.abi,vaultAbi=compiled['src/RevenueSplitVault.sol'].RevenueSplitVault.abi;
  const provider=ganache.provider({chain:{chainId:NETWORK.id,hardfork:'shanghai'},wallet:{totalAccounts:6},logging:{quiet:true}});
  const transport=custom({request:({method,params})=>provider.request({method:method==='wallet_sendTransaction'?'eth_sendTransaction':method,params})}),client=createPublicClient({chain:CHAIN,transport}),accounts=await provider.request({method:'eth_accounts',params:[]}),[creator,project,reserve,stranger]=accounts;
  const wallet=account=>createWalletClient({account,chain:CHAIN,transport});
  async function send(account,parameters){const hash=await wallet(account).writeContract({...parameters,gas:10000000n});const receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt;}
  async function deploy(artifact,args=[],value=0n){const hash=await wallet(creator).deployContract({abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,args,gas:10000000n,value});const receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt.contractAddress;}
  let nonce=0;
  try{
    const factory=await deploy(factoryArtifact),factoryAbi=factoryArtifact.abi;
    const config=(p=project,r=reserve,bps=1000)=>({name:'Orbit Club',symbol:'ORBIT',metadataCID:'Qm'+'1'.repeat(44),totalSupply:parseEther('1000000000'),projectTreasury:p,auditTreasury:r,auditBps:bps});
    const salt=()=>`0x${(++nonce).toString(16).padStart(64,'0')}`;
    async function launch(settings=config(),value=0n,account=creator,selectedSalt=salt()){
      const predicted=await client.readContract({address:factory,abi:factoryAbi,functionName:'predictTokenAddress',args:[account,settings,selectedSalt]});
      const receipt=await send(account,{address:factory,abi:factoryAbi,functionName:'createToken',args:[settings,selectedSalt],value});
      const event=parseEventLogs({abi:factoryAbi,logs:receipt.logs,eventName:'TokenCreated'})[0];assert.equal(event.args.token.toLowerCase(),predicted.toLowerCase());return {...event.args,receipt};
    }
    const launched=await launch(),vault=launched.vault,token=launched.token;
    const read=(name,args=[],address=vault)=>client.readContract({address,abi:vaultAbi,functionName:name,args});
    await t.test('issues all fixed supply to creator and registers its own vault',async()=>{
      assert.equal(await client.readContract({address:token,abi:tokenAbi,functionName:'balanceOf',args:[creator]}),config().totalSupply);
      assert.equal(await client.readContract({address:token,abi:tokenAbi,functionName:'totalSupply'}),config().totalSupply);
      assert.equal(await client.readContract({address:token,abi:tokenAbi,functionName:'tokenURI'}),'ipfs://'+config().metadataCID);
      assert.equal((await read('token')).toLowerCase(),token.toLowerCase());assert.equal((await read('launchFactory')).toLowerCase(),factory.toLowerCase());
      assert.equal((await client.readContract({address:factory,abi:factoryAbi,functionName:'vaults',args:[token]})).toLowerCase(),vault.toLowerCase());
      for(const name of ['mint','owner','upgradeTo','initialize','setTax'])assert.ok(!tokenAbi.some(item=>item.type==='function'&&item.name===name));
      for(const name of ['owner','upgradeTo','initialize','beacon'])assert.ok(!vaultAbi.some(item=>item.type==='function'&&item.name===name));
    });
    await t.test('rejects invalid supply, recipients and excessive funding atomically',async()=>{
      for(const override of [{totalSupply:0n},{totalSupply:10n**34n},{projectTreasury:zeroAddress},{auditTreasury:project},{auditBps:10001}])await assert.rejects(()=>client.simulateContract({address:factory,abi:factoryAbi,functionName:'createToken',args:[{...config(),...override},salt()],account:creator}));
      await assert.rejects(()=>client.simulateContract({address:factory,abi:factoryAbi,functionName:'createToken',args:[config(),salt()],account:creator,value:parseEther('1')+1n}),/funding exceeds/);
    });
    await t.test('salts are bound to the signing creator and initial funding is a vault deposit',async()=>{
      const sharedSalt=salt(),one=await launch(config(),parseEther('.2'),creator,sharedSalt),two=await launch(config(),0n,stranger,sharedSalt);
      assert.notEqual(one.token,two.token);assert.equal(await client.getBalance({address:one.vault}),parseEther('.2'));assert.equal(await client.getBalance({address:factory}),0n);
      await assert.rejects(()=>client.simulateContract({address:factory,abi:factoryAbi,functionName:'createToken',args:[config(),sharedSalt],account:creator}));
    });
    await t.test('pays both fixed shares and cannot pay an arbitrary address',async()=>{
      const hash=await wallet(creator).sendTransaction({to:vault,value:parseEther('1')});await client.waitForTransactionReceipt({hash});
      assert.equal(await read('pending',[project]),parseEther('.9'));assert.equal(await read('pending',[reserve]),parseEther('.1'));
      const before=await client.getBalance({address:reserve});await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[reserve]});assert.equal(await client.getBalance({address:reserve}),before+parseEther('.1'));
      await send(stranger,{address:vault,abi:vaultAbi,functionName:'release',args:[project]});assert.equal(await read('totalReceived'),parseEther('1'));assert.equal(await read('totalReleased'),parseEther('1'));
      for(const target of [stranger,reserve])await assert.rejects(()=>client.simulateContract({address:vault,abi:vaultAbi,functionName:'release',args:[target],account:stranger}));
    });
    await t.test('rounding and forced ETH transfers are accounted without double claims',async()=>{
      const force=await deploy(compiled['test/Receiver.sol'].ForceSend,[],7n);await send(creator,{address:force,abi:compiled['test/Receiver.sol'].ForceSend.abi,functionName:'force',args:[vault]});assert.equal(await read('pending',[project]),7n);assert.equal(await read('pending',[reserve]),0n);
      await client.waitForTransactionReceipt({hash:await wallet(creator).sendTransaction({to:vault,value:3n})});assert.equal(await read('pending',[project]),9n);assert.equal(await read('pending',[reserve]),1n);
    });
    await t.test('0 and 100 percent splits remain payable to the designated wallet',async()=>{
      for(const bps of [0,10000]){const instance=await launch(config(project,reserve,bps),10n);assert.equal(await read('pending',[project],instance.vault),bps===0?10n:0n);assert.equal(await read('pending',[reserve],instance.vault),bps===10000?10n:0n);}
    });
    await t.test('a rejecting recipient does not block the other recipient',async()=>{
      const reject=await deploy(compiled['test/Receiver.sol'].RejectingReceiver),other=await launch(config(reject,reserve),parseEther('1'));
      await assert.rejects(()=>client.simulateContract({address:other.vault,abi:vaultAbi,functionName:'release',args:[reject],account:stranger}),/Revenue transfer failed/);
      await send(stranger,{address:other.vault,abi:vaultAbi,functionName:'release',args:[reserve]});assert.equal(await read('pending',[reserve],other.vault),0n);assert.equal(await read('pending',[reject],other.vault),parseEther('.9'));
    });
    await t.test('a reentrant recipient cannot claim twice',async()=>{
      const receiver=await deploy(compiled['test/Receiver.sol'].ReenteringReceiver),other=await launch(config(receiver,reserve),parseEther('1'));
      await send(creator,{address:receiver,abi:compiled['test/Receiver.sol'].ReenteringReceiver.abi,functionName:'set',args:[other.vault]});await send(stranger,{address:other.vault,abi:vaultAbi,functionName:'release',args:[receiver]});assert.equal(await client.getBalance({address:receiver}),parseEther('.9'));assert.equal(await read('pending',[receiver],other.vault),0n);
    });
    await t.test('signed-in API prepares, verifies, publishes and reads a complete independent launch',async()=>{
      const qa=resolve('qa');await mkdir(qa,{recursive:true});const dir=await mkdtemp(resolve(qa,'independent-api-')),savedDirectory=process.env.DATA_DIRECTORY;
      const methods=['getChainId','getCode','readContract','getTransactionReceipt','getBlockNumber','getLogs'],saved=Object.fromEntries(methods.map(name=>[name,publicClient[name]]));let server;
      try{
        process.env.DATA_DIRECTORY=dir;for(const name of methods)publicClient[name]=client[name];
        ({server}=await import(`../server/index.mjs?independent-proof=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');
        const endpoint=`http://127.0.0.1:${server.address().port}`,account=privateKeyToAccount(provider.getInitialAccounts()[creator].secretKey),session=await signedClient(endpoint,account),other=await signedClient(endpoint,testWallet(50));
        const draft={name:'Orbit Club',symbol:'ORBIT',meta:config().metadataCID,totalSupply:'1000000000',initialFunding:'0.25',projectTreasury:project,auditTreasury:reserve,auditBps:1000,factory};
        const preparedResponse=await session.post('/launch/prepare',draft);assert.equal(preparedResponse.status,200);const prepared=await preparedResponse.json();assert.equal(prepared.to.toLowerCase(),factory.toLowerCase());assert.equal(prepared.value,parseEther('.25').toString());
        const hash=await wallet(creator).sendTransaction({to:prepared.to,data:prepared.data,value:BigInt(prepared.value),gas:10000000n}),receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');
        const created=parseEventLogs({abi:factoryAbi,logs:receipt.logs,eventName:'TokenCreated'})[0].args;assert.equal(created.token.toLowerCase(),prepared.predictedToken.toLowerCase());
        const input={...draft,tokenAddress:created.token,vaultAddress:created.vault,launchFactory:factory,launchHash:hash};
        assert.equal((await other.post('/projects',input)).status,400);assert.equal((await session.post('/projects',{...input,vaultAddress:project})).status,400);assert.equal((await session.post('/projects',{...input,launchFactory:stranger})).status,400);
        const response=await session.post('/projects',input);assert.equal(response.status,201);const record=await response.json();assert.equal(record.status,'launched');
        const snapshot=await (await session.get(`/projects/${record.id}/snapshot`)).json();assert.equal(snapshot.vault.totalReceived,'0.25');assert.equal(snapshot.vault.projectPending,'0.225');assert.equal(snapshot.vault.auditPending,'0.025');
        assert.equal((await session.post(`/projects/${record.id}/publication`,{published:true})).status,200);
        const page=await (await fetch(`${endpoint}/api/public/projects/${record.id}`)).json();assert.equal(page.project.name,draft.name);assert.equal(page.project.owner,undefined);assert.equal(page.project.draft,undefined);
        await send(stranger,{address:created.vault,abi:vaultAbi,functionName:'release',args:[reserve]});const released=await (await session.get(`/projects/${record.id}/snapshot`)).json();assert.equal(released.vault.auditPending,'0');assert.equal(released.vault.totalReleased,'0.025');
        assert.equal((await session.get('/artifacts/IVaultPortal')).status,400);
      }finally{
        if(server){server.close();server.closeAllConnections();}for(const name of methods)publicClient[name]=saved[name];if(savedDirectory===undefined)delete process.env.DATA_DIRECTORY;else process.env.DATA_DIRECTORY=savedDirectory;
        if(!resolve(dir).startsWith(qa+sep))throw new Error('Unsafe test cleanup.');await rm(dir,{recursive:true,force:true});
      }
    });
  }finally{await provider.disconnect();}
});
