import {useState} from 'react';
import {Arrow} from './Brand';
import {DesktopIcon} from './Desktop';
import {CopilotEntry} from './CopilotEntry';
import type {Page} from './types';

const examples=[
  {label:'AI chat',title:'Chat with your project’s AI.',body:''},
  {label:'Project memory',title:'Keep the project’s context.',body:'Purpose: a community for builders sharing useful work.\n\nPriority: prepare the next community demo.\n\nCommitment: share verified progress and answer open questions.\n\nBoundary: keep contributor contact details private.'},
  {label:'Action review',title:'Decide what happens next.',body:'Suggested task: collect demo submissions.\n\nReason: build the next update from actual community contributions.\n\nReview the proposal, approve it, and record what happened. An update only becomes public after your separate confirmation.'},
  {label:'Social post',title:'Start a conversation.',body:'Orbit Club is for builders who keep showing up. What are you working on this week? Share one small win with the community.'},
  {label:'Daily brief',title:'Plan the day.',body:'Review your launch settings and recipient wallets.\n\nIntroduce what your project is here to build.\n\nAsk the community one useful question.'},
  {label:'Weekly plan',title:'Give the week a shape.',body:'Monday — Introduce the project.\nTuesday — Ask what the community needs.\nWednesday — Share a milestone.\nThursday — Answer questions.\nFriday — Recap and plan.'},
];

export function GuestWorkspace({page,connect,navigate}:{page:Page;connect:()=>Promise<void>;navigate:(page:Page)=>void}){
  const [example,setExample]=useState(0);
  const copilot=page==='copilot',treasury=page==='treasury';
  if(!copilot&&!treasury)return <div className="guest-workspace guest-projects guest-system">
    <header className="guest-page-heading"><div><h1>My projects</h1><p>Your coins, drafts and community pages.</p></div><button className="button secondary" onClick={()=>navigate('launch')}>Launch a coin <Arrow/></button></header>
    <div className="guest-projects-layout"><section className="project-locked" aria-labelledby="projects-signin-title">
      <div className="project-shelf-label"><DesktopIcon name="projects" size={18}/><span>Your workspace</span><span className="workspace-lock"><LockIcon/>Wallet sign-in</span></div>
      <div className="project-locked-content"><span className="project-empty-symbol"><DesktopIcon name="projects" size={38}/><LockIcon/></span><h2 id="projects-signin-title">Your projects live here.</h2><p>Sign in to see your coins and pick up your drafts.</p><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button><small>Your projects are linked to your wallet.</small></div>
      <footer className="project-shelf-footer"><span>Drafts</span><span>Launched coins</span><span>Community pages</span></footer>
    </section><section className="guest-workflow"><span className="application-kicker">ONE HOME FOR YOUR COINS</span><h2>From first draft to your next chapter.</h2><ol>{[['Keep the idea','Save your coin’s name, story and launch settings.'],['Run the project','Work with MATE, plan content and manage community events.'],['Follow the revenue','Review creator fees and approve each payout in your wallet.']].map(([title,body],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section></div>
    <div className="guest-help-row"><span>New to MemeHelm?</span><button className="text-button" onClick={()=>navigate('guide')}>Read the quick guide <Arrow/></button></div>
  </div>;

  if(treasury)return <div className="guest-workspace guest-revenue guest-system">
    <header className="guest-page-heading"><div><h1>Creator revenue</h1><p>Creator fees and wallet allocations.</p></div><button className="button secondary" onClick={()=>navigate('launch')}>Plan revenue in Launchpad <Arrow/></button></header>
    <div className="guest-revenue-layout"><section className="revenue-locked"><span className="revenue-locked-icon"><DesktopIcon name="treasury" size={36}/></span><div><span className="application-kicker">CREATOR FEES · ETH</span><h2>Follow creator fees.<br/>Review every payout.</h2><p>Sign in and select a launched or imported pons v2 project to review creator fees and available payouts.</p><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button><small>Revenue destinations are chosen during launch. Activated vault rules stay fixed.</small></div></section>
    <section className="guest-workflow"><span className="application-kicker">THE PAYOUT PATH</span><h2>Three steps. Your approval.</h2><ol>{[['Settle creator fees','Move accrued fees into the protocol escrow.'],['Collect your balance','Claim escrow funds into your recipient wallet or vault.'],['Review the next action','Release fixed shares, prepare holder payouts or review escrow proposals when your project uses a vault.']].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section></div>
    <div className="guest-revenue-modes"><span>Revenue destinations</span><strong>Creator wallet</strong><strong>Fixed split</strong><strong>Holder payouts</strong><strong>Community escrow</strong></div>
  </div>;

  return <div className="guest-workspace guest-copilot guest-system">
    <header className="guest-page-heading"><div><h1>AI Copilot</h1><p>Chat about your coin. Keep project context. Review your next moves.</p></div></header>
    <section className="copilot-sample" aria-label="Explore AI Copilot"><div className="copilot-sample-toolbar"><span className="application-kicker">EXPLORE WITH MATE</span><div className="example-tabs" aria-label="Copilot previews">{examples.map((item,i)=><button key={item.label} aria-pressed={example===i} onClick={()=>setExample(i)}><span>0{i+1}</span>{item.label}<Arrow/></button>)}</div><span className="sample-label">{example===0?'Interactive preview':'Illustrative example'}</span></div>
      {example===0?<CopilotEntry mode="guest" signIn={connect}/>:<div className="copilot-sample-document"><div className="sample-project"><span>OC</span><div><strong>Orbit Club</strong><small>Illustrative project</small></div></div><h2>{examples[example].title}</h2><p>{examples[example].body}</p><button className="button primary copilot-example-signin" onClick={connect}>Sign in to use Copilot <Arrow/></button></div>}
      <footer><span>{example===0?'Chat uses your selected project’s context and available observations.':'Illustrative content. Your drafts stay private until you share them.'}</span><button className="text-button" onClick={()=>navigate('launch')}>Open Launchpad <Arrow/></button></footer>
    </section>
  </div>;
}

function LockIcon(){return <svg className="workspace-lock-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="8" rx="2"/><path d="M7 8.5V5a3 3 0 0 1 6 0v3.5M10 11.5v2"/></svg>;}
