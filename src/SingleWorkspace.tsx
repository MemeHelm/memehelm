import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent} from 'react';
import {Wordmark,Arrow} from './Brand';
import {apps,AppTile,DesktopIcon,ShellIcon,QuickGuide} from './Desktop';
import type {DesktopProps} from './Desktop';
import {Wallpaper} from './Wallpaper';
import {CommandBoard} from './CommandBoard';
import {SearchPalette} from './SearchPalette';
import {useModalFocus} from './useModalFocus';
import {primaryContentKey,workspacePageFor,guardDestination,mainAreaFor} from '../shared/workspace-navigation.mjs';
import type {Page} from './types';

const appFor=(page:Page)=>apps.find(app=>app.id===page)||apps[0];
const readWidth=()=>{try{const width=Number(localStorage.getItem('memehelm:workspace:assistant-width'));return width>=280&&width<=460?width:340;}catch{return 340;}};
function SignoutReview({keep,discard,busy}:{keep:()=>void;discard:()=>void;busy:boolean}){
 const panel=useRef<HTMLElement>(null);useModalFocus(panel,keep);
 return <div className="modal-overlay window-discard-overlay"><section ref={panel} tabIndex={-1} className="modal panel" role="alertdialog" aria-modal="true" aria-labelledby="workspace-signout-title"><h2 id="workspace-signout-title">Keep your work open?</h2><p>There are unsaved edits or a request in progress. Save your work or wait for its result before signing out. Signing out does not cancel an already submitted request.</p><div className="button-row"><button className="button primary" onClick={keep}>Keep working</button><button className="button secondary" disabled={busy} onClick={discard}>Discard edits and sign out</button></div></section></div>;
}

