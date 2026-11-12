import {randomBytes,randomUUID} from 'node:crypto';
import {erc20Abi,zeroAddress,encodeFunctionData,encodeDeployData,encodeAbiParameters,formatEther,formatUnits,parseUnits,keccak256} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {PONS,factoryAbi,curveAbi,escrowAbi,hookAbi,stateAbi,quoterAbi,routerAbi,permitAbi,poolKeyType,poolKey,poolId,quoteCurveBuy,quoteCurveSell,ceilDiv} from '../shared/pons.mjs';
import {validateLaunch,validateSplit,validAddress} from '../shared/launch.mjs';
import {publicClient,artifact} from './chain.mjs';

const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
const uint128max=(1n<<128n)-1n;
export async function verifyDeployment(client,name){const pinned=PONS[name],code=await client.getCode({address:pinned.address});if(!code||keccak256(code)!==pinned.codeHash)throw new Error('The protocol contracts changed. Transactions are paused until they can be verified.');}
export function createPons({client=publicClient,now=()=>Date.now(),loadArtifact=artifact,checkCode=verifyDeployment}={}){
  let checked=-Infinity;
  const quotes=new Map();
  const read=(address,abi,functionName,args=[],blockNumber)=>client.readContract({address,abi,functionName,args,...(blockNumber?{blockNumber}:{})});
  const factory=(name,args=[],block)=>read(PONS.factory.address,factoryAbi,name,args,block);
  async function verify(names=['factory','hook','escrow']){
    if(await client.getChainId()!==4663)throw new Error('Switch to Robinhood Chain before continuing.');
    if(now()-checked<60000&&names.every(name=>['factory','hook','escrow'].includes(name)))return;
    await Promise.all(names.map(name=>checkCode(client,name)));
    if(names.includes('factory')){const[escrow,hook]=await Promise.all([factory('feeEscrow'),factory('memeHook')]);if(!same(escrow,PONS.escrow.address)||!same(hook,PONS.hook.address))throw new Error('Protocol configuration changed. Please try again later.');checked=now();}
  }
  async function options(owner){
    await verify();const block=await client.getBlockNumber(),[fee,count,cap,allowed]=await Promise.all([factory('launchFee',[],block),factory('launchConfigCount',[],block),factory('maxCreatorTaxBps',[],block),owner?factory('canLaunch',[validAddress(owner)],block):null]);
    if(count>100n)throw new Error('Issuance plans could not be verified.');
    const configs=await Promise.all(Array.from({length:Number(count)},async(_,id)=>({id,...await factory('getLaunchConfig',[BigInt(id)],block)})));
    return{chainId:4663,factory:PONS.factory.address,fee:fee.toString(),feeETH:formatEther(fee),maxCreatorTaxBps:Number(cap),canLaunch:allowed,configs:configs.filter(c=>c.enabled).map(c=>({...c,supply:String(c.supply),curveFeeBps:Number(c.curveFeeBps),phantomQuote:String(c.phantomQuote),graduationThreshold:String(c.graduationThreshold)})),block:String(block),checkedAt:new Date(now()).toISOString()};
  }
  async function launchRecord(token){await verify();const launch=await factory('getLaunchedToken',[validAddress(token,'Token')]);if(!launch.exists)throw new Error('This token was not issued by the supported pons v2 factory.');return launch;}
  async function nativeRecord(token){const launch=await launchRecord(token);if(!same(launch.pairToken,zeroAddress))throw new Error('This trading view supports ETH-paired pons v2 tokens.');return launch;}
  async function verifyVault(address,owner){
    const compiled=await loadArtifact('RevenueSplitVault'),code=await client.getCode({address:validAddress(address,'Split vault')});
    if(!same(code,compiled.deployedBytecode))throw new Error('This is not a verified MemeHelm split vault.');
    const [controller,escrow,projectTreasury,auditTreasury,auditBps]=await Promise.all(['controller','feeEscrow','projectTreasury','auditTreasury','auditBps'].map(name=>read(address,compiled.abi,name)));
    if(owner&&!same(controller,owner))throw new Error('This split vault belongs to another wallet.');if(!same(escrow,PONS.escrow.address))throw new Error('The split vault uses a different fee escrow.');
    return{...compiled,controller,projectTreasury,auditTreasury,auditBps:Number(auditBps)};
  }
  async function prepareVault(owner,input){await verify();const settings=validateSplit(input),compiled=await loadArtifact('RevenueSplitVault');return{chainId:4663,data:encodeDeployData({abi:compiled.abi,bytecode:compiled.bytecode,args:[settings.projectTreasury,settings.auditTreasury,settings.auditBps]}),value:'0',settings};}
  async function prepareLaunch(owner,input){
    const draft=validateLaunch(input),settings=await options(owner),config=settings.configs.find(c=>c.id===draft.configId);if(!settings.canLaunch)throw new Error('Pons is not accepting launches from this wallet. You can still save your draft.');if(!config)throw new Error('This issuance plan is no longer available.');if(draft.creatorTaxBps>settings.maxCreatorTaxBps)throw new Error('The creator fee exceeds the current protocol limit.');
    if(draft.splitEnabled){const vault=await verifyVault(draft.vaultAddress,owner);if(!same(vault.projectTreasury,draft.projectTreasury)||!same(vault.auditTreasury,draft.auditTreasury)||vault.auditBps!==draft.auditBps)throw new Error('Your split settings changed. Activate a new split or restore its original settings.');}
    else if(draft.vaultAddress)throw new Error('A split vault requires the split option.');
    else {const code=await client.getCode({address:draft.creatorFeeRecipient});if(code&&code!=='0x')throw new Error('Choose a wallet address, or activate a MemeHelm split vault. Other contracts may be unable to claim fees.');}
    const expectedEconomics=await factory('previewLaunchEconomics',[BigInt(draft.configId),zeroAddress]),salt=`0x${randomBytes(32).toString('hex')}`;
    const params={name:draft.name,symbol:draft.symbol,logo:draft.image,description:draft.description,socials:{twitter:draft.x,telegram:draft.telegram,discord:'',website:draft.website,farcaster:''},creatorFeeRecipient:draft.creatorFeeRecipient,creatorTaxBps:draft.creatorTaxBps,buybackEnabled:false,expectedEconomics,salt};
    await client.simulateContract({address:PONS.factory.address,abi:factoryAbi,functionName:'launchToken',args:[params,BigInt(draft.configId),zeroAddress],account:owner,value:BigInt(settings.fee)});
    return{chainId:4663,to:PONS.factory.address,data:encodeFunctionData({abi:factoryAbi,functionName:'launchToken',args:[params,BigInt(draft.configId),zeroAddress]}),value:settings.fee,expiresAt:new Date(now()+90000).toISOString(),economics:expectedEconomics,settings:draft,config};
  }
  async function marketState(token){
    const launch=await nativeRecord(token),key=poolKey(launch,PONS.hook.address),id=poolId(key);
    if(launch.phase===0){const[reserves,raised,ready,fee,tax]=await Promise.all(['getReserves','realQuoteReserve','readyToGraduate','feeBps','creatorTaxBps'].map(name=>read(launch.curve,curveAbi,name)));return{launch,pool:id,phase:launch.phase,price:String(Number(reserves[0])/Number(reserves[1])),reserve:formatEther(raised),progress:Math.min(100,Number(raised)*100/Number(launch.graduationThreshold)),graduated:false,buyTaxBps:Number(fee+tax),sellTaxBps:Number(fee+tax),readyToGraduate:ready};}
    if(launch.phase===2){await verify(['stateView']);const[slot,policy]=await Promise.all([read(PONS.stateView.address,stateAbi,'getSlot0',[id]),factory('getLaunchFeePolicy',[token])]);const sqrt=Number(slot[0])/2**96,price=slot[0]===0n?null:String(1/(sqrt*sqrt));return{launch,pool:id,phase:2,price,reserve:null,progress:100,graduated:true,buyTaxBps:Number(policy.hookFeeBps)+Number(launch.creatorTaxBps),sellTaxBps:Number(policy.hookFeeBps)+Number(launch.creatorTaxBps),readyToGraduate:true};}
    return{launch,pool:id,phase:launch.phase,price:null,reserve:null,progress:launch.phase===1?100:null,graduated:false,buyTaxBps:null,sellTaxBps:null,readyToGraduate:true};
  }
  async function quote(owner,input){
    const token=validAddress(input.token,'Token'),side=input.side,slippageBps=Number(input.slippageBps??100);if(!['buy','sell'].includes(side)||!Number.isInteger(slippageBps)||slippageBps<10||slippageBps>500)throw new Error('Choose buy or sell and slippage from 0.1% to 5%.');
    const amount=String(input.amount??'').trim();if(!/^\d{1,24}(\.\d{1,18})?$/.test(amount))throw new Error('Enter a positive amount with up to 18 decimals.');const value=parseUnits(amount,18);if(value<=0n||value>uint128max)throw new Error('Enter a valid trade amount.');
    const launch=await nativeRecord(token);if(![0,2].includes(launch.phase))throw new Error(launch.phase===1?'The pool is being created. Trading resumes after graduation.':'This launch is no longer trading.');
    const balance=side==='buy'?await client.getBalance({address:owner}):await read(token,erc20Abi,'balanceOf',[owner]);if(value>balance)throw new Error('Your wallet balance is too low for this amount.');
    const transactions=[];let output,spent=value,refund=0n,snipe=0n,minArgument,route;
    const approve=async spender=>{const allowance=await read(token,erc20Abi,'allowance',[owner,spender]);if(allowance<value){if(allowance>0n)transactions.push({label:'Reset token allowance',to:token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[spender,0n]}),value:'0'});transactions.push({label:'Approve exact token amount',to:token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[spender,value]}),value:'0'});}};
    if(launch.phase===0){
      route='Pons bonding curve';const block=await client.getBlockNumber(),names=['getReserves','sellableTokens','feeBps','creatorTaxBps','readyToGraduate'];const[reserves,sellable,feeBps,taxBps,ready]=await Promise.all(names.map(name=>read(launch.curve,curveAbi,name,[],block)));
      if(ready)throw new Error('The curve is full. Wait for pool graduation before trading.');
      if(side==='buy'){snipe=await read(launch.curve,curveAbi,'currentSnipeTaxBps',[owner],block);const result=quoteCurveBuy({input:value,quoteReserve:reserves[0],tokenReserve:reserves[1],sellable,feeBps,taxBps,snipeBps:snipe});output=result.output;spent=result.spent;refund=result.refund;snipe=result.snipeBps;minArgument=output*(10000n-BigInt(slippageBps))/10000n;if(spent<value)minArgument=ceilDiv(minArgument*value,spent);}
      else {output=quoteCurveSell({input:value,quoteReserve:reserves[0],tokenReserve:reserves[1],feeBps,taxBps});minArgument=output*(10000n-BigInt(slippageBps))/10000n;await approve(launch.curve);}
      const args=[value,minArgument,owner];transactions.push({label:side==='buy'?'Buy tokens':'Sell tokens',to:launch.curve,data:encodeFunctionData({abi:curveAbi,functionName:side,args}),value:side==='buy'?String(value):'0'});
      if(side==='buy'||transactions.length===1)await client.simulateContract({address:launch.curve,abi:curveAbi,functionName:side,args,account:owner,value:side==='buy'?value:0n});
    }else{
      route='Uniswap v4';await verify(['router','permit2','quoter','stateView']);const key=poolKey(launch,PONS.hook.address),zeroForOne=side==='buy',inputCurrency=zeroForOne?key.currency0:key.currency1,outputCurrency=zeroForOne?key.currency1:key.currency0;
      const result=await client.simulateContract({address:PONS.quoter.address,abi:quoterAbi,functionName:'quoteExactInputSingle',args:[{poolKey:key,zeroForOne,exactAmount:value,hookData:'0x'}],account:owner});output=result.result[0];minArgument=output*(10000n-BigInt(slippageBps))/10000n;
      if(side==='sell'){await approve(PONS.permit2.address);const allowance=await read(PONS.permit2.address,permitAbi,'allowance',[owner,token,PONS.router.address]);if(allowance[0]<value||Number(allowance[1])<Math.floor(now()/1000)+300)transactions.push({label:'Authorize router for this amount',to:PONS.permit2.address,data:encodeFunctionData({abi:permitAbi,functionName:'approve',args:[token,PONS.router.address,value,Math.floor(now()/1000)+600]}),value:'0'});}
      const swapType={type:'tuple',components:[{...poolKeyType,name:'poolKey'},{name:'zeroForOne',type:'bool'},{name:'amountIn',type:'uint128'},{name:'amountOutMinimum',type:'uint128'},{name:'hookData',type:'bytes'}]};
      const params=[encodeAbiParameters([swapType],[{poolKey:key,zeroForOne,amountIn:value,amountOutMinimum:minArgument,hookData:'0x'}]),encodeAbiParameters([{type:'address'},{type:'uint256'}],[inputCurrency,value]),encodeAbiParameters([{type:'address'},{type:'uint256'}],[outputCurrency,minArgument])];
      const packed=encodeAbiParameters([{type:'bytes'},{type:'bytes[]'}],['0x060c0f',params]),deadline=BigInt(Math.floor(now()/1000)+120);
      const args=['0x10',[packed],deadline];transactions.push({label:side==='buy'?'Buy tokens':'Sell tokens',to:PONS.router.address,data:encodeFunctionData({abi:routerAbi,functionName:'execute',args}),value:side==='buy'?String(value):'0'});
      if(transactions.length===1)await client.simulateContract({address:PONS.router.address,abi:routerAbi,functionName:'execute',args,account:owner,value:side==='buy'?value:0n});
    }
    if(output<=0n||minArgument<=0n)throw new Error('This amount is too small to trade.');
    const id=randomUUID(),expires=now()+90000,result={id,token,side,route,chainId:4663,input:formatUnits(value,18),output:formatUnits(output,18),minimum:formatUnits(output*(10000n-BigInt(slippageBps))/10000n,18),spent:formatUnits(spent,18),refund:formatUnits(refund,18),snipeTaxBps:Number(snipe),slippageBps,recipient:owner,expiresAt:new Date(expires).toISOString(),steps:transactions.map(t=>t.label)};
    for(const[key,value]of quotes)if(value.expires<now())quotes.delete(key);if(quotes.size>500)quotes.delete(quotes.keys().next().value);
    quotes.set(id,{owner:owner.toLowerCase(),expires,transactions,token,phase:launch.phase,result});return result;
  }
  async function tradeStep(owner,id,index){const saved=quotes.get(id);if(!saved||saved.owner!==owner.toLowerCase())throw new Error('Quote not found. Request a new quote.');if(saved.expires<=now())throw new Error('This quote expired. Review a new quote before signing.');if(!Number.isInteger(index)||index<0||index>=saved.transactions.length)throw new Error('Invalid trade step.');const launch=await nativeRecord(saved.token);if(launch.phase!==saved.phase)throw new Error('The trading route changed. Review a new quote.');return{...saved.transactions[index],chainId:4663,expiresAt:new Date(saved.expires).toISOString()};}
  async function snapshot(project){
    if(project.chainId!==4663)throw new Error('This project belongs to another network.');if(!project.tokenAddress)throw new Error('Launch or import a token first.');const token=validAddress(project.tokenAddress,'Token');await verify();
    const[name,symbol,totalSupply,decimals,registered]=await Promise.all(['name','symbol','totalSupply','decimals'].map(name=>read(token,erc20Abi,name)).concat(factory('getLaunchedToken',[token])));
    const result={chainId:4663,tokenAddress:token,name,symbol,totalSupply:String(totalSupply),decimals:Number(decimals),checkedAt:new Date(now()).toISOString(),vault:null,revenue:null};
    if(!registered.exists)return result;const launch=registered;
    if(!same(launch.pairToken,zeroAddress))return result;
    const claimable=await read(PONS.escrow.address,escrowAbi,'balanceOf',[launch.creatorFeeRecipient]);let unsettledQuote=0n,unsettledToken=0n;
    if(launch.phase===0){const amounts=await Promise.all(['quoteFeeBalance','creatorTaxBalance'].map(name=>read(launch.curve,curveAbi,name)));unsettledQuote=amounts[0]+amounts[1];}
    else if(launch.phase===2){const id=poolId(poolKey(launch,PONS.hook.address));const amounts=await Promise.all([zeroAddress,token].map(async currency=>{const[a,b]=await Promise.all(['pendingFees','pendingCreatorTax'].map(name=>read(PONS.hook.address,hookAbi,name,[id,currency])));return a+b;}));[unsettledQuote,unsettledToken]=amounts;}
    result.revenue={recipient:launch.creatorFeeRecipient,claimable:formatEther(claimable),unsweptQuote:formatEther(unsettledQuote),unsweptToken:formatUnits(unsettledToken,18),phase:launch.phase,buybackEnabled:launch.buybackEnabled,scope:'Escrow balance is shared by every launch using this recipient. Unsettled amounts are gross protocol fees, before the creator split.'};
    if(project.vaultAddress){if(!same(project.vaultAddress,launch.creatorFeeRecipient))throw new Error('This vault is not the current fee recipient.');const compiled=await verifyVault(project.vaultAddress,project.owner),addr=project.vaultAddress;
      const[totalReceived,totalReleased,projectPending,auditPending,auditReleased]=await Promise.all([read(addr,compiled.abi,'totalReceived'),read(addr,compiled.abi,'totalReleased'),read(addr,compiled.abi,'pending',[compiled.projectTreasury]),read(addr,compiled.abi,'pending',[compiled.auditTreasury]),read(addr,compiled.abi,'released',[compiled.auditTreasury])]);
      result.vault={address:addr,controller:compiled.controller,projectTreasury:compiled.projectTreasury,auditTreasury:compiled.auditTreasury,auditBps:compiled.auditBps,totalReceived:formatEther(totalReceived),totalReleased:formatEther(totalReleased),projectPending:formatEther(projectPending),auditPending:formatEther(auditPending),auditReleased:formatEther(auditReleased),auditAccrued:formatEther(auditPending+auditReleased)};
    }return result;
  }
  async function revenueAction(owner,project,action,recipient){
    const state=await snapshot(project);if(!state.revenue)throw new Error('This token has no supported pons fee ledger.');const launch=await nativeRecord(project.tokenAddress);let address,abi,functionName,args=[];
    if(action==='graduate'){if(launch.phase!==1)throw new Error('This launch is not waiting for its pool.');address=PONS.factory.address;abi=factoryAbi;functionName='createGraduatedPool';args=[project.tokenAddress];}
    else if(action==='release'){if(!state.vault)throw new Error('No verified split vault is linked.');if(![state.vault.projectTreasury,state.vault.auditTreasury].some(a=>same(a,recipient)))throw new Error('Use a fixed recipient of this vault.');address=state.vault.address;abi=(await loadArtifact('RevenueSplitVault')).abi;functionName='release';args=[recipient];}
    else if(action==='claim'){if(BigInt(parseUnits(state.revenue.claimable,18))===0n)throw new Error('There are no settled fees to collect yet.');if(state.vault){address=state.vault.address;abi=(await loadArtifact('RevenueSplitVault')).abi;functionName='claimFees';}else{if(!same(launch.creatorFeeRecipient,owner))throw new Error('Only the fee recipient wallet can collect this balance.');address=PONS.escrow.address;abi=escrowAbi;functionName='claim';}}
    else if(action==='sweep'){if(launch.buybackEnabled)throw new Error('These fees require settlement by the protocol operator.');if(state.vault){address=state.vault.address;abi=(await loadArtifact('RevenueSplitVault')).abi;functionName='sweepFees';args=[project.tokenAddress];}else{if(!same(owner,launch.creatorFeeRecipient))throw new Error('Only the fee recipient can settle these fees.');if(launch.phase===0){address=launch.curve;abi=curveAbi;functionName='sweepFees';args=[0n];}else if(launch.phase===2){if(Number(state.revenue.unsweptToken)>0)throw new Error('Token-denominated fees require settlement by the protocol operator.');address=PONS.hook.address;abi=hookAbi;functionName='sweepPoolFees';args=[poolId(poolKey(launch,PONS.hook.address)),0n,0n];}else throw new Error('Settlement is unavailable during graduation.');}}
    else throw new Error('Choose a valid revenue action.');
    await client.simulateContract({address,abi,functionName,args,account:owner});return{chainId:4663,to:address,data:encodeFunctionData({abi,functionName,args}),value:'0',label:action,recipient:action==='release'?recipient:action==='claim'?launch.creatorFeeRecipient:null,amount:action==='release'?(same(recipient,state.vault.projectTreasury)?state.vault.projectPending:state.vault.auditPending):action==='claim'?state.revenue.claimable:null,expiresAt:new Date(now()+90000).toISOString()};
  }
  return{verify,options,launchRecord,nativeRecord,marketState,verifyVault,prepareVault,prepareLaunch,quote,tradeStep,snapshot,revenueAction};
}
export const pons=createPons();
