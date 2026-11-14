import {createPublicClient,http} from 'viem';
import {readFile} from 'node:fs/promises';
import {NETWORK,CHAIN} from '../shared/config.mjs';
export const publicClient=createPublicClient({chain:CHAIN,transport:http(process.env.ROBINHOOD_MAINNET_RPC_URL||NETWORK.rpc,{timeout:12000,retryCount:0})});
export async function artifact(name){
  if(!['RevenueSplitVault','HoldersVault','SocialVault'].includes(name))throw new Error('Unknown contract artifact.');
  return JSON.parse(await readFile(new URL(`../artifacts/${name}.json`,import.meta.url),'utf8'));
}
export async function verifyChain(){if(await publicClient.getChainId()!==NETWORK.id)throw new Error('RPC network mismatch. Only Robinhood Chain is supported.');}
export async function chainStatus(){try{await verifyChain();return{ok:true,block:String(await publicClient.getBlockNumber()),checkedAt:new Date().toISOString(),error:null};}catch{return{ok:false,block:null,checkedAt:new Date().toISOString(),error:'Robinhood Chain is temporarily unavailable.'};}}
export async function snapshot(project){const{pons}=await import('./pons.mjs');return pons.snapshot(project);}
