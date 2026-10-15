import { encodeAbiParameters, getAddress, isAddress, parseEther, zeroAddress, zeroHash } from 'viem';
export function validateLaunch(input) {
  const clean = {
    name: String(input.name ?? '').trim(), symbol: String(input.symbol ?? '').trim().toUpperCase(),
    meta: String(input.meta ?? '').trim().replace(/^ipfs:\/\//, ''),
    description: String(input.description ?? '').trim().slice(0, 2000),
    projectTreasury: String(input.projectTreasury ?? '').trim(),
    auditTreasury: String(input.auditTreasury ?? '').trim(),
    auditBps: Number(input.auditBps), buyTaxRate: Number(input.buyTaxRate), sellTaxRate: Number(input.sellTaxRate),
    taxDays: Number(input.taxDays), antiFarmerDays: Number(input.antiFarmerDays),
    initialBuy: String(input.initialBuy ?? '0').trim(), factory: String(input.factory ?? '').trim(),
  };
  if (clean.name.length < 2 || clean.name.length > 32) throw new Error('Name must contain 2–32 characters.');
  if (!/^[A-Z0-9]{2,10}$/.test(clean.symbol)) throw new Error('Symbol must contain 2–10 letters or numbers.');
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})$/.test(clean.meta)) throw new Error('Provide a pinned IPFS metadata CID (not a website URL).');
  for (const field of ['projectTreasury', 'auditTreasury', 'factory']) {
    if (!isAddress(clean[field], { strict: false }) || clean[field].toLowerCase() === zeroAddress) throw new Error(`${field} must be a nonzero EVM address.`);
    clean[field] = getAddress(clean[field].toLowerCase());
  }
  if (clean.projectTreasury === clean.auditTreasury) throw new Error('Use a separate wallet for the audit reserve.');
  if (!Number.isInteger(clean.auditBps) || clean.auditBps < 0 || clean.auditBps > 10000) throw new Error('Audit share must be between 0% and 100%.');
  for (const field of ['buyTaxRate', 'sellTaxRate']) {
    // Both are nonzero for the conservative V6 launch path used by this initial release.
    if (!Number.isInteger(clean[field]) || clean[field] < 1 || clean[field] > 1000) throw new Error('V6 buy and sell tax must each be greater than 0% and at most 10%.');
  }
  if (!Number.isInteger(clean.taxDays) || clean.taxDays < 365 || clean.taxDays > 36500) throw new Error('Tax duration must be 365–36,500 days.');
  if (!Number.isInteger(clean.antiFarmerDays) || clean.antiFarmerDays < 1 || clean.antiFarmerDays > 365) throw new Error('Anti-farmer duration must be 1–365 days.');
  if (!/^\d+(\.\d{1,18})?$/.test(clean.initialBuy) || parseEther(clean.initialBuy) > parseEther('1')) throw new Error('Initial buy must be between 0 and 1 tBNB for this testnet release.');
  return clean;
}
export function buildLaunchParams(input, salt) {
  const draft = validateLaunch(input);
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt)) throw new Error('A valid vanity salt is required.');
  return {
    name: draft.name, symbol: draft.symbol, meta: draft.meta, dexThresh: 1, salt,
    migratorType: 1, quoteToken: zeroAddress, quoteAmt: parseEther(draft.initialBuy),
    permitData: '0x', extensionID: zeroHash, extensionData: '0x', dexId: 0, lpFeeProfile: 0,
    buyTaxRate: draft.buyTaxRate, sellTaxRate: draft.sellTaxRate,
    taxDuration: BigInt(draft.taxDays) * 86400n, antiFarmerDuration: BigInt(draft.antiFarmerDays) * 86400n,
    mktBps: 10000, deflationBps: 0, dividendBps: 0, lpBps: 0,
    minimumShareBalance: 0n, dividendToken: zeroAddress, commissionReceiver: zeroAddress,
    tokenVersion: 6, vaultFactory: draft.factory,
    vaultData: encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint16'}], [draft.projectTreasury,draft.auditTreasury,draft.auditBps]),
  };
}
