import { hexToBigInt, numberToHex } from 'viem';
export type Provider={request(args:{method:string;params?:any[]}):Promise<any>;on?:(event:string,listener:(value:any)=>void)=>void;removeListener?:(event:string,listener:(value:any)=>void)=>void};
declare global { interface Window { ethereum?:Provider } }
export function provider(){if(!window.ethereum)throw new Error('Open this app in a browser with an EVM wallet extension, such as MetaMask or Rabby.');return window.ethereum;}
export async function connectWallet(){const accounts=await provider().request({method:'eth_requestAccounts'});return accounts[0] as string;}
export async function switchTestnet(){
  const wallet=provider();
  try{await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x61'}]});}
  catch(error:any){if(error.code!==4902)throw error;await wallet.request({method:'wallet_addEthereumChain',params:[{chainId:'0x61',chainName:'BNB Smart Chain Testnet',nativeCurrency:{name:'Test BNB',symbol:'tBNB',decimals:18},rpcUrls:['https://bsc-testnet-rpc.publicnode.com'],blockExplorerUrls:['https://testnet.bscscan.com']}]});}
}
export async function sendTestnet(from:string,tx:{to?:string;data?:string;value?:string}){
  const wallet=provider();
  const accounts=await wallet.request({method:'eth_accounts'});
  if(accounts[0]?.toLowerCase()!==from.toLowerCase())throw new Error('The active wallet changed. Reconnect before continuing.');
  if(Number(hexToBigInt(await wallet.request({method:'eth_chainId'})))!==97)throw new Error('Switch your wallet to BNB Testnet first.');
  const request={from,...(tx.to?{to:tx.to}:{}),data:tx.data||'0x',value:numberToHex(BigInt(tx.value||'0'))};
  const estimated=await wallet.request({method:'eth_estimateGas',params:[request]});
  const hash=await wallet.request({method:'eth_sendTransaction',params:[{...request,gas:numberToHex(hexToBigInt(estimated)*120n/100n)}]});
  for(let attempt=0;attempt<120;attempt++){
    const receipt=await wallet.request({method:'eth_getTransactionReceipt',params:[hash]});
    if(receipt){if(receipt.status!=='0x1')throw new Error('Transaction reverted. Inspect the transaction on BscScan.');return receipt;}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw new Error(`Transaction pending: ${hash}. Check BscScan before retrying.`);
}
