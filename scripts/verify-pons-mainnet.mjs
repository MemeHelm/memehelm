// Read-only verification. No wallet, account key or transaction broadcast exists here.
import {pons} from '../server/pons.mjs';
import {PONS} from '../shared/pons.mjs';
await pons.verify(Object.keys(PONS));
const options=await pons.options();
console.log(JSON.stringify({checkedAt:options.checkedAt,chainId:options.chainId,factory:options.factory,verifiedDeployments:Object.keys(PONS),launchFeeETH:options.feeETH,maxCreatorTaxBps:options.maxCreatorTaxBps,enabledConfigs:options.configs},null,2));
