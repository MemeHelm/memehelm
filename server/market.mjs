import {getAddress,isAddress,erc20Abi,formatUnits,parseAbiItem,zeroAddress} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {PONS,factoryAbi,curveAbi,tokenInfoAbi,poolKey,poolId} from '../shared/pons.mjs';
import {imageLink} from '../shared/project.mjs';
import {publicClient} from './chain.mjs';
import {createPons} from './pons.mjs';
import {withDeadline} from './deadline.mjs';
const source='Pons v2 / Robinhood mainnet';
const safeImage=value=>{try{return imageLink(value);}catch{return '';}};
const swapEvent=parseAbiItem('event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)');
export function createMarket(store,{client=publicClient,fetcher=(...args)=>fetch(...args),now=()=>Date.now(),protocol=createPons({client,now}),deadlines={}}={}){
  const limits={core:12000,holders:5500,trades:10000,feed:12000,block:3000,...deadlines};
  let cachedFeed=null;const pending=new Map(),tradeCache=new Map(),holderCache=new Map(),times=new Map();
  function flight(key,milliseconds,work){
    if(pending.has(key))return pending.get(key);let active=true;
    const promise=withDeadline(()=>work(()=>{if(!active)throw new Error('This request expired.');}),milliseconds).finally(()=>{active=false;if(pending.get(key)===promise)pending.delete(key);});
    pending.set(key,promise);return promise;
  }
  async function timestamp(block){const key=String(block);if(!times.has(key)){const value=withDeadline(()=>client.getBlock({blockNumber:BigInt(block)}),limits.block).then(b=>new Date(Number(b.timestamp)*1000).toISOString()).catch(error=>{times.delete(key);throw error;});times.set(key,value);if(times.size>1000)times.delete(times.keys().next().value);}return times.get(key);}
  async function explorer(path){const response=await fetcher(`${NETWORK.explorer}/api/v2${path}`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Holder data is temporarily unavailable.');return response.json();}
  async function recentLogs(parameters,range=20000n){const latest=await client.getBlockNumber(),from=latest>range?latest-range:0n,parts=[];for(let start=from;start<=latest;start+=5000n)parts.push(client.getLogs({...parameters,fromBlock:start,toBlock:start+4999n<latest?start+4999n:latest}));const results=await Promise.allSettled(parts);if(results.every(r=>r.status==='rejected'))throw new Error('Recent chain events are temporarily unavailable.');return{logs:results.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(r=>!r.removed),fromBlock:String(from),toBlock:String(latest),partial:results.some(r=>r.status==='rejected')};}
  async function feed(){
    if(cachedFeed&&now()-cachedFeed.fetchedAt<60000)return cachedFeed;
    return flight('feed',limits.feed,async active=>{
      await protocol.verify();active();const event=factoryAbi.find(e=>e.type==='event'&&e.name==='TokenLaunched'),page=await recentLogs({address:PONS.factory.address,event}),unique=new Map();active();
      for(const log of page.logs.sort((a,b)=>Number(b.blockNumber-a.blockNumber)||Number(b.logIndex-a.logIndex)))if(!unique.has(log.args.token.toLowerCase()))unique.set(log.args.token.toLowerCase(),log);
      const results=await Promise.allSettled([...unique.values()].slice(0,30).map(async log=>{const token=log.args.token,[name,symbol,createdAt,info]=await Promise.all([client.readContract({address:token,abi:erc20Abi,functionName:'name'}),client.readContract({address:token,abi:erc20Abi,functionName:'symbol'}),timestamp(log.blockNumber),withDeadline(()=>client.readContract({address:token,abi:tokenInfoAbi,functionName:'getTokenInfo'}),3000).catch(()=>null)]);return{id:token,tokenAddress:token,name,symbol,image:safeImage(info?.[1]),creator:log.args.deployer,curve:log.args.curve,pairToken:log.args.pairToken,createdAt,transactionHash:log.transactionHash,source};}));active();
      cachedFeed={items:results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),checkedAt:new Date(now()).toISOString(),fetchedAt:now(),fromBlock:page.fromBlock,toBlock:page.toBlock,partial:page.partial||results.some(r=>r.status==='rejected'),scope:'Recent 20,000 blocks from the official pons v2 factory. This is not an all-time launch list.'};return cachedFeed;
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
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const address=getAddress(input.toLowerCase()),key=address.toLowerCase(),cached=holderCache.get(key);
    if(cached&&now()-cached.fetchedAt<(cached.holderDataAvailable?30000:5000))return cached;
    // Retain compatible already-observed snapshots; new core reads never wait for the explorer.
    const stored=store.read('market').find(item=>item.address===key&&item.data?.coreVersion===2&&item.data?.holderDataAvailable&&now()-item.fetchedAt<30000);
    if(stored)return{holders:stored.data.holders||[],holdersCount:stored.data.holdersCount,holderDataAvailable:true,checkedAt:stored.data.checkedAt};
    try{return await flight('holders:'+key,limits.holders,async active=>{
      const results=await Promise.allSettled([withDeadline(()=>explorer(`/tokens/${address}`),limits.holders-1),withDeadline(()=>explorer(`/tokens/${address}/holders`),limits.holders-1)]);active();const[info,list]=results;
      const items=list.status==='fulfilled'&&Array.isArray(list.value.items)?list.value.items.map(item=>({address:item.address?.hash,balance:String(item.value)})).filter(item=>isAddress(item.address||'',{strict:false})):[];
      const result={holders:items,holdersCount:info.status==='fulfilled'&&info.value.holders_count!=null?Number(info.value.holders_count):null,holderDataAvailable:list.status==='fulfilled',checkedAt:new Date(now()).toISOString(),fetchedAt:now()};holderCache.set(key,result);if(holderCache.size>200)holderCache.delete(holderCache.keys().next().value);return result;
    });}catch{return{holders:[],holdersCount:null,holderDataAvailable:false,checkedAt:null};}
  }
  async function observe(input){const[data,holderData]=await Promise.all([details(input),holders(input)]);return{...data,...holderData,checkedAt:data.checkedAt};}
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
  return{feed,details,holders,observe,history,trades};
}
