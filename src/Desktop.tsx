import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent,ReactNode} from 'react';
import {Arrow,HelmMark,Wordmark} from './Brand';
import {EntryLoader,prefersLessMotion} from './EntryLoader';
import {Wallpaper} from './Wallpaper';
import {SearchPalette} from './SearchPalette';
import type {Page,Project} from './types';
import {fitWindow,initialWindow,moveWindow,resizeWindow} from '../shared/desktop-layout.mjs';
import {imageSource} from '../shared/project.mjs';
import './desktop.css';

type ToolId=Page;
export const apps:{id:ToolId;title:string;description:string;icon:string;color:string}[]=[
  {id:'home',title:'Workspace',description:'Your project, at a glance',icon:'home',color:'peach'},
  {id:'discover',title:'Discover',description:'Explore MemeHelm launches',icon:'discover',color:'yellow'},
  {id:'signals',title:'Signals',description:'Your watchlist and private alerts',icon:'signals',color:'mint'},
  {id:'launch',title:'Launchpad',description:'Create your coin on Robinhood',icon:'launch',color:'orange'},
  {id:'copilot',title:'AI Copilot',description:'Project memory, action reviews and writing',icon:'copilot',color:'mint'},
  {id:'treasury',title:'Treasury',description:'Follow revenue and release funds',icon:'treasury',color:'yellow'},
  {id:'overview',title:'My Projects',description:'Your coins, together in one place',icon:'projects',color:'blue'},
  {id:'calculator',title:'Split Calculator',description:'Find the right revenue allocation',icon:'calculator',color:'pink'},
  {id:'guide',title:'Quick Guide',description:'Launching, revenue and AI explained',icon:'guide',color:'lavender'},
];
const appFor=(id:ToolId)=>apps.find(app=>app.id===id)!;
type Rect={x:number;y:number;width:number;height:number};
type DeskWindow={id:ToolId;rect:Rect;minimized:boolean;maximized:boolean;motion?:'opening'|'restoring'|'minimizing'|'closing'};
type Bounds={width:number;height:number};

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
  };
  return <svg className="app-symbol" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{symbols[name]||symbols.home}</svg>;
}

function AppTile({name}:{name:string}){return <span className={`os-app-tile os-icon-${name}`}><DesktopIcon name={name} size={38}/><i/></span>;}

