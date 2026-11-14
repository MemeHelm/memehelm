import {randomBytes,randomUUID} from 'node:crypto';
import {erc20Abi,zeroAddress,encodeFunctionData,encodeDeployData,encodeAbiParameters,formatEther,formatUnits,parseUnits,keccak256} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {PONS,factoryAbi,curveAbi,escrowAbi,hookAbi,stateAbi,quoterAbi,routerAbi,permitAbi,poolKeyType,poolKey,poolId,quoteCurveBuy,quoteCurveSell,ceilDiv} from '../shared/pons.mjs';
import {validateLaunch,validateSplit,validAddress} from '../shared/launch.mjs';
import {computeHoldersPayout,holdersExclusions} from '../shared/distribution.mjs';
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
    await verify();const block=await client.getBlockNumber(),[fee,count,cap,allowed,snipeSeconds,snipeStartBps]=await Promise.all([factory('launchFee',[],block),factory('launchConfigCount',[],block),factory('maxCreatorTaxBps',[],block),owner?factory('canLaunch',[validAddress(owner)],block):null,factory('snipeTaxSeconds',[],block),factory('snipeTaxStartBps',[],block)]);
    if(count>100n)throw new Error('Issuance plans could not be verified.');
    const configs=await Promise.all(Array.from({length:Number(count)},async(_,id)=>({id,...await factory('getLaunchConfig',[BigInt(id)],block)})));
    return{chainId:4663,factory:PONS.factory.address,fee:fee.toString(),feeETH:formatEther(fee),maxCreatorTaxBps:Number(cap),canLaunch:allowed,snipeTaxSeconds:Number(snipeSeconds),snipeTaxStartBps:Number(snipeStartBps),configs:configs.filter(c=>c.enabled).map(c=>({...c,supply:String(c.supply),curveFeeBps:Number(c.curveFeeBps),phantomQuote:String(c.phantomQuote),graduationThreshold:String(c.graduationThreshold)})),block:String(block),checkedAt:new Date(now()).toISOString()};
  }
  async function launchRecord(token){await verify();const launch=await factory('getLaunchedToken',[validAddress(token,'Token')]);if(!launch.exists)throw new Error('This token was not issued by the supported pons v2 factory.');return launch;}
  async function nativeRecord(token){const launch=await launchRecord(token);if(!same(launch.pairToken,zeroAddress))throw new Error('This trading view supports ETH-paired pons v2 tokens.');return launch;}
  const quoteAssets=new Map();
  async function quoteAsset(launch){
    if(same(launch.pairToken,zeroAddress))return{address:zeroAddress,symbol:'ETH',decimals:18};
    const key=launch.pairToken.toLowerCase();if(quoteAssets.has(key))return quoteAssets.get(key);
    const [symbol,decimals]=await Promise.all(['symbol','decimals'].map(name=>read(launch.pairToken,erc20Abi,name)));
    if(!Number.isInteger(Number(decimals))||Number(decimals)>36)throw new Error('The quote asset decimals could not be verified.');
    const asset={address:launch.pairToken,symbol:String(symbol).slice(0,24),decimals:Number(decimals)};quoteAssets.set(key,asset);return asset;
  }
  async function identifyVault(address){
    const checksum=validAddress(address,'Fee vault'),code=await client.getCode({address:checksum});
    if(!code||code==='0x')throw new Error('This fee vault could not be read from the chain.');
    for(const name of ['RevenueSplitVault','HoldersVault','SocialVault']){
      const compiled=await loadArtifact(name);
      if(same(code,compiled.deployedBytecode))return{name,compiled};
    }
    throw new Error('This is not a verified MemeHelm fee vault.');
  }
  async function verifyVault(address,owner){
    const {name,compiled}=await identifyVault(address);
    if(name==='HoldersVault'||name==='SocialVault'){
      const kind=name==='HoldersVault'?'holders':'social',[controller,escrow]=await Promise.all([read(address,compiled.abi,'controller'),read(address,compiled.abi,'feeEscrow')]);
      if(owner&&!same(controller,owner))throw new Error(kind==='holders'?'This holders vault belongs to another wallet.':'This community escrow belongs to another wallet.');
      if(!same(escrow,PONS.escrow.address))throw new Error(kind==='holders'?'The holders vault uses a different fee escrow.':'The community escrow uses a different fee escrow.');
      return{kind,...compiled,controller};
    }
    const [controller,escrow,projectTreasury,auditTreasury,auditBps]=await Promise.all(['controller','feeEscrow','projectTreasury','auditTreasury','auditBps'].map(name=>read(address,compiled.abi,name)));
    if(owner&&!same(controller,owner))throw new Error('This split vault belongs to another wallet.');if(!same(escrow,PONS.escrow.address))throw new Error('The split vault uses a different fee escrow.');
    return{kind:'split',...compiled,controller,projectTreasury,auditTreasury,auditBps:Number(auditBps)};
  }
  async function prepareVault(owner,input){await verify();if(input&&(input.holdersEnabled===true||input.socialEnabled===true)){const holders=input.holdersEnabled===true,compiled=await loadArtifact(holders?'HoldersVault':'SocialVault');return{chainId:4663,data:encodeDeployData({abi:compiled.abi,bytecode:compiled.bytecode,args:[]}),value:'0',kind:holders?'holders':'social'};}const settings=validateSplit(input),compiled=await loadArtifact('RevenueSplitVault');return{chainId:4663,data:encodeDeployData({abi:compiled.abi,bytecode:compiled.bytecode,args:[settings.projectTreasury,settings.auditTreasury,settings.auditBps]}),value:'0',kind:'split',settings};}
  async function prepareLaunch(owner,input){
    const draft=validateLaunch(input),settings=await options(owner),config=settings.configs.find(c=>c.id===draft.configId);if(!settings.canLaunch)throw new Error('Pons is not accepting launches from this wallet. You can still save your draft.');if(!config)throw new Error('This issuance plan is no longer available.');if(draft.creatorTaxBps>settings.maxCreatorTaxBps)throw new Error('The creator fee exceeds the current protocol limit.');
    if(draft.splitEnabled){const vault=await verifyVault(draft.vaultAddress,owner);if(vault.kind!=='split')throw new Error('This vault is not a fixed split vault.');if(!same(vault.projectTreasury,draft.projectTreasury)||!same(vault.auditTreasury,draft.auditTreasury)||vault.auditBps!==draft.auditBps)throw new Error('Your split settings changed. Activate a new split or restore its original settings.');}
    else if(draft.holdersEnabled){const vault=await verifyVault(draft.vaultAddress,owner);if(vault.kind!=='holders')throw new Error('This vault is not a holders vault.');}
    else if(draft.socialEnabled){const vault=await verifyVault(draft.vaultAddress,owner);if(vault.kind!=='social')throw new Error('This vault is not a community escrow.');}
    else if(draft.vaultAddress)throw new Error('A fee vault requires its vault option.');
    else {const code=await client.getCode({address:draft.creatorFeeRecipient});if(code&&code!=='0x')throw new Error('Choose a wallet address, or activate a MemeHelm split vault. Other contracts may be unable to claim fees.');}
    const expectedEconomics=await factory('previewLaunchEconomics',[BigInt(draft.configId),zeroAddress]),salt=`0x${randomBytes(32).toString('hex')}`;
    const params={name:draft.name,symbol:draft.symbol,logo:draft.image,description:draft.description,socials:{twitter:draft.x,telegram:draft.telegram,discord:'',website:draft.website,farcaster:''},creatorFeeRecipient:draft.creatorFeeRecipient,creatorTaxBps:draft.creatorTaxBps,buybackEnabled:false,expectedEconomics,salt};
    // The 4-argument launchToken overload is only used when exemptions are supplied,
    // so launches without exemptions keep the exact 3-argument calldata used before.
    const launchArgs=[params,BigInt(draft.configId),zeroAddress,...(draft.snipeTaxExemptions.length?[draft.snipeTaxExemptions]:[])];
    await client.simulateContract({address:PONS.factory.address,abi:factoryAbi,functionName:'launchToken',args:launchArgs,account:owner,value:BigInt(settings.fee)});
    return{chainId:4663,to:PONS.factory.address,data:encodeFunctionData({abi:factoryAbi,functionName:'launchToken',args:launchArgs}),value:settings.fee,expiresAt:new Date(now()+90000).toISOString(),economics:expectedEconomics,settings:draft,config};
  }
  async function marketState(token){
    const launch=await launchRecord(token),asset=await quoteAsset(launch),key=poolKey(launch,PONS.hook.address),id=poolId(key),scale=10**(18-asset.decimals),base={launch,pool:id,currency:asset.symbol,pairToken:asset.address,quoteDecimals:asset.decimals};
    if(launch.phase===0){const[reserves,raised,ready,fee,tax]=await Promise.all(['getReserves','realQuoteReserve','readyToGraduate','feeBps','creatorTaxBps'].map(name=>read(launch.curve,curveAbi,name)));return{...base,phase:launch.phase,price:String(Number(reserves[0])/Number(reserves[1])*scale),reserve:formatUnits(raised,asset.decimals),progress:Math.min(100,Number(raised)*100/Number(launch.graduationThreshold)),graduated:false,buyTaxBps:Number(fee+tax),sellTaxBps:Number(fee+tax),readyToGraduate:ready};}
    if(launch.phase===2){await verify(['stateView']);const[slot,policy]=await Promise.all([read(PONS.stateView.address,stateAbi,'getSlot0',[id]),factory('getLaunchFeePolicy',[token])]);const sqrt=Number(slot[0])/2**96,ratio=sqrt*sqrt,price=slot[0]===0n?null:String((same(key.currency0,launch.pairToken)?1/ratio:ratio)*scale);return{...base,phase:2,price,reserve:null,progress:100,graduated:true,buyTaxBps:Number(policy.hookFeeBps)+Number(launch.creatorTaxBps),sellTaxBps:Number(policy.hookFeeBps)+Number(launch.creatorTaxBps),readyToGraduate:true};}
    return{...base,phase:launch.phase,price:null,reserve:null,progress:launch.phase===1?100:null,graduated:false,buyTaxBps:null,sellTaxBps:null,readyToGraduate:true};
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
      if(compiled.kind==='holders'){
        const[totalReceived,distributable,totalDistributed,rounds]=await Promise.all([read(addr,compiled.abi,'totalReceived'),read(addr,compiled.abi,'distributable'),read(addr,compiled.abi,'totalDistributed'),read(addr,compiled.abi,'rounds')]);
        result.vault={kind:'holders',address:addr,controller:compiled.controller,totalReceived:formatEther(totalReceived),distributable:formatEther(distributable),totalDistributed:formatEther(totalDistributed),rounds:Number(rounds)};
      } else if(compiled.kind==='social'){
        const[totalReceived,distributable,totalReleased,proposalCount,reviewWindow]=await Promise.all([read(addr,compiled.abi,'totalReceived'),read(addr,compiled.abi,'distributable'),read(addr,compiled.abi,'totalReleased'),read(addr,compiled.abi,'proposalCount'),read(addr,compiled.abi,'reviewWindow')]);
        result.vault={kind:'social',address:addr,controller:compiled.controller,totalReceived:formatEther(totalReceived),distributable:formatEther(distributable),totalReleased:formatEther(totalReleased),proposalCount:Number(proposalCount),reviewWindow:Number(reviewWindow)};
      } else {
        const[totalReceived,totalReleased,projectPending,auditPending,auditReleased]=await Promise.all([read(addr,compiled.abi,'totalReceived'),read(addr,compiled.abi,'totalReleased'),read(addr,compiled.abi,'pending',[compiled.projectTreasury]),read(addr,compiled.abi,'pending',[compiled.auditTreasury]),read(addr,compiled.abi,'released',[compiled.auditTreasury])]);
        result.vault={kind:'split',address:addr,controller:compiled.controller,projectTreasury:compiled.projectTreasury,auditTreasury:compiled.auditTreasury,auditBps:compiled.auditBps,totalReceived:formatEther(totalReceived),totalReleased:formatEther(totalReleased),projectPending:formatEther(projectPending),auditPending:formatEther(auditPending),auditReleased:formatEther(auditReleased),auditAccrued:formatEther(auditPending+auditReleased)};
      }
    }return result;
  }
  async function revenueAction(owner,project,action,recipient){
    const state=await snapshot(project);if(!state.revenue)throw new Error('This token has no supported pons fee ledger.');const launch=await nativeRecord(project.tokenAddress);const vaultArtifact=async()=>loadArtifact(state.vault?(state.vault.kind==='holders'?'HoldersVault':state.vault.kind==='social'?'SocialVault':'RevenueSplitVault'):'RevenueSplitVault');let address,abi,functionName,args=[];
    if(action==='graduate'){if(launch.phase!==1)throw new Error('This launch is not waiting for its pool.');address=PONS.factory.address;abi=factoryAbi;functionName='createGraduatedPool';args=[project.tokenAddress];}
    else if(action==='release'){if(!state.vault)throw new Error('No verified split vault is linked.');if(state.vault.kind==='holders')throw new Error('Holder payouts are prepared in the holders vault section.');if(state.vault.kind==='social')throw new Error('Escrow releases are prepared in the community escrow section.');if(![state.vault.projectTreasury,state.vault.auditTreasury].some(a=>same(a,recipient)))throw new Error('Use a fixed recipient of this vault.');address=state.vault.address;abi=(await loadArtifact('RevenueSplitVault')).abi;functionName='release';args=[recipient];}
    else if(action==='claim'){if(BigInt(parseUnits(state.revenue.claimable,18))===0n)throw new Error('There are no settled fees to collect yet.');if(state.vault){address=state.vault.address;abi=(await vaultArtifact()).abi;functionName='claimFees';}else{if(!same(launch.creatorFeeRecipient,owner))throw new Error('Only the fee recipient wallet can collect this balance.');address=PONS.escrow.address;abi=escrowAbi;functionName='claim';}}
    else if(action==='sweep'){if(launch.buybackEnabled)throw new Error('These fees require settlement by the protocol operator.');if(state.vault){address=state.vault.address;abi=(await vaultArtifact()).abi;functionName='sweepFees';args=[project.tokenAddress];}else{if(!same(owner,launch.creatorFeeRecipient))throw new Error('Only the fee recipient can settle these fees.');if(launch.phase===0){address=launch.curve;abi=curveAbi;functionName='sweepFees';args=[0n];}else if(launch.phase===2){if(Number(state.revenue.unsweptToken)>0)throw new Error('Token-denominated fees require settlement by the protocol operator.');address=PONS.hook.address;abi=hookAbi;functionName='sweepPoolFees';args=[poolId(poolKey(launch,PONS.hook.address)),0n,0n];}else throw new Error('Settlement is unavailable during graduation.');}}
    else throw new Error('Choose a valid revenue action.');
    await client.simulateContract({address,abi,functionName,args,account:owner});return{chainId:4663,to:address,data:encodeFunctionData({abi,functionName,args}),value:'0',label:action,recipient:action==='release'?recipient:action==='claim'?launch.creatorFeeRecipient:null,amount:action==='release'?(same(recipient,state.vault.projectTreasury)?state.vault.projectPending:state.vault.auditPending):action==='claim'?state.revenue.claimable:null,expiresAt:new Date(now()+90000).toISOString()};
  }
  // Counter-style holder payout: the keeper turns one explorer snapshot plus the
  // current vault balance into one explicit distribute() transaction for the
  // controller to review and sign. Nothing moves without that signature.
  async function prepareDistribution(owner,project,holdersResult){
    const state=await snapshot(project);
    if(!state.vault||state.vault.kind!=='holders')throw new Error('Link this token to a verified holders vault before preparing payouts.');
    const compiled=await loadArtifact('HoldersVault'),balance=await read(state.vault.address,compiled.abi,'distributable');
    if(balance===0n)throw new Error('Collect settled fees into the holders vault first.');
    if(!holdersResult||!holdersResult.holderDataAvailable)throw new Error('Holder data is temporarily unavailable. Try again shortly.');
    const launch=await nativeRecord(project.tokenAddress);
    const exclusions=holdersExclusions({curve:launch.curve,poolManager:PONS.manager.address,vault:state.vault.address});
    const round=computeHoldersPayout({entries:holdersResult.holders,amountWei:balance,exclude:exclusions});
    const recipients=round.payouts.map(payout=>payout.address),amounts=round.payouts.map(payout=>payout.amount);
    await client.simulateContract({address:state.vault.address,abi:compiled.abi,functionName:'distribute',args:[recipients,amounts],account:owner});
    return {chainId:4663,to:state.vault.address,data:encodeFunctionData({abi:compiled.abi,functionName:'distribute',args:[recipients,amounts]}),value:'0',label:'distribute',total:formatEther(balance),recipients,amounts:amounts.map(amount=>formatEther(amount)),round:{included:round.included,sampled:round.sampled,coveredBalance:round.coveredBalance,dropped:round.dropped},expiresAt:new Date(now()+90000).toISOString()};
  }
  // Community-escrow releases: fees wait onchain behind a public review window.
  // The workspace prepares propose/execute/cancel transactions; release execution
  // additionally requires the project's verified X connection (route-level gate).
  async function socialEscrowAction(owner,project,action,input){
    const state=await snapshot(project);
    if(!state.vault||state.vault.kind!=='social')throw new Error('Link this token to a verified community escrow first.');
    const compiled=await loadArtifact('SocialVault');
    if(action==='propose'){
      const recipient=validAddress(input.recipient,'Release recipient');
      let amount;try{amount=parseUnits(String(input.amount),18);}catch{throw new Error('Choose a release amount above zero.');}
      const balance=await read(state.vault.address,compiled.abi,'distributable');
      if(balance===0n)throw new Error('Collect settled fees into the escrow first.');
      if(amount<=0n)throw new Error('Choose a release amount above zero.');
      if(amount>balance)throw new Error('The escrow does not hold that much ETH yet.');
      const reviewWindow=Number(await read(state.vault.address,compiled.abi,'reviewWindow')),block=await client.getBlock(),args=[recipient,amount];
      await client.simulateContract({address:state.vault.address,abi:compiled.abi,functionName:'propose',args,account:owner});
      return {chainId:4663,to:state.vault.address,data:encodeFunctionData({abi:compiled.abi,functionName:'propose',args}),value:'0',label:'propose',recipient,amount:formatEther(amount),availableAt:new Date(Number(block.timestamp)*1000+reviewWindow*1000).toISOString(),expiresAt:new Date(now()+90000).toISOString()};
    }
    if(action==='execute'||action==='cancel'){
      const id=Number(input.proposalId);
      if(!Number.isSafeInteger(id)||id<=0)throw new Error('Choose a proposal.');
      const[recipient,amount,proposedAt,status]=await read(state.vault.address,compiled.abi,'proposals',[BigInt(id)]);
      if(Number(status)!==0)throw new Error('This proposal is already closed.');
      const windowSeconds=Number(await read(state.vault.address,compiled.abi,'reviewWindow')),block=await client.getBlock();
      if(action==='execute'&&BigInt(proposedAt)+BigInt(windowSeconds)>BigInt(block.timestamp))throw new Error('The community review window is still open.');
      const args=[BigInt(id)];
      await client.simulateContract({address:state.vault.address,abi:compiled.abi,functionName:action,args,account:owner});
      return {chainId:4663,to:state.vault.address,data:encodeFunctionData({abi:compiled.abi,functionName:action,args}),value:'0',label:action,proposalId:id,recipient,amount:formatEther(amount),proposedAt:new Date(Number(proposedAt)*1000).toISOString(),availableAt:new Date((Number(proposedAt)+windowSeconds)*1000).toISOString(),expiresAt:new Date(now()+90000).toISOString()};
    }
    throw new Error('Choose a valid escrow action.');
  }
  async function socialProposals(project,limit=10){
    const state=await snapshot(project);
    if(!state.vault||state.vault.kind!=='social')throw new Error('This project has no community escrow.');
    const compiled=await loadArtifact('SocialVault'),count=Number(await read(state.vault.address,compiled.abi,'proposalCount')),windowSeconds=Number(await read(state.vault.address,compiled.abi,'reviewWindow')),first=Math.max(1,count-Math.min(Math.max(1,limit),25)+1),ids=Array.from({length:Math.max(0,count-first+1)},(_,index)=>first+index);
    const proposals=await Promise.all(ids.reverse().map(async id=>{
      const[recipient,amount,proposedAt,status]=await read(state.vault.address,compiled.abi,'proposals',[BigInt(id)]);
      return {id,recipient,amount:formatEther(amount),proposedAt:new Date(Number(proposedAt)*1000).toISOString(),status:Number(status)===1?'executed':Number(status)===2?'cancelled':'open',availableAt:new Date((Number(proposedAt)+windowSeconds)*1000).toISOString()};
    }));
    return {proposals,reviewWindow:windowSeconds,proposalCount:count,checkedAt:new Date(now()).toISOString()};
  }
  return{verify,options,launchRecord,nativeRecord,quoteAsset,marketState,verifyVault,prepareVault,prepareLaunch,quote,tradeStep,snapshot,revenueAction,prepareDistribution,socialEscrowAction,socialProposals};
}
export const pons=createPons();
