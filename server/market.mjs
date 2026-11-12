import {getAddress,isAddress,erc20Abi,toEventSelector,decodeEventLog} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {publicClient,artifact,verifyFactory} from './chain.mjs';
export function createMarket(store,{client=publicClient,fetcher=(...args)=>fetch(...args),now=()=>Date.now()}={}){
  let cachedFeed=null,feedPending=null;const pending=new Map();
  async function verifyChain(){if(await client.getChainId()!==NETWORK.id)throw new Error('Market data belongs to another network.');}
  async function explorer(path){const response=await fetcher(`${NETWORK.explorer}/api/v2${path}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Explorer data is temporarily unavailable.');return response.json();}
  async function feed(){
    if(cachedFeed&&now()-cachedFeed.fetchedAt<60000)return cachedFeed;if(feedPending)return feedPending;
    feedPending=(async()=>{
      const projects=await store.projects();
      const factories=[...new Set([process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS,...projects.filter(p=>p.chainId===NETWORK.id&&p.published&&p.owner&&p.launchHash).map(p=>p.launchFactory)].filter(value=>isAddress(value||'',{strict:false})).map(value=>value.toLowerCase()))];
      if(!factories.length)return {items:[],checkedAt:new Date(now()).toISOString(),scope:'Verified MemeHelm launches',fetchedAt:now()};
      await verifyChain();const event=(await artifact('MemeHelmLaunchFactory')).abi.find(item=>item.type==='event'&&item.name==='TokenCreated');
      const latest=await client.getBlockNumber(),fromBlock=latest>60000n?latest-60000n:0n;
      const results=await Promise.allSettled(factories.map(async factory=>{
        await verifyFactory(factory,client);
        const records=await Promise.allSettled([client.getLogs({address:factory,event,fromBlock,toBlock:latest}),indexed(factory,event)]);
        if(records.every(result=>result.status==='rejected'))throw new Error('Launch events unavailable.');
        return records.flatMap(result=>result.status==='fulfilled'?result.value:[]).filter(log=>!log.removed&&log.args?.token&&log.address?.toLowerCase()===factory);
      }));
      if(results.every(result=>result.status==='rejected'))throw new Error('Launches could not be loaded. Please try again.');
      const records=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>Number(b.args.ts)-Number(a.args.ts)),unique=new Map();
      for(const log of records)if(!unique.has(log.args.token.toLowerCase()))unique.set(log.args.token.toLowerCase(),log);
      const items=[...unique.values()].slice(0,60).map(log=>({id:log.args.token,tokenAddress:log.args.token,name:log.args.name,symbol:log.args.symbol,creator:log.args.creator,createdAt:new Date(Number(log.args.ts)*1000).toISOString(),transactionHash:log.transactionHash,source:'MemeHelm'}));
      cachedFeed={items,fetchedAt:now(),checkedAt:new Date(now()).toISOString(),fromBlock:String(fromBlock),toBlock:String(latest),scope:'Recent RPC events and latest explorer event page per verified MemeHelm factory',partial:results.some(result=>result.status==='rejected')};return cachedFeed;
    })().finally(()=>{feedPending=null;});return feedPending;
  }
  async function indexed(factory,event){const page=await explorer(`/addresses/${factory}/logs?topic=${toEventSelector(event)}`);return page.items.filter(item=>item.address?.hash?.toLowerCase()===factory).flatMap(item=>{try{return [{address:factory,args:decodeEventLog({abi:[event],data:item.data,topics:item.topics.filter(Boolean)}).args,transactionHash:item.transaction_hash,blockNumber:item.block_number,logIndex:item.index}];}catch{return [];}});}
  async function trades(){return {items:[],available:false,scope:'No verified trading-pool source is linked. Token transfers are not reported as trades.'};}
  async function details(input){
    if(!isAddress(input,{strict:false}))throw new Error('Enter a valid token address.');const address=getAddress(input.toLowerCase()),key=address.toLowerCase(),recent=store.read('market').find(item=>item.address===key&&item.data?.source==='Robinhood RPC + Blockscout');
    if(recent&&now()-recent.fetchedAt<30000)return recent.data;if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      await verifyChain();const code=await client.getCode({address});if(!code||code==='0x')throw new Error('No token contract was found at this address on Robinhood Testnet.');
      const [name,symbol,totalSupply,decimals]=await Promise.all(['name','symbol','totalSupply','decimals'].map(functionName=>client.readContract({address,abi:erc20Abi,functionName})));
      if(typeof name!=='string'||typeof symbol!=='string'||typeof totalSupply!=='bigint'||!Number.isInteger(Number(decimals)))throw new Error('This address could not be verified as an ERC-20 token.');
      const [info,holderResult]=await Promise.allSettled([explorer(`/tokens/${address}`),explorer(`/tokens/${address}/holders`)]),token=info.status==='fulfilled'?info.value:null;
      const holders=holderResult.status==='fulfilled'&&Array.isArray(holderResult.value.items)?holderResult.value.items.map(item=>({address:item.address?.hash,balance:String(item.value)})).filter(item=>item.address):[];
      const checkedAt=new Date(now()).toISOString(),data={address,name,symbol,chainId:NETWORK.id,checkedAt,currency:'test ETH',price:null,reserve:null,progress:null,graduated:null,pool:null,buyTaxBps:null,sellTaxBps:null,holdersCount:token?.holders_count==null?null:Number(token.holders_count),totalSupply:totalSupply.toString(),decimals:Number(decimals),holders,holderDataAvailable:holderResult.status==='fulfilled',marketCap:null,volume:null,source:'Robinhood RPC + Blockscout'};
      await store.change('market',records=>{const index=records.findIndex(item=>item.address===key),next={address:key,fetchedAt:now(),data};if(index<0)records.push(next);else records[index]=next;if(records.length>200)records.splice(0,records.length-200);});
      await store.change('observations',records=>{const latest=records.filter(item=>item.address===key).at(-1);if(!latest||now()-Date.parse(latest.checkedAt)>=60000)records.push({address:key,checkedAt,price:null,holdersCount:data.holdersCount,source:data.source});const cutoff=now()-7*86400000;for(let i=records.length-1;i>=0;i--)if(Date.parse(records[i].checkedAt)<cutoff)records.splice(i,1);if(records.length>50000)records.splice(0,records.length-50000);});return data;
    })().finally(()=>pending.delete(key));pending.set(key,work);return work;
  }
  function history(address){return store.read('observations').filter(item=>item.address===address.toLowerCase()&&item.source==='Robinhood RPC + Blockscout').slice(-500);}
  return {feed,details,history,trades};
}
