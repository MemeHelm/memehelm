import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeFunctionData,parseEther,erc20Abi,zeroAddress} from 'viem';
import {PONS,factoryAbi,curveAbi} from '../shared/pons.mjs';
import {createPons} from '../server/pons.mjs';
const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222',token='0x3333333333333333333333333333333333333333',curve='0x4444444444444444444444444444444444444444',pin='0x'+'a'.repeat(64);
function fixture(){
 let time=1800000000000,allowed=true,fee=12345n,phase=0,ready=false,allowance=0n;const simulations=[],checked=[];
 const record=()=>({token,curve,deployer:owner,creatorFeeRecipient:owner,pairToken:zeroAddress,graduationThreshold:parseEther('4.2'),poolFee:0,tickSpacing:200,creatorTaxBps:100,buybackEnabled:false,phase,sweptQuote:0n,sweptTokens:0n,sweptAt:0n,exists:true});
 const client={getChainId:async()=>4663,getBlockNumber:async()=>100n,getCode:async()=>'0x',getBalance:async()=>parseEther('100'),readContract:async({functionName,args})=>{const values={feeEscrow:PONS.escrow.address,memeHook:PONS.hook.address,launchFee:fee,launchConfigCount:1n,maxCreatorTaxBps:1000n,canLaunch:allowed,snipeTaxSeconds:600n,snipeTaxStartBps:5000n,getLaunchConfig:{supply:10n**27n,curveFeeBps:100n,phantomQuote:parseEther('1.68'),graduationThreshold:parseEther('4.2'),poolFee:0,tickSpacing:200,enabled:true},previewLaunchEconomics:pin,getLaunchedToken:record(),getReserves:[parseEther('1.68'),10n**27n],realQuoteReserve:0n,sellableTokens:8n*10n**26n,feeBps:100n,creatorTaxBps:100n,currentSnipeTaxBps:0n,readyToGraduate:ready,balanceOf:parseEther('1000000'),allowance};if(!(functionName in values))throw Error(functionName);return values[functionName];},simulateContract:async request=>{simulations.push(request);return{result:0n};}};
 const protocol=createPons({client,now:()=>time,checkCode:async(_,name)=>checked.push(name)});
 return{protocol,client,simulations,checked,setTime:v=>time=v,setAllowed:v=>allowed=v,setFee:v=>fee=v,setPhase:v=>phase=v,setReady:v=>ready=v,setAllowance:v=>allowance=v};
}
test('launch reads wallet permissions, fee and economics pin again for every preparation',async()=>{
 const f=fixture(),draft={name:'Orbit Club',symbol:'ORBIT',creatorFeeRecipient:owner,creatorTaxBps:100,configId:0};
 const prepared=await f.protocol.prepareLaunch(owner,draft),decoded=decodeFunctionData({abi:factoryAbi,data:prepared.data});assert.equal(prepared.to,PONS.factory.address);assert.equal(prepared.value,'12345');assert.equal(decoded.functionName,'launchToken');assert.equal(decoded.args[0].expectedEconomics,pin);assert.equal(decoded.args[0].buybackEnabled,false);assert.equal(decoded.args[2],zeroAddress);assert.equal(f.simulations.length,1);
 f.setFee(54321n);assert.equal((await f.protocol.prepareLaunch(owner,draft)).value,'54321');
 f.setAllowed(false);await assert.rejects(()=>f.protocol.prepareLaunch(owner,draft),/not accepting launches/);assert.equal(f.simulations.length,2);
 f.setAllowed(true);await assert.rejects(()=>f.protocol.prepareLaunch(owner,{...draft,creatorTaxBps:1001}),/current protocol limit/);
 assert.deepEqual(f.checked.slice(0,3),['factory','hook','escrow']);
});
test('snipe tax exemptions reach the four-argument launchToken overload only when supplied',async()=>{
 const f=fixture(),draft={name:'Orbit Club',symbol:'ORBIT',creatorFeeRecipient:owner,creatorTaxBps:100,configId:0,snipeTaxExemptions:[owner,other]};
 const prepared=await f.protocol.prepareLaunch(owner,draft),decoded=decodeFunctionData({abi:factoryAbi,data:prepared.data});
 assert.equal(decoded.functionName,'launchToken');assert.equal(decoded.args.length,4);assert.deepEqual(decoded.args[3],[owner,other]);
 assert.deepEqual(f.simulations[0].args[3],[owner,other]);
 const plain=await f.protocol.prepareLaunch(owner,{...draft,snipeTaxExemptions:[]});
 assert.equal(decodeFunctionData({abi:factoryAbi,data:plain.data}).args.length,3);
 const options=await f.protocol.options(owner);assert.equal(options.snipeTaxSeconds,600);assert.equal(options.snipeTaxStartBps,5000);
 await assert.rejects(()=>f.protocol.prepareLaunch(owner,{...draft,snipeTaxExemptions:[owner,owner]}),/listed once/);
 await assert.rejects(()=>f.protocol.prepareLaunch(owner,{...draft,snipeTaxExemptions:Array(33).fill(owner)}),/at most 32/);
});
test('trade preparations bind wallet, network, quote lifetime and current launch phase',async()=>{
 const f=fixture(),quote=await f.protocol.quote(owner,{token,side:'buy',amount:'0.01',slippageBps:100});assert.equal(quote.steps.length,1);assert.ok(Number(quote.output)>Number(quote.minimum));
 await assert.rejects(()=>f.protocol.tradeStep(other,quote.id,0),/Quote not found/);
 const tx=await f.protocol.tradeStep(owner,quote.id,0);assert.equal(tx.chainId,4663);assert.equal(tx.to,curve);const decoded=decodeFunctionData({abi:curveAbi,data:tx.data});assert.equal(decoded.args[2],owner);
 f.setPhase(1);await assert.rejects(()=>f.protocol.tradeStep(owner,quote.id,0),/route changed/);f.setPhase(0);f.setTime(1800000090001);await assert.rejects(()=>f.protocol.tradeStep(owner,quote.id,0),/expired/);
 f.setReady(true);await assert.rejects(()=>f.protocol.quote(owner,{token,side:'sell',amount:'1'}),/curve is full/);
});
test('sell approvals are exact, reset an existing nonzero allowance, and precede the protected trade',async()=>{
 const f=fixture();f.setAllowance(1n);const quote=await f.protocol.quote(owner,{token,side:'sell',amount:'100',slippageBps:50});assert.equal(quote.steps.length,3);
 const reset=decodeFunctionData({abi:erc20Abi,data:(await f.protocol.tradeStep(owner,quote.id,0)).data}),approve=decodeFunctionData({abi:erc20Abi,data:(await f.protocol.tradeStep(owner,quote.id,1)).data});assert.equal(reset.args[1],0n);assert.equal(approve.args[0],curve);assert.equal(approve.args[1],parseEther('100'));
 const trade=decodeFunctionData({abi:curveAbi,data:(await f.protocol.tradeStep(owner,quote.id,2)).data});assert.equal(trade.functionName,'sell');assert.ok(trade.args[1]>0n);
});
