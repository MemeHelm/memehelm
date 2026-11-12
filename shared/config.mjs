import {defineChain} from 'viem';
export const NETWORK = Object.freeze({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  shortName: 'Robinhood Testnet',
  currency: 'ETH',
  rpc: 'https://rpc.testnet.chain.robinhood.com',
  explorer: 'https://explorer.testnet.chain.robinhood.com',
  source: 'https://docs.robinhood.com/chain/',
});
export const CHAIN=defineChain({id:NETWORK.id,name:NETWORK.name,nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[NETWORK.rpc]}},blockExplorers:{default:{name:'Blockscout',url:NETWORK.explorer}},testnet:true});
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
