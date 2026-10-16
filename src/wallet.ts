import { hexToBigInt, numberToHex } from 'viem';
import {NETWORK} from '../shared/config.mjs';
export type Provider={request(args:{method:string;params?:any[]}):Promise<any>;on?:(event:string,listener:(value:any)=>void)=>void;removeListener?:(event:string,listener:(value:any)=>void)=>void};
declare global { interface Window { ethereum?:Provider } }
export function provider(){if(!window.ethereum)throw new Error('Open this app in a browser with an EVM wallet extension, such as MetaMask or Rabby.');return window.ethereum;}
export async function connectWallet(){await provider().request({method:'eth_requestAccounts'});await switchTestnet();const accounts=await provider().request({method:'eth_accounts'});if(!accounts[0])throw new Error('Choose an account in your wallet to continue.');return accounts[0] as string;}
export async function switchTestnet(){
  const wallet=provider();
  const chainId=numberToHex(NETWORK.id);
  try{await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
  catch(error:any){if(error.code!==4902)throw error;await wallet.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:NETWORK.name,nativeCurrency:{name:'Ether',symbol:NETWORK.currency,decimals:18},rpcUrls:[NETWORK.rpc],blockExplorerUrls:[NETWORK.explorer]}]});await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
}
export async function sendTestnet(from:string,tx:{to?:string;data?:string;value?:string;chainId?:number}){
  if(tx.chainId!==undefined&&tx.chainId!==NETWORK.id)throw new Error('This transaction was prepared for another network. Prepare it again on Robinhood Testnet.');
  const wallet=provider();
  const accounts=await wallet.request({method:'eth_accounts'});
  if(accounts[0]?.toLowerCase()!==from.toLowerCase())throw new Error('The active wallet changed. Reconnect before continuing.');
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)await switchTestnet();
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)throw new Error(`Switch your wallet to ${NETWORK.shortName} first.`);
  const request={from,...(tx.to?{to:tx.to}:{}),data:tx.data||'0x',value:numberToHex(BigInt(tx.value||'0'))};
  const estimated=await wallet.request({method:'eth_estimateGas',params:[request]});
  const currentAccounts=await wallet.request({method:'eth_accounts'});
  if(currentAccounts[0]?.toLowerCase()!==from.toLowerCase())throw new Error('The active wallet changed. Reconnect before continuing.');
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==NETWORK.id)throw new Error(`The wallet network changed. Switch back to ${NETWORK.shortName} before continuing.`);
  const hash=await wallet.request({method:'eth_sendTransaction',params:[{...request,gas:numberToHex(hexToBigInt(estimated)*120n/100n)}]});
  for(let attempt=0;attempt<120;attempt++){
    const receipt=await wallet.request({method:'eth_getTransactionReceipt',params:[hash]});
    if(receipt){if(receipt.status!=='0x1')throw new Error('Transaction reverted. Inspect the transaction on Blockscout.');return receipt;}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw new Error(`Transaction pending: ${hash}. Check Blockscout before retrying.`);
}
