import { createPublicClient, http, erc20Abi, formatEther, isAddress,parseAbi,zeroAddress } from 'viem';
import { readFile } from 'node:fs/promises';
import { NETWORK,CHAIN } from '../shared/config.mjs';
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(process.env.ROBINHOOD_TESTNET_RPC_URL || NETWORK.rpc, { timeout: 10000, retryCount: 0 }) });
export async function artifact(name) {
  if (!['RevenueSplitFactory', 'RevenueSplitVault', 'IVaultPortal', 'IPortal'].includes(name)) throw new Error('Unknown contract artifact.');
  return JSON.parse(await readFile(new URL(`../artifacts/${name}.json`, import.meta.url), 'utf8'));
}
export async function verifyChain() {
  if (await publicClient.getChainId() !== NETWORK.id) throw new Error(`RPC network mismatch. Only ${NETWORK.shortName} is supported.`);
}
// Decode enum fields as integers: the current Robinhood curve was added after the archived interface.
const quoteConfigAbi=parseAbi(['function getQuoteTokenConfiguration(address) view returns ((uint8 enabled,uint8 defaultCurve,uint8 alternativeCurve,uint8 nativeToQuoteSwapType,uint8 dexId))']);
export async function verifyLaunchConfiguration(){
  const config=await publicClient.readContract({address:NETWORK.portal,abi:quoteConfigAbi,functionName:'getQuoteTokenConfiguration',args:[zeroAddress]});
  if(config.enabled!==1||config.defaultCurve!==NETWORK.nativeQuoteCurve||config.dexId!==0)throw new Error('Token launches are temporarily unavailable. The network settings need to be reviewed.');
  return config;
}
export async function chainStatus() {
  try {
    await verifyChain();
    const [block,quote,...contracts] = await Promise.all([publicClient.getBlockNumber(),verifyLaunchConfiguration(),...[NETWORK.portal,NETWORK.vaultPortal,NETWORK.taxTokenImplementation,NETWORK.guardian].map(address=>publicClient.getCode({address}))]);
    return { ok: contracts.every(code=>!!code&&code!=='0x'), block: String(block), checkedAt: new Date().toISOString(), error: null };
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
