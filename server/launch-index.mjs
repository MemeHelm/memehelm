import {getAddress,isAddress,zeroAddress} from 'viem';
import {PONS,factoryAbi} from '../shared/pons.mjs';
import {withDeadline} from './deadline.mjs';

export const LAUNCH_INDEX_IDENTITY=Object.freeze({
  id:`pons-token-launched:4663:${PONS.factory.address.toLowerCase()}:${PONS.factory.codeHash.toLowerCase()}:1`,
  chainId:4663,factory:PONS.factory.address.toLowerCase(),factoryCodeHash:PONS.factory.codeHash.toLowerCase(),schemaVersion:1,
});
const event=factoryAbi.find(item=>item.type==='event'&&item.name==='TokenLaunched');
const hash=value=>typeof value==='string'&&/^0x[\da-f]{64}$/i.test(value)?value.toLowerCase():null;
const uint256max=(1n<<256n)-1n;
const flights=new WeakMap();
const indexError=Symbol('launch index error');
const fail=(message,code='INDEX_INVALID_DATA')=>Object.assign(new Error(message),{code,[indexError]:true});
const safeError=error=>error?.[indexError]?error.message:'Official launch data could not be verified. Coverage stops at the last verified range.';
function integer(value,label){
  if(!(typeof value==='bigint'||typeof value==='number'&&Number.isSafeInteger(value))||value<0||value>Number.MAX_SAFE_INTEGER)throw fail(`${label} could not be verified.`);
  return Number(value);
}
function uint(value){
  if(!(typeof value==='bigint'||typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value))||String(value).length>78)throw fail('A launch event amount could not be verified.');
  const result=BigInt(value);if(result<0n||result>uint256max)throw fail('A launch event amount could not be verified.');return String(result);
}
function address(value,allowZero=false){
  if(typeof value!=='string'||!isAddress(value,{strict:false})||!allowZero&&value.toLowerCase()===zeroAddress)throw fail('A launch event address could not be verified.');
  return getAddress(value.toLowerCase());
}
function normalizeLog(log,fromBlock,toBlock){
  if(!log||log.eventName!=='TokenLaunched'||log.removed===true||typeof log.address!=='string'||log.address.toLowerCase()!==LAUNCH_INDEX_IDENTITY.factory)throw fail('A launch event came from an unverified source.');
  const blockNumber=integer(log.blockNumber,'The launch event block'),logIndex=integer(log.logIndex,'The launch event position');
  const blockHash=hash(log.blockHash),transactionHash=hash(log.transactionHash);
  if(!blockHash||!transactionHash||blockNumber<fromBlock||blockNumber>toBlock)throw fail('A launch event block or transaction could not be verified.');
  const args=log.args||{};
  return{blockNumber,blockHash,transactionHash,logIndex,args:{token:address(args.token),curve:address(args.curve),deployer:address(args.deployer),pairToken:address(args.pairToken,true),launchConfigId:uint(args.launchConfigId),graduationThreshold:uint(args.graduationThreshold)}};
}
function bounded(value,fallback,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max?value:fallback;}

