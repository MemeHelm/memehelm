import { hexToBigInt, numberToHex, stringToHex, keccak256 } from 'viem';
import {NETWORK} from '../shared/config.mjs';
export type Provider={request(args:{method:string;params?:any[]}):Promise<any>;on?:(event:string,listener:(value:any)=>void)=>void;removeListener?:(event:string,listener:(value:any)=>void)=>void};
export type TransactionIntent={kind:'launch'|'vault'|'trade'|'revenue'|'transaction';label:string;payload?:Record<string,any>};
export type StoredTransaction={id:string;account:string;chainId:number;fingerprint:string;intent:TransactionIntent;request:{from:string;to?:string;data:string;value:string;gas:string};hash?:string;nonce?:string;nonceVerified?:boolean;blockNumber?:string;submittedAt:string;status:'wallet'|'submitted'|'confirmed'|'reverted'|'replaced';receipt?:any;replacementHash?:string;error?:string};

const transactionKey=(account:string)=>`memehelm:${NETWORK.id}:pons-v2:${account.toLowerCase()}:transactions`;
const hashPattern=/^0x[0-9a-fA-F]{64}$/;
const journalMemory=new Map<string,StoredTransaction[]>();
const volatileJournals=new Set<string>();
const submissions=new Map<string,Promise<any>>();
function changed(){if(typeof window!=='undefined'&&window.dispatchEvent)window.dispatchEvent(new Event('memehelm-transactions-changed'));}
export function pendingTransactions(account:string):StoredTransaction[]{
  const key=transactionKey(account);
  if(volatileJournals.has(key))return journalMemory.get(key)||[];
  try{const parsed=JSON.parse(window.localStorage.getItem(key)||'[]');if(Array.isArray(parsed)){const records=parsed.filter(record=>record&&record.account?.toLowerCase()===account.toLowerCase()&&record.chainId===NETWORK.id&&typeof record.id==='string'&&record.request&&record.intent&&['wallet','submitted','confirmed','reverted','replaced'].includes(record.status));journalMemory.set(key,records);return records;}}
  catch{}
  return journalMemory.get(key)||[];
}
function saveTransaction(record:StoredTransaction,requireStorage=false){
  const records=pendingTransactions(record.account).filter(item=>item.id!==record.id);records.push(record);
  const key=transactionKey(record.account);
  try{window.localStorage.setItem(key,JSON.stringify(records));volatileJournals.delete(key);}
  catch{if(requireStorage)throw new Error('Your browser could not save transaction recovery details. Enable site storage before requesting a wallet transaction.');volatileJournals.add(key);}
  journalMemory.set(key,records);changed();
}
export function completeTransaction(account:string,id?:string){
  if(!id)return;
  const records=pendingTransactions(account).filter(record=>record.id!==id),key=transactionKey(account);journalMemory.set(key,records);
  try{window.localStorage.setItem(key,JSON.stringify(records));volatileJournals.delete(key);}catch{volatileJournals.add(key);}
  changed();
}
export class SubmittedTransactionError extends Error{
  constructor(public transaction:StoredTransaction,message='Your transaction was submitted, but confirmation is unavailable. Check its status before sending again.'){
    super(`${message}${transaction.hash?` Transaction: ${transaction.hash}.`:''}`);this.name='SubmittedTransactionError';
  }
}
// Receipt queries stay on the prepared chain even if the wallet changes networks.
async function chainRead(method:string,params:any[]){
  const injected=typeof window!=='undefined'?window.ethereum:undefined;
  let walletChain:number|undefined;
  if(injected)try{walletChain=Number(BigInt(await injected.request({method:'eth_chainId'})));}catch{}
  if(injected&&walletChain===NETWORK.id)return injected.request({method,params});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch(NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});if(!response.ok)throw new Error('Chain status is temporarily unavailable.');const result=await response.json();if(result.error)throw new Error('Chain status is temporarily unavailable.');return result.result;}finally{clearTimeout(timer);}
}
function matchesRequest(transaction:any,record:StoredTransaction){
  try{return transaction&&transaction.from?.toLowerCase()===record.account.toLowerCase()&&(transaction.to||'').toLowerCase()===(record.request.to||'').toLowerCase()&&(transaction.input||transaction.data||'0x').toLowerCase()===record.request.data.toLowerCase()&&BigInt(transaction.value||'0x0')===BigInt(record.request.value);}catch{return false;}
}
async function verifySubmittedNonce(record:StoredTransaction){
  if(!record.hash||record.nonceVerified)return record;
  // Pending nonce estimates are not authoritative: the wallet can choose another nonce.
  let submitted:any;try{submitted=await chainRead('eth_getTransactionByHash',[record.hash]);}catch{return record;}
  if(!submitted)return record;
  if(!matchesRequest(submitted,record)){
    const changed:StoredTransaction={...record,status:'replaced',replacementHash:record.hash,error:'The submitted transaction does not perform the reviewed action. Check its details in your wallet before continuing.'};saveTransaction(changed);return changed;
  }
  if(typeof submitted.nonce==='string'&&/^0x[0-9a-f]+$/i.test(submitted.nonce)){
    record={...record,nonce:submitted.nonce,nonceVerified:true};saveTransaction(record);
  }
  return record;
}
async function readReceipt(record:StoredTransaction){
  if(!record.hash)throw new SubmittedTransactionError(record,'Check your wallet for the earlier request. Add its transaction hash to recover it, or confirm it was never sent.');
  record=await verifySubmittedNonce(record);
  if(record.status==='replaced')return record;
  const receipt=await chainRead('eth_getTransactionReceipt',[record.hash]);
  if(receipt){
    const status=receipt.status==='0x1'?'confirmed':'reverted';
    record={...record,status,receipt:{...receipt,transactionHash:receipt.transactionHash||record.hash}};saveTransaction(record);
    return record;
  }
  // A consumed nonce may indicate a wallet speed-up or cancellation. Never resend it.
  if(record.nonce&&record.nonceVerified){
    let nonce:string|undefined;try{nonce=await chainRead('eth_getTransactionCount',[record.account,'latest']);}catch{}
    if(nonce&&BigInt(nonce)>BigInt(record.nonce)){
      try{
        const latest=BigInt(await chainRead('eth_blockNumber',[]));
        const first=record.blockNumber?BigInt(record.blockNumber):latest;
        const lower=latest>63n?latest-63n:0n;
        for(let block=latest;block>=(first>lower?first:lower);block--){
          const data=await chainRead('eth_getBlockByNumber',[numberToHex(block),true]);
          const replacement=data?.transactions?.find((tx:any)=>tx.from?.toLowerCase()===record.account.toLowerCase()&&tx.nonce&&BigInt(tx.nonce)===BigInt(record.nonce!));
          if(replacement&&replacement.hash!==record.hash){
            const same=matchesRequest(replacement,record);
            if(same){const updated={...record,hash:replacement.hash,replacementHash:replacement.hash,status:'submitted' as const};saveTransaction(updated);return await readReceipt(updated);}
            record={...record,status:'replaced',replacementHash:replacement.hash,error:'This request was replaced or cancelled in your wallet. The replacement does not perform the reviewed action.'};saveTransaction(record);return record;
          }
        }
      }catch(error){if(error instanceof SubmittedTransactionError)throw error;}
      return {...record,error:'This nonce was used, but its replacement could not be identified in the recent block window. Check your wallet and the explorer; do not send again yet.'};
    }
  }
  return record;
}
export async function resumeTransaction(account:string,id:string,hash?:string):Promise<StoredTransaction>{
  let record=pendingTransactions(account).find(item=>item.id===id);
  if(!record)throw new Error('This recovery record is unavailable for the active wallet.');
  if(record.status==='confirmed'||record.status==='reverted'||record.status==='replaced')return record;
  if(hash){
    if(!hashPattern.test(hash))throw new Error('Enter a valid transaction hash from your wallet.');
    const submitted=await chainRead('eth_getTransactionByHash',[hash]);
    const verifiedNonce=typeof submitted?.nonce==='string'&&/^0x[0-9a-f]+$/i.test(submitted.nonce);
    if(!matchesRequest(submitted,record)||record.nonceVerified&&record.nonce&&(!verifiedNonce||BigInt(submitted.nonce)!==BigInt(record.nonce)))throw new Error('This transaction does not match the reviewed request on Robinhood Chain.');
    record={...record,hash,status:'submitted',nonce:verifiedNonce?submitted.nonce:undefined,nonceVerified:verifiedNonce};saveTransaction(record);
  }
  try{return await readReceipt(record);}catch(error){if(error instanceof SubmittedTransactionError)throw error;throw new SubmittedTransactionError(record);}
}
declare global { interface Window { ethereum?:Provider } }
export function provider(){if(!window.ethereum)throw new Error('Open this app in a browser with an EVM wallet extension, such as MetaMask or Rabby.');return window.ethereum;}
export async function connectWallet(){await provider().request({method:'eth_requestAccounts'});await switchMainnet();const accounts=await provider().request({method:'eth_accounts'});if(!accounts[0])throw new Error('Choose an account in your wallet to continue.');return accounts[0] as string;}
export async function signInMessage(address:string,message:string){
  const wallet=provider();
  if((await wallet.request({method:'eth_accounts'}))[0]?.toLowerCase()!==address.toLowerCase())throw new Error('Your wallet changed. Sign in again.');
  const signature=await wallet.request({method:'personal_sign',params:[stringToHex(message),address]});
  if((await wallet.request({method:'eth_accounts'}))[0]?.toLowerCase()!==address.toLowerCase())throw new Error('Your wallet changed. Sign in again.');
  return signature as string;
}
export async function switchMainnet(){
  const wallet=provider();
  const chainId=numberToHex(NETWORK.id);
  try{await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
  catch(error:any){if(error.code!==4902)throw error;await wallet.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:NETWORK.name,nativeCurrency:{name:'Ether',symbol:NETWORK.currency,decimals:18},rpcUrls:[NETWORK.rpc],blockExplorerUrls:[NETWORK.explorer]}]});await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
}
type PreparedTransaction={to?:string;data?:string;value?:string;chainId?:number;expiresAt?:string};
const fingerprintFor=(from:string,tx:PreparedTransaction)=>keccak256(stringToHex(JSON.stringify([from.toLowerCase(),NETWORK.id,tx.to?.toLowerCase()||'',(tx.data||'0x').toLowerCase(),String(BigInt(tx.value||'0'))])));
export async function sendTransaction(from:string,tx:PreparedTransaction,intent:TransactionIntent={kind:'transaction',label:'Wallet transaction'}){
  if(tx.chainId!==undefined&&tx.chainId!==NETWORK.id)throw new Error('This transaction was prepared for another network. Prepare it again on Robinhood Chain.');
  if(tx.expiresAt&&Date.parse(tx.expiresAt)<=Date.now())throw new Error('This review expired. Request fresh terms before signing.');
  const fingerprint=fingerprintFor(from,tx),key=`memehelm:${NETWORK.id}:transaction:${fingerprint}`;
  const existing=submissions.get(key);if(existing)return existing;
  const work=()=>submitTransaction(from,tx,intent,fingerprint);
  // Web Locks cover another tab; the synchronous promise map also covers rapid clicks here.
  const promise=Promise.resolve().then(()=>typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request(key,{mode:'exclusive'},work):work()).finally(()=>{if(submissions.get(key)===promise)submissions.delete(key);});
  submissions.set(key,promise);return promise;
}
async function submitTransaction(from:string,tx:PreparedTransaction,intent:TransactionIntent,fingerprint:string){
  if(tx.chainId!==undefined&&tx.chainId!==NETWORK.id)throw new Error('This transaction was prepared for another network. Prepare it again on Robinhood Chain.');
  if(tx.expiresAt&&Date.parse(tx.expiresAt)<=Date.now())throw new Error('This review expired. Request fresh terms before signing.');
  const wallet=provider();
  const earlier=pendingTransactions(from).find(record=>record.fingerprint===fingerprint&&!['reverted','replaced'].includes(record.status));
  if(earlier){const resumed=await resumeTransaction(from,earlier.id);if(resumed.status==='confirmed')return {...resumed.receipt,recoveryId:resumed.id};throw new SubmittedTransactionError(resumed);}
  const accounts=await wallet.request({method:'eth_accounts'});
  if(accounts[0]?.toLowerCase()!==from.toLowerCase())throw new Error('The active wallet changed. Reconnect before continuing.');
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)await switchMainnet();
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)throw new Error(`Switch your wallet to ${NETWORK.shortName} first.`);
  const request={from,...(tx.to?{to:tx.to}:{}),data:tx.data||'0x',value:numberToHex(BigInt(tx.value||'0'))};
  const estimated=await wallet.request({method:'eth_estimateGas',params:[request]});
  const currentAccounts=await wallet.request({method:'eth_accounts'});
  if(currentAccounts[0]?.toLowerCase()!==from.toLowerCase())throw new Error('The active wallet changed. Reconnect before continuing.');
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)throw new Error(`The wallet network changed. Switch back to ${NETWORK.shortName} before continuing.`);
  if(tx.expiresAt&&Date.parse(tx.expiresAt)<=Date.now())throw new Error('This review expired. Request fresh terms before signing.');
  const preparedRequest={...request,gas:numberToHex(hexToBigInt(estimated)*120n/100n)};
  let blockNumber:string|undefined;
  try{blockNumber=await wallet.request({method:'eth_blockNumber'});}catch{}
  const concurrent=pendingTransactions(from).find(item=>item.fingerprint===fingerprint&&!['reverted','replaced'].includes(item.status));
  if(concurrent){const resumed=await resumeTransaction(from,concurrent.id);if(resumed.status==='confirmed')return{...resumed.receipt,recoveryId:resumed.id};throw new SubmittedTransactionError(resumed);}
  let record:StoredTransaction={id:crypto.randomUUID(),account:from.toLowerCase(),chainId:NETWORK.id,fingerprint,intent,request:preparedRequest,blockNumber,submittedAt:new Date().toISOString(),status:'wallet'};
  saveTransaction(record,true);
  let hash:string;
  try{hash=await wallet.request({method:'eth_sendTransaction',params:[preparedRequest]});}
  catch(error:any){if(error.code===4001||error.code===-32602){completeTransaction(from,record.id);throw error;}throw new SubmittedTransactionError(record,'The wallet request did not return a transaction hash. Check your wallet before requesting it again.');}
  if(!hashPattern.test(hash))throw new SubmittedTransactionError(record,'The wallet did not return a valid transaction hash. Check your wallet before retrying.');
  record={...record,hash,status:'submitted'};saveTransaction(record);
  for(let attempt=0;attempt<120;attempt++){
    let checked:StoredTransaction;
    try{checked=await readReceipt(record);}catch{throw new SubmittedTransactionError(record);}
    if(checked.status==='confirmed')return {...checked.receipt,recoveryId:record.id};
    if(checked.status==='reverted')throw new SubmittedTransactionError(checked,'Transaction reverted. No reviewed action was completed; network gas may have been spent.');
    if(checked.status==='replaced')throw new SubmittedTransactionError(checked,checked.error);
    record=checked;
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw new SubmittedTransactionError(record,'Transaction is still pending. Use its recovery record to check again before sending another request.');
}
