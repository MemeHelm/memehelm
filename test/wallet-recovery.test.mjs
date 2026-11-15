import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const account='0x1111111111111111111111111111111111111111',target='0x2222222222222222222222222222222222222222',other='0x3333333333333333333333333333333333333333';
const hash='0x'+'a'.repeat(64),replacementHash='0x'+'b'.repeat(64);
const request={to:target,data:'0x1234',value:'1',chainId:4663};
const intent={kind:'launch',label:'Launch a coin',payload:{name:'Recovery Coin',symbol:'RCV'}};

async function fixture(work){
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  await mkdir('qa',{recursive:true});const directory=await mkdtemp(resolve('qa','wallet-recovery-'));
  const compiled=ts.transpileModule(await readFile('src/wallet.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../shared/config.mjs'","from '../../shared/config.mjs'");
  await writeFile(resolve(directory,'wallet.mjs'),compiled);
  const data=new Map(),rpc={chain:'0x1237',accepted:0,prompts:0,receiptError:true,reject:null,latestNonce:'0x5',actualNonce:'0x5',replacement:null,receipt:null,transactions:new Map()};
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))};
  const provider={async request({method,params}){
    if(method==='eth_accounts'||method==='eth_requestAccounts')return[account];
    if(method==='eth_chainId')return rpc.chain;
    if(method==='wallet_switchEthereumChain'){rpc.chain=params[0].chainId;return null;}
    if(method==='eth_estimateGas')return'0x5208';
    if(method==='eth_getTransactionCount')return params[1]==='pending'?'0x5':rpc.latestNonce;
    if(method==='eth_blockNumber')return'0x20';
    if(method==='eth_sendTransaction'){rpc.prompts++;if(rpc.reject)throw rpc.reject;rpc.accepted++;rpc.transactions.set(hash,{hash,from:account,to:params[0].to,input:params[0].data,value:params[0].value,nonce:rpc.actualNonce});return hash;}
    if(method==='eth_getTransactionReceipt'){if(rpc.receiptError)throw new Error('Receipt RPC disconnected');return params[0]===replacementHash?{status:'0x1',transactionHash:replacementHash,blockNumber:'0x20'}:rpc.receipt;}
    if(method==='eth_getTransactionByHash')return rpc.transactions.get(params[0])??null;
    if(method==='eth_getBlockByNumber')return{transactions:rpc.replacement?[rpc.replacement]:[]};
    throw new Error('Unexpected wallet request: '+method);
  }};
  globalThis.window={ethereum:provider,localStorage:storage,dispatchEvent(){}};
  globalThis.fetch=async()=>{throw new Error('Unexpected network request in wallet test');};
  let imports=0;const load=()=>import(pathToFileURL(resolve(directory,'wallet.mjs')).href+'?instance='+imports++);
  try{await work({wallet:await load(),load,rpc,storage,data});}
  finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;globalThis.fetch=previousFetch;if(!resolve(directory).startsWith(resolve('qa')+sep))throw new Error('Unsafe test cleanup.');await rm(directory,{recursive:true,force:true});}
}

test('broadcast interruption persists the hash, blocks duplicate sends and resumes after a module reload',()=>fixture(async({wallet,load,rpc})=>{
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),error=>error instanceof wallet.SubmittedTransactionError&&error.transaction.hash===hash);
  let record=wallet.pendingTransactions(account)[0];assert.equal(record.status,'submitted');assert.equal(record.hash,hash);assert.deepEqual(record.intent,intent);assert.equal(rpc.accepted,1);
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);assert.equal(rpc.accepted,1);assert.equal(rpc.prompts,1);
  const reloaded=await load();assert.equal(reloaded.pendingTransactions(account)[0].hash,hash);
  rpc.receiptError=false;rpc.receipt={status:'0x1',transactionHash:hash,blockNumber:'0x20'};
  record=await reloaded.resumeTransaction(account,record.id);assert.equal(record.status,'confirmed');assert.equal(record.receipt.transactionHash,hash);assert.equal(rpc.accepted,1);
  const receipt=await reloaded.sendTransaction(account,request,intent);assert.equal(receipt.recoveryId,record.id);assert.equal(rpc.accepted,1);
  reloaded.completeTransaction(account,record.id);assert.deepEqual(reloaded.pendingTransactions(account),[]);
  await reloaded.sendTransaction(account,request,intent);assert.equal(rpc.accepted,2);
}));

