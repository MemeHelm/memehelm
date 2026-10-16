import {defineChain} from 'viem';
export const NETWORK = Object.freeze({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  shortName: 'Robinhood Testnet',
  currency: 'ETH',
  nativeQuoteCurve:25,
  rpc: 'https://rpc.testnet.chain.robinhood.com',
  explorer: 'https://explorer.testnet.chain.robinhood.com',
  flap: 'https://testnet.flap.sh',
  portal: '0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09',
  vaultPortal: '0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B',
  taxTokenImplementation: '0x7777C8743C88B3aff3cf262135beF2c8b2e83333',
  guardian: '0x0000b48720d3B4ED6BC5031768B07F2b59270000',
  source: 'https://docs.flap.sh/flap/developers/deployed-contract-addresses',
  verifiedAt: '2026-10-16',
});
export const CHAIN=defineChain({id:NETWORK.id,name:NETWORK.name,nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[NETWORK.rpc]}},blockExplorers:{default:{name:'Blockscout',url:NETWORK.explorer}},testnet:true});
export const AUDIT_REFERENCE_ETH = '0.16';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
