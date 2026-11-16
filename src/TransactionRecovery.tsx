import {useEffect,useState} from 'react';
import {utcDateTime} from './time';
import {completeTransaction,pendingTransactions,resumeTransaction} from './wallet';
import type {StoredTransaction} from './wallet';
import {Arrow} from './Brand';

export function TransactionRecovery({wallet,resolved}:{wallet:string;resolved:(record:StoredTransaction)=>Promise<void>}){
  const[records,setRecords]=useState<StoredTransaction[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[hashes,setHashes]=useState<Record<string,string>>({}),[checked,setChecked]=useState<Record<string,boolean>>({});
  useEffect(()=>{const reload=()=>setRecords(wallet?pendingTransactions(wallet):[]);reload();window.addEventListener('memehelm-transactions-changed',reload);window.addEventListener('storage',reload);return()=>{window.removeEventListener('memehelm-transactions-changed',reload);window.removeEventListener('storage',reload);};},[wallet]);
  async function inspect(record:StoredTransaction){
    if(busy)return;setBusy(record.id);setError('');
    try{const result=await resumeTransaction(wallet,record.id,hashes[record.id]?.trim()||undefined);if(result.status==='confirmed'){await resolved(result);completeTransaction(wallet,result.id);}else if(result.status==='reverted'||result.status==='replaced'){setError(result.error||'The transaction reverted. The reviewed action did not complete; network gas may have been spent.');}else setError(result.error||'This transaction is still pending. Check it again later; no new transaction was sent.');}
    catch(reason:any){setError(reason.message||'Confirmation is temporarily unavailable. Your recovery record is still here.');}
    finally{setBusy('');}
  }
  if(!wallet||!records.length)return null;
  return <aside className={`transaction-recovery ${open?'is-open':''}`} aria-label="Transaction recovery">
    <button className="transaction-recovery-toggle" aria-expanded={open} aria-controls="transaction-recovery-list" onClick={()=>setOpen(!open)}><span>{records.length} transaction{records.length===1?'':'s'} to check</span><span>{open?'Hide':'Review'} <Arrow/></span></button>
    {open&&<div id="transaction-recovery-list" className="transaction-recovery-list"><p>Check an earlier request before sending it again. Status checks do not request a wallet signature.</p>{error&&<p className="notice error" role="alert">{error}</p>}{records.map(record=><section key={record.id}>
      <strong>{record.intent.label}</strong><small>{utcDateTime(record.submittedAt)} · {({wallet:'Wallet request',submitted:'Submitted',confirmed:'Confirmed — finish updating workspace',reverted:'Reverted',replaced:'Replaced or cancelled'})[record.status]}</small>
      {record.hash?<a className="address-value" href={`https://robinhoodchain.blockscout.com/tx/${record.hash}`} target="_blank" rel="noreferrer">{record.hash} <Arrow diagonal/></a>:<label>Transaction hash from your wallet<input aria-label={`Transaction hash for ${record.intent.label}`} value={hashes[record.id]||''} onChange={event=>setHashes({...hashes,[record.id]:event.target.value})} placeholder="0x…"/></label>}
      {record.replacementHash&&<a href={`https://robinhoodchain.blockscout.com/tx/${record.replacementHash}`} target="_blank" rel="noreferrer">View replacement <Arrow diagonal/></a>}
      <button className="button secondary" disabled={!!busy||(!record.hash&&!hashes[record.id])||record.status==='reverted'||record.status==='replaced'} onClick={()=>inspect(record)}>{busy===record.id?'Checking…':record.status==='confirmed'?'Finish workspace update':'Check transaction'} <Arrow/></button>
      <details><summary>Clear this local record</summary><p>Clearing does not cancel an onchain transaction. A pending request may still complete.</p><label className="checkbox"><input type="checkbox" checked={!!checked[record.id]} onChange={event=>setChecked({...checked,[record.id]:event.target.checked})}/><span>I checked my wallet and the explorer and understand its status before making another request.</span></label><button className="text-button" disabled={!!busy||!checked[record.id]} onClick={()=>completeTransaction(wallet,record.id)}>Clear recovery record</button></details>
    </section>)}</div>}
  </aside>;
}