test('concurrent attempts for the same reviewed action cannot open two wallet requests',()=>fixture(async({wallet,rpc})=>{
  const results=await Promise.allSettled([wallet.sendTransaction(account,request,intent),wallet.sendTransaction(account,request,intent)]);
  assert.ok(results.every(result=>result.status==='rejected'));assert.equal(rpc.accepted,1);assert.equal(rpc.prompts,1);assert.equal(wallet.pendingTransactions(account).length,1);
}));

test('separate module contexts serialize the same intent through the browser lock',()=>fixture(async({wallet,load,rpc})=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),locks=new Map();let requests=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request(key,_options,work){requests++;const task=(locks.get(key)||Promise.resolve()).catch(()=>{}).then(work);locks.set(key,task);return task;}}}});
  try{
    const anotherTab=await load(),results=await Promise.allSettled([wallet.sendTransaction(account,request,intent),anotherTab.sendTransaction(account,request,intent)]);
    assert.ok(results.every(result=>result.status==='rejected'));assert.equal(requests,2);assert.equal(locks.size,1);assert.equal(rpc.accepted,1);assert.equal(wallet.pendingTransactions(account).length,1);
  }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}));

test('wallet-selected actual nonces cannot be mistaken for cancellation of a guessed pending nonce',()=>fixture(async({wallet,rpc})=>{
  rpc.actualNonce='0x9';
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];assert.ok(!record.nonce||record.nonce==='0x9','a predicted pending nonce must not be used as the actual broadcast nonce');
  rpc.receiptError=false;rpc.latestNonce='0x6';rpc.replacement={hash:replacementHash,from:account,to:account,input:'0x',value:'0x0',nonce:'0x5'};
  const recovered=await wallet.resumeTransaction(account,record.id);assert.equal(recovered.status,'submitted');assert.equal(rpc.accepted,1);
}));

test('receipt recovery uses the fixed Robinhood RPC after the wallet changes networks',()=>fixture(async({wallet,rpc})=>{
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];rpc.chain='0x38';let reads=0;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://rpc.mainnet.chain.robinhood.com');const body=JSON.parse(options.body);assert.equal(body.method,'eth_getTransactionReceipt');assert.deepEqual(body.params,[hash]);reads++;return Response.json({jsonrpc:'2.0',id:1,result:{status:'0x1',transactionHash:hash}});};
  const recovered=await wallet.resumeTransaction(account,record.id);assert.equal(recovered.status,'confirmed');assert.equal(reads,1);assert.equal(rpc.chain,'0x38');assert.equal(rpc.accepted,1);
}));

test('wallet rejection clears an unsent journal and unavailable storage prevents a wallet request',()=>fixture(async({wallet,rpc,storage})=>{
  rpc.reject=Object.assign(new Error('User rejected'),{code:4001});
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),error=>error.code===4001);assert.equal(rpc.accepted,0);assert.equal(rpc.prompts,1);assert.deepEqual(wallet.pendingTransactions(account),[]);
  rpc.reject=null;storage.setItem=()=>{throw new Error('Storage disabled');};
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),/Enable site storage/);assert.equal(rpc.accepted,0);assert.equal(rpc.prompts,1);assert.deepEqual(wallet.pendingTransactions(account),[]);
}));

