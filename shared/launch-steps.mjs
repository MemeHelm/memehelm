import {isAddress,zeroAddress} from 'viem';
import {imageLink,projectLink} from './project.mjs';
export function launchStepErrors(draft,step){
 /** @type {Record<string,string>} */ const errors={};
 const check=key=>{if(!isAddress(String(draft[key]||'').trim(),{strict:false})||String(draft[key]).toLowerCase()===zeroAddress)errors[key]='Enter a nonzero wallet address.';};
 if(step===0){if(String(draft.name||'').trim().length<2||String(draft.name||'').trim().length>32)errors.name='Use 2–32 characters.';if(!/^[A-Z0-9]{2,10}$/.test(String(draft.symbol||'').trim().toUpperCase()))errors.symbol='Use 2–10 letters or numbers.';for(const key of ['image','website','x','telegram'])try{key==='image'?imageLink(draft[key]):projectLink(draft[key],key);}catch(e){errors[key]=e.message;}}
 if(step===1){if(draft.splitEnabled){check('projectTreasury');check('auditTreasury');if(draft.projectTreasury?.toLowerCase()===draft.auditTreasury?.toLowerCase())errors.auditTreasury='Use a separate reserve wallet.';if(!Number.isInteger(draft.auditBps)||draft.auditBps<0||draft.auditBps>10000)errors.auditBps='Choose a reserve share between 0% and 100%.';}else if(draft.creatorFeeRecipient)check('creatorFeeRecipient');}
 if(step===2){if(!Number.isInteger(draft.creatorTaxBps)||draft.creatorTaxBps<0||draft.creatorTaxBps>10000)errors.creatorTaxBps='Choose a valid creator fee.';if(!Number.isSafeInteger(draft.configId)||draft.configId<0)errors.configId='Choose an issuance plan.';}
 return errors;
}
