import {useId,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {Arrow} from './Brand';
import {useDesktopSummary} from './useDesktopSummary';
import {utcDateTime} from './time';
import {imageSource} from '../shared/project.mjs';
import type {Page,Project} from './types';

type Props={projects:Project[];projectsState?:'loading'|'ready'|'error';refreshProjects?:()=>void;wallet:string;visible:boolean;enabled:boolean;navigate:(page:Page)=>void;openProject:(id:string)=>void;openWorkspace?:(view:'chat'|'community'|'content',projectId?:string)=>void;hide:()=>void;icon:(name:string)=>ReactNode};

function WorkflowGlyph({kind}:{kind:'knowledge'|'draft'|'review'|'result'|'check'}){
  const paths={knowledge:<><path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4V5Z"/><path d="M12 7v14M7 9h2m-2 4h2m6-4h2m-2 4h2"/></>,draft:<><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5"/><path d="M8 12h8m-8 4h5"/></>,review:<><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,result:<><path d="M4 5h16v14H4V5Zm0 9h5l1 2h4l1-2h5"/><path d="M8 9h8"/></>,check:<path d="m5 12 4 4L19 6"/>};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

/** A product preview, not a token or a claim about a saved project. */
function LaunchCoin({id}:{id:string}){
  return <svg className="mh-launch-coin" viewBox="0 0 320 320" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={id+'-edge'} x1="40" y1="40" x2="270" y2="290" gradientUnits="userSpaceOnUse"><stop stopColor="#edf1f5"/><stop offset=".23" stopColor="#69757f"/><stop offset=".48" stopColor="#d4dce3"/><stop offset=".65" stopColor="#39434d"/><stop offset="1" stopColor="#11181f"/></linearGradient>
      <linearGradient id={id+'-face'} x1="86" y1="35" x2="219" y2="272" gradientUnits="userSpaceOnUse"><stop stopColor="#e0e6eb"/><stop offset=".28" stopColor="#a8b4be"/><stop offset=".55" stopColor="#71808c"/><stop offset="1" stopColor="#c5ced5"/></linearGradient>
      <linearGradient id={id+'-mark'} x1="111" y1="90" x2="220" y2="232" gradientUnits="userSpaceOnUse"><stop stopColor="#fafcff"/><stop offset=".38" stopColor="#d1dae2"/><stop offset="1" stopColor="#697782"/></linearGradient>
      <radialGradient id={id+'-shine'}><stop stopColor="#fff" stopOpacity=".5"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="165" cy="286" rx="102" ry="13" fill="#000" opacity=".35"/>
    <circle cx="167" cy="156" r="121" fill={'url(#'+id+'-edge)'} stroke="#e2ebf6" strokeOpacity=".35"/>
    <circle cx="156" cy="149" r="119" fill={'url(#'+id+'-face)'} stroke="#e9f1f8" strokeWidth="2"/>
    <circle cx="156" cy="149" r="107" stroke="#27333d" strokeOpacity=".65"/>
    <circle cx="156" cy="149" r="102" fill="#26343f" stroke="#d8e3ed" strokeOpacity=".65"/>
    <circle cx="156" cy="149" r="97" fill="#17232d"/>
    <path d="M91 103 155 152 202 116V140L221 125V183L197 164V146L155 179 115 147V170L91 151V103ZM91 158 115 177V225L91 208V158ZM197 171 221 190V208L197 225V171Z" fill="#0a1219" transform="translate(2 3)"/>
    <path d="M91 100 155 149 202 113V137L221 122V180L197 161V143L155 176 115 144V167L91 148V100ZM91 155 115 174V222L91 205V155ZM197 168 221 187V205L197 222V168Z" fill={'url(#'+id+'-mark)'}/>
    <path d="m207 109 19-13v17l-19 14v-18Z" fill="#d7ff00"/>
    <ellipse cx="111" cy="67" rx="76" ry="45" fill={'url(#'+id+'-shine)'} transform="rotate(-30 111 67)"/>
    <path d="M47 122a114 114 0 0 1 95-87" stroke="#fff" strokeOpacity=".65" strokeLinecap="round"/>
  </svg>;
}

export function CommandBoard({projects,projectsState='ready',refreshProjects,wallet,visible,enabled,navigate,openProject,openWorkspace,hide,icon}:Props){
  const owned=wallet?projects:[],[filter,setFilter]=useState('all'),[selected,setSelected]=useState('');
  const [address,setAddress]=useState(''),[addressError,setAddressError]=useState('');
  const visualId=useId().replace(/:/g,''),addressId=visualId+'-address',errorId=visualId+'-address-error';
  const project=owned.find(item=>item.id===selected)||owned[0];
  const summary=useDesktopSummary({wallet,projectId:project?.id,enabled:enabled&&visible});
  const rows=owned.filter(item=>filter==='all'||item.status===filter).slice(0,4);
  const openMate=()=>project?openProject(project.id):navigate('launch');
  const openView=(view:'community'|'content')=>{if(!project){navigate('overview');return;}if(openWorkspace)openWorkspace(view,project.id);else openMate();};
  function lookUpToken(event:FormEvent){
    event.preventDefault();const token=address.trim();
    if(!/^0x[a-fA-F0-9]{40}$/.test(token)){setAddressError('Enter a Robinhood token address: 0x followed by 40 hexadecimal characters.');return;}
    setAddressError('');navigate('discover');
    // Keep the shell's navigation entry and state while selecting a token inside Market.
    history.replaceState({...history.state},'','#app/discover/'+token);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  return <section className="desktop-command mh-home" aria-label="Workbench" hidden={!visible}>
    <header className="mh-home-heading"><div><h1>{project?'Make your next move.':'A home for your next coin.'}</h1><p>{project?'Pick up your project, shape a plan and keep moving.':'Create it, give it a story, bring people together.'}</p></div><div className="mh-home-controls">{wallet&&<button className="mh-home-quiet" disabled={summary.loading} onClick={summary.refresh}>{summary.loading?'Refreshing…':'Refresh'}</button>}<button className="mh-home-quiet" onClick={hide} aria-label="Show desktop">{icon('home')}<span>Desktop</span></button></div></header>
    {wallet&&projectsState==='loading'&&!owned.length&&<div className="mh-home-notice" role="status">Reading your projects… Your workspace will appear when they are ready.</div>}
    {wallet&&projectsState==='error'&&<div className="mh-home-notice mh-home-warning" role="status"><span>Your projects could not be refreshed. {owned.length?'Saved projects are kept below.':'Try again to read your saved workspace.'}</span><button onClick={refreshProjects}>Retry projects</button></div>}
    {wallet&&summary.errors.length>0&&<div className="mh-home-notice mh-home-warning" role="status"><span>{summary.errors.join(' ')} Saved information is kept when available.</span><button disabled={summary.loading} onClick={summary.refresh}>Try again</button></div>}
    {!project&&<div className="mh-home-deck">
      <section className="mh-home-surface mh-home-launch" aria-labelledby="mh-launch-title">
        <div className="mh-launch-scene" aria-hidden="true"><div className="mh-launch-orbit"/><LaunchCoin id={visualId}/><span className="mh-preview-label">Preview</span></div>
        <div className="mh-launch-copy"><span className="mh-feature-label">{icon('launch')}Launchpad</span><h2 id="mh-launch-title">Launch it.<br/>Steer it.</h2><p>Your coin. Your story.<br/>The tools to keep it moving.</p><button className="mh-home-primary" onClick={()=>navigate('launch')}>Start a coin<Arrow/></button><button className="mh-home-text" onClick={()=>navigate('overview')}>Import an existing token<Arrow/></button></div>
        <div className="mh-launch-steps" aria-label="Launchpad workflow preview">{['Your coin','Revenue','Economics','Review'].map((step,index)=><div key={step}><span>{index+1}</span><strong>{step}</strong></div>)}</div>
      </section>
      <section className="mh-home-surface mh-home-workflow" aria-labelledby="mh-workflow-title">
        <header className="mh-feature-heading"><span className="mh-feature-label">{icon('copilot')}AI workflow</span><span className="mh-preview-label">Preview</span></header><h2 id="mh-workflow-title">Context to action.</h2>
        <div className="mh-workflow-sequence" aria-label="AI workflow preview"><div><span className="mh-workflow-symbol"><WorkflowGlyph kind="knowledge"/></span><span><strong>Project knowledge</strong><small>Story, voice, goals</small></span></div><div><span className="mh-workflow-symbol"><WorkflowGlyph kind="draft"/></span><span><strong>Draft</strong><small>A post or a plan</small></span></div><div><span className="mh-workflow-symbol"><WorkflowGlyph kind="review"/></span><span><strong>Your review</strong><small>Refine and approve</small></span><span className="mh-review-mark"><WorkflowGlyph kind="check"/></span></div><div><span className="mh-workflow-symbol"><WorkflowGlyph kind="result"/></span><span><strong>Saved result</strong><small>Keep it with your project</small></span></div></div>
        <div className="mh-workflow-footer"><p>Create or import a project to give MATE context.</p><div><button className="mh-home-text" onClick={()=>navigate('launch')}>Create project<Arrow/></button><button className="mh-home-text mh-home-muted-link" onClick={()=>navigate('overview')}>Import token</button></div></div>
      </section>
      <section className="mh-home-surface mh-home-community" aria-labelledby="mh-community-title">
        <header className="mh-feature-heading"><span className="mh-feature-label">{icon('community')}Community & content</span><span className="mh-preview-label">Preview</span></header><div className="mh-community-description"><h2 id="mh-community-title">Plan the conversation.</h2><p>A place for the weekly plan, the invitation and the words.</p></div>
        <div className="mh-community-preview" aria-label="Community calendar, invitation and content preview"><div className="mh-week-preview"><header><strong>Weekly plan</strong><span>UTC</span></header><div className="mh-week-days">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div><div className="mh-week-grid"><span className="mh-week-event">{icon('calendar')}<i/></span><span className="mh-week-post"><WorkflowGlyph kind="draft"/><i/></span></div><footer>Planning preview</footer></div><div className="mh-paper-preview"><div className="mh-draft-paper"><span>Community update</span><i/><i/><i/></div><div className="mh-invite-paper"><span className="mh-invite-glyph">{icon('community')}</span><strong>You’re invited.</strong><span>Community call</span><small>Date & time · UTC</small><i/></div></div></div>
        <footer className="mh-feature-footer"><p>Create or import a project to start planning.</p><button className="mh-home-text" onClick={()=>navigate('overview')}>Open Projects<Arrow/></button></footer>
      </section>
      <section className="mh-home-surface mh-home-market" aria-labelledby="mh-market-title">
        <header className="mh-feature-heading"><span className="mh-feature-label">{icon('discover')}Market watch</span><span className="mh-network-label"><i/>Robinhood</span></header><h2 id="mh-market-title">Look closer.</h2><p className="mh-market-description">Research a token’s observed prices, holders and trades.</p>
        <form className="mh-market-lookup" onSubmit={lookUpToken} noValidate><label htmlFor={addressId}>Token address</label><div><input id={addressId} value={address} onChange={event=>{setAddress(event.target.value);if(addressError)setAddressError('');}} placeholder="0x…" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!addressError} aria-describedby={addressError?errorId:undefined}/><button type="submit" aria-label="Look up token"><Arrow/></button></div>{addressError&&<p id={errorId} className="mh-address-error" role="alert">{addressError}</p>}</form>
        <div className="mh-market-evidence"><span>{icon('discover')}</span><div><strong>Start with a token.</strong><p>Check the data and its coverage before your next move.</p></div></div><footer className="mh-feature-footer"><button className="mh-home-text" onClick={()=>navigate('discover')}>Browse Market<Arrow/></button><button className="mh-home-text mh-home-muted-link" onClick={()=>navigate('signals')}>{wallet?'Open Signals':'Keep your own watchlist'}</button></footer>
      </section>
    </div>}
    {project&&<section className="mh-saved-workspace" aria-label="Your saved workspace">
      <header className="mh-saved-heading"><div><h2>Your workspace</h2><p>Saved projects, plans and the things that need your attention.</p></div><button className="mh-home-text" onClick={()=>navigate('overview')}>All projects<Arrow/></button></header>
      <div className="mh-saved-grid">
        <section className="mh-saved-panel mh-saved-projects"><header><h3>Projects <span>{owned.length}</span></h3><button className="mh-home-text" onClick={()=>navigate('launch')}>New coin<Arrow/></button></header><div className="command-project-filters" aria-label="Filter desktop projects">{(['all','draft','launched','imported'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{({all:'All',draft:'Drafts',launched:'Launched',imported:'Imported'})[value]}<span>{owned.filter(item=>value==='all'||item.status===value).length}</span></button>)}</div><div className="command-project-list">{rows.length?rows.map(item=><button className="command-project-row" key={item.id} onClick={()=>openProject(item.id)}><span className="command-token">{item.image?<img src={imageSource(item.image)} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}}/>:null}<span>{item.symbol.slice(0,2)}</span></span><span><strong>{item.name}</strong><small>${item.symbol}</small></span><span className="command-status" data-status={item.status}>{({draft:'Draft',launched:'Launched',imported:'Imported'})[item.status]}</span><Arrow/></button>):<div className="mh-saved-empty"><p>No projects in this view.</p><button className="mh-home-text" onClick={()=>setFilter('all')}>Show all projects</button></div>}</div></section>
        <section className="mh-saved-panel"><header><h3>Next up</h3><button className="mh-home-text" onClick={openMate}>Open Copilot<Arrow/></button></header><label className="command-project-select"><span>Project</span><select aria-label="Desktop project" value={project.id} onChange={event=>setSelected(event.target.value)}>{owned.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="command-next-list">{summary.actions?.slice(0,2).map(action=><button key={action.id} aria-label={'Open Copilot for '+action.title} onClick={openMate}><span className="command-kind">{action.status==='proposed'?'Awaiting your review':'Ready to act'}</span><strong>{action.title}</strong><small>{action.dueAt?utcDateTime(action.dueAt,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'No due date'}</small><Arrow/></button>)}{summary.loading&&summary.actions===null?<p className="mh-saved-empty" role="status">Reading your saved plans…</p>:summary.actions?.length===0?<div className="mh-saved-empty"><strong>Your next plan starts here.</strong><p>Shape a post or plan a community event.</p><button className="mh-home-text" onClick={openMate}>Plan with MATE<Arrow/></button></div>:summary.actions===null?<div className="mh-saved-empty"><p>Some saved plans could not be read.</p><button className="mh-home-text" onClick={summary.refresh}>Refresh plans</button></div>:null}</div></section>
        <section className="mh-saved-panel"><header><h3>Upcoming · UTC</h3><button className="mh-home-text" onClick={()=>openView('content')}>View plans<Arrow/></button></header><div className="command-agenda">{summary.agenda?.length?summary.agenda.slice(0,2).map((item,index)=><button key={item.kind+item.at+index} aria-label={'Open Copilot for '+item.title} onClick={()=>openView(item.kind==='Community event'?'community':'content')}><span className="command-row-icon">{icon('calendar')}</span><span><strong>{item.title}</strong><small>{utcDateTime(item.at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></span><span className="command-agenda-kind">{item.kind==='Community event'?'Event':'Post'}</span></button>):summary.loading&&summary.agenda===null?<p className="mh-saved-empty" role="status">Reading upcoming plans…</p>:<div className="mh-saved-empty"><p>{summary.agenda===null?'Your saved agenda is unavailable.':'No upcoming events or posts saved.'}</p><button className="mh-home-text" onClick={summary.agenda===null?summary.refresh:()=>openView('community')}>{summary.agenda===null?'Refresh upcoming plans':'Plan an event'}<Arrow/></button></div>}</div></section>
        <section className="mh-saved-panel"><header><h3>Saved Signals</h3><button className="mh-home-text" onClick={()=>navigate('signals')}>Open Signals<Arrow/></button></header><div className="command-signal-summary"><span><strong>{summary.watchCount??'—'}</strong> watching</span><span><strong>{summary.unreadCount??'—'}</strong> unread in recent signals</span></div>{summary.alerts===null&&!summary.loading?<div className="mh-saved-empty"><p>Saved signals are unavailable.</p><button className="mh-home-text" onClick={summary.refresh}>Refresh signals</button></div>:summary.alerts?.length?<div className="command-signal-list">{summary.alerts.slice(0,2).map(alert=><button key={alert.id} onClick={()=>navigate('signals')}><span><strong>{alert.title}</strong><small>{utcDateTime(alert.createdAt,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></span><Arrow/></button>)}</div>:<p className="mh-saved-empty">{summary.loading?'Reading your saved signals…':'No recent signals saved.'}</p>}</section>
      </div>
    </section>}
    <footer className="mh-home-bottom"><span>{wallet?'Your work stays with your wallet.':'Sign in with your wallet to save your projects.'}</span><span>Launch it. Steer it.</span></footer>
  </section>;
}
