import {getAddress, isAddress, parseEther, parseUnits, zeroAddress} from 'viem';
export function validateLaunch(input) {
  const clean = {
    name:String(input.name??'').trim(),symbol:String(input.symbol??'').trim().toUpperCase(),
    meta:String(input.meta??'').trim().replace(/^ipfs:\/\//,''), description:String(input.description??'').trim().slice(0,2000),
    projectTreasury:String(input.projectTreasury??'').trim(),auditTreasury:String(input.auditTreasury??'').trim(),
    auditBps:Number(input.auditBps),totalSupply:String(input.totalSupply??'').trim(),
    initialFunding:String(input.initialFunding??'0').trim(),factory:String(input.factory??'').trim(),
  };
  if(clean.name.length<2||clean.name.length>32)throw new Error('Name must contain 2–32 characters.');
  if(!/^[A-Z0-9]{2,10}$/.test(clean.symbol))throw new Error('Symbol must contain 2–10 letters or numbers.');
  if(!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})$/.test(clean.meta))throw new Error('Provide a pinned IPFS metadata CID.');
  for(const field of ['projectTreasury','auditTreasury','factory']){
    if(!isAddress(clean[field],{strict:false})||clean[field].toLowerCase()===zeroAddress)throw new Error(`${field} must be a nonzero EVM address.`);
    clean[field]=getAddress(clean[field].toLowerCase());
  }
  if(clean.projectTreasury===clean.auditTreasury)throw new Error('Use a separate wallet for the reserve.');
  if(!Number.isInteger(clean.auditBps)||clean.auditBps<0||clean.auditBps>10000)throw new Error('Reserve share must be between 0% and 100%.');
  if(!/^[1-9]\d{0,15}$/.test(clean.totalSupply)||BigInt(clean.totalSupply)>1000000000000000n)throw new Error('Total supply must be 1–1,000,000,000,000,000 whole tokens.');
  if(!/^\d+(\.\d{1,18})?$/.test(clean.initialFunding)||parseEther(clean.initialFunding)>parseEther('1'))throw new Error('Initial vault funding must be between 0 and 1 test ETH.');
  return clean;
}
export function buildLaunchParams(input){
  const draft=validateLaunch(input);
  return {name:draft.name,symbol:draft.symbol,metadataCID:draft.meta,totalSupply:parseUnits(draft.totalSupply,18),projectTreasury:draft.projectTreasury,auditTreasury:draft.auditTreasury,auditBps:draft.auditBps};
}
