import {getAddress,isAddress,erc20Abi,formatUnits,parseAbiItem,zeroAddress} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {PONS,factoryAbi,curveAbi,tokenInfoAbi,poolKey,poolId} from '../shared/pons.mjs';
import {imageLink} from '../shared/project.mjs';
import {publicClient} from './chain.mjs';
import {createPons} from './pons.mjs';
import {withDeadline} from './deadline.mjs';
import {normalizeHolderBalances} from '../shared/distribution.mjs';
import {createLaunchIndex} from './launch-index.mjs';
const source='Pons v2 / Robinhood mainnet';
const holderSource='Robinhood Blockscout token holders';
const safeImage=value=>{try{return imageLink(value);}catch{return '';}};
const swapEvent=parseAbiItem('event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)');
export function createMarket(store,{client=publicClient,fetcher=(...args)=>fetch(...args),now=()=>Date.now(),protocol=createPons({client,now}),deadlines={},launchIndex=createLaunchIndex(store,{client,now,syncTimeoutMs:8000})}={}){
  const limits={core:12000,holders:5500,trades:10000,feed:16000,block:3000,...deadlines};
  let cachedFeed=null;const pending=new Map(),tradeCache=new Map(),holderCache=new Map(),times=new Map();
  function flight(key,milliseconds,work){
    if(pending.has(key))return pending.get(key);let active=true;
    const promise=withDeadline(()=>work(()=>{if(!active)throw new Error('This request expired.');}),milliseconds).finally(()=>{active=false;if(pending.get(key)===promise)pending.delete(key);});
    pending.set(key,promise);return promise;
  }
  async function timestamp(block){const key=String(block);if(!times.has(key)){const value=withDeadline(()=>client.getBlock({blockNumber:BigInt(block)}),limits.block).then(b=>new Date(Number(b.timestamp)*1000).toISOString()).catch(error=>{times.delete(key);throw error;});times.set(key,value);if(times.size>1000)times.delete(times.keys().next().value);}return times.get(key);}
  async function explorer(path){const response=await fetcher(`${NETWORK.explorer}/api/v2${path}`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Holder data is temporarily unavailable.');return response.json();}
  async function recentLogs(parameters,range=20000n){const latest=await client.getBlockNumber(),from=latest>range?latest-range:0n,parts=[];for(let start=from;start<=latest;start+=5000n)parts.push(client.getLogs({...parameters,fromBlock:start,toBlock:start+4999n<latest?start+4999n:latest}));const results=await Promise.allSettled(parts);if(results.every(r=>r.status==='rejected'))throw new Error('Recent chain events are temporarily unavailable.');return{logs:results.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(r=>!r.removed),fromBlock:String(from),toBlock:String(latest),partial:results.some(r=>r.status==='rejected')};}
  async function feed({refresh=false}={}){
    if(cachedFeed&&launchIndex.snapshot().coverage?.invalidated)cachedFeed=null;
    if(cachedFeed&&now()-cachedFeed.fetchedAt<(refresh?5000:60000))return cachedFeed;
    return flight('feed',limits.feed,async active=>{
      let page;
      try{await withDeadline(()=>protocol.verify(),5000);active();page=await launchIndex.sync({assertActive:active});}
      catch{active();page={...launchIndex.snapshot(),stale:true,error:'Latest launch history could not be verified.'};}
      active();const coverage={...page.coverage,...(page.stale?{status:'stale',partial:true}:{})},unique=new Map();
      if((coverage.fromBlock==null||coverage.toBlock==null)&&!coverage.invalidated){cachedFeed=null;throw new Error('Launch history is temporarily unavailable. Try again shortly.');}
      for(const log of [...page.logs].sort((a,b)=>Number(BigInt(b.blockNumber)-BigInt(a.blockNumber))||Number(b.logIndex)-Number(a.logIndex)))if(!unique.has(log.args.token.toLowerCase()))unique.set(log.args.token.toLowerCase(),log);
      const metadataName='pons-launch-metadata-v1',metadata=store.read(metadataName).filter(item=>item.chainId===4663&&item.factory===PONS.factory.address.toLowerCase()),updates=[];
      const items=await Promise.all([...unique.values()].slice(0,30).map(async log=>{
        const token=log.args.token,key=`${log.transactionHash.toLowerCase()}:${log.logIndex}:${log.blockHash.toLowerCase()}`,saved=metadata.find(item=>item.key===key);
        let fields=saved?.fields,metadataStale=false;
        if(!fields||now()-saved.fetchedAt>=900000){
          const results=await Promise.allSettled(['name','symbol','getTokenInfo'].map(functionName=>withDeadline(()=>client.readContract({address:token,abi:functionName==='getTokenInfo'?tokenInfoAbi:erc20Abi,functionName}),2000)));
          active();const validText=result=>result.status==='fulfilled'&&typeof result.value==='string'&&!!result.value.trim()&&result.value.length<=256;
          const text=(result,fallback)=>validText(result)?result.value:fallback;
          const name=text(results[0],saved?.fields.name),symbol=text(results[1],saved?.fields.symbol),image=results[2].status==='fulfilled'?safeImage(results[2].value?.[1]):saved?.fields.image||'';
          fields={name:name||'Token details unavailable',symbol:symbol||'—',image,metadataAvailable:!!name&&!!symbol};
          metadataStale=!!saved&&(!validText(results[0])||!validText(results[1]));
          // Failed lookups retain receipts and previously observed metadata, without extending their freshness.
          if(fields.metadataAvailable&&!metadataStale)updates.push({key,chainId:4663,factory:PONS.factory.address.toLowerCase(),fields,fetchedAt:now()});
        }
        return{id:token,tokenAddress:token,...fields,metadataStale,creator:log.args.deployer,curve:log.args.curve,pairToken:log.args.pairToken,createdAt:log.createdAt,blockNumber:String(log.blockNumber),blockHash:log.blockHash,logIndex:log.logIndex,transactionHash:log.transactionHash,source};
      }));active();
      if(updates.length)await store.change(metadataName,records=>{active();for(const update of updates){const index=records.findIndex(item=>item.key===update.key);if(index<0)records.push(update);else records[index]=update;}records.sort((a,b)=>b.fetchedAt-a.fetchedAt);records.splice(200);});active();
      const incompleteMetadata=items.some(item=>!item.metadataAvailable||item.metadataStale);
      cachedFeed={items,checkedAt:page.checkedAt??coverage.verifiedAt??null,fetchedAt:now(),fromBlock:coverage.fromBlock,toBlock:coverage.toBlock,partial:!!coverage.partial||!!page.stale,stale:!!page.stale,coverage,metadataPartial:incompleteMetadata,scope:coverage.scope,notice:page.stale?'Showing saved launch history. The latest chain state could not be verified.':coverage.partial?'Some launch history is still missing. Only the covered blocks are shown.':''};return cachedFeed;
    });
  }
  async function details(input){
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const address=getAddress(input.toLowerCase()),key=address.toLowerCase(),recent=store.read('market').find(item=>item.address===key&&item.data?.source===source&&item.data?.coreVersion===2);
    if(recent&&now()-recent.fetchedAt<30000)return recent.data;
    return flight('core:'+key,limits.core,async active=>{
      await protocol.verify();active();const[name,symbol,totalSupply,decimals,launch]=await Promise.all(['name','symbol','totalSupply','decimals'].map(functionName=>client.readContract({address,abi:erc20Abi,functionName})).concat(client.readContract({address:PONS.factory.address,abi:factoryAbi,functionName:'getLaunchedToken',args:[address]})));active();
      const market=launch.exists?await protocol.marketState(address):{};active();
      const checkedAt=new Date(now()).toISOString(),price=market.price??null,data={coreVersion:2,address,name,symbol,chainId:4663,checkedAt,currency:market.currency??null,pairToken:launch.exists?launch.pairToken:null,price,reserve:market.reserve??null,progress:market.progress??null,graduated:market.graduated??null,phase:market.phase??null,pool:market.pool??null,readyToGraduate:market.readyToGraduate??false,tradeable:!!launch.exists&&launch.pairToken.toLowerCase()===zeroAddress&&[0,2].includes(launch.phase)&&!(launch.phase===0&&market.readyToGraduate),buyTaxBps:market.buyTaxBps??null,sellTaxBps:market.sellTaxBps??null,holdersCount:null,totalSupply:String(totalSupply),decimals:Number(decimals),holders:[],holderDataAvailable:false,marketCap:price===null?null:String(Number(price)*Number(formatUnits(totalSupply,Number(decimals)))),volume:null,source};
      await store.change('market',records=>{active();const index=records.findIndex(item=>item.address===key),next={address:key,fetchedAt:now(),data};if(index<0)records.push(next);else records[index]=next;if(records.length>200)records.splice(0,records.length-200);});active();
      await store.change('observations',records=>{active();const latest=records.filter(item=>item.address===key).at(-1);if(!latest||now()-Date.parse(latest.checkedAt)>=60000)records.push({address:key,checkedAt,price,holdersCount:null,graduated:data.graduated,currency:data.currency,source});const cutoff=now()-7*86400000;for(let i=records.length-1;i>=0;i--)if(Date.parse(records[i].checkedAt)<cutoff)records.splice(i,1);if(records.length>50000)records.splice(0,records.length-50000);});return data;
    });
  }
  async function holders(input){
    if(typeof input!=='string'||!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const address=getAddress(input.toLowerCase()),key=address.toLowerCase(),cached=holderCache.get(key);
    if(cached&&now()-cached.fetchedAt<(cached.holderDataAvailable?30000:5000))return cached;
    // Retain compatible already-observed snapshots; new core reads never wait for the explorer.
    const stored=store.read('market').find(item=>item.address===key&&item.data?.coreVersion===2&&item.data?.holderDataAvailable&&now()-item.fetchedAt<30000);
    try{return await flight('holders:'+key,limits.holders,async active=>{
      if(stored){
        const sample=normalizeHolderBalances(stored.data.holders),data=stored.data;
        return{...sample,returned:Number.isSafeInteger(data.returned)&&data.returned>=sample.returned?data.returned:sample.returned,duplicateRows:Number.isSafeInteger(data.duplicateRows)&&data.duplicateRows>=0?data.duplicateRows:sample.duplicateRows,holdersCount:data.holdersCount??null,holderDataAvailable:true,source:data.holderSource||null,balanceUnit:'token-base-units',snapshotBlock:null,snapshotBlockHash:null,paginationComplete:typeof data.paginationComplete==='boolean'?data.paginationComplete:null,coverage:data.coverage==='partial'?'partial':'unknown',checkedAt:data.holdersCheckedAt??data.checkedAt??null,fetchedAt:stored.fetchedAt};
      }
      const results=await Promise.allSettled([withDeadline(()=>explorer(`/tokens/${address}`),limits.holders-1),withDeadline(()=>explorer(`/tokens/${address}/holders`),limits.holders-1)]);active();const[info,list]=results;
      if(list.status!=='fulfilled'||!Array.isArray(list.value?.items))throw new Error('Holder balances are unavailable.');
      const sample=normalizeHolderBalances(list.value.items.map(item=>({address:item?.address?.hash,balance:item?.value}))),next=list.value.next_page_params;
      const paginationComplete=next===null?true:next&&typeof next==='object'&&!Array.isArray(next)&&Object.keys(next).length>0?false:null;
      const count=info.status==='fulfilled'&&/^(0|[1-9]\d*)$/.test(String(info.value?.holders_count))?Number(info.value.holders_count):null;
      const result={...sample,holdersCount:Number.isSafeInteger(count)?count:null,holderDataAvailable:true,source:holderSource,balanceUnit:'token-base-units',snapshotBlock:null,snapshotBlockHash:null,paginationComplete,coverage:paginationComplete===null?'unknown':'partial',checkedAt:new Date(now()).toISOString(),fetchedAt:now()};holderCache.set(key,result);if(holderCache.size>200)holderCache.delete(holderCache.keys().next().value);return result;
    });}catch{return{holders:[],sampled:0,returned:0,duplicateRows:0,holdersCount:null,holderDataAvailable:false,source:holderSource,balanceUnit:'token-base-units',snapshotBlock:null,snapshotBlockHash:null,paginationComplete:null,coverage:'unknown',checkedAt:null};}
  }
  async function observe(input){const[data,holderData]=await Promise.all([details(input),holders(input)]);return{...data,...holderData,source:data.source,holderSource:holderData.source,holdersCheckedAt:holderData.checkedAt,checkedAt:data.checkedAt};}
  async function trades(input){
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const token=getAddress(input.toLowerCase()),key=token.toLowerCase(),cached=tradeCache.get(key);if(cached&&now()-cached.fetchedAt<(cached.available?30000:5000))return cached;
    try{return await flight('trades:'+key,limits.trades,async active=>{
      const launch=await protocol.launchRecord(token),asset=await protocol.quoteAsset(launch);active();const requests=[recentLogs({address:launch.curve,events:curveAbi.filter(e=>e.type==='event')})];
      const keyForPool=poolKey(launch,PONS.hook.address);if(launch.phase===2){await protocol.verify(['manager']);active();requests.push(recentLogs({address:PONS.manager.address,event:swapEvent,args:{id:poolId(keyForPool)}}));}
      const pages=await Promise.all(requests);active();const logs=pages.flatMap(p=>p.logs).sort((a,b)=>Number(b.blockNumber-a.blockNumber)||Number(b.logIndex-a.logIndex)).slice(0,60);
      const results=await Promise.allSettled(logs.map(async log=>{let kind,amount,value,wallet;if(log.eventName==='CurveBuy'){kind='buy';amount=log.args.tokensOut;value=log.args.quoteIn;wallet=log.args.buyer;}else if(log.eventName==='CurveSell'){kind='sell';amount=log.args.tokensIn;value=log.args.quoteOut;wallet=log.args.seller;}else{const quoteIs0=keyForPool.currency0.toLowerCase()===launch.pairToken.toLowerCase(),quoteDelta=quoteIs0?log.args.amount0:log.args.amount1,tokenDelta=quoteIs0?log.args.amount1:log.args.amount0;kind=quoteDelta<0n?'buy':'sell';amount=tokenDelta<0n?-tokenDelta:tokenDelta;value=quoteDelta<0n?-quoteDelta:quoteDelta;wallet=log.args.sender;}const tokenAmount=formatUnits(amount,18),quoteValue=formatUnits(value,asset.decimals);return{kind,amount:tokenAmount,value:quoteValue,price:amount?String(Number(quoteValue)/Number(tokenAmount)):null,currency:asset.symbol,wallet,checkedAt:await timestamp(log.blockNumber),transactionHash:log.transactionHash,poolTrade:log.eventName==='Swap'};}));active();
      if(logs.length&&results.every(r=>r.status==='rejected'))throw new Error('Trade timestamps are unavailable.');
      const result={items:results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),currency:asset.symbol,available:true,fetchedAt:now(),partial:pages.some(p=>p.partial)||results.some(r=>r.status==='rejected'),fromBlock:pages[0].fromBlock,toBlock:pages[0].toBlock,scope:'Latest 60 trades within 20,000 blocks. Curve prices are execution prices including fees; pool amounts exclude hook fees. Pool sender may be a router.'};tradeCache.set(key,result);if(tradeCache.size>200)tradeCache.delete(tradeCache.keys().next().value);return result;
    });}catch{return{items:[],available:false,fetchedAt:now(),scope:'Recent trade history could not be loaded. Please try again.'};}
  }
  function history(address){return store.read('observations').filter(item=>item.address===address.toLowerCase()&&item.source===source).slice(-500);}
  async function forensics(input){
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');
    const address=getAddress(input.toLowerCase());
    const [core,holderData,tradeData]=await Promise.allSettled([details(input),holders(input),trades(input)]);
    const token=core.status==='fulfilled'?core.value:null,holder=holderData.status==='fulfilled'?holderData.value:null,trade=tradeData.status==='fulfilled'?tradeData.value:null;
    let launch=null,registered=null,recipientIsContract=null,graduationThreshold=null,graduationCurrency=null;
    // A successful registry read can prove absence. A timeout cannot.
    try{await withDeadline(async()=>{await protocol.verify();const record=await client.readContract({address:PONS.factory.address,abi:factoryAbi,functionName:'getLaunchedToken',args:[address]});if(typeof record?.exists!=='boolean')throw new Error('Registry result unavailable.');registered=record.exists;launch=record.exists?record:null;},limits.core);}catch{}
    if(launch){try{const code=await withDeadline(()=>client.getCode({address:launch.creatorFeeRecipient}),3000);recipientIsContract=!!code&&code!=='0x';}catch{recipientIsContract=null;}}
    if(launch){try{const asset=await withDeadline(()=>protocol.quoteAsset(launch),3000);graduationThreshold=formatUnits(launch.graduationThreshold,asset.decimals);graduationCurrency=asset.symbol;}catch{}}
    const supply=token&&Number(token.totalSupply)>0?BigInt(token.totalSupply):null;
    const largest=holder&&holder.holderDataAvailable&&supply?[...holder.holders].sort((a,b)=>BigInt(b.balance)>BigInt(a.balance)?1:BigInt(b.balance)<BigInt(a.balance)?-1:0).slice(0,10).map(item=>BigInt(item.balance)):null;
    const concentration=largest&&supply?{largestCount:largest.length,share:Number(largest.reduce((sum,value)=>sum+value,0n)*10000n/supply)/100,sampled:holder.holders.length,holdersCount:holder.holdersCount,note:'Returned balances may include pools and contracts; the explorer index can lag recent transfers. This is not a whale or ownership verdict.'}:null;
    const items=trade&&trade.available?trade.items:[];
    const counted=items.reduce((summary,item)=>{const wallet=String(item.wallet||'').toLowerCase();if(!summary.wallets.has(wallet))summary.wallets.add(wallet);if(item.kind==='buy')summary.buyValue+=Number(item.value||0);else if(item.kind==='sell')summary.sellValue+=Number(item.value||0);return summary;},{buyValue:0,sellValue:0,wallets:new Set()});
    const observedTrading=trade&&trade.available?{buys:items.filter(item=>item.kind==='buy').length,sells:items.filter(item=>item.kind==='sell').length,distinctWallets:counted.wallets.size,buyValue:counted.buyValue,sellValue:counted.sellValue,currency:trade.currency,coverage:{fromBlock:trade.fromBlock,toBlock:trade.toBlock},partial:!!trade.partial,note:'Direct curve and pool execution events only. Routed trades are attributed to their sending address, which may be a router.'}:null;
    const deployer=launch?launch.deployer.toLowerCase():null;
    const launcherActivity=deployer&&trade&&trade.available?{buys:items.filter(item=>item.kind==='buy'&&String(item.wallet||'').toLowerCase()===deployer).length,sells:items.filter(item=>item.kind==='sell'&&String(item.wallet||'').toLowerCase()===deployer).length,note:'Only trades sent directly by the launching wallet within the covered blocks are counted. Trades routed through other addresses cannot be attributed.'}:null;
    // Material fact flags: plain observations from the checks above, never a safety score or rating.
    const flags=[];
    if(launch&&Number(launch.creatorTaxBps)>0)flags.push({id:'creator-fee',label:`Creator fee ${Number(launch.creatorTaxBps)/100}%`});
    if(recipientIsContract===true)flags.push({id:'fee-recipient-contract',label:'Creator fees flow to a contract'});
    if(concentration&&concentration.share>=40)flags.push({id:'concentration',label:`Top ${concentration.largestCount} balances hold ${concentration.share.toFixed(0)}%`});
    if(launcherActivity&&launcherActivity.buys+launcherActivity.sells>0)flags.push({id:'launcher-traded',label:`Launching wallet traded ${launcherActivity.buys+launcherActivity.sells}× in window`});
    if(registered===false)flags.push({id:'unregistered',label:'Not a pons v2 launch'});
    return {address,checkedAt:new Date(now()).toISOString(),source,
      registration:launch?{registered:true,phase:launch.phase,pairToken:launch.pairToken,graduationThreshold,graduationCurrency,graduationThresholdRaw:String(launch.graduationThreshold),deployer:launch.deployer}:{registered,phase:null,pairToken:token?.pairToken||null,graduationThreshold:null,graduationCurrency:null,graduationThresholdRaw:null,deployer:null},
      creatorEconomics:launch?{creatorTaxBps:Number(launch.creatorTaxBps),recipient:launch.creatorFeeRecipient,recipientIsContract,buybackEnabled:launch.buybackEnabled}:null,
      concentration,observedTrading,launcherActivity,flags,
      scope:'Checks use the current Blockscout holder snapshot and pons/Uniswap v4 execution events from the most recent 20,000 blocks. Missing data is never estimated.',
      disclaimer:'A basic read of public chain data within the stated coverage. Not an independent audit, a safety rating or financial advice.'};
  }
  return{feed,details,holders,observe,history,trades,forensics};
}
