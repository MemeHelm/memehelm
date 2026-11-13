import {useRef,useState} from 'react';
import {DraftText} from './DraftText';
import type {XPost,ManualReport} from './community-types';

const date=(value:string)=>new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
const localDate=(value:string)=>{const time=new Date(value);return new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const labels={likes:'Likes',replies:'Replies',reposts:'Reposts',quotes:'Quotes',views:'Views'} as const;
type Perform=(suffix:string,input:unknown,message:string)=>Promise<boolean>;

export function ManualPostRecord({post,busy,pending,perform,onDirty}:{post:XPost;busy:boolean;pending:boolean;perform:Perform;onDirty:(value:boolean)=>void}){
  const publication=post.manualPublication,target=publication||post.receipt;
  const [mode,setMode]=useState<'link'|'results'|null>(null),[url,setUrl]=useState(publication?.url||''),[publishedAt,setPublishedAt]=useState(publication?.publishedAt?localDate(publication.publishedAt):''),[notes,setNotes]=useState(''),[confirm,setConfirm]=useState(false),[observedAt,setObservedAt]=useState(()=>localDate(new Date().toISOString())),[counts,setCounts]=useState<Record<keyof ManualReport['counts'],string>>({likes:'',replies:'',reposts:'',quotes:'',views:''});
  const area=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
  function open(next:'link'|'results'){
    setMode(next);setUrl(publication?.url||'');setPublishedAt(publication?.publishedAt?localDate(publication.publishedAt):'');setCounts({likes:'',replies:'',reposts:'',quotes:'',views:''});setObservedAt(localDate(new Date().toISOString()));setNotes(next==='link'?publication?.notes||'':'');setConfirm(false);onDirty(true);
    requestAnimationFrame(()=>area.current?.querySelector<HTMLInputElement>('form input')?.focus());
  }
  function cancel(){setMode(null);onDirty(false);requestAnimationFrame(()=>heading.current?.focus());}
  const reports=post.manualReports||[];
  return <section className="community-manual-record" ref={area}>
    <div className="community-section-title"><div><h4 tabIndex={-1} ref={heading}>{target?'Post journal':'Already published it on X?'}</h4><p className="data-note">{target?'Your links and results stay private and inform the next AI review.':'Save the link after you publish in X, then track what happened.'}</p></div><span className="community-status">Recorded by you</span></div>
    {publication&&<div className="community-publication"><a className="text-button" href={publication.url} target="_blank" rel="noreferrer">Open recorded post ↗</a><p className="data-note">Not verified with X · Saved {date(publication.recordedAt)}</p>{publication.publishedAt&&<p className="data-note">Publication time you supplied: {date(publication.publishedAt)}</p>}{publication.notes&&<DraftText text={publication.notes}/>}</div>}
    {!mode?<div className="button-row">{!post.receipt&&<button className="button secondary" disabled={busy} onClick={()=>open('link')}>{publication?'Edit recorded link':'Record published post'}</button>}{target&&<button className="button secondary" disabled={busy} onClick={()=>open('results')}>Record results</button>}</div>:<form onSubmit={async e=>{
      e.preventDefault();const input=mode==='link'?{action:'record',url,publishedAt:publishedAt?new Date(publishedAt).toISOString():null,notes,confirm}:{action:'report',counts:Object.fromEntries(Object.entries(counts).map(([key,value])=>[key,value===''?null:Number(value)])),observedAt:new Date(observedAt).toISOString(),notes};
      if(await perform('/x/'+post.id,{...input,revision:post.revision},mode==='link'?'Published post link recorded. It has not been verified with X.':'Your results were recorded for the next AI review.')){cancel();}
    }}><fieldset disabled={busy}>
      <h4>{mode==='link'?(publication?'Edit recorded link':'Record a published post'):'Record your results'}</h4>
      {mode==='link'?<>
        <label className="field"><span>Published X post link</span><input required type="url" maxLength={500} placeholder="https://x.com/yourname/status/…" value={url} onChange={e=>{setUrl(e.target.value);setConfirm(false);}}/></label>
        <label className="field"><span>Publication time · your local time (optional)</span><input type="datetime-local" value={publishedAt} onChange={e=>{setPublishedAt(e.target.value);setConfirm(false);}}/></label>
        <label className="field"><span>Publication notes (optional)</span><textarea rows={3} maxLength={2000} value={notes} onChange={e=>{setNotes(e.target.value);setConfirm(false);}}/></label>
        <p className="data-note">We save the link you provide. The author, published text and time are not checked with X.{publication?' Changing the link keeps older results attached to their original post.':''}</p>
        <label className="checkbox"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>I opened this link and checked that it is the post I want to record.</span></label>
      </>:<>
        <a className="text-button" href={target?.url} target="_blank" rel="noreferrer">Open post to check results ↗</a>
        <p className="data-note">Enter only what you can see. Leave unknown counts blank; enter 0 only when you observed zero.</p>
        <div className="community-count-inputs">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><label className="field" key={key}><span>{labels[key]} (optional)</span><input type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" value={counts[key]} onChange={e=>setCounts({...counts,[key]:e.target.value})}/></label>)}</div>
        <label className="field"><span>Observed at · your local time</span><input required type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
        <label className="field"><span>What happened? What did you learn? (optional)</span><textarea rows={4} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <p className="data-note">These are your observations, not data read from X. The latest 30 entries are kept. Add a new entry to correct an earlier one.</p>
      </>}
      <div className="button-row"><button className="button primary" disabled={busy||mode==='link'&&!confirm}>{pending?'Saving…':mode==='link'?'Save post link':'Save results'}</button><button type="button" className="text-button" onClick={cancel}>Discard changes</button></div>
    </fieldset></form>}
    {reports.length>0&&<div className="community-report-history"><h4>Result history</h4>{reports.map(report=><article key={report.id}><div className="community-section-title"><time dateTime={report.observedAt}>{date(report.observedAt)}</time><span className="community-status">Your observation</span></div><p className="data-note">Not verified with X · Saved {date(report.recordedAt)}</p>{report.postId!==(publication?.postId||post.receipt?.id)&&<a className="text-button" href={report.url} target="_blank" rel="noreferrer">Results for a previously recorded link ↗</a>}<dl>{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{report.counts[key]??'—'}</dd></div>)}</dl>{report.notes&&<DraftText text={report.notes}/>}</article>)}</div>}
  </section>;
}
