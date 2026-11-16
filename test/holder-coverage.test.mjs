import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarket} from '../server/market.mjs';
import {NETWORK} from '../shared/config.mjs';

const token='0x1111111111111111111111111111111111111111';
const alice='0x2222222222222222222222222222222222222222',bob='0x3333333333333333333333333333333333333333';
const date='2026-11-16T00:00:00.000Z',instant=Date.parse(date);
const source='Robinhood Blockscout token holders';
const row=(address,value)=>({address:{hash:address},value});

// Every external read is injected; these holder tests need neither disk state nor a live RPC.
function fixture({info={holders_count:'21'},list={items:[row(alice,'100')],next_page_params:null},records=[],readResponse,deadlines}={}){
 let clock=instant,currentInfo=info,currentList=list;
 const state={market:structuredClone(records)},calls=[];
 const store={read:name=>state[name]??[],change:async(name,work)=>work(state[name]??=[])};
 const fetcher=async(input,options)=>{
  const url=new URL(String(input)),base=new URL(NETWORK.explorer);
  assert.equal(url.origin,base.origin);assert.ok(options.signal);
  assert.ok([`/api/v2/tokens/${token}`,`/api/v2/tokens/${token}/holders`].includes(url.pathname),'Only the two injected explorer reads are permitted.');
  calls.push(url.pathname);
  if(readResponse)return readResponse(url.pathname.endsWith('/holders')?'holders':'info');
  return Response.json(url.pathname.endsWith('/holders')?currentList:currentInfo);
 };
 const market=createMarket(store,{client:{},protocol:{},fetcher,now:()=>clock,...(deadlines?{deadlines}:{})});
 return{market,calls,advance:milliseconds=>clock+=milliseconds,setResponses:(nextInfo,nextList)=>{currentInfo=nextInfo;currentList=nextList;}};
}

function observed(result,{paginationComplete,coverage,sampled,returned,duplicateRows=0}){
 assert.equal(result.source,source);assert.equal(result.balanceUnit,'token-base-units');
 assert.equal(result.snapshotBlock,null);assert.equal(result.snapshotBlockHash,null);
 assert.equal(result.paginationComplete,paginationComplete);assert.equal(result.coverage,coverage);
 assert.equal(result.sampled,sampled);assert.equal(result.returned,returned);assert.equal(result.duplicateRows,duplicateRows);
 assert.equal(result.holderDataAvailable,true);assert.equal(result.checkedAt,date);
 assert.notEqual(result.coverage,'complete');
}

function unavailable(result){
 assert.equal(result.holderDataAvailable,false);assert.deepEqual(result.holders,[]);
 assert.equal(result.checkedAt,null);assert.equal(result.coverage,'unknown');
 assert.equal(result.paginationComplete,null);assert.equal(result.snapshotBlock,null);assert.equal(result.snapshotBlockHash,null);
}

test('holder pages disclose pagination without claiming a fixed-block or complete snapshot',async()=>{
 for(const [next,paginationComplete]of [[{items_count:50},false],[null,true]]){
  const f=fixture({list:{items:[row(alice,'100')],next_page_params:next,block_number:123,block_hash:'0x'+'a'.repeat(64)}});
  const result=await f.market.holders(token);
  observed(result,{paginationComplete,coverage:'partial',sampled:1,returned:1});
  assert.equal(result.holdersCount,21);assert.deepEqual(result.holders,[{address:alice,balance:'100'}]);assert.equal(f.calls.length,2);
 }
});

test('missing or invalid pagination metadata remains unknown rather than implying end of history',async()=>{
 for(const metadata of [{},{next_page_params:undefined},{next_page_params:false},{next_page_params:0},{next_page_params:''},{next_page_params:[]},{next_page_params:{}}]){
  const f=fixture({list:{items:[row(alice,'100')],...metadata}}),result=await f.market.holders(token);
  observed(result,{paginationComplete:null,coverage:'unknown',sampled:1,returned:1});
 }
});

test('base-unit balances retain uint256 precision, discard zero and deduplicate identical addresses without summing',async()=>{
 const max=((1n<<256n)-1n).toString(),f=fixture({list:{items:[row(alice,max),row(alice,max),row(bob,'0')],next_page_params:null}});
 const result=await f.market.holders(token);
 observed(result,{paginationComplete:true,coverage:'partial',sampled:1,returned:3,duplicateRows:1});
 assert.deepEqual(result.holders,[{address:alice,balance:max}]);
});

test('invalid or missing balances reject the whole holder page instead of fabricating zero or a smaller sample',async()=>{
 const invalid=[undefined,null,'',' ','-1','1.5','1e3','NaN',false,0,100,{},[],(1n<<256n).toString()];
 for(const value of invalid){
  const f=fixture({list:{items:[row(alice,'100'),row(bob,value)],next_page_params:null}});
  unavailable(await f.market.holders(token));
 }
 for(const entry of [null,{},row('not-an-address','100')]){
  const f=fixture({list:{items:[row(alice,'100'),entry],next_page_params:null}});
  unavailable(await f.market.holders(token));
 }
});