function ShellIcon({name}:{name:'search'|'pause'|'play'|'desktop'|'grid'|'wallet'}){
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

function QuickGuide({navigate}:{navigate:(page:Page)=>void}){
  const [topic,setTopic]=useState(0);
  const guides=[
    {title:'From an idea to a coin.',text:'A few essentials, a clear revenue split, and your wallet’s approval.',steps:[['Connect your wallet','Use an EVM wallet such as MetaMask or Rabby. The app uses Robinhood Chain and ETH for transactions.'],['Make the coin yours','Enter your name, symbol, story and hosted artwork link. Choose a direct fee recipient or a fixed wallet split.'],['Review, then sign','Check the live supply, fees and graduation target. Review your launch and sign in your wallet.']],action:'Open Launchpad',page:'launch' as Page},
    {title:'A purpose for every share.',text:'See what comes in, what each wallet can claim, and what has already been released.',steps:[['Choose your destinations','Choose a direct fee recipient, or activate a fixed two-wallet split.'],['Follow the revenue','Settle protocol fees, collect the escrow balance into your vault, then review each wallet’s share.'],['Release each share','Connect your wallet and request a payout. Funds go to the designated recipient; each share can be released independently.']],action:'Open Treasury',page:'treasury' as Page},
    {title:'Keep your project moving.',text:'Remember the context, review the next action and learn from the result.',steps:[['Save project memory','Create or import a project. Record its story, roadmap, commitments and private boundaries.'],['Review the next actions','Check observations and request an AI review within your project’s daily allowance. Read and edit proposals before approving.'],['Act and record the result','Confirm project-page publication separately. Complete community tasks with an outcome for your next review. Scheduled AI is optional; wallet transactions require your signature.']],action:'Open Copilot',page:'copilot' as Page},
  ];
  const guide=guides[topic];
  return <div className="guide-app"><div className="guide-tabs" aria-label="Guide topics">{['Launch a coin','Revenue','AI Copilot'].map((label,index)=><button key={label} aria-pressed={topic===index} className={topic===index?'active':''} onClick={()=>setTopic(index)}>{label}</button>)}</div><div className="guide-content"><span className="desktop-eyebrow">A FRIENDLY FIELD GUIDE</span><h1>{guide.title}</h1><p>{guide.text}</p><ol>{guide.steps.map(([title,body],index)=><li key={title}><span>{index+1}</span><div><h2>{title}</h2><p>{body}</p></div></li>)}</ol><button className="button primary" onClick={()=>navigate(guide.page)}>{guide.action}<Arrow/></button></div></div>;
}

function SplitCalculator({useSplit,compact=false}:{useSplit:(reserve:number)=>void;compact?:boolean}){
  const [amount,setAmount]=useState('1'),[reserve,setReserve]=useState(10);
  const parsed=Number(amount),revenue=Number.isFinite(parsed)?Math.max(0,parsed):0;
  const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:5});
  return <div className={`calculator-app ${compact?'calculator-compact':''}`}><div className="calculator-intro"><DesktopIcon name="calculator" size={32}/><div>{compact?<h2>Give revenue a destination.</h2>:<h1>Find your split.</h1>}<p>Try an allocation before you launch.</p></div></div><label className="calculator-input">Example revenue<div><input aria-label="Example vault revenue in ETH" inputMode="decimal" type="number" min="0" step="0.1" value={amount} onChange={event=>setAmount(event.target.value)}/><span>ETH</span></div></label><div className="calculator-shares"><div><span>Project wallet</span><strong>{100-reserve}<small>%</small></strong></div><Arrow diagonal/><div><span>Reserve wallet</span><strong>{reserve}<small>%</small></strong></div></div><label className="calculator-range"><span>Reserve allocation<strong>{reserve}%</strong></span><input aria-label="Example reserve allocation" type="range" min="0" max="100" value={reserve} onChange={event=>setReserve(Number(event.target.value))}/></label><div className="calculator-totals"><div><span>Project receives</span><strong>{format(revenue*(100-reserve)/100)} <small>ETH</small></strong></div><div><span>Reserve receives</span><strong>{format(revenue*reserve/100)} <small>ETH</small></strong></div></div><button className="button secondary full" onClick={()=>useSplit(reserve)}>Use this allocation <Arrow/></button><p className="calculator-note">Illustrative amounts, not earnings. Applies to ETH received by your vault.</p></div>;
}

type Props={page:Page;navigate:(page:Page)=>void;renderPage:(page:Page)=>ReactNode;projects:Project[];wallet:string;busy:string;connect:()=>Promise<void>;logout:()=>Promise<void>;useSplit:(reserve:number)=>void;openProject:(id:string)=>void};

