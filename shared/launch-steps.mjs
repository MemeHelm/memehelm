import {isAddress,zeroAddress,parseEther} from 'viem';
import {imageLink,projectLink} from './project.mjs';
export function launchStepErrors(draft,step){
  /** @type {Record<string,string>} */
  const errors={};
  if(step===0){
    if(String(draft.name||'').trim().length<2||String(draft.name||'').trim().length>32)errors.name='Use 2–32 characters for your token name.';
    if(!/^[A-Z0-9]{2,10}$/.test(String(draft.symbol||'').trim().toUpperCase()))errors.symbol='Use 2–10 letters or numbers.';
    if(!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})$/.test(String(draft.meta||'').trim().replace(/^ipfs:\/\//,'')))errors.meta='Add the IPFS CID of your uploaded token metadata.';
    for(const field of ['image','website','x','telegram'])try{field==='image'?imageLink(draft[field]):projectLink(draft[field],field);}catch(error){errors[field]=error.message;}
  }
  if(step===1){
    for(const field of ['projectTreasury','auditTreasury'])if(!isAddress(String(draft[field]||'').trim(),{strict:false})||String(draft[field]).trim().toLowerCase()===zeroAddress)errors[field]='Enter a nonzero Robinhood Chain wallet address.';
    if(!errors.auditTreasury&&!errors.projectTreasury&&String(draft.projectTreasury).trim().toLowerCase()===String(draft.auditTreasury).trim().toLowerCase())errors.auditTreasury='Choose a different wallet for the reserve.';
    if(!Number.isInteger(draft.auditBps)||draft.auditBps<0||draft.auditBps>10000)errors.auditBps='Choose a reserve share between 0% and 100%.';
  }
  if(step===2){
    if(!/^[1-9]\d{0,15}$/.test(String(draft.totalSupply))||BigInt(draft.totalSupply)>1000000000000000n)errors.totalSupply='Choose 1–1,000,000,000,000,000 whole tokens.';
    try{if(!/^\d+(\.\d{1,18})?$/.test(draft.initialFunding)||parseEther(draft.initialFunding)>parseEther('1'))throw new Error();}catch{errors.initialFunding='Enter 0–1 test ETH, with up to 18 decimal places.';}
  }
  return errors;
}