test('conflicting duplicate balances reject the page instead of summing or choosing one result',async()=>{
 const f=fixture({list:{items:[row(alice,'100'),row(alice,'200')],next_page_params:null}});
 unavailable(await f.market.holders(token));
});

test('absent and malformed holder counts stay unknown while a valid zero is kept as observed',async()=>{
 for(const info of [{},{holders_count:null},{holders_count:''},{holders_count:false},{holders_count:'-1'},{holders_count:'1.5'},{holders_count:'not-a-count'},{holders_count:{}},{holders_count:'9007199254740992'}]){
  const result=await fixture({info,list:{items:[],next_page_params:null}}).market.holders(token);
  observed(result,{paginationComplete:true,coverage:'partial',sampled:0,returned:0});assert.equal(result.holdersCount,null);
 }
 const zero=await fixture({info:{holders_count:'0'},list:{items:[],next_page_params:null}}).market.holders(token);
 assert.equal(zero.holdersCount,0);assert.equal(zero.sampled,0);assert.equal(zero.coverage,'partial');
});

test('successful holder cache preserves provenance, pagination and its original observation time',async()=>{
 const f=fixture({list:{items:[row(alice,'100')],next_page_params:{items_count:1}}});
 const first=await f.market.holders(token);observed(first,{paginationComplete:false,coverage:'partial',sampled:1,returned:1});
 f.advance(1000);f.setResponses({holders_count:'999'},{items:[],next_page_params:null});
 const cached=await f.market.holders(token);assert.deepEqual(cached,first);assert.equal(f.calls.length,2);
 f.advance(30001);f.setResponses({}, {items:[row(bob,'200')]});
 const fresh=await f.market.holders(token);assert.equal(f.calls.length,4);assert.equal(fresh.coverage,'unknown');assert.equal(fresh.paginationComplete,null);assert.equal(fresh.source,source);assert.equal(fresh.checkedAt,new Date(instant+31001).toISOString());assert.equal(fresh.holdersCount,null);
});

test('stored compatible observations retain metadata and legacy holder caches stay explicitly unknown',async()=>{
 const base={coreVersion:2,source:'Pons v2 / Robinhood mainnet',holderDataAvailable:true,holders:[{address:alice,balance:'100'}],holdersCount:1,checkedAt:new Date(instant+1000).toISOString()};
 const metadata={holderSource:source,holdersCheckedAt:date,balanceUnit:'token-base-units',sampled:1,returned:3,duplicateRows:1,snapshotBlock:null,snapshotBlockHash:null,paginationComplete:false,coverage:'partial'};
 const fresh=fixture({records:[{address:token,fetchedAt:instant,data:{...base,...metadata}}],readResponse:()=>{throw new Error('A compatible stored holder observation should be reused.');}});
 observed(await fresh.market.holders(token),{paginationComplete:false,coverage:'partial',sampled:1,returned:3,duplicateRows:1});assert.equal(fresh.calls.length,0);
 const legacy=fixture({records:[{address:token,fetchedAt:instant,data:base}],readResponse:()=>{throw new Error('A legacy holder observation should be reused conservatively.');}});
 const result=await legacy.market.holders(token);assert.equal(result.holderDataAvailable,true);assert.equal(result.source,null);assert.equal(result.coverage,'unknown');assert.equal(result.paginationComplete,null);assert.equal(result.snapshotBlock,null);assert.equal(result.snapshotBlockHash,null);assert.equal(result.checkedAt,base.checkedAt);assert.equal(legacy.calls.length,0);
});

test('explorer failures, malformed list bodies and timeouts remain unavailable rather than an empty verified snapshot',async()=>{
 for(const readResponse of [async()=>{throw new Error('Explorer unavailable');},async()=>new Response('Unavailable',{status:503}),async()=>new Response('{not JSON',{status:200})]){
  const result=await fixture({readResponse}).market.holders(token);unavailable(result);assert.equal(result.holdersCount,null);
 }
 for(const list of [null,{}, {items:null,next_page_params:null},{items:{},next_page_params:null}])unavailable(await fixture({list}).market.holders(token));
 const timeout=fixture({readResponse:()=>new Promise(()=>{}),deadlines:{holders:20}});
 unavailable(await timeout.market.holders(token));assert.equal(timeout.calls.length,2);
});

test('bad token input never starts an explorer request',async()=>{
 const f=fixture();for(const input of ['not-a-token','https://example.test/',null,42])await assert.rejects(()=>f.market.holders(input),/valid token address/);
 assert.equal(f.calls.length,0);
});