export function createLaunchIndex(store,{
  client,now=()=>Date.now(),batchSize=5000,maxRanges=4,maxRequests=48,
  requestTimeoutMs=2500,syncTimeoutMs=8000,bootstrapBlocks=20000n,
  maxReorgChecks=8,previewLimit=200,staleAfterMs=60000,maxLogsPerRange=10000,
}={}){
  const repository=store?.launchIndex;
  const identity=LAUNCH_INDEX_IDENTITY;
  const batch=bounded(batchSize,5000,1,5000),rangesPerSync=bounded(maxRanges,4,1,16);
  const requestLimit=bounded(maxRequests,48,8,200),reorgLimit=bounded(maxReorgChecks,8,1,32);
  const preview=bounded(previewLimit,200,1,1000),logLimit=bounded(maxLogsPerRange,10000,1,20000);
  const totalTimeout=bounded(syncTimeoutMs,8000,10,8000),requestTimeout=Math.min(totalTimeout,bounded(requestTimeoutMs,2500,1,8000));
  const bootstrap=typeof bootstrapBlocks==='bigint'&&bootstrapBlocks>0n&&bootstrapBlocks<=20000n?Number(bootstrapBlocks):20000;
  const iso=()=>new Date(now()).toISOString();
  const startFor=head=>Math.max(0,head-bootstrap+1);

  function snapshot({error:transientError=null}={}){
    const state=repository?.state(identity)||null;
    const rows=state&&!state.invalidated?repository.events(identity,{limit:preview}):[];
    const logs=rows.map(row=>({...row,address:PONS.factory.address,eventName:'TokenLaunched',removed:false,blockNumber:BigInt(row.blockNumber),args:{...row.args,launchConfigId:BigInt(row.args.launchConfigId),graduationThreshold:BigInt(row.args.graduationThreshold)}}));
    const count=state&&!state.invalidated?repository.count(identity):0,hasCoverage=!!state&&!state.invalidated&&state.nextBlock>state.bootstrapFrom;
    const error=transientError||state?.error||(!repository?'Persistent launch storage is unavailable.':null);
    const stale=!!error||!state?.verifiedAt||now()-Date.parse(state.verifiedAt)>staleAfterMs;
    const nextBlock=state?(state.invalidated?state.bootstrapFrom:state.nextBlock):null;
    const pending=!!state&&nextBlock<=state.targetBlock;
    const status=!state?'unavailable':state.invalidated?'rebuilding':error?'stale':!hasCoverage?'empty':pending?(state.reorg?.kind==='reset'?'rebuilding':'syncing'):stale?'stale':'current';
    return{logs,checkedAt:state?.verifiedAt||null,stale,error,coverage:{
      chainId:4663,factory:PONS.factory.address,factoryCodeHash:PONS.factory.codeHash,schemaVersion:1,allTime:false,finality:'observed',
      status,bootstrapFromBlock:state?String(state.bootstrapFrom):null,
      fromBlock:hasCoverage?String(state.bootstrapFrom):null,toBlock:hasCoverage?String(state.nextBlock-1):null,
      nextBlock:state?String(nextBlock):null,targetBlock:state?String(state.targetBlock):null,invalidated:!!state?.invalidated,
      partial:!hasCoverage||pending||stale,count,previewLimit:preview,
      missingRanges:pending?[{fromBlock:String(nextBlock),toBlock:String(state.targetBlock)}]:[],
      verifiedAt:state?.verifiedAt||null,lastSuccessAt:state?.lastSuccessAt||null,
      lastAttemptAt:state?.lastAttemptAt||null,reorg:state?.reorg||null,
      scope:`Official pons v2 factory events from the first observed recent ${bootstrap.toLocaleString('en-US')}-block window onward. Earlier history is outside coverage. Observed chain data, not finalized.`,
    }};
  }

  async function run(check){
    if(!repository)throw fail('Persistent launch storage is unavailable.','INDEX_UNAVAILABLE');
    if(!client||typeof client.getChainId!=='function'||typeof client.getBlockNumber!=='function'||typeof client.getBlock!=='function'||typeof client.getLogs!=='function')throw fail('The RPC cannot verify persistent launch coverage.','INDEX_UNAVAILABLE');
    let requests=0;
    async function call(work){
      check();if(requests>=requestLimit)throw fail('Launch indexing reached its request limit. Retry the next range.','INDEX_BUDGET');requests++;
      const result=await withDeadline(work,requestTimeout,'The launch source did not respond before its deadline.');check();return result;
    }
    async function header(number){
      const block=await call(()=>client.getBlock({blockNumber:BigInt(number)}));
      if(!block||integer(block.number,'The returned block')!==number||!hash(block.hash)||block.parentHash!=null&&!hash(block.parentHash))throw fail('A canonical block header could not be verified.');
      if(typeof block.timestamp!=='bigint'||block.timestamp<0n||block.timestamp>8640000000000n)throw fail('A launch block timestamp could not be verified.');
      return{number,hash:hash(block.hash),createdAt:new Date(Number(block.timestamp)*1000).toISOString()};
    }
    const chain=await call(()=>client.getChainId());if(chain!==4663)throw fail('The launch source is not Robinhood Chain 4663.','INDEX_WRONG_CHAIN');
    const head=integer(await call(()=>client.getBlockNumber()),'The current chain height');
    check();let state=repository.initialize(identity,{fromBlock:startFor(head),targetBlock:head,at:iso()});
    let checkpoints=repository.ranges(identity,{limit:Math.min(reorgLimit,requestLimit-2)});
    if(checkpoints.length){
      let matched=null,mismatched=false;
      for(const checkpoint of checkpoints){
        if(checkpoint.toBlock>head){if(!mismatched){check();repository.invalidate(identity,{at:iso()});}mismatched=true;continue;}
        const current=await header(checkpoint.toBlock);
        if(current.hash===checkpoint.endHash){matched=checkpoint;break;}
        if(!mismatched){check();repository.invalidate(identity,{at:iso()});}
        mismatched=true;
      }
      if(mismatched){
        check();if(matched)repository.rollback(identity,{nextBlock:matched.toBlock+1,at:iso()});
        else repository.reset(identity,{fromBlock:startFor(head),targetBlock:head,at:iso()});
        state=repository.state(identity);checkpoints=repository.ranges(identity,{limit:1});
      }
    }
    check();repository.verified(identity,{targetBlock:head,at:iso()});
    let previous=checkpoints[0]||null;
    for(let completed=0;completed<rangesPerSync;completed++){
      check();state=repository.state(identity);
      if(state.nextBlock>head||requestLimit-requests<(previous?5:4))break;
      const fromBlock=state.nextBlock,requestedEnd=Math.min(fromBlock+batch-1,head);
      let end=requestedEnd,endHeader=await header(end);
      const response=await call(()=>client.getLogs({address:PONS.factory.address,event,fromBlock:BigInt(fromBlock),toBlock:BigInt(requestedEnd)}));
      if(!Array.isArray(response)||response.length>logLimit)throw fail('The launch event range exceeded its verified response limit.','INDEX_RANGE_LIMIT');
      let events=response.map(log=>normalizeLog(log,fromBlock,requestedEnd)).sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
      const unique=new Map(),positions=new Map(),transactions=new Map();
      for(const log of events){
        const key=log.transactionHash+':'+log.logIndex,old=unique.get(key);
        if(old&&JSON.stringify(old)!==JSON.stringify(log))throw fail('Conflicting launch events were returned for one transaction log.');
        const position=log.blockNumber+':'+log.logIndex,previousTransaction=positions.get(position),previousBlock=transactions.get(log.transactionHash);
        if(previousTransaction&&previousTransaction!==log.transactionHash||previousBlock&&previousBlock!==log.blockHash)throw fail('Conflicting launch event positions were returned for a block or transaction.');
        positions.set(position,log.transactionHash);transactions.set(log.transactionHash,log.blockHash);
        unique.set(key,log);
      }
      events=[...unique.values()];
      const blocks=[...new Set(events.map(log=>log.blockNumber))];
      // Reserve the final endpoint and previous-checkpoint rechecks. A dense
      // range is shortened, never silently sampled while advancing past logs.
      const capacity=requestLimit-requests-1-(previous?1:0);
      if(blocks.length>capacity){
        if(capacity<1)break;
        end=blocks[capacity-1];events=events.filter(log=>log.blockNumber<=end);
        endHeader=null;
      }
      const headers=new Map();if(endHeader)headers.set(end,endHeader);
      for(const number of new Set(events.map(log=>log.blockNumber)))if(!headers.has(number))headers.set(number,await header(number));
      if(!headers.has(end))headers.set(end,await header(end));
      endHeader=headers.get(end);
      for(const log of events){
        const block=headers.get(log.blockNumber);if(block.hash!==log.blockHash){check();repository.invalidate(identity,{at:iso()});throw fail('A launch event no longer matches its canonical block.','INDEX_CHAIN_CHANGED');}
        log.createdAt=block.createdAt;
      }
      if(previous&&(await header(previous.toBlock)).hash!==previous.endHash){check();repository.invalidate(identity,{at:iso()});throw fail('The previous launch checkpoint changed during this read.','INDEX_CHAIN_CHANGED');}
      if((await header(end)).hash!==endHeader.hash){check();repository.invalidate(identity,{at:iso()});throw fail('The chain changed while a launch range was being read.','INDEX_CHAIN_CHANGED');}
      check();repository.commitRange(identity,{fromBlock,toBlock:end,endHash:endHeader.hash,events,at:iso(),targetBlock:head});
      previous={fromBlock,toBlock:end,endHash:endHeader.hash};
    }
    check();return snapshot();
  }

  async function sync({assertActive=()=>{}}={}){
    if(repository&&flights.has(repository)){const result=await flights.get(repository);assertActive();return snapshot({error:result.error});}
    let active=true;
    const check=()=>{if(!active)throw fail('The launch read expired. Coverage stops at the last verified range.','INDEX_TIMEOUT');assertActive();};
    const work=(async()=>{
      try{return await withDeadline(()=>run(check),totalTimeout,'Launch indexing reached its time limit. Coverage stops at the last verified range.');}
      catch(error){
        active=false;assertActive();const message=safeError(error);
        if(repository&&repository.state(identity))repository.failure(identity,{at:iso(),error:message});
        return snapshot({error:message});
      }finally{active=false;}
    })();
    if(repository)flights.set(repository,work);
    try{return await work;}finally{if(repository&&flights.get(repository)===work)flights.delete(repository);}
  }
  return{sync,snapshot};
}
