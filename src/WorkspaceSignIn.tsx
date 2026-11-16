import {Arrow} from './Brand';
import {DesktopIcon} from './Desktop';
import type {Page} from './types';

const tools:Record<string,{title:string;description:string;icon:string}>={
 assets:{title:'Assets',description:'Compose your images and captions for PNG export.',icon:'guide'},
 publishing:{title:'Publishing',description:'Review social posts and record their results.',icon:'community'},
 publication:{title:'Public page',description:'Choose which project details and updates to share.',icon:'community'},
 workspace:{title:'Project overview',description:'Your project’s priorities, observations and upcoming plans.',icon:'home'},
 community:{title:'Community',description:'Bring your community together with events, links and conversations.',icon:'community'},
 calendar:{title:'Content calendar',description:'Plan your posts, keep private drafts and record what you share.',icon:'calendar'},
 memory:{title:'AI setup',description:'Keep your story, audience, commitments and boundaries together.',icon:'guide'},
 goals:{title:'Community goals',description:'Invite contributions and review what your community creates.',icon:'community'},
 activity:{title:'Activity',description:'Review your project’s decisions, observations and recorded outcomes.',icon:'signals'},
 writing:{title:'Writing',description:'Write posts, daily briefs and plans with your project’s context.',icon:'guide'},
};
export function WorkspaceSignIn({page,connect,launch}:{page:Page;connect:()=>Promise<void>;launch:()=>void}){
 const tool=tools[page]||tools.workspace;
 return <section className="workspace-signin"><header className="application-heading"><div><h1>{tool.title}</h1><p>{tool.description}</p></div></header><div className="workspace-signin-surface"><span className="workspace-signin-icon"><DesktopIcon name={tool.icon} size={32}/></span><h2>Your project, ready to work.</h2><p>Sign in with your wallet and choose a project to open this tool. Your drafts and community plans stay private until you share them.</p><div className="button-row"><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button><button className="button secondary" onClick={launch}>Start a launch draft <Arrow/></button></div></div><div className="workspace-signin-note"><DesktopIcon name="copilot" size={18}/><p>MATE stays beside your work. Ask a question whenever you need a little direction.</p></div></section>;
}
