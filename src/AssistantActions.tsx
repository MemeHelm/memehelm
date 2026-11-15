import {useEffect,useRef,useState} from 'react';
import {api,ApiError,resetAIRequest} from './api';
import {AIRequestRecovery} from './AIRequestRecovery';
import {DraftText} from './DraftText';
import './assistant-actions.css';

type CalendarItem={title:string;content:string;channel:'x'|'discord'|'telegram'|'project';scheduledAt:string|null};
type EventPayload={title:string;description:string;startsAt:string|null;endsAt:string|null;capacity:number|null;url?:string};
export type AssistantAction={id:string;projectId:string;chatId?:string|null;kind:'calendar'|'event'|'distribution';title:string;rationale:string;status:'proposed'|'applied'|'dismissed';revision:number;payload:{items?:CalendarItem[]}&Partial<EventPayload>;createdAt:string;appliedAt?:string;result?:{kind:string;id?:string;message?:string}};
type PlanRequest={chatId?:string;content:string};
const channels={x:'X',discord:'Discord',telegram:'Telegram',project:'Project page'};
const examples=['Plan three X updates for next week.','Draft a community call for Friday.','Help me review a holder payout.'];
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const timestamp=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZoneName:undefined}):'Choose a time before creating this draft';
const localDate=(value:string|null|undefined)=>{if(!value||!Number.isFinite(Date.parse(value)))return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const fromLocal=(value:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const errorMessage=(reason:unknown)=>reason instanceof Error?reason.message:'This action could not be completed. Try again.';

/** Preview validation mirrors the concrete destinations; the server revalidates every revision. */
export function assistantActionIssues(action:AssistantAction,now=Date.now(),requireDates=true):string[]{
  const issues:string[]=[];
  if(!action.title.trim()||action.title.length>120)issues.push('Add a title of 120 characters or fewer.');
  if(action.kind==='calendar'){
    const items=action.payload.items||[];
    if(!items.length||items.length>7)issues.push('A content plan needs between one and seven drafts.');
    items.forEach((item,index)=>{
      if(!item.title.trim()||item.title.length>120||!item.content.trim()||item.content.length>8000)issues.push(`Draft ${index+1}: add a title and content within the field limits.`);
      if(!(item.channel in channels))issues.push(`Draft ${index+1}: choose a channel.`);
      if(item.channel==='x'&&[...item.content].length>280)issues.push(`Draft ${index+1}: X content must fit within 280 characters.`);
      const date=Date.parse(item.scheduledAt||'');
      if((requireDates||item.scheduledAt)&&(!Number.isFinite(date)||date<=now||date>now+365*86400000))issues.push(`Draft ${index+1}: choose a future date within one year.`);
    });
  }else if(action.kind==='event'){
    const payload=action.payload,start=Date.parse(payload.startsAt||''),end=Date.parse(payload.endsAt||'');
    if(!payload.title?.trim()||payload.title.length>120||!payload.description?.trim()||payload.description.length>4000)issues.push('Add an event title and description within the field limits.');
    if((requireDates||payload.startsAt)&&(!Number.isFinite(start)||start<=now||start>now+365*86400000))issues.push('Choose a future event start within one year.');
    if((requireDates||payload.endsAt)&&(!Number.isFinite(end)||!Number.isFinite(start)||end<=start||end-start>7*86400000))issues.push('Choose an end after the start, no more than seven days later.');
    if(payload.capacity!==null&&(!Number.isSafeInteger(payload.capacity)||Number(payload.capacity)<1||Number(payload.capacity)>500))issues.push('Capacity must be open or a whole number from 1 to 500.');
  }
  return issues;
}

function ActionContent({action}:{action:AssistantAction}){
  if(action.kind==='calendar')return <ol className="assistant-content-list">{action.payload.items?.map((item,index)=><li key={index}><div className="assistant-content-meta"><strong>{item.title||'Untitled draft'}</strong><span>{channels[item.channel]||item.channel}</span></div><p className="assistant-action-date">{timestamp(item.scheduledAt)}</p><DraftText text={item.content||'Content needs to be added.'}/></li>)}</ol>;
  if(action.kind==='event')return <div className="assistant-event-preview"><h4>{action.payload.title||'Untitled event'}</h4><DraftText text={action.payload.description||'Description needs to be added.'}/><dl><div><dt>Starts</dt><dd>{timestamp(action.payload.startsAt)}</dd></div><div><dt>Ends</dt><dd>{timestamp(action.payload.endsAt)}</dd></div><div><dt>Capacity</dt><dd>{action.payload.capacity===null?'Open':action.payload.capacity??'Choose capacity'}</dd></div>{action.payload.url&&<div><dt>Event link</dt><dd><a href={action.payload.url} target="_blank" rel="noreferrer">{action.payload.url}</a></dd></div>}</dl></div>;
  return <p className="assistant-action-copy">Open Treasury to check the linked holder vault, current balance, eligible recipients and exact amounts. This proposal contains no transaction or payout instruction. You review and sign separately in your wallet.</p>;
}

function ActionEditor({draft,setDraft,disabled}:{draft:AssistantAction;setDraft:(action:AssistantAction)=>void;disabled:boolean}){
  const setPayload=(patch:Partial<AssistantAction['payload']>)=>setDraft({...draft,payload:{...draft.payload,...patch}});
  const itemChange=(index:number,patch:Partial<CalendarItem>)=>setPayload({items:draft.payload.items?.map((item,i)=>i===index?{...item,...patch}:item)});
  return <div className="assistant-action-editor"><label>Proposal title<input value={draft.title} maxLength={120} disabled={disabled} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    {draft.kind==='calendar'&&draft.payload.items?.map((item,index)=><fieldset key={index} disabled={disabled}><legend>Draft {index+1}</legend><label>Title<input value={item.title} maxLength={120} onChange={event=>itemChange(index,{title:event.target.value})}/></label><label>Content<textarea rows={4} value={item.content} maxLength={8000} onChange={event=>itemChange(index,{content:event.target.value})}/></label><div className="assistant-field-pair"><label>Channel<select value={item.channel} onChange={event=>itemChange(index,{channel:event.target.value as CalendarItem['channel']})}>{Object.entries(channels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Scheduled time<input type="datetime-local" value={localDate(item.scheduledAt)} onChange={event=>itemChange(index,{scheduledAt:fromLocal(event.target.value)})}/></label></div></fieldset>)}
    {draft.kind==='event'&&<fieldset disabled={disabled}><legend>Event details</legend><label>Event title<input value={draft.payload.title||''} maxLength={120} onChange={event=>setPayload({title:event.target.value})}/></label><label>Description<textarea rows={4} value={draft.payload.description||''} maxLength={4000} onChange={event=>setPayload({description:event.target.value})}/></label><div className="assistant-field-pair"><label>Starts<input type="datetime-local" value={localDate(draft.payload.startsAt)} onChange={event=>setPayload({startsAt:fromLocal(event.target.value)})}/></label><label>Ends<input type="datetime-local" value={localDate(draft.payload.endsAt)} onChange={event=>setPayload({endsAt:fromLocal(event.target.value)})}/></label></div><label>Capacity · leave empty for open registration<input type="number" min={1} max={500} step={1} value={draft.payload.capacity??''} onChange={event=>setPayload({capacity:event.target.value===''?null:Number(event.target.value)})}/></label><label>Event link · optional<input type="url" value={draft.payload.url||''} maxLength={500} onChange={event=>setPayload({url:event.target.value})}/></label></fieldset>}
  </div>;
}

export function AssistantActions({projectId,chatId,available,onBlocked}:{projectId:string;chatId?:string;available:boolean;onBlocked?:(blocked:boolean)=>void}){
  const [items,setItems]=useState<AssistantAction[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[input,setInput]=useState(''),[reply,setReply]=useState(''),[planning,setPlanning]=useState(false),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[recoveryCode,setRecoveryCode]=useState(''),[failed,setFailed]=useState<PlanRequest|null>(null),[active,setActive]=useState(''),[draft,setDraft]=useState<AssistantAction|null>(null),[confirmed,setConfirmed]=useState<Record<string,boolean>>({}),[notice,setNotice]=useState('');
  const identity=useRef(projectId);identity.current=projectId;
  const alive=useRef(true),requesting=useRef(false),mutation=useRef(false);
  const base=`/projects/${projectId}/assistant`;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'your local time zone';
  useEffect(()=>{onBlocked?.(planning||!!input.trim()||!!draft||!!active);return()=>onBlocked?.(false);},[planning,input,draft,active,onBlocked]);
  useEffect(()=>{alive.current=true;const controller=new AbortController(),id=projectId;setItems([]);setLoading(true);setLoadError('');setInput('');setReply('');setDraft(null);setError('');setFailed(null);setConfirmed({});setNotice('');api<{items:AssistantAction[]}>(`/projects/${id}/assistant/actions`,undefined,controller.signal).then(result=>{if(!controller.signal.aborted&&identity.current===id)merge(result.items);}).catch(reason=>{if(!controller.signal.aborted&&identity.current===id)setLoadError(errorMessage(reason));}).finally(()=>{if(!controller.signal.aborted&&identity.current===id)setLoading(false);});return()=>{alive.current=false;controller.abort();};},[projectId]);
  const current=(id:string)=>alive.current&&identity.current===id;
  function merge(updated:AssistantAction[]){setItems(previous=>{const records=new Map(previous.map(item=>[item.id,item]));for(const item of updated){const existing=records.get(item.id);if(!existing||item.revision>=existing.revision)records.set(item.id,item);}return [...records.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));});}
  async function refresh(){const id=projectId;setLoading(true);setLoadError('');try{const result=await api<{items:AssistantAction[]}>(`${base}/actions`);if(current(id)){merge(result.items);setActionError('');}}catch(reason){if(current(id))setLoadError(errorMessage(reason));}finally{if(current(id))setLoading(false);}}
  async function plan(content:string,exact?:PlanRequest){
    if(requesting.current||planning||!available||!content.trim()||draft||active)return;
    requesting.current=true;const id=projectId,body=exact||{chatId:chatId||undefined,content:content.trim().slice(0,4000)};
    setPlanning(true);setError('');setNotice('');setRecoveryCode('');
    try{const result=await api<{reply:string;items:AssistantAction[]}>(`${base}/plan`,body);if(!current(id))return;merge(result.items);setReply(result.reply);setInput('');setFailed(null);}
    catch(reason){if(current(id)){setInput(body.content);setFailed(body);setError(errorMessage(reason));setRecoveryCode(reason instanceof ApiError?reason.code||'':'');}}
    finally{requesting.current=false;if(current(id))setPlanning(false);}
  }
  async function inspect(){const id=projectId,result=await api<{items:AssistantAction[]}>(`${base}/actions`);if(current(id))merge(result.items);return result.items.length?result.items.map(item=>`${item.title} · ${item.status}\n${item.kind==='calendar'?item.payload.items?.map(row=>`${row.title}\n${timestamp(row.scheduledAt)}\n${row.content}`).join('\n\n'):item.kind==='event'?`${item.payload.title}\n${timestamp(item.payload.startsAt)}\n${item.payload.description}`:'Payout review entry; no transaction prepared.'}`).join('\n\n——\n\n'):'No saved action proposals were found for this project.';}
  async function restart(){if(!failed)return;await resetAIRequest(`${base}/plan`,failed);await plan(failed.content,failed);}
  async function change(item:AssistantAction,action:'apply'|'dismiss'|'edit'){
    if(mutation.current||planning||active||input.trim()||item.status!=='proposed')return;
    const target=action==='edit'?draft:item;if(!target)return;
    if(action==='apply'&&(assistantActionIssues(item).length||!confirmed[item.id]))return;
    mutation.current=true;const id=projectId;setActive(item.id);setActionError('');setNotice('');
    try{
      const result=await api<{action:AssistantAction;result?:{kind:string;projectId?:string}}>(`${base}/actions/${item.id}`,{action,revision:item.revision,...(action==='edit'?{title:target.title,payload:target.payload}:{confirm:true})});
      if(!current(id))return;merge([result.action]);setConfirmed(previous=>({...previous,[item.id]:false}));if(action==='edit')setDraft(null);
      if(action==='apply'&&item.kind==='distribution'){window.dispatchEvent(new CustomEvent('memehelm-open-distribution-review',{detail:{projectId}}));setNotice('Payout review opened in Treasury. No transaction has been signed.');}
      else if(action==='apply')setNotice(item.kind==='calendar'?'Private content drafts created. Open the content calendar to review and publish separately.':'Private event draft created. Open Community to review its invitation before publishing.');
      else if(action==='dismiss')setNotice('Proposal dismissed. Existing content and events are unchanged.');
      else setNotice('Review saved. Check the updated details before creating drafts.');
    }catch(reason){if(current(id))setActionError(errorMessage(reason));}
    finally{mutation.current=false;if(current(id))setActive('');}
  }
  return <section className="assistant-actions" aria-label="Plan an action"><div className="assistant-plan-intro"><h3>Turn an idea into a reviewed action.</h3><p>Ask for a content plan, a community event or a holder payout review. Check every detail before continuing.</p></div>
    <form className="chat-composer" onSubmit={event=>{event.preventDefault();plan(input);}}><label className="assistant-plan-prompt">What would you like to do?<textarea rows={3} maxLength={4000} value={input} placeholder="Plan three community updates for next week…" disabled={!available||planning||!!draft||!!active} onChange={event=>setInput(event.target.value)}/></label><button className="button primary" type="submit" disabled={!available||planning||!input.trim()||!!draft||!!active}>{planning?'Planning…':'Create proposal'}</button></form>
    {input.trim()&&<button className="text-button" disabled={planning} onClick={()=>{setInput('');setFailed(null);setError('');setRecoveryCode('');}}>Discard unsent request</button>}
    <div className="chat-suggestions">{examples.map(example=><button key={example} type="button" disabled={planning||!!input.trim()||!!draft||!!active||!available} onClick={()=>setInput(example)}>{example}</button>)}</div>
    {!available&&<p className="inline-note">Planning is temporarily unavailable. Your saved proposals can still be reviewed.</p>}
    {error&&<div className="notice error" role="alert"><span>{error}</span>{failed&&(['AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED'].includes(recoveryCode)?<AIRequestRecovery key={recoveryCode+failed.content} label="drafts" disabled={planning||!available||!!draft||!!active} inspect={inspect} restart={restart}/>:<button className="button secondary" disabled={planning||!available||input.trim()!==failed.content} onClick={()=>plan(failed.content,failed)}>Retry request</button>)}</div>}
    {reply&&<div className="assistant-plan-reply"><DraftText text={reply}/></div>}
    {notice&&<p className="assistant-action-notice" role="status">{notice}</p>}
    <div className="section-title assistant-review-title"><h3>Saved proposals</h3><button className="text-button" disabled={loading||planning||!!draft||!!active} onClick={refresh}>{loading?'Refreshing…':'Refresh'}</button></div>
    <p className="assistant-action-timezone">All times are shown in {zone}. Content and event drafts stay private. A date in the calendar never posts automatically.</p>
    {input.trim()&&items.length>0&&<p className="data-note">Finish or discard your unsent request before applying a saved proposal.</p>}
    {actionError&&<p className="notice error" role="alert">{actionError} Review the saved proposal or refresh the list before trying again.</p>}
    {loadError&&<p className="notice error" role="alert">{loadError} <button className="text-button" disabled={loading} onClick={refresh}>Try loading proposals again</button></p>}
    {loading&&!items.length?<p role="status" className="data-note">Loading your saved proposals…</p>:!items.length&&!loadError?<p className="assistant-actions-empty">Your first proposal will appear here. Nothing is created until you review and confirm it.</p>:<div className="assistant-actions-list">{items.map(item=>{const editing=draft?.id===item.id,review=editing?draft:item,issues=assistantActionIssues(review),busy=!!active||planning||!!input.trim();return <details key={item.id} className="assistant-action" open={item.status==='proposed'||undefined}><summary><span><strong>{item.title}</strong><small>{item.kind==='calendar'?'Content plan':item.kind==='event'?'Community event':'Holder payout review'} · {timestamp(item.createdAt)}</small></span><span className="badge">{item.status==='proposed'?'Needs review':item.status==='dismissed'?'Dismissed':item.kind==='distribution'?'Review opened':'Private drafts created'}</span></summary><div className="assistant-action-body"><p className="assistant-action-copy">{item.rationale}</p>{editing?<ActionEditor draft={draft} setDraft={setDraft} disabled={busy}/>:<ActionContent action={item}/>}
      {item.status==='proposed'&&<>{issues.length>0&&<div className="assistant-action-issues"><strong>Update before continuing</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}{editing?<div className="button-row"><button className="button primary" disabled={busy||!!assistantActionIssues(draft,Date.now(),false).length} onClick={()=>change(item,'edit')}>{active===item.id?'Saving…':'Save review'}</button><button className="button secondary" disabled={busy} onClick={()=>setDraft(null)}>Discard edits</button></div>:<><label className="checkbox assistant-action-confirm"><input type="checkbox" checked={!!confirmed[item.id]} disabled={busy||!!draft||!!issues.length} onChange={event=>setConfirmed(previous=>({...previous,[item.id]:event.target.checked}))}/><span>{item.kind==='distribution'?'I want to review the current payout in Treasury. I will check and sign any transaction separately.':`I reviewed all details. Create ${item.kind==='calendar'?'these private content drafts':'this private event draft'} without publishing or sending anything.`}</span></label><div className="button-row"><button className="button primary" disabled={busy||!!draft||!confirmed[item.id]||!!issues.length} onClick={()=>change(item,'apply')}>{active===item.id?'Saving…':item.kind==='distribution'?'Open payout review':item.kind==='calendar'?'Create private drafts':'Create private event'}</button>{item.kind!=='distribution'&&<button className="button secondary" disabled={busy||!!draft} onClick={()=>{setDraft(clone(item));setConfirmed(previous=>({...previous,[item.id]:false}));setNotice('');}}>Edit details</button>}<button className="text-button" disabled={busy||!!draft} onClick={()=>change(item,'dismiss')}>Dismiss</button></div></>}</>}
      {item.status==='applied'&&<div className="assistant-action-result"><p>{item.result?.message||(item.kind==='distribution'?'Review entry saved. No payout or wallet signature was made here.':'The approved details were saved as private drafts.')}</p>{item.kind==='distribution'?<button className="button secondary" disabled={busy||!!draft} onClick={()=>window.dispatchEvent(new CustomEvent('memehelm-open-distribution-review',{detail:{projectId}}))}>Open payout review again</button>:<button className="button secondary" disabled={busy||!!draft} onClick={()=>window.dispatchEvent(new CustomEvent('memehelm-open-assistant-result',{detail:{projectId,kind:item.kind}}))}>{item.kind==='calendar'?'Open content plan':'Open Community'}</button>}</div>}
    </div></details>;})}</div>}
  </section>;
}
