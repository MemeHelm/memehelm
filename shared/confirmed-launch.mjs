import {parseEventLogs} from 'viem';
import {factoryAbi} from './pons.mjs';

// Recovery records are only hints; the server verifies the resulting chain receipt.
export function confirmedLaunchInput(wallet,prepared,receipt,draftId){
  const events=parseEventLogs({abi:factoryAbi,logs:receipt.logs||[],eventName:'TokenLaunched'});
  const event=events.find(item=>item.address.toLowerCase()===prepared.to.toLowerCase()&&item.args.deployer.toLowerCase()===wallet.toLowerCase());
  if(!event)throw new Error(`Transaction confirmed. No matching launch event was found. Check ${receipt.transactionHash} before requesting another launch.`);
  const settings=prepared.settings;
  const hasVault=settings.splitEnabled||settings.holdersEnabled||settings.socialEnabled;
  return {...settings,draftId:draftId||undefined,tokenAddress:event.args.token,vaultAddress:hasVault?settings.vaultAddress:null,launchHash:receipt.transactionHash};
}
