import {parseAbi,encodeAbiParameters,keccak256} from 'viem';
export {PONS} from './pons-addresses.mjs';
export const factoryAbi=parseAbi([
  'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }',
  'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }',
  'struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }',
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'struct FeePolicy { address protocolFeeRecipient; uint16 protocolFeeShareBps; uint16 buybackBurnBps; uint16 hookFeeBps; uint16 maxInternalPriceImpactBps; }',
  'function canLaunch(address) view returns (bool)',
  'function launchFee() view returns (uint256)',
  'function launchConfigCount() view returns (uint256)',
  'function getLaunchConfig(uint256) view returns (LaunchConfig)',
  'function maxCreatorTaxBps() view returns (uint256)',
  'function previewLaunchEconomics(uint256,address) view returns (bytes32)',
  'function getLaunchedToken(address) view returns (LaunchedToken)',
  'function getLaunchFeePolicy(address) view returns (FeePolicy)',
  'function feeEscrow() view returns (address)',
  'function memeHook() view returns (address)',
  'function launchToken(TokenParams,uint256,address) payable returns (address token,address curve)',
  'function launchToken(TokenParams,uint256,address,address[] snipeTaxExemptions) payable returns (address token,address curve)',
  'function snipeTaxSeconds() view returns (uint256)',
  'function snipeTaxStartBps() view returns (uint256)',
  'function createGraduatedPool(address token)',
  'event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)',
]);
export const curveAbi=parseAbi([
  'function getReserves() view returns (uint256 quoteReserve,uint256 tokenReserve)',
  'function realQuoteReserve() view returns (uint256)',
  'function sellableTokens() view returns (uint256)',
  'function reservedTokens() view returns (uint256)',
  'function readyToGraduate() view returns (bool)',
  'function graduated() view returns (bool)',
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address) view returns (uint256)',
  'function quoteFeeBalance() view returns (uint256)',
  'function creatorTaxBalance() view returns (uint256)',
  'function buy(uint256 quoteIn,uint256 minTokensOut,address recipient) payable returns (uint256)',
  'function sell(uint256 tokensIn,uint256 minQuoteOut,address recipient) returns (uint256)',
  'function sweepFees(uint256 minBuybackTokensOut)',
  'event CurveBuy(address indexed buyer,address indexed recipient,uint256 quoteIn,uint256 tokensOut,uint256 fee,uint256 tax)',
  'event CurveSell(address indexed seller,address indexed recipient,uint256 tokensIn,uint256 quoteOut,uint256 fee,uint256 tax)',
]);
export const escrowAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function claim()']);
export const hookAbi=parseAbi(['function pendingFees(bytes32,address) view returns(uint256)','function pendingCreatorTax(bytes32,address) view returns(uint256)','function sweepPoolFees(bytes32,uint256,uint256)']);
export const tokenInfoAbi=parseAbi(['struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }','function getTokenInfo() view returns(address tokenDeployer,string tokenLogo,string tokenDescription,Socials tokenSocials)']);
export const poolKeyType={type:'tuple',components:[{name:'currency0',type:'address'},{name:'currency1',type:'address'},{name:'fee',type:'uint24'},{name:'tickSpacing',type:'int24'},{name:'hooks',type:'address'}]};
export const stateAbi=parseAbi(['function getSlot0(bytes32) view returns(uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)']);
export const quoterAbi=[{type:'function',name:'quoteExactInputSingle',stateMutability:'nonpayable',inputs:[{name:'params',type:'tuple',components:[{...poolKeyType,name:'poolKey'},{name:'zeroForOne',type:'bool'},{name:'exactAmount',type:'uint128'},{name:'hookData',type:'bytes'}]}],outputs:[{name:'amountOut',type:'uint256'},{name:'gasEstimate',type:'uint256'}]}];
export const routerAbi=parseAbi(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable']);
export const permitAbi=parseAbi(['function allowance(address user,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)','function approve(address token,address spender,uint160 amount,uint48 expiration)']);
export function poolKey(launch,hook){const sorted=[launch.token,launch.pairToken].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));return {currency0:sorted[0],currency1:sorted[1],fee:launch.poolFee,tickSpacing:launch.tickSpacing,hooks:hook};}
export function poolId(key){return keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],[key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks]));}
export const BPS=10000n;
export const ceilDiv=(a,b)=>(a+b-1n)/b;
export function quoteCurveBuy({input,quoteReserve,tokenReserve,sellable,feeBps,taxBps,snipeBps}){
  if(input<=0n||quoteReserve<=0n||tokenReserve<=0n||sellable<=0n)throw new Error('The curve cannot accept this buy.');
  const cap=BPS-feeBps-taxBps-100n;if(cap<0n)throw new Error('Invalid fee configuration.');
  const snipe=snipeBps>cap?cap:snipeBps,totalRate=feeBps+taxBps+snipe;
  const net=input-input*feeBps/BPS-input*taxBps/BPS-input*snipe/BPS;
  let output=net*tokenReserve/(quoteReserve+net),spent=input;
  if(output>sellable){output=sellable;const needed=output*quoteReserve/(tokenReserve-output)+1n;const gross=ceilDiv(needed*BPS,BPS-totalRate);spent=gross<input?gross:input;}
  return {output,spent,refund:input-spent,snipeBps:snipe};
}
export function quoteCurveSell({input,quoteReserve,tokenReserve,feeBps,taxBps}){const gross=input*quoteReserve/(tokenReserve+input);return gross-gross*feeBps/BPS-gross*taxBps/BPS;}
