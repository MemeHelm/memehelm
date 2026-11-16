import {useEffect,useState} from 'react';
import {api} from './api';
import {useWindowGuard} from './window-guard';
import type {Project} from './types';

const values=(project:Project)=>({aiName:project.aiName||'Copilot',aiVoice:project.aiVoice||'Clear & practical',aiGoal:project.aiGoal||''});
export function AssistantProfile({project,updated,onBlocked}:{project:Project;updated?:(project:Project)=>void;onBlocked:(blocked:boolean)=>void}){
 const [saved,setSaved]=useState(()=>values(project)),[profile,setProfile]=useState(()=>values(project)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const dirty=profile.aiName!==saved.aiName||profile.aiVoice!==saved.aiVoice||profile.aiGoal!==saved.aiGoal;
 useWindowGuard('workspace-memory',busy||dirty);
 useEffect(()=>{onBlocked(busy||dirty);return()=>onBlocked(false);},[busy,dirty,onBlocked]);
 useEffect(()=>{if(dirty)return;const next=values(project);setSaved(next);setProfile(next);},[project.aiName,project.aiVoice,project.aiGoal]);
 async function save(){if(busy)return;setBusy(true);setError('');setNotice('');try{const result=await api<Project>('/projects/'+project.id+'/assistant',profile),next=values(result);setSaved(next);setProfile(next);updated?.(result);setNotice('Assistant profile saved. It will guide your next draft.');}catch(reason){setError(reason instanceof Error?reason.message:'The profile could not be saved. Try again.');}finally{setBusy(false);}}
 return <form className="panel assistant-profile" onSubmit={event=>{event.preventDefault();void save();}}><div className="section-title"><h2>Assistant profile</h2><span className="badge">PRIVATE</span></div><p>Set the name, voice and community goal your assistant should use.</p>
  {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice success" role="status">{notice}</p>}
  <fieldset disabled={busy}><div className="form-grid"><label className="field"><span>Assistant name</span><input required maxLength={40} value={profile.aiName} onChange={event=>setProfile({...profile,aiName:event.target.value})}/></label><label className="field"><span>Voice</span><select value={profile.aiVoice} onChange={event=>setProfile({...profile,aiVoice:event.target.value})}>{['Clear & practical','Playful & bold','Warm & community-first'].map(voice=><option key={voice}>{voice}</option>)}</select></label><label className="field span-2"><span>What should your community work toward?</span><textarea rows={2} maxLength={500} value={profile.aiGoal} onChange={event=>setProfile({...profile,aiGoal:event.target.value})}/></label></div><div className="button-row"><button className="button secondary" disabled={!dirty}>{busy?'Saving…':'Save assistant profile'}</button>{dirty&&<button type="button" className="text-button" onClick={()=>{setProfile(saved);setError('');setNotice('');}}>Discard profile changes</button>}</div></fieldset><p className="data-note">You review public updates and approve every wallet transaction.</p>
 </form>;
}
