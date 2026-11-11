import {formatEther,formatUnits,getAddress,isAddress,zeroAddress,toEventSelector,decodeEventLog} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {publicClient,artifact} from './chain.mjs';
export function createMarket(store,{client=publicClient,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}){
  let cachedFeed=null,feedPending=null,tradesCache=null;const pending=new Map();
  async function verifyChain(){if(await client.getChainId()!==NETWORK.id)throw new Error('Market data belongs to another network.');}
  async function explorer(path){const response=await fetcher(`${NETWORK.explorer}/api/v2${path}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Explorer data is temporarily unavailable.');return response.json();}
  async function feed(){
    if(cachedFeed&&now()-cachedFeed.fetchedAt<60000)return cachedFeed;if(feedPending)return feedPending;
    feedPending=(async()=>{await verifyChain();const abi=(await artifact('IPortal')).abi,event=abi.find(item=>item.type==='event'&&item.name==='TokenCreated');const latest=await client.getBlockNumber(),fromBlock=latest>60000n?latest-60000n:0n;
      const results=await Promise.allSettled([client.getLogs({address:NETWORK.portal,event,fromBlock,toBlock:latest}),indexed('TokenCreated',abi)]);
      if(results.every(item=>item.status==='rejected'))throw new Error('Launches could not be loaded. Please try again.');
      const records=results.flatMap(item=>item.status==='fulfilled'?item.value:[]).filter(log=>!log.removed&&log.args?.token).sort((a,b)=>Number(b.args.ts)-Number(a.args.ts));const unique=new Map();for(const log of records)if(!unique.has(log.args.token.toLowerCase()))unique.set(log.args.token.toLowerCase(),log);
      const items=[...unique.values()].slice(0,60).map(log=>({id:log.args.token,tokenAddress:log.args.token,name:log.args.name,symbol:log.args.symbol,creator:log.args.creator,createdAt:new Date(Number(log.args.ts)*1000).toISOString(),transactionHash:log.transactionHash,source:'Flap Portal'}));cachedFeed={items,fetchedAt:now(),checkedAt:new Date(now()).toISOString(),fromBlock:String(fromBlock),toBlock:String(latest),scope:'Recent onchain launches'};return cachedFeed;})().finally(()=>{feedPending=null;});return feedPending;
  }
  async function indexed(eventName,abi){const event=abi.find(item=>item.type==='event'&&item.name===eventName);const page=await explorer(`/addresses/${NETWORK.portal}/logs?topic=${toEventSelector(event)}`);return page.items.filter(item=>item.address?.hash?.toLowerCase()===NETWORK.portal.toLowerCase()).flatMap(item=>{try{return [{args:decodeEventLog({abi:[event],data:item.data,topics:item.topics.filter(Boolean)}).args,transactionHash:item.transaction_hash,blockNumber:item.block_number,logIndex:item.index}];}catch{return [];}});}
  async function trades(address){
    if(!tradesCache||now()-tradesCache.at>60000){const abi=(await artifact('IPortal')).abi;const results=await Promise.allSettled(['TokenBought','TokenSold'].map(name=>indexed(name,abi).then(logs=>logs.map(log=>({...log,kind:name==='TokenBought'?'buy':'sell'})))));tradesCache={at:now(),available:results.some(item=>item.status==='fulfilled'),items:results.flatMap(item=>item.status==='fulfilled'?item.value:[])};}
    const items=tradesCache.items.filter(item=>item.args.token.toLowerCase()===address.toLowerCase()).sort((a,b)=>Number(b.args.ts)-Number(a.args.ts)||Number(b.blockNumber||0)-Number(a.blockNumber||0)||Number(b.logIndex||0)-Number(a.logIndex||0)).map(item=>({kind:item.kind,price:formatEther(item.args.postPrice),amount:formatEther(item.args.amount),value:formatEther(item.args.eth),wallet:item.args.buyer||item.args.seller,checkedAt:new Date(Number(item.args.ts)*1000).toISOString(),transactionHash:item.transactionHash}));return {items,available:tradesCache.available,scope:'Latest 50 indexed buys and 50 sells across Flap. Other DEX trades are excluded.'};
  }
  async function details(input){
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const address=getAddress(input.toLowerCase()),key=address.toLowerCase();const recent=store.read('market').find(item=>item.address===key);if(recent&&now()-recent.fetchedAt<30000)return recent.data;if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      await verifyChain();const abi=(await artifact('IPortal')).abi;const state=await client.readContract({address:NETWORK.portal,abi,functionName:'getTokenV8Safe',args:[address]});
      if(![1,4].includes(state.status)||state.quoteTokenAddress.toLowerCase()!==zeroAddress)throw new Error('This address is not a supported Flap token on Robinhood Testnet.');
      const [info,holderResult]=await Promise.allSettled([explorer(`/tokens/${address}`),explorer(`/tokens/${address}/holders`)]);const token=info.status==='fulfilled'?info.value:null;const holders=holderResult.status==='fulfilled'&&Array.isArray(holderResult.value.items)?holderResult.value.items.map(item=>({address:item.address?.hash,balance:String(item.value)})).filter(item=>item.address):[];
      const checkedAt=new Date(now()).toISOString(),price=Number(formatEther(state.price));
      const data={address,name:token?.name||null,symbol:token?.symbol||null,chainId:NETWORK.id,checkedAt,currency:'test ETH',price:state.price>0n?String(price):null,reserve:formatEther(state.reserve),progress:Math.min(100,Number(state.progress)*100/1e18),graduated:state.status===4,pool:state.pool===zeroAddress?null:state.pool,buyTaxBps:Number(state.buyTaxRate),sellTaxBps:Number(state.sellTaxRate),holdersCount:token?.holders_count==null?null:Number(token.holders_count),totalSupply:token?.total_supply?String(token.total_supply):null,decimals:Number(token?.decimals??18),holders,holderDataAvailable:holderResult.status==='fulfilled',marketCap:token?.total_supply&&state.price>0n?String(Number(formatUnits(BigInt(token.total_supply),Number(token.decimals??18)))*price):null,volume:null,source:'Flap Portal + Robinhood Blockscout'};
      await store.change('market',records=>{const index=records.findIndex(item=>item.address===key);const next={address:key,fetchedAt:now(),data};if(index<0)records.push(next);else records[index]=next;if(records.length>200)records.splice(0,records.length-200);});
      await store.change('observations',records=>{const latest=records.filter(item=>item.address===key).at(-1);if(!latest||now()-Date.parse(latest.checkedAt)>=60000)records.push({address:key,checkedAt,price:data.price,reserve:data.reserve,holdersCount:data.holdersCount,progress:data.progress});const cutoff=now()-7*86400000;for(let i=records.length-1;i>=0;i--)if(Date.parse(records[i].checkedAt)<cutoff)records.splice(i,1);if(records.length>50000)records.splice(0,records.length-50000);});return data;
    })().finally(()=>pending.delete(key));pending.set(key,work);return work;
  }
  function history(address){return store.read('observations').filter(item=>item.address===address.toLowerCase()).slice(-500);}
  return {feed,details,history,trades};
}
