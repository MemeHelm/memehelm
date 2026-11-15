import {erc20Abi,getAddress,isAddress,zeroAddress} from 'viem';
import {NETWORK} from '../shared/config.mjs';
import {publicClient} from './chain.mjs';
import {withDeadline} from './deadline.mjs';

const invalid=message=>Object.assign(new Error(message),{status:400});
const unavailable=()=>Object.assign(new Error('Token details could not be verified on Robinhood Chain. Please try again.'),{status:503});

// Importing is private tracking, so a valid ERC20 need not be a pons launch.
export async function verifyImportedToken(input,{client=publicClient,timeoutMs=12000}={}){
  if(typeof input!=='string'||!isAddress(input,{strict:false})||input.toLowerCase()===zeroAddress)throw invalid('Enter a valid token address.');
  const address=getAddress(input.toLowerCase());
  try{
    return await withDeadline(async()=>{
      if(await client.getChainId()!==NETWORK.id)throw unavailable();
      const code=await client.getCode({address});
      if(!code||code==='0x')throw invalid('No token contract was found at this address on Robinhood Chain. Check the address and network.');
      let values;
      try{values=await Promise.all(['name','symbol','decimals','totalSupply'].map(functionName=>client.readContract({address,abi:erc20Abi,functionName})));}
      catch(error){
        // A revert or undecodable result is evidence that the required token interface is absent.
        if(['ContractFunctionRevertedError','AbiDecodingDataSizeTooSmallError','ContractFunctionZeroDataError'].some(name=>error?.name===name||error?.walk?.(cause=>cause?.name===name)))throw invalid('This contract could not be verified as a token. Check its address.');
        throw unavailable();
      }
      const[name,symbol,decimals,totalSupply]=values;
      if(typeof name!=='string'||!name.trim()||name.length>256||typeof symbol!=='string'||!symbol.trim()||symbol.length>64||!Number.isInteger(Number(decimals))||Number(decimals)<0||Number(decimals)>255||typeof totalSupply!=='bigint'||totalSupply<0n)throw invalid('This contract does not provide valid token details. Check its address.');
      return{address,name,symbol,decimals:Number(decimals),totalSupply:String(totalSupply),chainId:NETWORK.id};
    },timeoutMs);
  }catch(error){if(error?.status===400||error?.status===503)throw error;throw unavailable();}
}
