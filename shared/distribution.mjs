import {getAddress,isAddress} from 'viem';
export const MIN_HOLDERS_PAYOUT_WEI=10n**15n; // 0.001 ETH: below this, a payout costs more in gas than it delivers.
const sameAddress=(a,b)=>a.toLowerCase()===b.toLowerCase();

/// Honest, bounded holder-payout math for the HoldersVault keeper flow.
/// Shares are pro-rata within the balances returned by one explorer snapshot;
/// balances outside the snapshot do not participate in the round.
export function computeHoldersPayout({entries,amountWei,exclude=[],minPayoutWei=MIN_HOLDERS_PAYOUT_WEI}){
  if(typeof amountWei!=='bigint'||amountWei<=0n)throw new Error('No ETH is available to distribute yet.');
  if(typeof minPayoutWei!=='bigint'||minPayoutWei<0n)throw new Error('Invalid minimum payout.');
  const excluded=new Set((Array.isArray(exclude)?exclude:[]).filter(isAddress).map(address=>getAddress(address.toLowerCase())));
  const merged=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    if(!isAddress(String(entry?.address||''),{strict:false}))continue;
    const balance=BigInt(entry.balance||0n);
    if(balance<=0n)continue;
    const address=getAddress(String(entry.address).toLowerCase());
    merged.set(address,(merged.get(address)||0n)+balance);
  }
  const wallets=[...merged].map(([address,balance])=>({address,balance})).filter(wallet=>!excluded.has(wallet.address));
  const dropped=[];
  if(!wallets.length)throw new Error('No eligible holder balances were returned for this snapshot.');
  // Calculate everyone's share before applying the transaction limit or minimum.
  // Unselected shares stay in the vault instead of being reassigned to other holders.
  wallets.sort((a,b)=>a.balance>b.balance?-1:a.balance<b.balance?1:0);
  const covered=wallets.reduce((sum,wallet)=>sum+wallet.balance,0n);
  if(covered<=0n)throw new Error('No eligible holder balances were returned for this snapshot.');
  const payouts=wallets.map(wallet=>({address:wallet.address,amount:amountWei*wallet.balance/covered,remainder:amountWei*wallet.balance%covered}));
  const floorTotal=payouts.reduce((sum,payout)=>sum+payout.amount,0n);
  let leftover=amountWei-floorTotal;
  if(leftover<0n)throw new Error('Payout computation failed.');
  if(leftover>0n){ // Largest-remainder: distribute single wei to the largest fractional remainders.
    const order=[...payouts].sort((a,b)=>(b.remainder>a.remainder?1:b.remainder<a.remainder?-1:a.address<b.address?-1:1)).slice(0,Number(leftover));
    if(BigInt(order.length)!==leftover)throw new Error('Payout rounding could not be resolved.');
    for(const payout of order)payout.amount+=1n;
  }
  const distributed=payouts.reduce((sum,payout)=>sum+payout.amount,0n);
  if(distributed!==amountWei)throw new Error('Payout computation failed.');
  const selected=payouts.filter((payout,index)=>{
    const reason=index>=200?'Beyond the per-round wallet limit.':payout.amount<minPayoutWei?'Payout below the minimum for this round.':null;
    if(reason)dropped.push({address:payout.address,reason,amount:String(payout.amount)});
    return !reason;
  }).map(({address,amount})=>({address,amount}));
  if(!selected.length)throw new Error('Every balance in this snapshot is below the minimum payout.');
  return {payouts:selected,snapshotAmount:amountWei,coveredBalance:String(covered),eligible:wallets.length,sampled:(Array.isArray(entries)?entries:[]).length,included:selected.length,dropped,minPayoutWei:String(minPayoutWei)};
}
export function selectHoldersPayout(round,excludedRecipients=[]){
  if(!Array.isArray(excludedRecipients)||excludedRecipients.length>200)throw new Error('Choose up to 200 payout recipients to leave out.');
  const excluded=new Set(excludedRecipients.map(address=>{
    if(!isAddress(String(address),{strict:false}))throw new Error('Choose a valid payout recipient to leave out.');
    const normalized=getAddress(String(address).toLowerCase());
    if(!round.payouts.some(payout=>payout.address===normalized))throw new Error('This recipient is not in the reviewed payout snapshot.');
    return normalized;
  }));
  const payouts=round.payouts.filter(payout=>!excluded.has(payout.address)),total=payouts.reduce((sum,payout)=>sum+payout.amount,0n);
  return {payouts,total,retained:round.snapshotAmount-total,excludedRecipients:[...excluded]};
}
export const holdersExclusions=({curve,poolManager,vault})=>{
  const list=[curve,poolManager,vault].filter(isAddress);
  if(!list.length)throw new Error('Vault and launch addresses are required.');
  return list;
};
export function describeHoldersRound(result,{amountWei}={}){
  if(!result||!Array.isArray(result.payouts))throw new Error('Invalid payout result.');
  return {included:result.included,coveredBalance:result.coveredBalance,droppedCount:result.dropped.length,totalWei:amountWei!=null?String(amountWei):null};
}
export {sameAddress};
