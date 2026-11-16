import {useId} from 'react';
import {Arrow} from './Brand';

type Props = {mode:'guest';signIn:()=>Promise<void>} | {mode:'project';createProject:()=>void;openProjects:()=>void};

export function CopilotEntry(props:Props){
  const helpId=useId();
  return <section className="copilot-chat-entry copilot-entry-system" aria-label={props.mode==='guest'?'AI chat preview':'Open project tools'}>
    <div className="copilot-entry-welcome"><img className="copilot-entry-mate" data-mate-landing="welcome" src="/brand/mate-v1.png" alt="MATE, your MemeHelm assistant"/><div className="copilot-entry-intro"><h2>{props.mode==='guest'?<>A little clarity.<br/>Your next move.</>:<>A home for<br/>your project.</>}</h2><p>{props.mode==='guest'?'Meet MATE. Explore an idea, plan a launch or draft your first community update.':'Keep your content, community and revenue together. Save a draft or import a token to open these project tools.'}</p></div></div>
    {props.mode==='guest'&&<div className="copilot-entry-topics"><span>Start with a useful question</span><ul><li><span>Help me shape a meme project idea.</span><Arrow/></li><li><span>What should I prepare before launching?</span><Arrow/></li><li><span>Help me draft our first community update.</span><Arrow/></li></ul></div>}
    <div className="copilot-entry-next"><p id={helpId}>{props.mode==='guest'?'Sign in with your wallet to start a private conversation. No project needed.':'You can chat with MATE before creating a project.'}</p><div className="copilot-entry-actions">{props.mode==='guest'?<button className="button primary" onClick={props.signIn}>Sign in to chat <Arrow/></button>:<><button className="button primary" onClick={props.createProject}>Create a project <Arrow/></button><button className="button secondary" onClick={props.openProjects}>My Projects</button><button className="text-button" onClick={()=>window.dispatchEvent(new CustomEvent('memehelm-open-assistant'))}>Chat with MATE <Arrow/></button></>}</div></div>
    {props.mode==='guest'&&<label className="copilot-entry-question"><span>Your question</span><textarea rows={2} disabled placeholder="Sign in to ask MATE…" aria-describedby={helpId}/></label>}
    <p className="copilot-entry-footnote">MATE answers MemeHelm questions only. Drafts stay private; you approve public updates and wallet transactions.</p>
  </section>;
}
