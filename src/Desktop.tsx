import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent,ReactNode} from 'react';
import {Arrow,HelmMark,Wordmark} from './Brand';
import {prefersLessMotion} from './EntryLoader';
import {Wallpaper} from './Wallpaper';
import {SearchPalette} from './SearchPalette';
import {MateCompanion} from './MateCompanion';
import {SingleWorkspace} from './SingleWorkspace';
import {useModalFocus} from './useModalFocus';
import type {Page,Project} from './types';
import {fitWindow,initialWindow,moveWindow,resizeWindow} from '../shared/desktop-layout.mjs';
import {imageSource} from '../shared/project.mjs';
import './desktop.css';
import './recovery.css';

type ToolId=Page;
export const apps:{id:ToolId;title:string;description:string;icon:string;color:string}[]=[
  {id:'home',title:'Workbench',description:'Your projects and next moves',icon:'home',color:'peach'},
  {id:'workspace',title:'Project overview',description:'Review actions, observations and outcomes',icon:'home',color:'peach'},
  {id:'community',title:'Community',description:'Manage your community and its events',icon:'community',color:'mint'},
  {id:'calendar',title:'Calendar',description:'Plan content and record outcomes',icon:'calendar',color:'mint'},
  {id:'memory',title:'AI setup',description:'Project knowledge, voice and review settings',icon:'guide',color:'blue'},
  {id:'goals',title:'Community goals',description:'Invite and review contributions',icon:'community',color:'yellow'},
  {id:'activity',title:'Activity',description:'Decisions, observations and outcomes',icon:'signals',color:'mint'},
  {id:'writing',title:'Writing',description:'Draft and review project content',icon:'guide',color:'blue'},
  {id:'assets',title:'Assets',description:'Compose images and export a PNG',icon:'guide',color:'blue'},
  {id:'publishing',title:'Publishing',description:'Review posts and record published results',icon:'writing',color:'blue'},
  {id:'publication',title:'Public page',description:'Preview and manage your project page',icon:'community',color:'mint'},
  {id:'discover',title:'Market',description:'Discover tokens, follow changes and review trades',icon:'discover',color:'yellow'},
  {id:'signals',title:'Watchlist & alerts',description:'Your saved tokens and observed changes',icon:'signals',color:'mint'},
  {id:'launch',title:'Launchpad',description:'Create your coin on Robinhood',icon:'launch',color:'orange'},
  {id:'copilot',title:'MATE',description:'Open your project’s AI assistant',icon:'copilot',color:'mint'},
  {id:'treasury',title:'Treasury',description:'Follow revenue and release funds',icon:'treasury',color:'yellow'},
  {id:'overview',title:'Projects',description:'Your drafts, launched coins and imported tokens',icon:'projects',color:'blue'},
  {id:'calculator',title:'Revenue allocation',description:'Preview a fixed split inside Launchpad',icon:'calculator',color:'pink'},
  {id:'guide',title:'Quick Guide',description:'Launching, revenue and AI explained',icon:'guide',color:'lavender'},
];
const appFor=(id:ToolId)=>apps.find(app=>app.id===id)!;
type Rect={x:number;y:number;width:number;height:number};
type DeskWindow={id:ToolId;rect:Rect;minimized:boolean;maximized:boolean;customized?:boolean;motion?:'opening'|'restoring'|'minimizing'|'closing'};
type Bounds={width:number;height:number};

function systemWindow(page:Page,bounds:Bounds,index=0):Rect{
  const current=initialWindow(page,bounds,index);
  if(bounds.width<=720)return current;
  const rail=bounds.width>=1280?176:bounds.width>=1024?104:0;
  const inset=rail+18,offset=(index%3)*16;
  const compact=['home','guide','calculator'].includes(page);
  const desired=page==='calculator'?520:page==='guide'?760:page==='home'?1000:1440;
  return fitWindow({...current,x:inset+offset,y:18+offset,width:Math.min(desired,bounds.width-inset-18-offset),height:Math.min(compact?720:900,bounds.height-36-offset)},bounds);
}

