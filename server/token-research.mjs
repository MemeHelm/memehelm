import {erc20Abi,getAddress,isAddress} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {PONS,factoryAbi} from '../shared/pons.mjs';
import {publicClient} from './chain.mjs';
import {withDeadline} from './deadline.mjs';

const source='Pons v2 / Robinhood mainnet';
const launchEvent=factoryAbi.find(item=>item.type==='event'&&item.name==='TokenLaunched');
const hash=value=>/^0x[a-fA-F0-9]{64}$/.test(value||'')?value:null;
const address=value=>isAddress(value||'',{strict:false})?getAddress(value.toLowerCase()):null;
const iso=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const blockTime=value=>{try{return new Date(Number(value)*1000).toISOString();}catch{return null;}};
const coverage=page=>({fromBlock:page?.fromBlock??null,toBlock:page?.toBlock??null,partial:!!page?.partial,scope:page?.scope||'Coverage unavailable.'});
const unavailable=message=>({status:'unavailable',count:null,items:[],coverage:null,message});

/** Read-only, bounded evidence. Missing sources never become zero activity or a safety verdict. */
export function createTokenResearch({market,client=publicClient,now=()=>Date.now(),ttlMs=30000,deadlines={}}={}){
  if(!market?.forensics||!market?.trades)throw new TypeError('Token research requires a market reader.');
  const limits={forensics:12000,trades:10000,history:5000,metadata:1000,total:18500,...deadlines};
  const cache=new Map(),pending=new Map();
  async function launchHistory(deployer,currentToken,checkedAt){
    let active=true;
    try{return await withDeadline(async()=>{
      const latest=BigInt(await client.getBlockNumber()),from=latest>=19999n?latest-19999n:0n;
      if(!active)throw new Error('This source request expired.');
      const pages=[];
      for(let start=from;start<=latest;start+=5000n){
        const end=start+4999n<latest?start+4999n:latest;
        pages.push(withDeadline(()=>client.getLogs({address:PONS.factory.address,event:launchEvent,args:{deployer},fromBlock:start,toBlock:end}),limits.history));
      }
      const settled=await Promise.allSettled(pages);
      if(!active)throw new Error('This source request expired.');
      if(settled.every(result=>result.status==='rejected'))return unavailable('The launching wallet’s recent factory events could not be read.');
      let invalid=false;
      const unique=new Map();
      for(const page of settled){
        if(page.status!=='fulfilled')continue;
        for(const log of page.value){
          if(log.removed)continue;
          // The RPC query is factory-scoped; reject an inconsistent emitter if a response provides it.
          if(log.address!=null&&address(log.address)?.toLowerCase()!==PONS.factory.address.toLowerCase()){invalid=true;continue;}
          const token=address(log.args?.token),sender=address(log.args?.deployer),tx=hash(log.transactionHash);
          if(!token||!sender||sender.toLowerCase()!==deployer.toLowerCase()||!tx||typeof log.blockNumber!=='bigint'||log.blockNumber<from||log.blockNumber>latest){invalid=true;continue;}
          if(!unique.has(token.toLowerCase()))unique.set(token.toLowerCase(),{token,deployer:sender,transactionHash:tx,blockNumber:String(log.blockNumber),logIndex:Number(log.logIndex??0)});
        }
      }
      const events=[...unique.values()].sort((a,b)=>Number(BigInt(b.blockNumber)-BigInt(a.blockNumber))||b.logIndex-a.logIndex);
      const items=await Promise.all(events.slice(0,12).map(async item=>{
        const results=await Promise.allSettled([
          withDeadline(()=>client.readContract({address:item.token,abi:erc20Abi,functionName:'name'}),limits.metadata),
          withDeadline(()=>client.readContract({address:item.token,abi:erc20Abi,functionName:'symbol'}),limits.metadata),
          withDeadline(()=>client.getBlock({blockNumber:BigInt(item.blockNumber)}),limits.metadata),
        ]);
        const [name,symbol,block]=results;
        const timestamp=block.status==='fulfilled'&&block.value?.timestamp!=null?blockTime(block.value.timestamp):null;
        return{...item,name:name.status==='fulfilled'&&typeof name.value==='string'?name.value.slice(0,160):null,symbol:symbol.status==='fulfilled'&&typeof symbol.value==='string'?symbol.value.slice(0,40):null,timestamp,checkedAt,current:item.token.toLowerCase()===currentToken.toLowerCase(),evidenceId:'launch:'+item.transactionHash+':'+item.logIndex};
      }));
      const partial=settled.some(result=>result.status==='rejected')||invalid;
      return{status:'available',count:events.length,items,truncated:events.length>items.length,coverage:{fromBlock:String(from),toBlock:String(latest),partial,scope:'Official pons v2 TokenLaunched events for this launching wallet, within the latest 20,000 blocks. Up to 12 receipts shown; other factories and older launches are outside this search.'},message:partial?'Some factory event ranges could not be read. The count is a lower bound.':null};
    },limits.history,'The launching wallet’s recent factory events took too long to load.');}finally{active=false;}
  }
  async function collect(token){
    const checkedAt=new Date(now()).toISOString();
    const [forensicsResult,tradesResult]=await Promise.allSettled([
      withDeadline(()=>market.forensics(token),limits.forensics),
      withDeadline(()=>market.trades(token),limits.trades),
    ]);
    const forensic=forensicsResult.status==='fulfilled'?forensicsResult.value:null;
    const registered=typeof forensic?.registration?.registered==='boolean'?forensic.registration.registered:null;
    const deployer=registered===true?address(forensic.registration.deployer):null;
    const registryStatus=registered===null?'unavailable':registered?'available':'outside-scope';
    let history=unavailable('The launching wallet could not be established from the official registry.');
    if(registered===false)history={...unavailable('This token is not in the tracked pons v2 registry. Its creator’s launches are outside this search.'),status:'outside-scope'};
    if(deployer){try{history=await launchHistory(deployer,token,checkedAt);}catch{history=unavailable('The launching wallet’s recent factory events could not be loaded. Retry to check again.');}}
    const trade=tradesResult.status==='fulfilled'&&tradesResult.value?.available===true?tradesResult.value:null;
    let creatorTrading={...unavailable(deployer?'Recent execution events could not be read.':'A launching wallet is required to attribute direct curve events.'),buys:null,sells:null};
    if(deployer&&trade){
      const direct=(trade.items||[]).filter(item=>item.poolTrade===false&&address(item.wallet)?.toLowerCase()===deployer.toLowerCase()&&['buy','sell'].includes(item.kind)&&hash(item.transactionHash));
      const items=direct.map((item,index)=>({kind:item.kind,amount:String(item.amount),value:String(item.value),currency:typeof item.currency==='string'?item.currency:trade.currency??null,transactionHash:item.transactionHash,timestamp:iso(item.checkedAt),checkedAt,attribution:'curve-wallet',evidenceId:'trade:'+item.transactionHash+':'+index}));
      creatorTrading={status:'available',count:items.length,buys:items.filter(item=>item.kind==='buy').length,sells:items.filter(item=>item.kind==='sell').length,items,coverage:coverage(trade),poolEventsNotAttributed:(trade.items||[]).filter(item=>item.poolTrade).length,message:'Only curve buyer/seller addresses matching the launching wallet are attributed. Pool senders can be routers and are excluded. This is the latest 60 returned trades within the stated blocks, not lifetime trading or net profit.'};
    }else if(registered===false)creatorTrading={...creatorTrading,status:'outside-scope',message:'This token has no launching wallet in the tracked pons v2 registry.'};
    const evidence=[];
    if(registered!==null)evidence.push({id:'registry',kind:'registry',label:registered?'Official launch record found':'No launch record in the tracked factory',source:'Pons v2 factory getLaunchedToken',timestamp:iso(forensic.checkedAt),checkedAt,coverage:{scope:'Current registry state for this token.'},transactionHash:null,url:NETWORK.explorer+'/address/'+PONS.factory.address});
    for(const item of history.items)evidence.push({id:item.evidenceId,kind:'launch',label:'Launch receipt for '+(item.symbol||item.name||item.token),source:'Official pons v2 factory / TokenLaunched',timestamp:item.timestamp,checkedAt,coverage:history.coverage,transactionHash:item.transactionHash,url:NETWORK.explorer+'/tx/'+item.transactionHash});
    for(const item of creatorTrading.items)evidence.push({id:item.evidenceId,kind:'trade',label:'Launching wallet curve '+item.kind,source:'Pons v2 curve / '+(item.kind==='buy'?'CurveBuy':'CurveSell'),timestamp:item.timestamp,checkedAt,coverage:creatorTrading.coverage,transactionHash:item.transactionHash,url:NETWORK.explorer+'/tx/'+item.transactionHash});
    return{address:token,chainId:NETWORK.id,source,checkedAt,registration:{status:registryStatus,registered,deployer},launchHistory:history,creatorTrading,fundingRelationships:{status:'unknown',message:'Funding sources and related-wallet clusters have not been established. A shared sender or matching balance alone would not establish common ownership.'},evidence,limitations:['Recent factory coverage is not the creator’s complete launch history.','Trades routed through other wallets cannot be attributed to the launching wallet.','These observations do not establish common wallet ownership, a safety rating or an independent audit.']};
  }
  async function research(input,{refresh=false}={}){
    if(!isAddress(input||'',{strict:false})){const error=new Error('Enter a valid token address.');error.statusCode=400;throw error;}
    const token=getAddress(input.toLowerCase()),key=token.toLowerCase(),cached=cache.get(key);
    if(pending.has(key))return pending.get(key);
    if(!refresh&&cached&&now()-cached.fetchedAt<ttlMs)return cached.result;
    const work=withDeadline(()=>collect(token),limits.total,'Token research is temporarily unavailable. Please try again.').then(result=>{
      const healthy=result.registration.status!=='unavailable'&&result.launchHistory.status!=='unavailable'&&result.creatorTrading.status!=='unavailable';
      if(healthy){cache.set(key,{fetchedAt:now(),result});if(cache.size>200)cache.delete(cache.keys().next().value);}
      return result;
    }).finally(()=>{if(pending.get(key)===work)pending.delete(key);});
    pending.set(key,work);return work;
  }
  return{research};
}
