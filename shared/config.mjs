import {defineChain} from 'viem';
export const NETWORK = Object.freeze({
  id: 4663,
  name: 'Robinhood Chain',
  shortName: 'Robinhood Chain',
  currency: 'ETH',
  rpc: 'https://rpc.mainnet.chain.robinhood.com',
  explorer: 'https://robinhoodchain.blockscout.com',
  source: 'https://docs.robinhood.com/chain/',
});
export const CHAIN=defineChain({id:NETWORK.id,name:NETWORK.name,nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[NETWORK.rpc]}},blockExplorers:{default:{name:'Blockscout',url:NETWORK.explorer}},testnet:false});
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