function DiscardWindow({keep,discard,signout=false}:{keep:()=>void;discard:()=>void;signout?:boolean}){
  const panel=useRef<HTMLElement>(null);useModalFocus(panel,keep);
  return <div className="modal-overlay window-discard-overlay"><section className="modal panel" role="alertdialog" aria-modal="true" aria-labelledby="window-discard-title" aria-describedby="window-discard-description" ref={panel} tabIndex={-1}><h2 id="window-discard-title">Keep your work open?</h2><p id="window-discard-description">There are unsaved edits or a request in progress. Keep the window open to save your work or wait for the result. Closing does not cancel a submitted request.</p><div className="button-row"><button className="button primary" onClick={keep}>Keep editing</button><button className="button secondary" onClick={discard}>{signout?'Discard edits and sign out':'Discard edits and close'}</button></div></section></div>;
}

export function DesktopIcon({name,size=48}:{name:string;size?:number}){
  const symbols:Record<string,ReactNode>={
    home:<><path d="m5 13 11-9 11 9v15H5Z"/><path d="M12 28V17h8v11"/></>,
    discover:<><circle cx="16" cy="16" r="12"/><path d="m21 11-3 7-7 3 3-7Z" fill="currentColor" stroke="none"/></>,
    launch:<><path d="M12 10 25 4l-3 14-9 7-6-6Z" fill="currentColor" fillOpacity=".16"/><path d="m12 10 7 4 3 4M7 19l-4 2 7 3 3 5 1-4M7 25l-3 4"/><circle cx="19" cy="11" r="2" fill="currentColor" stroke="none"/></>,
    copilot:<><path d="m5 14 9-9h7l-6 6h-2l-5 5 5 5 3-3 4 4-6 6h-4l-8-8v-3Z" fill="currentColor" fillOpacity=".7" stroke="none"/><path d="m18 4 11 10v4l-9 9h-7l6-6h2l5-5-6-6-3 3-4-4Z" fill="currentColor" fillOpacity=".32" stroke="none"/><path d="m23 10 6 5-5 5-6-5Z" fill="var(--mh-accent)" stroke="none"/></>,
    signals:<><path d="M3 17h6l4-10 6 18 4-10h6"/><path d="M5 4h4m14 24h4" opacity=".4"/></>,
    treasury:<><rect x="4" y="5" width="24" height="23" rx="2"/><path d="M10 5V3h12v2M11 16h10m-5-5v10"/><circle cx="16" cy="16" r="8"/></>,
    projects:<><path d="M3 7h10l3 4h13v16H3Z" fill="currentColor" fillOpacity=".16"/><path d="M3 7h10l3 4H3Z" fill="var(--mh-accent)" stroke="none"/><path d="M3 13h26v14H3Z" fill="currentColor" fillOpacity=".28"/></>,
    calculator:<><path d="M4 4h24v24H4ZM16 4v24M4 16h24"/><path d="M8 10h4m-2-2v4m10-2h4M8 21h4m8-1h4m-4 3h4"/></>,
    guide:<><path d="M4 5h10l2 3 2-3h10v22H18l-2 2-2-2H4ZM16 8v21"/><path d="M8 11h4m-4 5h4m-4 5h4m8-10h4m-4 5h4m-4 5h4"/></>,
    community:<><circle cx="12" cy="10" r="4"/><path d="M4 27v-4a8 8 0 0 1 16 0v4ZM22 6a4 4 0 0 1 0 8m1 5a7 7 0 0 1 5 7H24"/></>,
    calendar:<><rect x="4" y="6" width="24" height="23" rx="3"/><path d="M10 3v7M22 3v7M4 14h24M10 19h2m8 0h2m-12 5h2m8 0h2"/></>,
  };
  return <svg className="app-symbol" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{symbols[name]||symbols.home}</svg>;
}

export function AppTile({name}:{name:string}){return <span className={`os-app-tile os-icon-${name}`}><DesktopIcon name={name} size={38}/><i/></span>;}

