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
  let wallets=[...merged].map(([address,balance])=>({address,balance})).filter(wallet=>!excluded.has(wallet.address));
  let dropped=[];
  if(!wallets.length)throw new Error('No eligible holder balances were returned for this snapshot.');
  // The vault pays at most 200 wallets per round; beyond that, only the largest balances participate.
  wallets.sort((a,b)=>a.balance>b.balance?-1:a.balance<b.balance?1:0);
  if(wallets.length>200){dropped.push(...wallets.slice(200).map(wallet=>({address:wallet.address,reason:'Beyond the per-round wallet limit.'})));wallets=wallets.slice(0,200);}
  // Wallets whose floor payout is under the minimum are excluded and the round is recomputed,
  // so gas never exceeds the value moved. The loop converges: each pass removes at least one wallet.
  for(let pass=0;pass<Math.min(50,wallets.length+1);pass++){
    const covered=wallets.reduce((sum,wallet)=>sum+wallet.balance,0n);
    if(covered<=0n)throw new Error('No eligible holder balances were returned for this snapshot.');
    const floors=wallets.map(wallet=>amountWei*wallet.balance/covered);
    const keep=[],remove=[];
    for(let index=0;index<wallets.length;index++)(floors[index]>=minPayoutWei?keep:remove).push(index);
    if(!remove.length)break;
    dropped=[...dropped,...remove.map(index=>({address:wallets[index].address,reason:'Payout below the minimum for this round.'}))];
    wallets=keep.map(index=>wallets[index]);
    if(!wallets.length)throw new Error('Every balance in this snapshot is below the minimum payout.');
  }
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
  return {payouts:payouts.map(({address,amount})=>({address,amount})),coveredBalance:String(covered),sampled:(Array.isArray(entries)?entries:[]).length,included:payouts.length,dropped};
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
