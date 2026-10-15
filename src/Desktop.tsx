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
  {id:'launch',title:'Launchpad',description:'Create your coin on Flap',icon:'launch',color:'orange'},
  {id:'copilot',title:'AI Copilot',description:'Draft, plan, and find your next move',icon:'copilot',color:'mint'},
  {id:'treasury',title:'Treasury',description:'Follow revenue and release funds',icon:'treasury',color:'yellow'},
  {id:'overview',title:'My Projects',description:'Your coins, together in one place',icon:'projects',color:'blue'},
  {id:'calculator',title:'Split Calculator',description:'Find the right revenue allocation',icon:'calculator',color:'pink'},
  {id:'guide',title:'Quick Guide',description:'A little help getting started',icon:'guide',color:'lavender'},
];
const appFor=(id:ToolId)=>apps.find(app=>app.id===id)!;
type Rect={x:number;y:number;width:number;height:number};
type DeskWindow={id:ToolId;rect:Rect;minimized:boolean;maximized:boolean;motion?:'opening'|'restoring'|'minimizing'|'closing'};
type Bounds={width:number;height:number};

export function DesktopIcon({name,size=48}:{name:string;size?:number}){
  const common={stroke:'#94a7b4',strokeWidth:2.3,strokeLinejoin:'round' as const,strokeLinecap:'round' as const};
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...common}>
    {name==='launch'?<><path fill="#24333d" d="M20 42H9V31l12-6M39 43v12H28l-5-12"/><path fill="#e0e8ee" d="M21 39C20 24 32 10 53 8c-1 21-12 34-28 36l-4-5Z"/><circle cx="40" cy="22" r="6" fill="#d7ff00"/><path d="m20 44-7 7m11-4-4 9m-6-16-7 4" stroke="#d7ff00"/><path d="m22 33 10 10"/></>:name==='copilot'?<><path d="M32 11V5m-4 0h8"/><rect x="10" y="17" width="44" height="33" rx="9" fill="#24333d"/><path d="M10 30H5v10h5m44-10h5v10h-5M23 50v7m18-7v7"/><rect x="19" y="26" width="26" height="15" rx="4" fill="#d7ff00"/><path d="M26 31v4m12-4v4m-12 9h12"/></>:name==='treasury'?<><rect x="9" y="12" width="46" height="43" rx="5" fill="#24333d"/><rect x="16" y="19" width="32" height="29" rx="3" fill="#18232c"/><circle cx="32" cy="34" r="9" fill="#d7ff00"/><path d="M32 25v18m-9-9h18M5 22h4m-4 21h4m46-21h4m-4 21h4"/></>:name==='projects'?<><path d="M7 18h19l6 7h25v28H7V18Z" fill="#24333d"/><path d="M7 27h50l-4 26H11L7 27Z" fill="#334650"/><path d="M15 17V9h24l8 8v10H15V17Z" fill="#d7ff00"/><path d="M39 9v9h8M22 19h10m-10 5h17"/></>:name==='calculator'?<><rect x="14" y="6" width="37" height="51" rx="5" fill="#24333d"/><rect x="20" y="12" width="25" height="11" rx="2" fill="#d7ff00"/><path d="M23 32h4m-2-2v4m11-2h5M23 42l4 4m0-4-4 4m13-2h5m-5 4h5"/><path d="M24 17h5m5 0h6" stroke="#18232c"/></>:name==='guide'?<><path d="M8 12c9-3 16-1 24 3 8-4 15-6 24-3v41c-9-3-17-2-24 2-7-4-15-5-24-2V12Z" fill="#24333d"/><path d="M32 15v40M14 22c4-1 8 0 12 2m-12 7c4-1 8 0 12 2m-12 7c4-1 8 0 12 2m12-18c4-2 8-3 12-2m-12 11c4-2 8-3 12-2m-12 11c4-2 8-3 12-2"/></>:<><path d="m8 28 24-19 24 19" fill="#24333d"/><path d="M14 24v31h36V24L32 10 14 24Z" fill="#18232c"/><path d="M26 55V36h12v19" fill="#d7ff00"/><path d="M18 15V8h9"/></>}
  </svg>;
}