export function Desktop({page,navigate,renderPage,projects,wallet,busy,connect,logout,useSplit,openProject}:Props){
  const surface=useRef<HTMLDivElement>(null);
  const [bounds,setBounds]=useState<Bounds>({width:1280,height:720});
  const [windows,setWindows]=useState<DeskWindow[]>(()=>page==='home'?[]:[{id:page,rect:initialWindow(page,{width:1280,height:720},0),minimized:false,maximized:false,motion:'opening'}]);
  const [active,setActive]=useState<ToolId|null>(page==='home'?null:page),[startOpen,setStartOpen]=useState(false),[now,setNow]=useState(new Date()),[searchOpen,setSearchOpen]=useState(false);
  const [ambientPaused,setAmbientPaused]=useState(()=>{try{return localStorage.getItem('memehelm:desktop:ambient')==='paused';}catch{return false;}});
  const [visible,setVisible]=useState(()=>!document.hidden);
  const [entered,setEntered]=useState(prefersLessMotion),[dragging,setDragging]=useState<ToolId|null>(null);
  const gesture=useRef<{id:ToolId;kind:'move'|'resize';x:number;y:number;rect:Rect;pointer:number}|null>(null);
  const menuRef=useRef<HTMLDivElement>(null),startRef=useRef<HTMLButtonElement>(null),topAppsRef=useRef<HTMLButtonElement>(null);
  const measured=useRef(false);
  const firstRoute=useRef(true),keyboardInput=useRef(false),requestedWindowFocus=useRef<ToolId|null>(null);
  const motionTimers=useRef(new Map<ToolId,number>()),currentWindows=useRef(windows),currentActive=useRef(active);
  currentWindows.current=windows;currentActive.current=active;
  useEffect(()=>{
    if(!surface.current)return;
    const observer=new ResizeObserver(([entry])=>{const value={width:entry.contentRect.width,height:entry.contentRect.height};if(value.width<1||value.height<1)return;setBounds(value);const first=!measured.current;measured.current=true;setWindows(previous=>previous.map((win,index)=>({...win,rect:first?initialWindow(win.id,value,index):value.width<=720?win.rect:fitWindow(win.rect,value)})));});
    observer.observe(surface.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{if(firstRoute.current){firstRoute.current=false;if(page==='home')return;focus(page);return;}if(currentActive.current!==page||!currentWindows.current.some(win=>win.id===page&&!win.minimized))focus(page);},[page]);
  useEffect(()=>{const id=requestedWindowFocus.current;if(!id||active!==id)return;const frame=requestAnimationFrame(()=>{if(currentActive.current!==id)return;requestedWindowFocus.current=null;const win=surface.current?.querySelector<HTMLElement>(`[data-window="${id}"]`);if(win&&!win.hidden&&!win.contains(document.activeElement))win.querySelector<HTMLElement>('.desktop-titlebar h2')?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[active,windows]);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>()=>{for(const timer of motionTimers.current.values())window.clearTimeout(timer);motionTimers.current.clear();},[]);
  useEffect(()=>{if(!startOpen)return;const close=(event:globalThis.PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node)&&!startRef.current?.contains(event.target as Node)&&!topAppsRef.current?.contains(event.target as Node))setStartOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setStartOpen(false);startRef.current?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[startOpen]);
  useEffect(()=>{const key=()=>{keyboardInput.current=true;},pointer=()=>{keyboardInput.current=false;},visibility=()=>setVisible(!document.hidden);document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',pointer,true);document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('visibilitychange',visibility);};},[]);
  useEffect(()=>{const toggle=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(open=>!open);}};window.addEventListener('keydown',toggle);return()=>window.removeEventListener('keydown',toggle);},[]);
  function cancelMotion(id:ToolId){const timer=motionTimers.current.get(id);if(timer!==undefined)window.clearTimeout(timer);motionTimers.current.delete(id);}
  function focus(id:ToolId,enterWindow=true){cancelMotion(id);requestedWindowFocus.current=enterWindow?id:null;setActive(id);const instant=keyboardInput.current||prefersLessMotion();setWindows(previous=>{const win=previous.find(item=>item.id===id);return win?[...previous.filter(item=>item.id!==id),{...win,minimized:false,motion:instant?undefined:win.minimized||win.motion==='minimizing'||win.motion==='closing'?'restoring':win.motion}]:[...previous,{id,rect:initialWindow(id,bounds,previous.length),minimized:false,maximized:false,motion:instant?undefined:'opening'}];});if(page!==id)navigate(id);setStartOpen(false);}
  function returnToDock(id:ToolId){requestAnimationFrame(()=>{const button=document.querySelector<HTMLButtonElement>(`.os-dock-app[data-app="${id}"]`);(button||startRef.current)?.focus({preventScroll:true});});}
  function minimize(id:ToolId){
    const win=currentWindows.current.find(item=>item.id===id);if(!win||win.minimized||win.motion==='closing')return;
    cancelMotion(id);
    const finish=()=>{motionTimers.current.delete(id);setWindows(previous=>previous.map(item=>item.id===id?{...item,minimized:true,motion:undefined}:item));setActive(value=>value===id?null:value);returnToDock(id);};
    if(prefersLessMotion()||keyboardInput.current){finish();return;}
    setWindows(previous=>previous.map(item=>item.id===id?{...item,motion:'minimizing'}:item));
    motionTimers.current.set(id,window.setTimeout(finish,240));
  }
  function close(id:ToolId){
    cancelMotion(id);
    const finish=()=>{
      motionTimers.current.delete(id);
      const next=[...currentWindows.current].reverse().find(win=>win.id!==id&&!win.minimized&&win.motion!=='closing');
      setWindows(previous=>previous.filter(win=>win.id!==id));
      if(currentActive.current===id){setActive(next?.id??null);if(next)navigate(next.id);}returnToDock(id);
    };
    if(prefersLessMotion()||keyboardInput.current){finish();return;}
    setWindows(previous=>previous.map(win=>win.id===id?{...win,motion:'closing'}:win));
    motionTimers.current.set(id,window.setTimeout(finish,180));
  }
  function begin(event:PointerEvent<HTMLElement>,win:DeskWindow,kind:'move'|'resize'){
    if(event.button!==0||win.maximized||bounds.width<=720||(event.target as HTMLElement).closest('button'))return;
    event.preventDefault();focus(win.id,false);setDragging(win.id);setWindows(previous=>previous.map(item=>item.id===win.id?{...item,motion:undefined}:item));gesture.current={id:win.id,kind,x:event.clientX,y:event.clientY,rect:win.rect,pointer:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function adjust(event:PointerEvent<HTMLElement>){const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.x,dy=event.clientY-current.y;const rect=current.kind==='move'?moveWindow(current.rect,dx,dy,bounds):resizeWindow(current.rect,dx,dy,bounds);setWindows(previous=>previous.map(win=>win.id===current.id?{...win,rect}:win));}
  function end(event:PointerEvent<HTMLElement>){if(gesture.current?.pointer===event.pointerId){gesture.current=null;setDragging(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  const shorten=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;
  const desktopApps=(['launch','overview','copilot','discover','signals'] as Page[]).map(appFor);
  const dockApps=(['launch','overview','copilot','treasury','discover','signals'] as Page[]).map(appFor);
  const showDesktop=()=>{currentWindows.current.filter(win=>!win.minimized&&win.motion!=='closing').forEach(win=>minimize(win.id));setActive(null);setStartOpen(false);};
  const toggleAmbient=()=>{setAmbientPaused(value=>{const next=!value;try{localStorage.setItem('memehelm:desktop:ambient',next?'paused':'playing');}catch{}return next;});};
  return <>{!entered&&<EntryLoader onDone={()=>setEntered(true)}/>}<div className={`desktop-shell os-desktop ${active?'has-active-window':''} ${entered?'desktop-ready':'desktop-entering'}`} inert={!entered} aria-hidden={!entered} aria-busy={!entered}><Wallpaper paused={ambientPaused||!visible}/><header className="desktop-topbar"><div className="os-topbar-left"><button className="desktop-brand" onClick={()=>focus('home')} aria-label="Open MemeHelm workspace"><Wordmark/></button><button className="os-menu-button os-desktop-menu" onClick={showDesktop} aria-label="Show desktop"><span>Desktop</span><ShellIcon name="desktop"/></button><button ref={topAppsRef} className="os-menu-button" aria-expanded={startOpen} aria-controls="desktop-app-launcher" onClick={()=>setStartOpen(!startOpen)}>Apps</button></div><div className="desktop-account"><button className="os-motion-button" aria-label={ambientPaused?'Resume background motion':'Pause background motion'} aria-pressed={ambientPaused} onClick={toggleAmbient}><ShellIcon name={ambientPaused?'play':'pause'}/></button><button className="desktop-search-button" aria-label="Search apps and projects" onClick={()=>setSearchOpen(true)}><ShellIcon name="search"/><kbd>⌘K</kbd></button><span className="desktop-network"><i/>Robinhood Chain</span><button className="desktop-wallet" disabled={!!busy} onClick={connect}><ShellIcon name="wallet"/>{wallet?shorten(wallet):'Connect wallet'}</button>{wallet&&<button className="desktop-signout" onClick={logout} title="Sign out of your private workspace">Sign out</button>}<time className="os-topbar-clock" dateTime={now.toISOString()} title={now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}>{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time></div></header>
    <div className="desktop-surface" ref={surface}>
      <nav className="desktop-shortcuts" aria-label="Desktop apps">{desktopApps.map((app,index)=><button key={app.id} className="desktop-shortcut" style={{'--shortcut-order':index} as CSSProperties} onClick={()=>focus(app.id)} title={app.description}><AppTile name={app.icon}/><strong>{app.title}</strong></button>)}</nav>
      <div className="desktop-windows">{windows.map((win,index)=>{const app=appFor(win.id),phone=bounds.width<=720;const rect=win.maximized||phone?{x:0,y:0,width:bounds.width,height:bounds.height}:win.rect;return <section key={win.id} className={`desktop-window ${active===win.id?'focused':''} ${win.maximized?'maximized':''} ${win.motion?`is-${win.motion}`:''} ${dragging===win.id?'is-dragging':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,zIndex:index+1} as CSSProperties} hidden={win.minimized} aria-label={`${app.title} window`} data-window={win.id} onFocusCapture={()=>{if(currentActive.current!==win.id)focus(win.id,false);}} onAnimationEnd={event=>{if(event.target===event.currentTarget&&(win.motion==='opening'||win.motion==='restoring'))setWindows(previous=>previous.map(item=>item.id===win.id&&item.motion===win.motion?{...item,motion:undefined}:item));}} onPointerDown={()=>{if(active!==win.id)focus(win.id,false);}}><header className="desktop-titlebar" onPointerDown={event=>begin(event,win,'move')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end} onDoubleClick={event=>{if((event.target as HTMLElement).closest('button')||phone)return;setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item));}}><DesktopIcon name={app.icon} size={21}/><h2 tabIndex={-1}>{app.title}</h2><div className="desktop-window-controls"><button className="window-minimize" aria-label={`Minimize ${app.title}`} onClick={()=>minimize(win.id)}><span/></button><button className="window-maximize" aria-label={`${win.maximized?'Restore':'Maximize'} ${app.title}`} onClick={()=>setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item))}><span/></button><button className="window-close" aria-label={`Close ${app.title}`} onClick={()=>close(win.id)}>×</button></div></header><div className="desktop-window-body">{win.id==='home'?<Welcome navigate={focus} projects={projects} openProject={openProject}/>:win.id==='guide'?<QuickGuide navigate={focus}/>:win.id==='calculator'?<SplitCalculator useSplit={useSplit}/>:renderPage(win.id)}</div><span className="desktop-resize" aria-hidden="true" onPointerDown={event=>begin(event,win,'resize')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end}/></section>;})}</div>
      {startOpen&&<div className="desktop-start-menu" id="desktop-app-launcher" ref={menuRef}><div><Wordmark/><span>Your coin. Your direction.</span>{wallet&&<button className="os-launcher-signout" disabled={!!busy} onClick={logout}>Sign out</button>}</div><nav aria-label="All apps">{apps.map(app=><button key={app.id} onClick={()=>focus(app.id)}><AppTile name={app.icon}/><span><strong>{app.title}</strong><small>{app.description}</small></span></button>)}</nav><div className="os-launcher-footer"><button className="os-launcher-help" onClick={()=>focus('guide')}>Quick guide <Arrow/></button><button className="os-launcher-motion" aria-pressed={ambientPaused} onClick={toggleAmbient}><ShellIcon name={ambientPaused?'play':'pause'}/>{ambientPaused?'Resume motion':'Pause motion'}</button></div></div>}
    </div>
    <footer className="desktop-taskbar"><div className="os-dock"><button ref={startRef} className={`desktop-start-button ${startOpen?'selected':''}`} aria-label="All apps" aria-expanded={startOpen} aria-controls="desktop-app-launcher" onClick={()=>setStartOpen(!startOpen)}><ShellIcon name="grid"/><span className="os-dock-label">All apps</span></button><span className="os-dock-divider"/><nav className="desktop-tasks" aria-label="Application dock">{[...dockApps,...windows.filter(win=>!dockApps.some(app=>app.id===win.id)).map(win=>appFor(win.id))].map(app=>{const win=windows.find(win=>win.id===app.id),isActive=active===app.id&&!!win&&!win.minimized;return <button key={app.id} data-app={app.id} data-running={!!win} className={`os-dock-app ${isActive?'active':''} ${win?.minimized?'minimized':''}`} aria-label={win?`${win.minimized?'Restore':'Switch to'} ${app.title}`:`Open ${app.title}`} aria-pressed={isActive} onClick={()=>isActive&&win?.motion!=='minimizing'&&win?.motion!=='closing'?minimize(app.id):focus(app.id)}><AppTile name={app.icon}/><span className="os-dock-label">{app.title}</span></button>;})}</nav><span className="os-dock-divider"/><button className="show-desktop" onClick={showDesktop} aria-label="Show desktop" title="Show desktop"><ShellIcon name="desktop"/></button></div></footer>
    {searchOpen&&<SearchPalette navigate={focus} projects={projects} openProject={openProject} close={()=>setSearchOpen(false)}/>}
  </div></>;
}
