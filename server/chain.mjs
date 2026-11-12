import { createPublicClient, http, erc20Abi, formatEther, isAddress } from 'viem';
import { readFile } from 'node:fs/promises';
import { NETWORK,CHAIN } from '../shared/config.mjs';
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(process.env.ROBINHOOD_TESTNET_RPC_URL || NETWORK.rpc, { timeout: 10000, retryCount: 0 }) });
export async function artifact(name) {
  if (!['MemeHelmLaunchFactory', 'RevenueSplitVault', 'MemeHelmToken'].includes(name)) throw new Error('Unknown contract artifact.');
  return JSON.parse(await readFile(new URL(`../artifacts/${name}.json`, import.meta.url), 'utf8'));
}
export async function verifyChain() {
  if (await publicClient.getChainId() !== NETWORK.id) throw new Error(`RPC network mismatch. Only ${NETWORK.shortName} is supported.`);
}
export async function verifyFactory(address,client=publicClient){
  if(!isAddress(address||'',{strict:false}))throw new Error('Enable your MemeHelm launchpad before preparing a token.');
  const compiled=await artifact('MemeHelmLaunchFactory'),code=await client.getCode({address});
  if(!code||code==='0x'||code.toLowerCase()!==compiled.deployedBytecode.toLowerCase())throw new Error('This address is not a matching MemeHelm launch factory. Enable the launchpad again.');
  return compiled;
}
export async function chainStatus() {
  try {
    await verifyChain();
    const block=await publicClient.getBlockNumber();
    return { ok:true, block:String(block), checkedAt:new Date().toISOString(),error:null };
  } catch { return { ok: false, block: null, checkedAt: new Date().toISOString(), error: `${NETWORK.shortName} is temporarily unavailable. Please try again shortly.` }; }
}
export async function snapshot(project) {
  if(project.chainId!==NETWORK.id)throw new Error('This project belongs to another network.');
  await verifyChain();
  if (!project.tokenAddress || !isAddress(project.tokenAddress, { strict: false })) throw new Error('Launch or import a testnet token first.');
  const address = project.tokenAddress;
  const code=await publicClient.getCode({address});if(!code||code==='0x')throw new Error(`Token has no contract on ${NETWORK.shortName}.`);
  const results = await Promise.allSettled(['name','symbol','totalSupply','decimals'].map(functionName=>publicClient.readContract({address,abi:erc20Abi,functionName})));
  const value=index=>results[index].status==='fulfilled'?results[index].value:undefined;
  const snapshot = { chainId: NETWORK.id, tokenAddress: address, checkedAt: new Date().toISOString(), name: value(0) ?? project.name, symbol: value(1) ?? project.symbol, totalSupply: value(2)?.toString() ?? null, decimals: value(3) ?? null, price: null, volume: null, holders: null, vault: null };
  if (project.vaultAddress) {
    const {abi} = await artifact('RevenueSplitVault');
    const vaultAddress = project.vaultAddress;
    const [token, launchFactory, projectTreasury, auditTreasury, auditBps, totalReceived, totalReleased] = await Promise.all(['token','launchFactory','projectTreasury','auditTreasury','auditBps','totalReceived','totalReleased'].map(functionName => publicClient.readContract({address: vaultAddress,abi,functionName})));
    if (token.toLowerCase() !== address.toLowerCase()) throw new Error('Vault token does not match this project.');
    const factory=await verifyFactory(launchFactory);
    const registered=await publicClient.readContract({address:launchFactory,abi:factory.abi,functionName:'vaults',args:[address]});
    if(registered.toLowerCase()!==vaultAddress.toLowerCase())throw new Error('This vault is not registered to the token by MemeHelm.');
    const [projectPending, auditPending, auditReleased] = await Promise.all([
      publicClient.readContract({address:vaultAddress,abi,functionName:'pending',args:[projectTreasury]}),
      publicClient.readContract({address:vaultAddress,abi,functionName:'pending',args:[auditTreasury]}),
      publicClient.readContract({address:vaultAddress,abi,functionName:'released',args:[auditTreasury]}),
    ]);
    snapshot.vault = { address:vaultAddress,projectTreasury,auditTreasury,auditBps:Number(auditBps), totalReceived:formatEther(totalReceived),totalReleased:formatEther(totalReleased),projectPending:formatEther(projectPending),auditPending:formatEther(auditPending),auditReleased:formatEther(auditReleased),auditAccrued:formatEther(auditPending+auditReleased) };
  }
  return snapshot;
}
