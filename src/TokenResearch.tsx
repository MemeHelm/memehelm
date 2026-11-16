import {useEffect,useId,useState} from 'react';
import {utcDateTime} from './time';
import {api} from './api';
import './token-research.css';

type Coverage={fromBlock?:string|null;toBlock?:string|null;partial?:boolean;scope:string};
type Evidence={id:string;kind:string;label:string;source:string;timestamp:string|null;checkedAt:string;coverage:Coverage;transactionHash:string|null;url:string};
type Launch={token:string;name:string|null;symbol:string|null;timestamp:string|null;blockNumber:string;current:boolean;evidenceId:string};
type DirectTrade={kind:string;amount:string;value:string;currency:string|null;timestamp:string|null;evidenceId:string};
type ReadStatus='available'|'unavailable'|'outside-scope';
type Research={address:string;checkedAt:string;registration:{status:ReadStatus;registered:boolean|null;deployer:string|null};launchHistory:{status:ReadStatus;count:number|null;items:Launch[];truncated?:boolean;coverage:Coverage|null;message:string|null};creatorTrading:{status:ReadStatus;count:number|null;buys:number|null;sells:number|null;items:DirectTrade[];coverage:Coverage|null;poolEventsNotAttributed?:number;message:string};fundingRelationships:{status:'unknown';message:string};evidence:Evidence[];limitations:string[]};
const explorer='https://robinhoodchain.blockscout.com';
const short=(value:string)=>value.slice(0,6)+'…'+value.slice(-4);
const time=(value:string|null)=>value?utcDateTime(value,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Time unavailable';
const number=(value:string)=>{const n=Number(value);return Number.isFinite(n)?n.toLocaleString('en-US',{maximumSignificantDigits:6}):'Unavailable';};

function CoverageNote({value}:{value:Coverage|null}){return value?<p className="research-coverage">{value.fromBlock!=null&&value.toBlock!=null&&<>Blocks {value.fromBlock}–{value.toBlock}. </>}{value.partial&&<strong>Partial coverage. </strong>}{value.scope}</p>:null;}
function Receipt({evidence}:{evidence:Evidence|undefined}){return evidence?<a className="research-receipt" href={evidence.url} title={evidence.source+' · '+time(evidence.timestamp)} target="_blank" rel="noreferrer" aria-label={evidence.label+' — open transaction'}>Receipt<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a>:<span className="research-unavailable">Receipt unavailable</span>;}

export function TokenResearch({address}:{address:string}){
  const heading=useId(),[savedReport,setReport]=useState<Research|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[version,setVersion]=useState(0);
  const report=savedReport?.address.toLowerCase()===address.toLowerCase()?savedReport:null;
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    api<Research>('/market/tokens/'+address+'/research'+(version?'?refresh=1':''),undefined,controller.signal).then(result=>{if(!controller.signal.aborted)setReport(result);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||'Research could not be loaded. Please try again.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[address,version]);
  // A changed address gets its own instance in TokenDetail; retain evidence during same-token retries.
  const evidence=new Map(report?.evidence.map(item=>[item.id,item])||[]),history=report?.launchHistory,trading=report?.creatorTrading;
  return <section className="token-research" aria-labelledby={heading} aria-busy={loading}>
    <header className="research-heading"><div><h3 id={heading}>Follow the launching wallet</h3><p>Trace official launches and direct curve trades back to their receipts.</p></div><button type="button" className="button secondary" disabled={loading} onClick={()=>setVersion(value=>value+1)}>{loading?'Reading evidence…':error?'Retry research':'Refresh research'}</button></header>
    {error&&<div className="research-error" role="alert"><strong>Research could not be refreshed.</strong><p>{error}</p>{report&&<p>The last successful evidence remains below. Checked {time(report.checkedAt)}.</p>}</div>}
    {loading&&!report?<div className="research-loading" role="status"><p>Reading the launch registry, recent factory events and curve receipts…</p><div/><div/></div>:!report?<p className="research-empty">No research could be read. Retry to check the available sources.</p>:<>
      <div className="research-identity"><span>Launching wallet</span>{report.registration.deployer?<a href={explorer+'/address/'+report.registration.deployer} target="_blank" rel="noreferrer">{short(report.registration.deployer)}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a>:<strong>{report.registration.registered===false?'Outside this registry':'Could not be verified'}</strong>}<span>Checked {time(report.checkedAt)}</span></div>
      <p className="research-note">Wallet funding sources and common ownership remain unverified.</p>
      <section className="research-section"><header><h4>Recent official launches</h4><span>{history?.status==='available'?`${history.count}${history.coverage?.partial?'+':''} found in coverage`:history?.status==='outside-scope'?'Outside coverage':'Unavailable'}</span></header><CoverageNote value={history?.coverage||null}/>
        {history?.message&&<p className="research-note">{history.message}</p>}
        {history?.items.length?<ol className="research-launches">{history.items.map(item=><li key={item.token}><div><a className="research-token-link" href={'#app/discover/'+item.token}>{item.name||short(item.token)}{item.symbol&&<span>${item.symbol}</span>}</a><p>{item.current?'This token · ':''}{time(item.timestamp)} · block {item.blockNumber}</p></div><Receipt evidence={evidence.get(item.evidenceId)}/></li>)}</ol>:history?.status==='available'?<p className="research-empty">No launches from this wallet were found in the covered blocks. Older launches and other factories were not checked.</p>:null}
        {history?.truncated&&<p className="research-note">The 12 most recent launch receipts are shown.</p>}
      </section>
      <section className="research-section"><header><h4>Direct trades in this token</h4><span>{trading?.status==='available'?`${trading.buys} buys · ${trading.sells} sells`:trading?.status==='outside-scope'?'Outside coverage':'Unavailable'}</span></header><CoverageNote value={trading?.coverage||null}/><p className="research-note">{trading?.message}</p>
        {trading?.items.length?<ol className="research-trades">{trading.items.map((item,index)=><li key={item.evidenceId}><div><strong>{item.kind==='buy'?'Bought':'Sold'} {number(item.amount)} tokens</strong><p>{number(item.value)} {item.currency||'quote units'} · {time(item.timestamp)}</p></div><Receipt evidence={evidence.get(item.evidenceId)}/></li>)}</ol>:trading?.status==='available'?<p className="research-empty">No directly attributable curve trades were found among the returned events. This does not prove the creator has never traded.</p>:null}
        {!!trading?.poolEventsNotAttributed&&<p className="research-note">{trading.poolEventsNotAttributed} pool events were excluded from creator attribution because their sender can be a router.</p>}
      </section>
      <details className="research-method"><summary>Sources and research limits</summary><p className="research-note">{report.fundingRelationships.message}</p><ul>{report.limitations.map(item=><li key={item}>{item}</li>)}</ul><ul className="research-sources">{report.evidence.filter(item=>item.kind==='registry').map(item=><li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.source}</a><span>Read {time(item.timestamp||item.checkedAt)}</span></li>)}</ul><p className="research-note">Every receipt above points to an onchain event. Names and tickers are token-provided metadata and are not endorsements.</p></details>
    </>}
  </section>;
}