/** Stable primary canvas and independent assistant; changing the route never destroys a visited page. */
export function SingleWorkspace({page,navigate,renderPage,assistant,selectProject,projects,projectsState,refreshProjects,wallet,busy,connect,logout,useSplit,openProject,entered,introRevealed,replayIntro}:DesktopProps){
 const activePage:Page=page==='copilot'?'workspace':page==='calculator'?'launch':page;
 const contentKey=primaryContentKey(activePage) as Page;
 const [visited,setVisited]=useState<Page[]>([contentKey]);
 const [mainVisible,setMainVisible]=useState(true),[assistantVisible,setAssistantVisible]=useState(()=>typeof window!=='undefined'&&(window.innerWidth>=1100||location.hash==='#app/copilot')),[focusMode,setFocusMode]=useState(false);
 const [assistantWidth,setAssistantWidth]=useState(readWidth),[bounds,setBounds]=useState({width:1280,height:720});
 const [startOpen,setStartOpen]=useState(false),[searchOpen,setSearchOpen]=useState(false),[signoutReview,setSignoutReview]=useState(false);
 const [ambientPaused,setAmbientPaused]=useState(()=>{try{return localStorage.getItem('memehelm:desktop:ambient')==='paused';}catch{return false;}}),[visible,setVisible]=useState(()=>!document.hidden);
 const stage=useRef<HTMLDivElement>(null),surface=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),startButton=useRef<HTMLButtonElement>(null),topApps=useRef<HTMLButtonElement>(null),assistantToggle=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const assistantPanel=useRef<HTMLElement>(null),lastPage=useRef(activePage);
 const guards=useRef(new Map<string,boolean>()),pendingFocus=useRef(false),actions=useRef<{open:(id:Page)=>void;reveal:()=>void}>({open:()=>{},reveal:()=>{}}),busyNow=useRef(busy),lastOperationsPage=useRef<Page>('workspace');
 if(['workspace','memory','activity'].includes(activePage))lastOperationsPage.current=activePage;
 const split=useRef<{x:number;width:number;pointer:number}|null>(null);busyNow.current=busy;
 function openAssistant(){setMainVisible(true);setFocusMode(false);setAssistantVisible(true);setStartOpen(false);}
 function activate(id:Page){
  if(id==='copilot'){openAssistant();return;}
  setVisited(previous=>previous.includes(primaryContentKey(id) as Page)?previous:[...previous,primaryContentKey(id) as Page]);
  setMainVisible(true);setStartOpen(false);pendingFocus.current=true;
  if(activePage!==id)navigate(id);else requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
 }
 actions.current={open:activate,reveal:openAssistant};
 function collapseAssistant(){setAssistantVisible(false);setFocusMode(false);requestAnimationFrame(()=>assistantToggle.current?.focus({preventScroll:true}));}
 function openProjectPage(id:string,target:Page='workspace'){
  if(selectProject){if(selectProject(id)===false)return false;}else if(openProject(id)===false)return false;
  activate(target);return true;
 }
 function openWorkspace(view:'chat'|'community'|'content',projectId?:string){
  if(projectId){if(selectProject){if(selectProject(projectId)===false)return;}else if(openProject(projectId)===false)return;}
  if(view==='chat')openAssistant();else activate(workspacePageFor(view) as Page);
 }
 const blocked=()=>!!busyNow.current||[...guards.current.values()].some(Boolean);
 function requestSignout(){if(blocked()){setSignoutReview(true);return;}void logout();}
 useEffect(()=>{setVisited(previous=>previous.includes(contentKey)?previous:[...previous,contentKey]);setMainVisible(true);},[contentKey,activePage]);
 useEffect(()=>{if(!entered||!pendingFocus.current)return;pendingFocus.current=false;const frame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[activePage,entered]);
 useEffect(()=>{
  const guard=(event:Event)=>{const detail=(event as CustomEvent<{id:string;blocked:boolean}>).detail;if(!detail?.id)return;if(detail.blocked)guards.current.set(detail.id,true);else guards.current.delete(detail.id);};
  const leave=(event:BeforeUnloadEvent)=>{if(blocked()){event.preventDefault();event.returnValue='';}};
  const projectChange=(event:Event)=>{if(!blocked())return;event.preventDefault();const id=guards.current.has('workspace-memory')?'workspace-memory':[...guards.current.keys()][0];if(id)actions.current.open(id==='workspace-operations'?lastOperationsPage.current:guardDestination(id) as Page);};
  const reveal=()=>actions.current.reveal();
  const openView=(event:Event)=>{const view=(event as CustomEvent<{view?:string}>).detail?.view;if(view==='chat')actions.current.reveal();else if(view)actions.current.open(workspacePageFor(view) as Page);};
  const resetLaunch=(event:Event)=>{if(guards.current.get('launch')){event.preventDefault();actions.current.open('launch');}};
  window.addEventListener('memehelm-window-guard',guard);window.addEventListener('beforeunload',leave);window.addEventListener('memehelm-before-project-change',projectChange);window.addEventListener('memehelm-open-assistant',reveal);window.addEventListener('memehelm-open-copilot-view',openView);
  window.addEventListener('memehelm-before-launch-reset',resetLaunch);
  return()=>{window.removeEventListener('memehelm-window-guard',guard);window.removeEventListener('beforeunload',leave);window.removeEventListener('memehelm-before-project-change',projectChange);window.removeEventListener('memehelm-open-assistant',reveal);window.removeEventListener('memehelm-open-copilot-view',openView);window.removeEventListener('memehelm-before-launch-reset',resetLaunch);};
 },[]);
 useEffect(()=>{
  if(!surface.current)return;const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width>0)setBounds({width:entry.contentRect.width,height:entry.contentRect.height});});observer.observe(surface.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{if(page==='copilot')openAssistant();},[page]);
 useEffect(()=>{const visibility=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(entered&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(open=>!open);}
   if(event.key==='Escape'&&!document.querySelector('[aria-modal="true"]')){if(startOpen){setStartOpen(false);startButton.current?.focus();}else if(assistantVisible&&bounds.width<1100)collapseAssistant();}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[entered,startOpen,assistantVisible,bounds.width]);
 useEffect(()=>{if(!startOpen)return;const outside=(event:globalThis.PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!startButton.current?.contains(event.target as Node)&&!topApps.current?.contains(event.target as Node))setStartOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[startOpen]);
 useEffect(()=>{try{localStorage.setItem('memehelm:workspace:assistant-width',String(assistantWidth));}catch{}},[assistantWidth]);
 function startSplit(event:PointerEvent<HTMLDivElement>){if(event.button!==0||bounds.width<1100)return;event.preventDefault();split.current={x:event.clientX,width:assistantWidth,pointer:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);}
 function moveSplit(event:PointerEvent<HTMLDivElement>){const current=split.current;if(!current||current.pointer!==event.pointerId)return;setAssistantWidth(Math.max(280,Math.min(460,current.width+current.x-event.clientX)));}
 function endSplit(event:PointerEvent<HTMLDivElement>){if(split.current?.pointer!==event.pointerId)return;split.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
 function showDesktop(){setMainVisible(false);setStartOpen(false);requestAnimationFrame(()=>startButton.current?.focus());}
 function toggleAmbient(){setAmbientPaused(value=>{const next=!value;try{localStorage.setItem('memehelm:desktop:ambient',next?'paused':'playing');}catch{}return next;});}
 const app=appFor(activePage),assistantOpen=assistantVisible&&!focusMode;
 const drawerOpen=mainVisible&&assistantOpen&&bounds.width<1100;
 useEffect(()=>{if(lastPage.current!==activePage&&bounds.width<1100)setAssistantVisible(false);lastPage.current=activePage;},[activePage,bounds.width]);
 useEffect(()=>{
  if(!entered||!drawerOpen)return;const panel=assistantPanel.current;if(!panel)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const foreignModal=()=>[...document.querySelectorAll('[aria-modal="true"]')].some(item=>item!==panel&&!panel.contains(item));
  const focusable=()=>[...panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(item=>!item.closest('[hidden],[inert]')&&item.getClientRects().length>0);
  const frame=requestAnimationFrame(()=>{if(!foreignModal())(focusable()[0]||panel).focus({preventScroll:true});});
  const trap=(event:KeyboardEvent)=>{if(foreignModal())return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();collapseAssistant();return;}if(event.key!=='Tab')return;const targets=focusable(),first=targets[0],last=targets[targets.length-1];if(!first){event.preventDefault();panel.focus();}else if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}};
  document.addEventListener('keydown',trap,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',trap,true);if(previous?.isConnected&&!previous.closest('[inert]')&&!foreignModal())previous.focus({preventScroll:true});};
 },[drawerOpen,entered]);
 const mainApps=(['home','launch','overview','discover'] as Page[]).map(appFor);
 const shortcutPages=mainApps;
 const dockPages=mainApps;
 const pages=visited.includes(contentKey)?visited:[...visited,contentKey];
 return <div className={`desktop-shell os-desktop system-shell single-workspace ${mainVisible?'has-active-window':''} ${!assistantOpen?'assistant-collapsed':''} ${focusMode?'focus-mode':''} ${entered||introRevealed?'desktop-ready':'desktop-entering'}`} style={{'--assistant-width':`${assistantWidth}px`} as CSSProperties} inert={!entered} aria-hidden={!entered} aria-busy={!entered}>
  <div className="system-wallpaper" aria-hidden="true"/><Wallpaper paused={ambientPaused||!visible||!entered}/>
  <header className="desktop-topbar" inert={drawerOpen}><div className="os-topbar-left"><button className="desktop-brand" onClick={()=>activate('home')} aria-label="Open MemeHelm workspace"><Wordmark/></button><nav className="system-topnav" aria-label="Main apps">{mainApps.map(item=><button key={item.id} className="system-nav-item" aria-pressed={mainVisible&&mainAreaFor(activePage)===item.id} onClick={()=>activate(item.id)}><DesktopIcon name={item.icon} size={21}/><span>{item.title}</span></button>)}</nav><button ref={topApps} className="os-menu-button system-apps-menu" aria-expanded={startOpen} aria-controls="desktop-app-launcher" onClick={()=>setStartOpen(!startOpen)}>Apps<ShellIcon name="grid"/></button></div><div className="desktop-account"><button className="os-motion-button" aria-label={ambientPaused?'Resume background motion':'Pause background motion'} aria-pressed={ambientPaused} onClick={toggleAmbient}><ShellIcon name={ambientPaused?'play':'pause'}/></button><button className="desktop-search-button" aria-label="Search apps and projects" onClick={()=>setSearchOpen(true)}><ShellIcon name="search"/><kbd>⌘K</kbd></button><span className="desktop-network"><i/>Robinhood Chain</span><button className="desktop-wallet" disabled={!!busy} onClick={connect}><ShellIcon name="wallet"/>{wallet?wallet.slice(0,6)+'…'+wallet.slice(-4):'Connect wallet'}</button>{wallet&&<button className="desktop-signout" onClick={requestSignout}>Sign out</button>}</div></header>
  <div className="desktop-surface" ref={surface}>
   <nav className="desktop-shortcuts" aria-label="Desktop apps" inert={drawerOpen}>{shortcutPages.map((item,index)=><button key={item.id} className="desktop-shortcut" style={{'--shortcut-order':index} as CSSProperties} title={item.description} aria-pressed={item.id==='copilot'?mainVisible&&assistantOpen:mainVisible&&mainAreaFor(activePage)===item.id} onClick={()=>activate(item.id)}><AppTile name={item.icon}/><strong>{item.title}</strong></button>)}</nav>
   <div ref={stage} className="workspace-stage" hidden={!mainVisible}>
    <section className="workspace-main desktop-window focused" data-window="main" aria-label="Main workspace" inert={drawerOpen}>
     <header className="workspace-main-titlebar desktop-titlebar"><nav className="workspace-navigation" aria-label="Workspace navigation"><button className="workspace-back" aria-label="Go back" disabled={!history.state?.memehelmDepth} onClick={()=>history.back()}><Arrow/></button><button aria-label="Open Workbench" onClick={()=>activate('home')}><DesktopIcon name="home" size={18}/></button></nav><div className="workspace-title"><DesktopIcon name={app.icon} size={21}/><h2 ref={heading} tabIndex={-1}>{app.title}</h2></div><div className="desktop-window-controls"><button ref={assistantToggle} className="workspace-assistant-toggle" aria-label={assistantOpen?'Collapse MATE':'Open MATE'} aria-pressed={assistantOpen} aria-expanded={assistantOpen} aria-controls="workspace-mate-panel" onClick={()=>assistantOpen?collapseAssistant():openAssistant()}><DesktopIcon name="copilot" size={18}/><span>MATE</span></button><button className="window-maximize" aria-label={focusMode?'Exit focus mode':'Enter focus mode'} aria-pressed={focusMode} onClick={()=>setFocusMode(value=>!value)}><span/></button><button className="window-minimize" aria-label="Minimize workspace" onClick={showDesktop}><span/></button></div></header>
     <div className="workspace-main-body desktop-window-body">{pages.map(key=><section key={key} className={`workspace-page ${key==='home'?'workspace-command-page':''}`} data-workspace-page={key} hidden={key!==contentKey} inert={key!==contentKey} aria-label={`${appFor(key).title} content`}>
      {key==='home'?<CommandBoard projects={projects} projectsState={projectsState} refreshProjects={refreshProjects} wallet={wallet} visible={key===contentKey&&mainVisible} enabled={entered&&visible&&mainVisible} navigate={activate} openProject={id=>{if(openProjectPage(id)!==false)openAssistant();}} openWorkspace={openWorkspace} hide={showDesktop} icon={name=><DesktopIcon name={name} size={21}/>}/>:key==='guide'?<QuickGuide navigate={activate}/>:renderPage(key)}
     </section>)}</div>
    </section>
    <div className="workspace-splitter" role="separator" aria-label="Resize MATE panel" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={460} aria-valuenow={assistantWidth} tabIndex={assistantOpen&&bounds.width>=1100?0:-1} hidden={!assistantOpen} onPointerDown={startSplit} onPointerMove={moveSplit} onPointerUp={endSplit} onPointerCancel={endSplit} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setAssistantWidth(width=>Math.max(280,Math.min(460,width+(event.key==='ArrowLeft'?16:-16))));}}}/>
    {assistantOpen&&bounds.width<1100&&<button className="workspace-assistant-backdrop" aria-label="Close MATE drawer" onClick={collapseAssistant}/>}
    <aside ref={assistantPanel} id="workspace-mate-panel" className="workspace-assistant-window desktop-window" data-window="assistant" role={drawerOpen?'dialog':'complementary'} aria-modal={drawerOpen?true:undefined} tabIndex={-1} hidden={!assistantOpen} aria-label="MATE assistant" aria-hidden={!assistantOpen} inert={!assistantOpen}><header className="workspace-assistant-titlebar desktop-titlebar"><div className="workspace-title"><img data-mate-landing="identity" src="/brand/mate-v1.png" alt=""/><div><h2>MATE</h2><small>AI Copilot</small></div></div><div className="desktop-window-controls"><button className="window-minimize" aria-label="Collapse MATE panel" onClick={collapseAssistant}><span/></button></div></header><div className="workspace-assistant-body">{assistant}</div></aside>
   </div>
   {startOpen&&<div className="desktop-start-menu" id="desktop-app-launcher" ref={menu}><div><Wordmark/><span>Your coin. Your direction.</span>{wallet&&<button className="os-launcher-signout" disabled={!!busy} onClick={requestSignout}>Sign out</button>}</div><nav aria-label="All apps">{[...mainApps,appFor('copilot')].map(item=><button key={item.id} onClick={()=>activate(item.id)}><AppTile name={item.icon}/><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</nav><div className="os-launcher-footer"><button className="os-launcher-help" onClick={()=>activate('guide')}>Quick guide <Arrow/></button><button className="os-launcher-intro" onClick={()=>{setStartOpen(false);replayIntro();}} aria-label="Replay full intro animation"><ShellIcon name="play"/>Replay intro</button><button className="os-launcher-motion" onClick={toggleAmbient} aria-pressed={ambientPaused}><ShellIcon name={ambientPaused?'play':'pause'}/>{ambientPaused?'Resume motion':'Pause motion'}</button></div></div>}
  </div>
  <footer className="desktop-taskbar" inert={drawerOpen}><div className="os-dock"><button ref={startButton} className={`desktop-start-button ${startOpen?'selected':''}`} aria-label="All apps" aria-expanded={startOpen} aria-controls="desktop-app-launcher" onClick={()=>setStartOpen(!startOpen)}><ShellIcon name="grid"/><span className="os-dock-label">All apps</span></button><span className="os-dock-divider"/><nav className="desktop-tasks" aria-label="Application dock">{dockPages.map(item=><button key={item.id} data-app={item.id} data-running={pages.includes(primaryContentKey(item.id) as Page)} className={`os-dock-app ${mainVisible&&mainAreaFor(activePage)===item.id?'active':''}`} aria-label={`Open ${item.title}`} aria-pressed={mainVisible&&mainAreaFor(activePage)===item.id} onClick={()=>activate(item.id)}><AppTile name={item.icon}/><span className="os-dock-label">{item.title}</span></button>)}<button className={`os-dock-app ${assistantOpen&&mainVisible?'active':''}`} aria-label="Open MATE assistant" onClick={openAssistant}><AppTile name="copilot"/><span className="os-dock-label">MATE</span></button></nav><span className="os-dock-divider"/><button className="show-desktop" onClick={showDesktop} aria-label="Show desktop"><ShellIcon name="desktop"/></button></div></footer>
  {searchOpen&&<SearchPalette navigate={activate} projects={projects} openProject={id=>{openProjectPage(id);}} close={()=>setSearchOpen(false)}/>}
  {signoutReview&&<SignoutReview busy={!!busy} keep={()=>setSignoutReview(false)} discard={()=>{setSignoutReview(false);void logout();}}/>}
 </div>;
}
