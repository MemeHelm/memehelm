import {useCallback,useState} from 'react';
import type {ReactNode} from 'react';
import type {Project} from './types';
import {CopilotEntry} from './CopilotEntry';
import {ProjectChat} from './ProjectChat';
import {useWindowGuard} from './window-guard';
import {Arrow} from './Brand';

type Props={wallet:string;connect:()=>Promise<void>;project:Project|undefined;selector:ReactNode;available:boolean;createProject:()=>void;openProjects:()=>void;updated?:(project:Project)=>void;currentPageLabel?:string};

/** One assistant conversation lives beside every primary tool, including while collapsed. */
export function WorkspaceAssistant(props:Props){
 const [blocked,setBlocked]=useState(false);
 const [chatScope,setChatScope]=useState<'general'|'project'>(()=>props.project?'project':'general');
 const chatProject=chatScope==='project'?props.project:undefined;
 const updateGuard=useCallback((value:boolean)=>setBlocked(value),[]);
 useWindowGuard('assistant-chat',blocked);
 return <div className="workspace-assistant copilot-system">
  <header className="workspace-assistant-context">
   <div className="workspace-assistant-location"><span>Working alongside you</span><strong>{props.currentPageLabel||'Workbench'}</strong></div>
   {props.wallet&&props.project&&<div className="workspace-assistant-scope" role="group" aria-label="Conversation context"><button type="button" aria-pressed={!chatProject} disabled={blocked} onClick={()=>setChatScope('general')}>Platform chat</button><button type="button" aria-pressed={!!chatProject} disabled={blocked} onClick={()=>setChatScope('project')}>Project chat</button></div>}
   {props.wallet&&chatProject&&props.selector&&<fieldset className="copilot-project-selector" disabled={blocked}>{props.selector}</fieldset>}
   {props.wallet&&chatProject&&<button type="button" className="workspace-knowledge-link" onClick={()=>window.dispatchEvent(new CustomEvent('memehelm-open-copilot-view',{detail:{view:'memory'}}))}>Project knowledge &amp; AI setup <Arrow diagonal/></button>}
  </header>
  <div className="workspace-assistant-body">
   {!props.wallet?<CopilotEntry mode="guest" signIn={props.connect}/>:<ProjectChat key={chatProject?.id||'general'} project={chatProject} available={props.available} onBlocked={updateGuard} presentation="sidebar"/>}
  </div>
 </div>;
}