test('storage failing after broadcast preserves the current-tab hash and duplicate guard',()=>fixture(async({wallet,rpc,storage})=>{
  const set=storage.setItem;let writes=0;storage.setItem=(key,value)=>{writes++;if(writes>1)throw new Error('Storage quota reached');set(key,value);};
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];assert.equal(record.hash,hash);assert.equal(record.status,'submitted');
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);assert.equal(rpc.accepted,1);
  wallet.completeTransaction(account,record.id);assert.deepEqual(wallet.pendingTransactions(account),[]);
}));

test('manually supplied recovery hashes must match the reviewed sender, recipient, data and value',()=>fixture(async({wallet,rpc})=>{
  rpc.reject=new Error('Wallet connection lost before its response');
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];assert.equal(record.status,'wallet');assert.equal(record.hash,undefined);
  const transaction={hash,from:account,to:target,input:request.data,value:'0x1',nonce:'0x5'};
  await assert.rejects(()=>wallet.resumeTransaction(account,record.id,hash),/does not match/);
  for(const changed of [{from:other},{to:other},{input:'0xabcd'},{value:'0x2'}]){
    rpc.transactions.set(hash,{...transaction,...changed});
    await assert.rejects(()=>wallet.resumeTransaction(account,record.id,hash),/does not match/);assert.equal(wallet.pendingTransactions(account)[0].hash,undefined);
  }
  rpc.transactions.set(hash,transaction);rpc.receiptError=false;rpc.receipt={status:'0x1',transactionHash:hash};
  const recovered=await wallet.resumeTransaction(account,record.id,hash);assert.equal(recovered.status,'confirmed');assert.equal(recovered.nonce,'0x5');assert.equal(rpc.prompts,1);
  await assert.rejects(()=>wallet.resumeTransaction(other,record.id,hash),/unavailable for the active wallet/);
}));

test('a known broadcast cannot be recovered with an older same-intent transaction at another nonce',()=>fixture(async({wallet,rpc})=>{
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];assert.equal(record.nonceVerified,true);
  rpc.transactions.set(replacementHash,{hash:replacementHash,from:account,to:target,input:request.data,value:'0x1',nonce:'0x4'});rpc.receiptError=false;
  await assert.rejects(()=>wallet.resumeTransaction(account,record.id,replacementHash),/does not match/);assert.equal(wallet.pendingTransactions(account)[0].hash,hash);assert.equal(rpc.accepted,1);
}));

test('a cancelled or different same-nonce replacement is recorded without replaying the action',()=>fixture(async({wallet,rpc})=>{
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];rpc.receiptError=false;rpc.latestNonce='0x6';rpc.replacement={hash:replacementHash,from:account,to:account,input:'0x',value:'0x0',nonce:'0x5'};
  const recovered=await wallet.resumeTransaction(account,record.id);assert.equal(recovered.status,'replaced');assert.equal(recovered.replacementHash,replacementHash);assert.match(recovered.error,/does not perform the reviewed action/);assert.equal(rpc.accepted,1);
  const again=await wallet.resumeTransaction(account,record.id);assert.equal(again.status,'replaced');assert.equal(rpc.accepted,1);
}));

test('a same-intent wallet speed-up follows its replacement hash and confirms once',()=>fixture(async({wallet,rpc})=>{
  await assert.rejects(()=>wallet.sendTransaction(account,request,intent),wallet.SubmittedTransactionError);
  const record=wallet.pendingTransactions(account)[0];rpc.receiptError=false;rpc.latestNonce='0x6';rpc.replacement={hash:replacementHash,from:account,to:target,input:request.data,value:'0x1',nonce:'0x5'};
  const recovered=await wallet.resumeTransaction(account,record.id);assert.equal(recovered.status,'confirmed');assert.equal(recovered.hash,replacementHash);assert.equal(recovered.receipt.transactionHash,replacementHash);assert.equal(recovered.id,record.id);
  const repeated=await wallet.sendTransaction(account,request,intent);assert.equal(repeated.transactionHash,replacementHash);assert.equal(rpc.accepted,1);assert.equal(wallet.pendingTransactions(account).length,1);
}));
