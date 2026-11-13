import {useState} from 'react';
import {Arrow} from './Brand';
import {DesktopIcon} from './Desktop';
import type {Page} from './types';

const examples=[
  {label:'Project memory',title:'Keep the project’s context.',body:'Purpose: a community for builders sharing useful work.\n\nPriority: prepare the next community demo.\n\nCommitment: share verified progress and answer open questions.\n\nBoundary: keep contributor contact details private.'},
  {label:'Action review',title:'Decide what happens next.',body:'Suggested task: collect demo submissions.\n\nReason: build the next update from actual community contributions.\n\nReview the proposal, approve it, and record what happened. An update only becomes public after your separate confirmation.'},
  {label:'Social post',title:'Start a conversation.',body:'Orbit Club is for builders who keep showing up. What are you working on this week? Share one small win with the community.'},
  {label:'Daily brief',title:'Plan the day.',body:'Review your launch settings and recipient wallets.\n\nIntroduce what your project is here to build.\n\nAsk the community one useful question.'},
  {label:'Weekly plan',title:'Give the week a shape.',body:'Monday — Introduce the project.\nTuesday — Ask what the community needs.\nWednesday — Share a milestone.\nThursday — Answer questions.\nFriday — Recap and plan.'},
];

export function GuestWorkspace({page,connect,navigate}:{page:Page;connect:()=>Promise<void>;navigate:(page:Page)=>void}){
  const [example,setExample]=useState(0);
  const copilot=page==='copilot',treasury=page==='treasury';
  if(!copilot&&!treasury)return <div className="guest-workspace guest-projects">
    <header className="guest-page-heading"><div><h1>My projects</h1><p>Your coins, drafts and community pages.</p></div><button className="button secondary" onClick={()=>navigate('launch')}>Launch a coin <Arrow/></button></header>
    <section className="project-locked" aria-labelledby="projects-signin-title">
      <div className="project-shelf-label"><DesktopIcon name="projects" size={18}/><span>Your workspace</span><span className="workspace-lock"><LockIcon/>Wallet sign-in</span></div>
      <div className="project-locked-content"><span className="project-empty-symbol"><DesktopIcon name="projects" size={38}/><LockIcon/></span><h2 id="projects-signin-title">Your projects live here.</h2><p>Sign in to see your coins and pick up your drafts.</p><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button><small>Your projects are linked to your wallet.</small></div>
      <footer className="project-shelf-footer"><span>Drafts</span><span>Launched coins</span><span>Community pages</span></footer>
    </section>
    <div className="guest-help-row"><span>New to MemeHelm?</span><button className="text-button" onClick={()=>navigate('guide')}>Read the quick guide <Arrow/></button></div>
  </div>;

  if(treasury)return <div className="guest-workspace guest-revenue">
    <header className="guest-page-heading"><div><h1>Creator revenue</h1><p>Creator fees and wallet allocations.</p></div><button className="button secondary" onClick={()=>navigate('calculator')}>Try the split calculator <Arrow/></button></header>
    <section className="revenue-locked"><span className="revenue-locked-icon"><DesktopIcon name="treasury" size={36}/></span><div><h2>See where your fees go.</h2><p>Sign in to view your coin’s collected fees and available payouts.</p><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button></div></section>
    <details className="guest-revenue-guide"><summary>How creator payouts work</summary><ol>{[['Settle creator fees','Move accrued fees into the protocol escrow.'],['Collect your balance','Claim escrow funds into your recipient wallet or split vault.'],['Release each share','Review the fixed recipients and approve the payout in your wallet.']].map(([title,text])=><li key={title}><strong>{title}</strong><p>{text}</p></li>)}</ol></details>
  </div>;

  return <div className="guest-workspace guest-copilot">
    <header className="guest-page-heading"><div><h1>AI Copilot</h1><p>Project memory, proposed actions and outcomes, with writing tools built in.</p></div></header>
    <div className="copilot-signin-bar"><span><LockIcon/>Sign in to run your project’s private workspace.</span><button className="button primary" onClick={connect}>Sign in with wallet <Arrow/></button></div>
    <section className="copilot-sample" aria-label="Copilot content examples"><div className="copilot-sample-toolbar"><div className="example-tabs" aria-label="Example draft type">{examples.map((item,i)=><button key={item.label} aria-pressed={example===i} onClick={()=>setExample(i)}>{item.label}</button>)}</div><span className="sample-label">Example</span></div>
      <div className="copilot-sample-document"><div className="sample-project"><span>OC</span><div><strong>Orbit Club</strong><small>Illustrative project</small></div></div><h2>{examples[example].title}</h2><p>{examples[example].body}</p></div>
      <footer><span>Illustrative content. Your drafts stay private until you share them.</span><button className="text-button" onClick={()=>navigate('launch')}>Open Launchpad <Arrow/></button></footer>
    </section>
  </div>;
}

function LockIcon(){return <svg className="workspace-lock-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="8" rx="2"/><path d="M7 8.5V5a3 3 0 0 1 6 0v3.5M10 11.5v2"/></svg>;}
