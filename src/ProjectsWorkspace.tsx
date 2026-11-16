import {useState} from 'react';
import {Arrow} from './Brand';
import {DesktopIcon} from './Desktop';
import {imageSource} from '../shared/project.mjs';
import type {Page,Project,Snapshot} from './types';

type Props={projects:Project[];active?:Project;snapshot:Snapshot|null;state:'loading'|'ready'|'error';busy:boolean;chainError:string;select:(id:string)=>void;create:()=>void;importToken:()=>void;retry:()=>void;navigate:(page:Page)=>void;edit:(project:Project)=>void;updated:(project:Project)=>void};
const short=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;
const number=(value:string|undefined)=>value===undefined?'—':Number(value).toLocaleString('en-US',{maximumFractionDigits:5});
function ProjectImage({project}:{project:Project}){const [failed,setFailed]=useState(false);return <span className="projects-token-image">{!failed&&imageSource(project.image)?<img src={imageSource(project.image)} alt="" onError={()=>setFailed(true)}/>:project.symbol.slice(0,2)}</span>;}

export function ProjectsWorkspace({projects,active,snapshot,state,busy,chainError,select,create,importToken,retry,navigate,edit,updated}:Props){
  const known=state==='ready'||projects.length>0;
  const metrics=[
    {label:'All projects',value:known?String(projects.length):'—',note:state==='loading'?'Reading your workspace':state==='error'?'Project read unavailable':'Linked to your wallet'},
    {label:'Drafts',value:known?String(projects.filter(item=>item.status==='draft').length):'—',note:'Ideas ready to continue'},
    {label:'Launched',value:known?String(projects.filter(item=>item.status==='launched').length):'—',note:'Issued through MemeHelm'},
    {label:'Imported',value:known?String(projects.filter(item=>item.status==='imported').length):'—',note:'Existing tokens you track'},
  ];  return <div className="projects-system">
    <header className="application-heading"><div><h1>Projects</h1><p>Keep your coins, launch drafts and community pages together.</p></div><div className="application-actions"><button className="button secondary" onClick={importToken}>Import token</button><button className="button primary" disabled={busy} onClick={create}>New project <Arrow/></button></div></header>
    <div className="projects-metrics">{metrics.map(item=><div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}</div>
    <div className="projects-browser">
      <section className="projects-library" aria-label="Your projects"><header><h2>Project library</h2><span>{state==='ready'||projects.length?projects.length:'—'}</span></header>
        {state==='loading'&&!projects.length?<div className="application-empty" role="status"><span className="spinner"/><h3>Finding your projects…</h3><p>Your saved drafts and coins will appear here.</p></div>:state==='error'&&!projects.length?<div className="application-empty"><DesktopIcon name="projects" size={30}/><h3>Couldn’t load your projects.</h3><p>Your saved work is still linked to your wallet.</p><button className="button secondary" onClick={retry}>Try again</button></div>:projects.length?<div className="projects-library-list">{projects.map(project=><button key={project.id} aria-pressed={active?.id===project.id} onClick={()=>select(project.id)}><ProjectImage key={`${project.id}:${project.image}`} project={project}/><span><strong>{project.name}</strong><small>${project.symbol} · {project.tokenAddress?short(project.tokenAddress):'Launch draft'}</small></span><span className={`projects-status is-${project.status}`}>{project.status==='launched'?'Onchain':project.status==='imported'?'Imported':'Draft'}</span><Arrow/></button>)}</div>:<div className="application-empty"><DesktopIcon name="projects" size={32}/><h3>Your next idea starts here.</h3><p>Save a launch draft or bring in a token you already own.</p><button className="button secondary" onClick={create}>Create a project <Arrow/></button></div>}
        <footer>Linked to your signed-in wallet.</footer>
      </section>
      <section className="projects-detail" aria-label="Project details">{active?<>
        <header className="projects-detail-header"><ProjectImage key={`${active.id}:${active.image}`} project={active}/><div><span className="projects-detail-symbol">${active.symbol}</span><h2>{active.name}</h2></div><span className={`projects-status is-${active.status}`}>{active.status==='launched'?'Onchain':active.status==='imported'?'Imported':'Draft'}</span></header>
        <p className="projects-description">{active.description||'Add a story as you shape this project.'}</p>
        {active.tokenAddress&&<a className="projects-address" href={`https://robinhoodchain.blockscout.com/token/${active.tokenAddress}`} target="_blank" rel="noreferrer"><span>Robinhood Chain</span><code>{short(active.tokenAddress)}</code><Arrow/></a>}
        <div className="projects-tools"><button onClick={()=>navigate('workspace')}><DesktopIcon name="projects" size={23}/><span><strong>Open project</strong><small>Overview, content, community and finances</small></span><Arrow/></button><button onClick={()=>navigate('copilot')}><DesktopIcon name="copilot" size={23}/><span><strong>Talk to MATE</strong><small>Plan the next move with your AI assistant</small></span><Arrow/></button></div>
        {active.status==='draft'&&active.draft&&<button className="button secondary projects-continue" disabled={busy} onClick={()=>edit(active)}>Continue launch draft <Arrow/></button>}
        <button className="text-button" onClick={()=>navigate('publication')}>Manage public page <Arrow/></button>

      </>:<div className="projects-detail-intro"><DesktopIcon name="launch" size={36}/><h2>A home for every coin.</h2><p>Choose a project to see its details, work with MATE and manage creator revenue.</p><ol><li><span>01</span><div><strong>Build the idea</strong><p>Keep the name, story and launch settings in a saved draft.</p></div></li><li><span>02</span><div><strong>Keep it moving</strong><p>Use project context to plan content and review your next actions.</p></div></li><li><span>03</span><div><strong>Share on your terms</strong><p>Choose when to publish your project page and community updates.</p></div></li></ol></div>}</section>
    </div>
    <footer className="application-footnote"><DesktopIcon name="treasury" size={15}/>Publishing is your choice. Every transaction requires approval in your wallet.</footer>
  </div>;
}