function Welcome({navigate,projects}:{navigate:(page:Page)=>void;projects:Project[]}){
  return <div className="welcome-app"><div className="welcome-intro"><div className="welcome-stamp"><HelmMark/></div><span className="desktop-eyebrow">A LITTLE DIRECTION GOES A LONG WAY.</span><h1>Big idea?<br/><span>Take the helm.</span></h1><p>Your tools to launch a coin, manage its revenue,<br className="welcome-break"/> and figure out the next move.</p><span className="welcome-chain"><i/>BNB Chain <span>·</span> Launches via Flap</span></div><div className="welcome-tools">{apps.filter(app=>['launch','copilot','treasury'].includes(app.id)).map(app=><button key={app.id} className={`welcome-tool ${app.color}`} onClick={()=>navigate(app.id)}><DesktopIcon name={app.icon} size={45}/><strong>{app.id==='launch'?'Launch a coin':app.id==='copilot'?'Ask Copilot':'Manage revenue'}</strong><span>{app.id==='launch'?'Bring your next idea onchain.':app.id==='copilot'?'A brief, a post, a plan.': 'Give every share a destination.'}</span><Arrow diagonal/></button>)}</div><div className="welcome-projects"><div><DesktopIcon name="projects" size={30}/><span><strong>{projects.length?`${projects.length} project${projects.length===1?'':'s'} on your desk`:'A fresh start for your next idea.'}</strong><small>{projects.length?'Pick up where you left off.':'Your coins will have a home here.'}</small></span></div><button onClick={()=>navigate('overview')}>My projects <Arrow/></button></div><div className="welcome-bottom"><span>Your wallet. Your signatures. Your direction.</span><button onClick={()=>navigate('guide')}>Show me around <Arrow diagonal/></button></div></div>;
}

function QuickGuide({navigate}:{navigate:(page:Page)=>void}){
  const [topic,setTopic]=useState(0);
  const guides=[
    {title:'From an idea to a coin.',text:'A few essentials, a clear revenue split, and your wallet’s approval.',steps:[['Connect your wallet','Use an EVM wallet such as MetaMask or Rabby. The app uses BNB Testnet and tBNB for transactions.'],['Make the coin yours','Enter your name, symbol, story, and pinned token metadata. Choose the trading taxes and recipient wallets.'],['Review, then sign','Enable the revenue split if needed. Check the full launch preview and approve the transaction in your wallet.']],action:'Open Launchpad',page:'launch' as Page},
    {title:'A purpose for every share.',text:'See what comes in, what each wallet can claim, and what has already been released.',steps:[['Choose your destinations','Set a project wallet, a separate reserve wallet, and a percentage for each when launching.'],['Follow the revenue','Your treasury shows BNB received by the vault after upstream fees. Each wallet has its own claimable balance.'],['Release each share','Connect your wallet and request a payout. Funds go to the designated recipient; each share can be released independently.']],action:'Open Treasury',page:'treasury' as Page},
    {title:'A little help with your next move.',text:'Start with the facts, then bring your own judgment.',steps:[['Give it your project’s context','Create a project draft or import a token. A clear description helps the copilot understand what you are building.'],['Choose what you need','Ask for a daily brief, a social draft, or a seven-day community plan.'],['Make it your own','Review the result and edit before sharing. Posts and onchain transactions stay in your hands.']],action:'Open Copilot',page:'copilot' as Page},
  ];
  const guide=guides[topic];
  return <div className="guide-app"><div className="guide-tabs" aria-label="Guide topics">{['Launch a coin','Revenue','AI Copilot'].map((label,index)=><button key={label} aria-pressed={topic===index} className={topic===index?'active':''} onClick={()=>setTopic(index)}>{label}</button>)}</div><div className="guide-content"><span className="desktop-eyebrow">A FRIENDLY FIELD GUIDE</span><h1>{guide.title}</h1><p>{guide.text}</p><ol>{guide.steps.map(([title,body],index)=><li key={title}><span>{index+1}</span><div><h2>{title}</h2><p>{body}</p></div></li>)}</ol><button className="button primary" onClick={()=>navigate(guide.page)}>{guide.action}<Arrow/></button></div></div>;
}

