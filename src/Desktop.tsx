import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent,ReactNode} from 'react';
import {Arrow,HelmMark,Wordmark} from './Brand';
import {EntryLoader,prefersLessMotion} from './EntryLoader';
import {Wallpaper} from './Wallpaper';
import type {Page,Project} from './types';
import {fitWindow,initialWindow,moveWindow,resizeWindow} from '../shared/desktop-layout.mjs';
import './desktop.css';

type ToolId=Page;
const apps:{id:ToolId;title:string;description:string;icon:string;color:string}[]=[
  {id:'home',title:'Welcome',description:'Your MemeHelm desktop',icon:'home',color:'peach'},
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
    launch:<><path d="M7 26V14L25 5v13L7 26Z"/><path d="m7 14 11 4 7-13M18 18v10"/></>,
    copilot:<><path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/><path d="M24 4h5m-2.5-2.5v5"/></>,
    signals:<><path d="M3 17h6l4-10 6 18 4-10h6"/><path d="M5 4h4m14 24h4" opacity=".4"/></>,
    treasury:<><rect x="4" y="5" width="24" height="23" rx="2"/><path d="M10 5V3h12v2M11 16h10m-5-5v10"/><circle cx="16" cy="16" r="8"/></>,
    projects:<><path d="M4 8h10l3 4h11v16H4Z"/><path d="M4 17h24M9 23h8"/></>,
    calculator:<><path d="M4 4h24v24H4ZM16 4v24M4 16h24"/><path d="M8 10h4m-2-2v4m10-2h4M8 21h4m8-1h4m-4 3h4"/></>,
    guide:<><path d="M4 5h10l2 3 2-3h10v22H18l-2 2-2-2H4ZM16 8v21"/><path d="M8 11h4m-4 5h4m-4 5h4m8-10h4m-4 5h4m-4 5h4"/></>,
  };
  return <svg className="app-symbol" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">{symbols[name]||symbols.home}</svg>;
}

function Welcome({navigate,projects,useSplit}:{navigate:(page:Page)=>void;projects:Project[];useSplit:(reserve:number)=>void}){
  const tools=[
    {id:'copilot' as Page,icon:'copilot',title:'Run your project',text:'Remember the context. Review actions. Record the results.'},
    {id:'discover' as Page,icon:'discover',title:'Explore coins',text:'Find launches and inspect their onchain activity.'},
    {id:'signals' as Page,icon:'signals',title:'Follow what matters',text:'Your watchlist, price alerts and saved briefs.'},
  ];
  return <div className="welcome-app">
    <div className="welcome-main">
      <div className="welcome-intro">
        <span className="welcome-network"><i/> Built for Robinhood Chain</span>
        <h1>Launch it.<br/>Steer it.</h1>
        <p>Launch a coin, write with AI, and manage creator revenue. One workspace. Your direction.</p>
        <div className="welcome-primary-actions"><button className="button primary" onClick={()=>navigate('launch')}>Launch a coin <Arrow/></button><button className="text-button" onClick={()=>navigate('guide')}>How it works</button></div>
        <div className="welcome-assurance"><DesktopIcon name="treasury" size={18}/><span>Your wallet approves every transaction.</span></div>
      </div>
      <SplitCalculator compact useSplit={useSplit}/>
    </div>
    <div className="welcome-toolkit"><div className="welcome-toolkit-heading"><h2>A home for the whole project.</h2><span>Pick a tool. Make it yours.</span></div><div className="welcome-tools">{tools.map(tool=><button key={tool.id} className="welcome-tool" onClick={()=>navigate(tool.id)}><DesktopIcon name={tool.icon} size={28}/><span><strong>{tool.title}</strong><small>{tool.text}</small></span><Arrow/></button>)}</div></div>
    <div className="welcome-projects"><div><DesktopIcon name="projects" size={24}/><span><strong>{projects.length?`${projects.length} project${projects.length===1?'':'s'} in your workspace`:'Keep your projects together.'}</strong><small>{projects.length?'Continue a draft or manage your launched coins.':'Create a coin or bring an existing token into your workspace.'}</small></span></div><button className="text-button" onClick={()=>navigate('overview')}>My projects <Arrow/></button></div>
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
  return <div className={`calculator-app ${compact?'calculator-compact':''}`}><div className="calculator-intro"><DesktopIcon name="calculator" size={32}/><div><span className="calculator-example">Allocation example</span>{compact?<h2>Give revenue a destination.</h2>:<h1>Find your split.</h1>}<p>Try an allocation before you launch.</p></div></div><label className="calculator-input">Example revenue<div><input aria-label="Example vault revenue in ETH" inputMode="decimal" type="number" min="0" step="0.1" value={amount} onChange={event=>setAmount(event.target.value)}/><span>ETH</span></div></label><div className="calculator-shares"><div><span>Project wallet</span><strong>{100-reserve}<small>%</small></strong></div><span>↗</span><div><span>Reserve wallet</span><strong>{reserve}<small>%</small></strong></div></div><label className="calculator-range"><span>Reserve allocation<strong>{reserve}%</strong></span><input aria-label="Example reserve allocation" type="range" min="0" max="100" value={reserve} onChange={event=>setReserve(Number(event.target.value))}/></label><div className="calculator-totals"><div><span>Project receives</span><strong>{format(revenue*(100-reserve)/100)} <small>ETH</small></strong></div><div><span>Reserve receives</span><strong>{format(revenue*reserve/100)} <small>ETH</small></strong></div></div><button className="button secondary full" onClick={()=>useSplit(reserve)}>Use this allocation <Arrow/></button><p className="calculator-note">Illustrative amounts, not earnings. Applies to ETH received by your vault.</p></div>;
}

