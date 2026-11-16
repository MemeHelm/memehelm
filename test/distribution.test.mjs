import test from 'node:test';
import assert from 'node:assert/strict';
import {computeHoldersPayout,normalizeHolderBalances,selectHoldersPayout,holdersExclusions,MIN_HOLDERS_PAYOUT_WEI} from '../shared/distribution.mjs';

const a='0x1111111111111111111111111111111111111111',b='0x2222222222222222222222222222222222222222',c='0x3333333333333333333333333333333333333333';
const entry=(address,balance)=>({address,balance});
const wallet=i=>'0x'+(i+1).toString(16).padStart(40,'0');

test('holder payouts are pro-rata within the snapshot and conserve the round total',()=>{
  const round=computeHoldersPayout({entries:[entry(a,'700'),entry(b,'300')],amountWei:1000n,minPayoutWei:1n});
  assert.deepEqual(round.payouts.map(payout=>payout.amount),[700n,300n]);
  assert.equal(round.coveredBalance,'1000');assert.equal(round.included,2);assert.equal(round.sampled,2);assert.equal(round.dropped.length,0);
  assert.equal(round.payouts.reduce((sum,payout)=>sum+payout.amount,0n),1000n);
});
test('largest remainder assigns leftover wei deterministically',()=>{
  const round=computeHoldersPayout({entries:[entry(a,'1'),entry(b,'1'),entry(c,'1')],amountWei:100n,minPayoutWei:1n});
  const amounts=round.payouts.map(payout=>payout.amount).sort((x,y)=>x>y?1:-1);
  assert.deepEqual(amounts,[33n,33n,34n]);
  assert.equal(round.payouts.reduce((sum,payout)=>sum+payout.amount,0n),100n);
});
test('excluded protocol wallets do not participate in the round',()=>{
  const curve='0x4444444444444444444444444444444444444444',vault='0x5555555555555555555555555555555555555555';
  const round=computeHoldersPayout({entries:[entry(curve,'900'),entry(a,'60'),entry(b,'40')],amountWei:100n,exclude:[curve,vault],minPayoutWei:1n});
  assert.equal(round.included,2);
  assert.deepEqual(round.payouts.map(payout=>payout.amount),[60n,40n]);
});
test('wallets below the minimum leave their share in the vault without increasing another payout',()=>{
  const round=computeHoldersPayout({entries:[entry(a,'1000'),entry(b,'1')],amountWei:1000n,minPayoutWei:5n});
  assert.equal(round.included,1);
  assert.deepEqual(round.payouts.map(payout=>payout.amount),[999n]);
  assert.equal(selectHoldersPayout(round).retained,1n);
  assert.equal(round.dropped.length,1);
  assert.match(round.dropped[0].reason,/below the minimum/);
});
test('beyond the per-round wallet limit only the largest balances participate',()=>{
  const entries=Array.from({length:205},(_,i)=>entry(wallet(i),'1'));
  const round=computeHoldersPayout({entries,amountWei:1000n,minPayoutWei:1n});
  assert.equal(round.included,200);assert.equal(round.dropped.length,5);
  assert.equal(round.payouts.reduce((sum,payout)=>sum+payout.amount,0n),980n);
  assert.equal(selectHoldersPayout(round).retained,20n);
  assert.match(round.dropped[0].reason,/per-round wallet limit/);
});

