import {getAddress,isAddress,zeroAddress} from 'viem';
import {imageLink,projectLink} from './project.mjs';
export function validAddress(value,label='Wallet') { if(typeof value!=='string'||!isAddress(value,{strict:false})||value.toLowerCase()===zeroAddress)throw new Error(label+' must be a nonzero EVM address.');return getAddress(value.toLowerCase()); }
export function validateSplit(input){const projectTreasury=validAddress(input.projectTreasury,'Project wallet'),auditTreasury=validAddress(input.auditTreasury,'Reserve wallet'),auditBps=Number(input.auditBps);if(projectTreasury===auditTreasury)throw new Error('Use different wallets for the split.');if(!Number.isInteger(auditBps)||auditBps<0||auditBps>10000)throw new Error('Reserve share must be between 0% and 100%.');return{projectTreasury,auditTreasury,auditBps};}
export function validateLaunch(input){
 // Pons snipe exemptions: normalized, unique, at most 32 wallets, fixed onchain at launch.
 const exemptions=Array.isArray(input.snipeTaxExemptions)?input.snipeTaxExemptions.map(item=>validAddress(item,'Snipe exemption')):input.snipeTaxExemptions===undefined||input.snipeTaxExemptions===null?[]:null;
 if(exemptions===null)throw new Error('Snipe tax exemptions must be a list of wallets.');
 if(exemptions.length>32)throw new Error('Exempt at most 32 wallets from the opening anti-snipe fee.');
 if(new Set(exemptions.map(address=>address.toLowerCase())).size!==exemptions.length)throw new Error('Each snipe exemption wallet must be listed once.');
 const clean={name:String(input.name??'').trim(),symbol:String(input.symbol??'').trim().toUpperCase(),description:String(input.description??'').trim(),image:imageLink(input.image),website:projectLink(input.website),x:projectLink(input.x,'x'),telegram:projectLink(input.telegram,'telegram'),creatorFeeRecipient:validAddress(input.creatorFeeRecipient,'Fee recipient'),configId:Number(input.configId??0),creatorTaxBps:Number(input.creatorTaxBps??0),buybackEnabled:false,splitEnabled:input.splitEnabled===true,holdersEnabled:input.holdersEnabled===true,socialEnabled:input.socialEnabled===true,vaultAddress:input.vaultAddress?validAddress(input.vaultAddress,'Fee vault'):null,snipeTaxExemptions:exemptions};
 if(clean.name.length<2||clean.name.length>32)throw new Error('Name must contain 2–32 characters.');if(!/^[A-Z0-9]{2,10}$/.test(clean.symbol))throw new Error('Symbol must contain 2–10 letters or numbers.');if(clean.description.length>2000)throw new Error('Keep your story under 2,000 characters.');
 if(!Number.isSafeInteger(clean.configId)||clean.configId<0)throw new Error('Choose an available issuance plan.');if(!Number.isInteger(clean.creatorTaxBps)||clean.creatorTaxBps<0||clean.creatorTaxBps>10000)throw new Error('Choose a valid creator fee.');
 if(input.buybackEnabled)throw new Error('Buyback vesting is not offered by this launch flow.');
 if([clean.splitEnabled,clean.holdersEnabled,clean.socialEnabled].filter(Boolean).length>1)throw new Error('Choose one fee destination: a fixed split, holder payouts or community escrow.');
 if(clean.splitEnabled){Object.assign(clean,validateSplit(input));if(!clean.vaultAddress||clean.vaultAddress!==clean.creatorFeeRecipient)throw new Error('Activate the split and use its vault as fee recipient.');}
 if(clean.holdersEnabled){if(!clean.vaultAddress||clean.vaultAddress!==clean.creatorFeeRecipient)throw new Error('Activate the holders vault and use it as fee recipient.');}
 if(clean.socialEnabled){if(!clean.vaultAddress||clean.vaultAddress!==clean.creatorFeeRecipient)throw new Error('Activate the community escrow and use its vault as fee recipient.');}
 return clean;
}
