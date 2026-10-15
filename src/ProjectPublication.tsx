import {useState} from 'react';
import {api} from './api';
import {Arrow} from './Brand';
import type {Project} from './types';
export function ProjectPublication({project,updated}:{project:Project;updated:(project:Project)=>void}){
  const [confirm,setConfirm]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  async function publish(){setPending(true);setError('');try{updated(await api<Project>(`/projects/${project.id}/publication`,{published:!project.published}));setConfirm(false);}catch(reason:any){setError(reason.message);}finally{setPending(false);}}
  return <section className="project-publication"><h4>Your project page</h4>{project.published?<><p>Your project details and the updates you choose to share are visible to people who can open this site.</p><a className="button secondary" href={`/project/${project.id}`} target="_blank" rel="noreferrer">Open project page <Arrow/></a><button className="text-button" disabled={pending} onClick={publish}>{pending?'Updating…':'Unpublish page'}</button></>:project.tokenAddress?<><p>Share your story, verified token address, vault balances, and selected updates.</p><label className="checkbox"><input type="checkbox" checked={confirm} onChange={event=>setConfirm(event.target.checked)}/><span>I want my project details and community links to be visible on its page.</span></label><button className="button secondary" disabled={!confirm||pending} onClick={publish}>{pending?'Checking token…':'Publish project page'} <Arrow/></button></>:<p>Launch or import an onchain token to create its project page.</p>}{error&&<p className="field-error" role="alert">{error}</p>}</section>;
}
