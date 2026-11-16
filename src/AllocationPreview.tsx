import {useId,useState} from 'react';
import {formatEther,parseEther} from 'viem';
import './allocation-preview.css';

export function previewAllocation(amount:string,reserveBps:number){
  if(!/^\d+(?:\.\d{0,18})?$/.test(amount)||!Number.isInteger(reserveBps)||reserveBps<0||reserveBps>10000)return null;
  const total=parseEther(amount),reserve=total*BigInt(reserveBps)/10000n;
  return{project:formatEther(total-reserve),reserve:formatEther(reserve)};
}

export function AllocationPreview({reserveBps}:{reserveBps:number}){
  const [amount,setAmount]=useState('1'),inputId=useId(),noteId=useId(),errorId=useId();
  const allocation=previewAllocation(amount,reserveBps),invalid=amount!==''&&!allocation;
  return <details className="allocation-preview">
    <summary>Preview allocation <span>Example only</span></summary>
    <div className="allocation-preview-body">
      <p>See how example ETH received by your vault would follow the split above.</p>
      <label className="field" htmlFor={inputId}><span>Example revenue in ETH</span><input id={inputId} type="number" inputMode="decimal" min="0" step="any" value={amount} aria-invalid={invalid} aria-describedby={invalid?`${noteId} ${errorId}`:noteId} onChange={event=>setAmount(event.target.value)}/></label>
      {invalid&&<p id={errorId} className="field-error">Enter a positive amount or zero, using up to 18 decimal places.</p>}
      <dl className="allocation-preview-results">
        <div><dt>Project receives <span>{100-reserveBps/100}%</span></dt><dd><output htmlFor={inputId}>{allocation?.project??'—'}</output><span>{allocation?'ETH':''}</span></dd></div>
        <div><dt>Reserve receives <span>{reserveBps/100}%</span></dt><dd><output htmlFor={inputId}>{allocation?.reserve??'—'}</output><span>{allocation?'ETH':''}</span></dd></div>
      </dl>
      <p id={noteId} className="allocation-preview-note">Illustrative amounts, not earnings. This preview does not move funds or change your split.</p>
    </div>
  </details>;
}
