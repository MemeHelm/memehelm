import {formatUnits} from 'viem';
import {utcDateTime} from './time';

export type PayoutSampleReview={
  mode:'sample';
  coverage:'partial'|'unknown';
  evidence:{source:string|null;checkedAt:string|null;snapshotBlock:string|null;snapshotBlockHash:string|null;paginationComplete:boolean|null;balanceUnit:'token-base-units';tokenDecimals:number|null;sampled:number;returned:number;duplicateRows:number;denominatorBalance:string;protocolExclusions:string[];calculationVersion:string};
  outsideSample:string;
  unallocatedIncoming?:string;
  additionalFundsNote?:string;
};

export function PayoutCoverage({review,symbol}:{review:PayoutSampleReview|undefined;symbol:string}){
  const evidence=review?.evidence;
  const decimals=evidence?.tokenDecimals;
  let denominator=evidence?.denominatorBalance?`${evidence.denominatorBalance} base units`:'Not available';
  if(evidence&&Number.isInteger(decimals)&&decimals!==null&&decimals!==undefined&&decimals>=0&&decimals<=255){
    try{denominator=`${formatUnits(BigInt(evidence.denominatorBalance),decimals)} ${symbol}`;}catch{/* Missing evidence is never a zero balance. */}
  }
  return <section className="payout-coverage" aria-label="Payout sample coverage">
    <div className="payout-coverage-title"><h3>This is a sample payout.</h3><span className="badge tone-neutral">{review?.coverage==='partial'?'Partial coverage':'Coverage unknown'}</span></div>
    <p>Only balances returned by the explorer are used to calculate this round. Wallets outside this sample receive no payout, and no amount is reserved for them.</p>
    <dl className="payout-evidence">
      <div><dt>Balance source</dt><dd>{evidence?.source||'Not available'}</dd></div>
      <div><dt>Balances read</dt><dd>{evidence?.checkedAt?utcDateTime(evidence.checkedAt):'Not established'}</dd></div>
      <div><dt>Fixed snapshot block</dt><dd>{evidence?.snapshotBlock??'Not established'}</dd></div>
      <div><dt>Explorer pagination</dt><dd>{evidence?.paginationComplete===false?'More pages not included':evidence?.paginationComplete===true?'No more pages reported':'Not established'}</dd></div>
    </dl>
    <details className="payout-calculation"><summary>How this round is calculated</summary>
      <dl className="payout-evidence">
        <div><dt>Eligible sampled balance</dt><dd>{denominator}</dd></div>
        <div><dt>Returned balance rows</dt><dd>{evidence?.returned??'Not available'}</dd></div>
        <div><dt>Unique positive balances</dt><dd>{evidence?.sampled??'Not available'}</dd></div>
        <div><dt>Duplicate rows removed</dt><dd>{evidence?.duplicateRows??'Not available'}</dd></div>
      </dl>
      <p>Each amount uses the wallet’s share of the eligible sampled balance, after protocol addresses are excluded. It is not a share of every token holder. Amounts below the minimum, beyond the recipient limit and shares you explicitly leave out remain in the vault.</p>
      <p>Leaving out a recipient does not increase another amount. These remaining funds are not reserved onchain for any wallet. A final explorer page alone does not establish a complete fixed-block snapshot.</p>
      {!!evidence?.protocolExclusions.length&&<p className="data-note">Excluded protocol addresses: <span className="address-value">{evidence.protocolExclusions.join(', ')}</span></p>}
    </details>
    {review?.unallocatedIncoming&&Number(review.unallocatedIncoming)>0&&<p className="payout-additional-funds">{review.unallocatedIncoming} ETH arrived after this review and is not allocated to this round.</p>}
  </section>;
}
