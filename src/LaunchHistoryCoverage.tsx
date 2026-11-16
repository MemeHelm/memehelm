import {utcDateTime} from './time';
import './launch-history.css';

export type LaunchHistoryRange={
  fromBlock:string|null;toBlock:string|null;targetBlock:string|null;
  bootstrapFromBlock?:string|null;count?:number;partial:boolean;status:string;
  missingRanges?:{fromBlock:string;toBlock:string}[];
  lastSuccessAt?:string|null;verifiedAt?:string|null;
  reorg?:{kind:string;fromBlock:string;detectedAt:string}|null;
  invalidated?:boolean;
};

export function LaunchHistoryCoverage({coverage,stale=false,metadataPartial=false,shown}:{coverage:LaunchHistoryRange|null;stale?:boolean;metadataPartial?:boolean;shown:number}){
  const covered=coverage?.fromBlock!=null&&coverage.toBlock!=null;
  const pending=!!coverage?.partial||coverage?.status==='syncing'||coverage?.status==='rebuilding';
  return <section className="launch-history-coverage" aria-label="Launch history coverage">
    <div className="launch-history-heading"><strong>History coverage</strong><span>{coverage?.invalidated?'Chain history changed':!covered?'Not available':stale?'Saved results':pending?'Partial history':'Observed history'}</span></div>
    <p>{coverage?.invalidated?'Previous results have been withdrawn while the changed block range is checked again.':!covered?'The covered block range could not be established.':stale?'These saved launches have not been checked against the latest chain state.':pending?'Some blocks have not been read yet. More launches may appear as the missing history is recovered.':'Launches from the covered block range are shown below.'} Earlier launches may be outside this history. Recent blocks can change.</p>
    {covered&&<details><summary>View covered blocks</summary><dl>
      <div><dt>Covered range</dt><dd>{coverage.fromBlock}–{coverage.toBlock}</dd></div>
      <div><dt>Launch records</dt><dd>{shown} shown{typeof coverage.count==='number'?` · ${coverage.count} stored`:''}</dd></div>
      {coverage.targetBlock&&<div><dt>Latest observed block</dt><dd>{coverage.targetBlock}</dd></div>}
      <div><dt>Last history read</dt><dd>{coverage.lastSuccessAt?utcDateTime(coverage.lastSuccessAt):'Unavailable'}</dd></div>
      <div><dt>Last chain check</dt><dd>{coverage.verifiedAt?utcDateTime(coverage.verifiedAt):'Unavailable'}</dd></div>
      {!!coverage.missingRanges?.length&&<div><dt>Missing blocks</dt><dd>{coverage.missingRanges.map(range=>`${range.fromBlock}–${range.toBlock}`).join(', ')}</dd></div>}
    </dl><p>Official pons v2 factory on Robinhood Chain. This is observed history, not an all-time or final record.</p></details>}
    {metadataPartial&&<p>Some token names or images are unavailable. Their launch receipts are retained.</p>}
  </section>;
}