function SplitCalculator({useSplit}:{useSplit:(reserve:number)=>void}){
  const [amount,setAmount]=useState('1'),[reserve,setReserve]=useState(10);
  const parsed=Number(amount),revenue=Number.isFinite(parsed)?Math.max(0,parsed):0;
  const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:5});
  return <div className="calculator-app"><div className="calculator-intro"><DesktopIcon name="calculator" size={56}/><div><span className="desktop-eyebrow">A PLAN FOR YOUR REVENUE</span><h1>Find your split.</h1><p>Try an allocation before you launch.</p></div></div><label className="calculator-input">If your vault receives<div><input aria-label="Example vault revenue in BNB" inputMode="decimal" type="number" min="0" step="0.1" value={amount} onChange={event=>setAmount(event.target.value)}/><span>BNB</span></div></label><div className="calculator-shares"><div><span>Project wallet</span><strong>{100-reserve}<small>%</small></strong></div><span>+</span><div><span>Reserve wallet</span><strong>{reserve}<small>%</small></strong></div></div><label className="calculator-range"><span>Reserve allocation<strong>{reserve}%</strong></span><input aria-label="Example reserve allocation" type="range" min="0" max="100" value={reserve} onChange={event=>setReserve(Number(event.target.value))}/></label><div className="calculator-totals"><div><span>For your project</span><strong>{format(revenue*(100-reserve)/100)} BNB</strong></div><div><span>For your reserve</span><strong>{format(revenue*reserve/100)} BNB</strong></div></div><button className="button primary full" onClick={()=>useSplit(reserve)}>Use this split in my launch <Arrow/></button><p className="calculator-note">Illustrative amounts. The split applies to BNB received by your vault after upstream fees.</p></div>;
}

type Props={page:Page;navigate:(page:Page)=>void;renderPage:(page:Page)=>ReactNode;projects:Project[];wallet:string;busy:string;connect:()=>Promise<void>;useSplit:(reserve:number)=>void};

