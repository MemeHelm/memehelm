import {useId} from 'react';
import {Arrow} from './Brand';
import {DesktopIcon} from './Desktop';

type Props = {mode:'guest';signIn:()=>Promise<void>} | {mode:'project';createProject:()=>void;openProjects:()=>void};

export function CopilotEntry(props:Props){
  const helpId=useId();
  return <section className="copilot-chat-entry" aria-label={props.mode==='guest'?'AI chat preview':'Start a project chat'}>
    <div className="copilot-entry-intro"><DesktopIcon name="copilot" size={36}/><div><h2>Meet your Copilot.</h2><p>Chat about your coin, review observed facts and plan community updates.</p></div></div>
    <div className="copilot-entry-next"><p id={helpId}>{props.mode==='guest'?'Sign in, then choose a project or save a draft. Conversations stay private.':'Save a launch draft or import an existing token from My Projects. You can use Copilot before launching a coin.'}</p><div className="copilot-entry-actions">{props.mode==='guest'?<button className="button primary" onClick={props.signIn}>Sign in to chat <Arrow/></button>:<><button className="button primary" onClick={props.createProject}>Create a project <Arrow/></button><button className="button secondary" onClick={props.openProjects}>My Projects <Arrow/></button></>}</div></div>
    <div className="copilot-entry-topics"><span>Questions you can ask</span><ul><li>What should we focus on this week?</li><li>What do the latest token observations show?</li><li>Help me draft our next community update.</li></ul></div>
    <label className="copilot-entry-question"><span>Your question</span><textarea rows={2} disabled placeholder={props.mode==='guest'?'Sign in and choose a project to ask Copilot…':'Choose or create a project to ask Copilot…'} aria-describedby={helpId}/></label>
  </section>;
}