export function ShellIcon({name}:{name:'search'|'pause'|'play'|'desktop'|'grid'|'wallet'}){
  const paths={search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,pause:<><path d="M8 5v14M16 5v14"/></>,play:<path d="m8 5 11 7-11 7Z"/>,desktop:<><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/></>,grid:<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,wallet:<><path d="M20 8H6a2 2 0 0 1 0-4h12v4M4 6v13h16V8"/><path d="M20 12h-6v4h6"/></>};
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Welcome({navigate,projects,openProject}:{navigate:(page:Page)=>void;projects:Project[];openProject:(id:string)=>void}){
  const project=projects[0];
  const tasks=[{title:'Create your next coin',text:'Give an idea a name, a story and a launch.',page:'launch' as Page,icon:'launch'}, {title:'Make your next move',text:'Keep context, review actions and shape your content.',page:'copilot' as Page,icon:'copilot'}, {title:'Give revenue a destination',text:'Explore a fixed allocation for your creator fees.',page:'calculator' as Page,icon:'treasury'}];
  return <div className="os-workspace">
    <aside className="os-workspace-sidebar"><div className="os-workspace-brand"><HelmMark/><strong>MemeHelm</strong></div><nav aria-label="Workspace tools">{(['home','overview','copilot','treasury','discover'] as Page[]).map(id=><button key={id} className={id==='home'?'selected':''} aria-current={id==='home'?'page':undefined} onClick={()=>navigate(id)}><DesktopIcon name={appFor(id).icon} size={20}/>{id==='home'?'Today':id==='overview'?'Projects':appFor(id).title}</button>)}</nav><button className="os-workspace-help" onClick={()=>navigate('guide')}><DesktopIcon name="guide" size={19}/>Quick guide <Arrow/></button></aside>
    <main className="os-workspace-main"><header className="os-workspace-heading"><div><h1>Your workspace.</h1><p>A little direction for your next big idea.</p></div><button className="button primary" onClick={()=>navigate('launch')}>Launch a coin <Arrow/></button></header>
      <div className="os-project-identity"><div className="os-project-art">{project?.image?<img src={imageSource(project.image)} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>:<HelmMark/>}</div><div><h2>{project?.name||'MemeHelm'}</h2><p>{project?`$${project.symbol}`:'Launch it. Steer it.'}</p><button className="text-button" onClick={()=>project?openProject(project.id):navigate('overview')}>{project?'Open project':'Your projects'}<Arrow diagonal/></button></div></div>
      <section className="os-next-moves"><h2>Your next moves</h2>{tasks.map(task=><button key={task.title} onClick={()=>navigate(task.page)}><span className="os-task-icon"><DesktopIcon name={task.icon} size={24}/></span><span><strong>{task.title}</strong><small>{task.text}</small></span><Arrow/></button>)}</section>
      <section className="os-project-shelf"><header><h2>On your desk</h2><button className="text-button" onClick={()=>navigate('overview')}>All projects <Arrow/></button></header>{projects.length?<div className="os-project-items">{projects.slice(0,3).map(item=><button key={item.id} onClick={()=>openProject(item.id)}><span className="os-project-initials">{item.symbol.slice(0,2)}</span><span><strong>{item.name}</strong><small>{item.status==='draft'?'Continue your draft':item.status==='imported'?'Imported project':'Launched coin'}</small></span><Arrow/></button>)}</div>:<div className="os-project-empty"><AppTile name="projects"/><div><strong>Room for something yours.</strong><p>Your coins and drafts come together here.</p></div><button className="text-button" onClick={()=>navigate('overview')}>Get started <Arrow/></button></div>}</section>
    </main>
  </div>;
}

export function QuickGuide({navigate}:{navigate:(page:Page)=>void}){
  const [topic,setTopic]=useState(0);
  const guides=[
    {title:'From an idea to a coin.',text:'A few essentials, a clear revenue split, and your wallet’s approval.',steps:[['Connect your wallet','Use an EVM wallet such as MetaMask or Rabby. The app uses Robinhood Chain and ETH for transactions.'],['Make the coin yours','Enter your name, symbol, story and hosted artwork link. Choose a direct fee recipient or a fixed wallet split.'],['Review, then sign','Check the live supply, fees and graduation target. Review your launch and sign in your wallet.']],action:'Open Launchpad',page:'launch' as Page},
    {title:'A purpose for every share.',text:'See what comes in, what each wallet can claim, and what has already been released.',steps:[['Choose your destinations','Choose a direct fee recipient, or activate a fixed two-wallet split.'],['Follow the revenue','Settle protocol fees, collect the escrow balance into your vault, then review each wallet’s share.'],['Release each share','Connect your wallet and request a payout. Funds go to the designated recipient; each share can be released independently.']],action:'Open Treasury',page:'treasury' as Page},
    {title:'Keep your project moving.',text:'Remember the context, review the next action and learn from the result.',steps:[['Save project memory','Create or import a project. Record its story, roadmap, commitments and private boundaries.'],['Review the next actions','Check observations and request an AI review within your project’s daily allowance. Read and edit proposals before approving.'],['Act and record the result','Confirm project-page publication separately. Complete community tasks with an outcome for your next review. Scheduled AI is optional; wallet transactions require your signature.']],action:'Open Copilot',page:'copilot' as Page},
  ];
  const guide=guides[topic];
  return <div className="guide-app"><div className="guide-tabs" aria-label="Guide topics">{['Launch a coin','Revenue','AI Copilot'].map((label,index)=><button key={label} aria-pressed={topic===index} className={topic===index?'active':''} onClick={()=>setTopic(index)}>{label}</button>)}</div><div className="guide-content"><span className="desktop-eyebrow">A FRIENDLY FIELD GUIDE</span><h1>{guide.title}</h1><p>{guide.text}</p><ol>{guide.steps.map(([title,body],index)=><li key={title}><span>{index+1}</span><div><h2>{title}</h2><p>{body}</p></div></li>)}</ol><button className="button primary" onClick={()=>navigate(guide.page)}>{guide.action}<Arrow/></button></div></div>;
}

export function SplitCalculator({useSplit,compact=false}:{useSplit:(reserve:number)=>void;compact?:boolean}){
  const [amount,setAmount]=useState('1'),[reserve,setReserve]=useState(10);
  const parsed=Number(amount),revenue=Number.isFinite(parsed)?Math.max(0,parsed):0;
  const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:5});
  return <div className={`calculator-app ${compact?'calculator-compact':''}`}><div className="calculator-intro"><DesktopIcon name="calculator" size={32}/><div>{compact?<h2>Give revenue a destination.</h2>:<h1>Find your split.</h1>}<p>Try an allocation before you launch.</p></div></div><label className="calculator-input">Example revenue<div><input aria-label="Example vault revenue in ETH" inputMode="decimal" type="number" min="0" step="0.1" value={amount} onChange={event=>setAmount(event.target.value)}/><span>ETH</span></div></label><div className="calculator-shares"><div><span>Project wallet</span><strong>{100-reserve}<small>%</small></strong></div><Arrow diagonal/><div><span>Reserve wallet</span><strong>{reserve}<small>%</small></strong></div></div><label className="calculator-range"><span>Reserve allocation<strong>{reserve}%</strong></span><input aria-label="Example reserve allocation" type="range" min="0" max="100" value={reserve} onChange={event=>setReserve(Number(event.target.value))}/></label><div className="calculator-totals"><div><span>Project receives</span><strong>{format(revenue*(100-reserve)/100)} <small>ETH</small></strong></div><div><span>Reserve receives</span><strong>{format(revenue*reserve/100)} <small>ETH</small></strong></div></div><button className="button secondary full" onClick={()=>useSplit(reserve)}>Use this allocation <Arrow/></button><p className="calculator-note">Illustrative amounts, not earnings. Applies to ETH received by your vault.</p></div>;
}

export type DesktopProps={assistant?:ReactNode;selectProject?:(id:string)=>boolean|void;page:Page;navigate:(page:Page)=>void;renderPage:(page:Page)=>ReactNode;projects:Project[];projectsState?:'loading'|'ready'|'error';refreshProjects?:()=>void;wallet:string;busy:string;connect:()=>Promise<void>;logout:()=>Promise<void>;useSplit:(reserve:number)=>void;openProject:(id:string)=>boolean|void;entered:boolean;introRevealed:boolean;replayIntro:()=>void};

export function Desktop(props:DesktopProps){return <SingleWorkspace {...props}/>;}
