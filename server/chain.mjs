import { createPublicClient, http, erc20Abi, formatEther, isAddress } from 'viem';
import { bscTestnet } from 'viem/chains';
import { readFile } from 'node:fs/promises';
import { NETWORK } from '../shared/config.mjs';
export const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', { timeout: 10000, retryCount: 0 }) });
export async function artifact(name) {
  if (!['RevenueSplitFactory', 'RevenueSplitVault', 'IVaultPortal', 'IPortal'].includes(name)) throw new Error('Unknown contract artifact.');
  return JSON.parse(await readFile(new URL(`../artifacts/${name}.json`, import.meta.url), 'utf8'));
}
export async function verifyChain() {
  if (await publicClient.getChainId() !== NETWORK.id) throw new Error('RPC network mismatch. Only BNB Testnet is supported.');
}
export async function chainStatus() {
  try {
    await verifyChain();
    const [block, portal, vaultPortal] = await Promise.all([publicClient.getBlockNumber(), publicClient.getCode({ address: NETWORK.portal }), publicClient.getCode({ address: NETWORK.vaultPortal })]);
    return { ok: !!portal && portal !== '0x' && !!vaultPortal && vaultPortal !== '0x', block: String(block), checkedAt: new Date().toISOString(), error: null };
  } catch { return { ok: false, block: null, checkedAt: new Date().toISOString(), error: 'BNB Testnet RPC is unavailable. Check the configured endpoint; no chain data has been substituted.' }; }
}
export async function snapshot(project) {
  await verifyChain();
  if (!project.tokenAddress || !isAddress(project.tokenAddress, { strict: false })) throw new Error('Launch or import a testnet token first.');
  const address = project.tokenAddress;
  if (!await publicClient.getCode({address})) throw new Error('Token has no contract on BNB Testnet.');
  const results = await publicClient.multicall({ contracts: ['name','symbol','totalSupply','decimals'].map(functionName => ({ address, abi: erc20Abi, functionName })), allowFailure: true });
  const snapshot = { chainId: NETWORK.id, tokenAddress: address, checkedAt: new Date().toISOString(), name: results[0].result ?? project.name, symbol: results[1].result ?? project.symbol, totalSupply: results[2].result?.toString() ?? null, decimals: results[3].result ?? null, price: null, volume: null, holders: null, vault: null };
  if (project.vaultAddress) {
    const {abi} = await artifact('RevenueSplitVault');
    const vaultAddress = project.vaultAddress;
    const [token, projectTreasury, auditTreasury, auditBps, totalReceived, totalReleased] = await Promise.all(['taxToken','projectTreasury','auditTreasury','auditBps','totalReceived','totalReleased'].map(functionName => publicClient.readContract({address: vaultAddress,abi,functionName})));
    if (token.toLowerCase() !== address.toLowerCase()) throw new Error('Vault token does not match this project.');
    const [projectPending, auditPending, auditReleased] = await Promise.all([
      publicClient.readContract({address:vaultAddress,abi,functionName:'pending',args:[projectTreasury]}),
      publicClient.readContract({address:vaultAddress,abi,functionName:'pending',args:[auditTreasury]}),
      publicClient.readContract({address:vaultAddress,abi,functionName:'released',args:[auditTreasury]}),
    ]);
    snapshot.vault = { address:vaultAddress,projectTreasury,auditTreasury,auditBps:Number(auditBps), totalReceived:formatEther(totalReceived),totalReleased:formatEther(totalReleased),projectPending:formatEther(projectPending),auditPending:formatEther(auditPending),auditReleased:formatEther(auditReleased),auditAccrued:formatEther(auditPending+auditReleased) };
  }
  return snapshot;
}