type Props={page:Page;navigate:(page:Page)=>void;renderPage:(page:Page)=>ReactNode;projects:Project[];wallet:string;busy:string;connect:()=>Promise<void>;logout:()=>Promise<void>;useSplit:(reserve:number)=>void};

export function Desktop({page,navigate,renderPage,projects,wallet,busy,connect,logout,useSplit}:Props){
  const surface=useRef<HTMLDivElement>(null);
  const [bounds,setBounds]=useState<Bounds>({width:1280,height:720});
  const [windows,setWindows]=useState<DeskWindow[]>([{id:page,rect:initialWindow(page,{width:1280,height:720},0),minimized:false,maximized:false,motion:'opening'}]);
  const [active,setActive]=useState<ToolId|null>(page),[startOpen,setStartOpen]=useState(false),[now,setNow]=useState(new Date());
  const [entered,setEntered]=useState(prefersLessMotion),[dragging,setDragging]=useState<ToolId|null>(null);
  const gesture=useRef<{id:ToolId;kind:'move'|'resize';x:number;y:number;rect:Rect;pointer:number}|null>(null);
  const menuRef=useRef<HTMLDivElement>(null),startRef=useRef<HTMLButtonElement>(null);
  const measured=useRef(false);
  const motionTimers=useRef(new Map<ToolId,number>()),currentWindows=useRef(windows),currentActive=useRef(active);
  currentWindows.current=windows;currentActive.current=active;
  useEffect(()=>{
    if(!surface.current)return;
    const observer=new ResizeObserver(([entry])=>{const value={width:entry.contentRect.width,height:entry.contentRect.height};setBounds(value);const first=!measured.current;measured.current=true;setWindows(previous=>previous.map((win,index)=>({...win,rect:first?initialWindow(win.id,value,index):fitWindow(win.rect,value)})));});
    observer.observe(surface.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{focus(page);},[page]);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>()=>{for(const timer of motionTimers.current.values())window.clearTimeout(timer);motionTimers.current.clear();},[]);
  useEffect(()=>{if(!startOpen)return;const close=(event:globalThis.PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node)&&!startRef.current?.contains(event.target as Node))setStartOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setStartOpen(false);startRef.current?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[startOpen]);
  function cancelMotion(id:ToolId){const timer=motionTimers.current.get(id);if(timer!==undefined)window.clearTimeout(timer);motionTimers.current.delete(id);}
  function focus(id:ToolId){cancelMotion(id);setActive(id);setWindows(previous=>{const win=previous.find(item=>item.id===id);return win?[...previous.filter(item=>item.id!==id),{...win,minimized:false,motion:win.minimized||win.motion==='minimizing'||win.motion==='closing'?'restoring':win.motion}]:[...previous,{id,rect:initialWindow(id,bounds,previous.length),minimized:false,maximized:false,motion:'opening'}];});if(page!==id)navigate(id);setStartOpen(false);}
  function minimize(id:ToolId){
    const win=currentWindows.current.find(item=>item.id===id);if(!win||win.minimized||win.motion==='closing')return;
    cancelMotion(id);
    const finish=()=>{motionTimers.current.delete(id);setWindows(previous=>previous.map(item=>item.id===id?{...item,minimized:true,motion:undefined}:item));setActive(value=>value===id?null:value);};
    if(prefersLessMotion()){finish();return;}
    setWindows(previous=>previous.map(item=>item.id===id?{...item,motion:'minimizing'}:item));
    motionTimers.current.set(id,window.setTimeout(finish,200));
  }
  function close(id:ToolId){
    cancelMotion(id);
    const finish=()=>{
      motionTimers.current.delete(id);
      const next=[...currentWindows.current].reverse().find(win=>win.id!==id&&!win.minimized&&win.motion!=='closing');
      setWindows(previous=>previous.filter(win=>win.id!==id));
      if(currentActive.current===id){setActive(next?.id??null);if(next)navigate(next.id);}
    };
    if(prefersLessMotion()){finish();return;}
    setWindows(previous=>previous.map(win=>win.id===id?{...win,motion:'closing'}:win));
    motionTimers.current.set(id,window.setTimeout(finish,180));
  }
  function begin(event:PointerEvent<HTMLElement>,win:DeskWindow,kind:'move'|'resize'){
    if(event.button!==0||win.maximized||bounds.width<=720||(event.target as HTMLElement).closest('button'))return;
    event.preventDefault();focus(win.id);setDragging(win.id);setWindows(previous=>previous.map(item=>item.id===win.id?{...item,motion:undefined}:item));gesture.current={id:win.id,kind,x:event.clientX,y:event.clientY,rect:win.rect,pointer:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function adjust(event:PointerEvent<HTMLElement>){const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;const dx=event.clientX-current.x,dy=event.clientY-current.y;const rect=current.kind==='move'?moveWindow(current.rect,dx,dy,bounds):resizeWindow(current.rect,dx,dy,bounds);setWindows(previous=>previous.map(win=>win.id===current.id?{...win,rect}:win));}
  function end(event:PointerEvent<HTMLElement>){if(gesture.current?.pointer===event.pointerId){gesture.current=null;setDragging(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  const shorten=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;
  return <>{!entered&&<EntryLoader onDone={()=>setEntered(true)}/>}<div className={`desktop-shell ${active?'has-active-window':''} ${entered?'desktop-ready':'desktop-entering'}`} inert={!entered} aria-hidden={!entered} aria-busy={!entered}><header className="desktop-topbar"><button className="desktop-brand" onClick={()=>focus('home')} aria-label="Open MemeHelm welcome"><Wordmark/></button><span className="desktop-topline">Launch it. Steer it.</span><div className="desktop-account"><span className="desktop-network"><i/>Robinhood Chain</span><button className="desktop-wallet" disabled={!!busy} onClick={connect}>{wallet?shorten(wallet):'Connect wallet'}<span>↗</span></button>{wallet&&<button className="desktop-signout" onClick={logout} title="Sign out of your private workspace">Sign out</button>}<button className="desktop-signal-button" aria-label="Open Signals" onClick={()=>focus('signals')}>⌁</button></div></header>
    <div className="desktop-surface" ref={surface}><Wallpaper/>
      <nav className="desktop-shortcuts" aria-label="Desktop apps">{apps.filter(app=>app.id!=='home').map((app,index)=><button key={app.id} className={`desktop-shortcut ${app.color}`} style={{'--shortcut-order':index} as CSSProperties} onClick={()=>focus(app.id)} title={app.description}><span><DesktopIcon name={app.icon}/></span><strong>{app.title}</strong></button>)}</nav>
      <div className="desktop-windows">{windows.map((win,index)=>{const app=appFor(win.id),phone=bounds.width<=720;const rect=win.maximized||phone?{x:0,y:0,width:bounds.width,height:bounds.height}:win.rect;return <section key={win.id} className={`desktop-window ${active===win.id?'focused':''} ${win.maximized?'maximized':''} ${win.motion?`is-${win.motion}`:''} ${dragging===win.id?'is-dragging':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,zIndex:index+1} as CSSProperties} hidden={win.minimized} aria-label={`${app.title} window`} onAnimationEnd={event=>{if(event.target===event.currentTarget&&(win.motion==='opening'||win.motion==='restoring'))setWindows(previous=>previous.map(item=>item.id===win.id&&item.motion===win.motion?{...item,motion:undefined}:item));}} onPointerDown={()=>{if(active!==win.id)focus(win.id);}}><header className="desktop-titlebar" onPointerDown={event=>begin(event,win,'move')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end} onDoubleClick={event=>{if((event.target as HTMLElement).closest('button')||phone)return;setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item));}}><DesktopIcon name={app.icon} size={21}/><h2>{app.title}</h2><div className="desktop-window-controls"><button className="window-minimize" aria-label={`Minimize ${app.title}`} onClick={()=>minimize(win.id)}><span/></button><button className="window-maximize" aria-label={`${win.maximized?'Restore':'Maximize'} ${app.title}`} onClick={()=>setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item))}><span/></button><button className="window-close" aria-label={`Close ${app.title}`} onClick={()=>close(win.id)}>×</button></div></header><div className="desktop-window-body">{win.id==='home'?<Welcome navigate={focus} projects={projects} useSplit={useSplit}/>:win.id==='guide'?<QuickGuide navigate={focus}/>:win.id==='calculator'?<SplitCalculator useSplit={useSplit}/>:renderPage(win.id)}</div><span className="desktop-resize" aria-hidden="true" onPointerDown={event=>begin(event,win,'resize')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end}/></section>;})}</div>
      {startOpen&&<div className="desktop-start-menu" ref={menuRef}><div><Wordmark/><span>Your coin. Your direction.</span></div><nav aria-label="All apps">{apps.map(app=><button key={app.id} onClick={()=>focus(app.id)}><DesktopIcon name={app.icon} size={32}/><span><strong>{app.title}</strong><small>{app.description}</small></span><Arrow/></button>)}</nav><span className="desktop-menu-foot">Built for builders on Robinhood Chain.</span></div>}
    </div>
    <footer className="desktop-taskbar"><button ref={startRef} className={`desktop-start-button ${startOpen?'selected':''}`} aria-expanded={startOpen} onClick={()=>setStartOpen(!startOpen)}><HelmMark/><span>Start</span></button><div className="desktop-tasks" aria-label="Open apps">{windows.map(win=>{const app=appFor(win.id);return <button key={win.id} className={`${active===win.id&&!win.minimized?'active':''} ${win.minimized?'minimized':''}`} aria-label={`${win.minimized?'Restore':'Switch to'} ${app.title}`} aria-pressed={active===win.id&&!win.minimized} onClick={()=>active===win.id&&!win.minimized&&win.motion!=='minimizing'&&win.motion!=='closing'?minimize(win.id):focus(win.id)}><DesktopIcon name={app.icon} size={24}/><span>{app.title}</span></button>;})}</div><button className="show-desktop" onClick={()=>{currentWindows.current.filter(win=>!win.minimized&&win.motion!=='closing').forEach(win=>minimize(win.id));setActive(null);setStartOpen(false);}} aria-label="Show desktop" title="Show desktop"><span/><span/></button><div className="desktop-clock"><time>{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time><small>{now.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</small></div></footer>
  </div></>;
}