export function Desktop({page,navigate,renderPage,projects,wallet,busy,connect,useSplit}:Props){
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
  return <>{!entered&&<EntryLoader onDone={()=>setEntered(true)}/>}<div className={`desktop-shell ${entered?'desktop-ready':'desktop-entering'}`} inert={!entered} aria-hidden={!entered} aria-busy={!entered}><header className="desktop-topbar"><button className="desktop-brand" onClick={()=>focus('home')} aria-label="Open MemeHelm welcome"><Wordmark/></button><span className="desktop-topline">Launch it. Steer it.</span><div className="desktop-account"><span className="desktop-network"><i/>BNB Testnet</span><button className="desktop-wallet" disabled={!!busy} onClick={connect}>{wallet?shorten(wallet):'Connect wallet'}<span>↗</span></button></div></header>
    <div className="desktop-surface" ref={surface}><Wallpaper/>
      <nav className="desktop-shortcuts" aria-label="Desktop apps">{apps.filter(app=>app.id!=='home').map((app,index)=><button key={app.id} className={`desktop-shortcut ${app.color}`} style={{'--shortcut-order':index} as CSSProperties} onClick={()=>focus(app.id)} title={app.description}><span><DesktopIcon name={app.icon}/></span><strong>{app.title}</strong></button>)}</nav>
      <div className="desktop-windows">{windows.map((win,index)=>{const app=appFor(win.id),phone=bounds.width<=720;const rect=win.maximized||phone?{x:0,y:0,width:bounds.width,height:bounds.height}:win.rect;return <section key={win.id} className={`desktop-window ${active===win.id?'focused':''} ${win.maximized?'maximized':''} ${win.motion?`is-${win.motion}`:''} ${dragging===win.id?'is-dragging':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,zIndex:index+1} as CSSProperties} hidden={win.minimized} aria-label={`${app.title} window`} onAnimationEnd={event=>{if(event.target===event.currentTarget&&(win.motion==='opening'||win.motion==='restoring'))setWindows(previous=>previous.map(item=>item.id===win.id&&item.motion===win.motion?{...item,motion:undefined}:item));}} onPointerDown={()=>{if(active!==win.id)focus(win.id);}}><header className="desktop-titlebar" onPointerDown={event=>begin(event,win,'move')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end} onDoubleClick={event=>{if((event.target as HTMLElement).closest('button')||phone)return;setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item));}}><DesktopIcon name={app.icon} size={21}/><h2>{app.title}</h2><div className="desktop-window-controls"><button className="window-minimize" aria-label={`Minimize ${app.title}`} onClick={()=>minimize(win.id)}><span/></button><button className="window-maximize" aria-label={`${win.maximized?'Restore':'Maximize'} ${app.title}`} onClick={()=>setWindows(previous=>previous.map(item=>item.id===win.id?{...item,maximized:!item.maximized}:item))}><span/></button><button className="window-close" aria-label={`Close ${app.title}`} onClick={()=>close(win.id)}>×</button></div></header><div className="desktop-window-body">{win.id==='home'?<Welcome navigate={focus} projects={projects}/>:win.id==='guide'?<QuickGuide navigate={focus}/>:win.id==='calculator'?<SplitCalculator useSplit={useSplit}/>:renderPage(win.id)}</div><span className="desktop-resize" aria-hidden="true" onPointerDown={event=>begin(event,win,'resize')} onPointerMove={adjust} onPointerUp={end} onPointerCancel={end}/></section>;})}</div>
      {startOpen&&<div className="desktop-start-menu" ref={menuRef}><div><Wordmark/><span>Your coin. Your direction.</span></div><nav aria-label="All apps">{apps.map(app=><button key={app.id} onClick={()=>focus(app.id)}><DesktopIcon name={app.icon} size={32}/><span><strong>{app.title}</strong><small>{app.description}</small></span><Arrow/></button>)}</nav><span className="desktop-menu-foot">Built for builders on BNB Chain.</span></div>}
    </div>
    <footer className="desktop-taskbar"><button ref={startRef} className={`desktop-start-button ${startOpen?'selected':''}`} aria-expanded={startOpen} onClick={()=>setStartOpen(!startOpen)}><HelmMark/><span>Start</span></button><div className="desktop-tasks" aria-label="Open apps">{windows.map(win=>{const app=appFor(win.id);return <button key={win.id} className={`${active===win.id&&!win.minimized?'active':''} ${win.minimized?'minimized':''}`} aria-label={`${win.minimized?'Restore':'Switch to'} ${app.title}`} aria-pressed={active===win.id&&!win.minimized} onClick={()=>active===win.id&&!win.minimized&&win.motion!=='minimizing'&&win.motion!=='closing'?minimize(win.id):focus(win.id)}><DesktopIcon name={app.icon} size={24}/><span>{app.title}</span></button>;})}</div><button className="show-desktop" onClick={()=>{currentWindows.current.filter(win=>!win.minimized&&win.motion!=='closing').forEach(win=>minimize(win.id));setActive(null);setStartOpen(false);}} aria-label="Show desktop" title="Show desktop"><span/><span/></button><div className="desktop-clock"><time>{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time><small>{now.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</small></div></footer>
  </div></>;
}
