import {useEffect,useId,useRef,useState} from 'react';
import {DraftText} from './DraftText';
import {ApiError} from './api';
import type {Activity} from './types';

export function DraftEditor({entry,busy=false,onSave,onReload,onEditingChange}:{entry:Activity;busy?:boolean;onSave:(content:string,revision:number)=>Promise<void>;onReload:()=>Promise<void>;onEditingChange:(editing:boolean)=>void}){
  const [editing,setEditing]=useState(false),[content,setContent]=useState(entry.content),[saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[copied,setCopied]=useState(false);
  const fieldId=useId(),hintId=useId();
  const editButton=useRef<HTMLButtonElement>(null),returnFocus=useRef(false);
  useEffect(()=>()=>onEditingChange(false),[onEditingChange]);
  useEffect(()=>{if(!editing&&returnFocus.current){returnFocus.current=false;editButton.current?.focus();}},[editing]);
  function finish(){returnFocus.current=true;setEditing(false);onEditingChange(false);setError('');setConflict(false);setCopied(false);}
  async function save(){
    if(saving||busy||!content.trim()||content===entry.content)return;
    setSaving(true);setError('');
    try{await onSave(content,entry.revision||0);finish();}
    catch(reason){setConflict(reason instanceof ApiError&&reason.status===409);setError(reason instanceof Error?reason.message:'Your changes could not be saved. Try again.');}
    finally{setSaving(false);}
  }
  async function reload(){setSaving(true);try{await onReload();finish();}catch(reason){setError(reason instanceof Error?reason.message:'The saved version could not be loaded. Your edits are still here.');}finally{setSaving(false);}}
  if(!editing)return <><div className="ai-draft-content"><DraftText text={entry.content}/></div><button ref={editButton} className="text-button draft-edit-action" disabled={busy} onClick={()=>{setContent(entry.content);setError('');setConflict(false);setCopied(false);setEditing(true);onEditingChange(true);}}>Edit draft</button></>;
  return <form className="draft-editor" aria-label="Edit draft" aria-busy={saving} onSubmit={event=>{event.preventDefault();void save();}}>
    <label className="field" htmlFor={fieldId}><span>Draft content</span><textarea id={fieldId} autoFocus required maxLength={20000} value={content} aria-describedby={hintId} disabled={saving} onChange={event=>setContent(event.target.value)}/></label>
    <div className="draft-editor-hint" id={hintId}><p>{entry.public?'Saving changes will hide this update until you review and publish it again.':'Changes stay private until you review and publish them.'}</p><span>{content.length.toLocaleString('en-US')} / 20,000</span></div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {conflict&&<div className="draft-conflict"><p>Your edits are still here. Copy them before loading the saved version.</p><div className="button-row"><button className="button secondary" type="button" disabled={saving} onClick={async()=>{try{await navigator.clipboard.writeText(content);setCopied(true);}catch{setError('Copy was unavailable. Select your draft text to copy it.');}}}>{copied?'Edits copied':'Copy my edits'}</button><button className="text-button" type="button" disabled={saving} onClick={reload}>Discard edits and reload</button></div></div>}
    <div className="button-row"><button className="button primary" type="submit" disabled={busy||saving||conflict||!content.trim()||content===entry.content}>{saving?'Saving changes…':'Save changes'}</button><button className="button secondary" type="button" disabled={saving} onClick={finish}>Cancel</button></div>
  </form>;
}