test('explicit exclusions preserve every original share and leave excluded ETH in the vault',()=>{
 const round=computeHoldersPayout({entries:[entry(a,'70'),entry(b,'20'),entry(c,'10')],amountWei:1000n,minPayoutWei:1n});
 const selected=selectHoldersPayout(round,[b]);
 assert.deepEqual(selected.payouts,[{address:a,amount:700n},{address:c,amount:100n}]);
 assert.equal(selected.total,800n);assert.equal(selected.retained,200n);
 assert.deepEqual(selectHoldersPayout(round,[]).payouts,round.payouts);
 assert.equal(selectHoldersPayout(round,[a,b,c]).total,0n);
 assert.throws(()=>selectHoldersPayout(round,['0x'+'4'.repeat(40)]),/not in the reviewed payout snapshot/);
});
test('identical duplicate balances are deduplicated without increasing a share',()=>{
  const round=computeHoldersPayout({entries:[entry(a,'50'),entry(a,'50'),entry(a,'50'),entry(b,'50')],amountWei:100n,minPayoutWei:1n});
  assert.equal(round.payouts.length,2);
  assert.deepEqual(round.payouts.map(payout=>payout.amount),[50n,50n]);
  assert.equal(round.coveredBalance,'100');assert.equal(round.sampled,2);assert.equal(round.returned,4);assert.equal(round.duplicateRows,2);
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'50'),entry(a,'51'),entry(b,'50')],amountWei:100n,minPayoutWei:1n}),/Conflicting balances/);
});

test('invalid rows cannot silently shrink the denominator or coerce a missing balance to zero',()=>{
  for(const balance of [undefined,null,false,0,1,1.5,'',' ','-1','1.5','1e6','0x10',(1n<<256n).toString()]){
    assert.throws(()=>computeHoldersPayout({entries:[entry(a,'100'),entry(b,balance)],amountWei:100n,minPayoutWei:1n}),/holder balance/i);
  }
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'100'),entry('not-a-wallet','100')],amountWei:100n,minPayoutWei:1n}),/holder address/i);
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'0'),entry(b,0n)],amountWei:100n,minPayoutWei:1n}),/No eligible holder balances/);
  const max=((1n<<256n)-1n).toString();assert.equal(normalizeHolderBalances([entry(a,max)]).holders[0].balance,max);
});

test('sample count and denominator distinguish valid observed balances from excluded protocol addresses',()=>{
  const round=computeHoldersPayout({entries:[entry(a,'700'),entry(b,'300'),entry(c,'0'),entry(a,'700')],amountWei:1000n,exclude:[a],minPayoutWei:1n});
  assert.equal(round.sampled,2);assert.equal(round.returned,4);assert.equal(round.duplicateRows,1);assert.equal(round.eligible,1);
  assert.equal(round.coveredBalance,'300');assert.deepEqual(round.payouts,[{address:b,amount:1000n}]);
});

test('input row order cannot change tied balances selected at the 200-wallet limit',()=>{
  const entries=Array.from({length:205},(_,i)=>entry(wallet(i),'1'));
  const input={amountWei:1000n,minPayoutWei:1n},first=computeHoldersPayout({...input,entries}),reversed=computeHoldersPayout({...input,entries:[...entries].reverse()});
  assert.deepEqual(first.payouts,reversed.payouts);assert.deepEqual(first.dropped,reversed.dropped);
});
test('rounds refuse unusable inputs instead of inventing shares',()=>{
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'1')],amountWei:0n}),/No ETH is available/);
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'1')],amountWei:100}),/No ETH is available/);
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'1')],amountWei:100n,exclude:[a]}),/No eligible holder balances/);
  assert.throws(()=>computeHoldersPayout({entries:[entry(a,'1'),entry(b,'1')],amountWei:100n,minPayoutWei:51n}),/below the minimum payout/);
  const defaulted=computeHoldersPayout({entries:[entry(a,MIN_HOLDERS_PAYOUT_WEI.toString())],amountWei:MIN_HOLDERS_PAYOUT_WEI});
  assert.equal(defaulted.included,1);
});
test('the exclusion list always covers curve, pool manager and vault',()=>{
  const curve='0x4444444444444444444444444444444444444444',manager='0x8366a39cc670b4001a1121b8f6a443a643e40951',vault='0x5555555555555555555555555555555555555555';
  assert.deepEqual(holdersExclusions({curve,poolManager:manager,vault}),[curve,manager,vault]);
  assert.throws(()=>holdersExclusions({}),/required/);
});
