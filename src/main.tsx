import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {confirmedLaunchInput} from '../shared/confirmed-launch.mjs';
import {TreasuryWorkspace} from './TreasuryWorkspace';
import {api} from './api';
import {sendTransaction,completeTransaction,pendingTransactions} from './wallet';
import type {StoredTransaction} from './wallet';
import {TransactionRecovery} from './TransactionRecovery';
import {useModalFocus} from './useModalFocus';
import {useWindowGuard} from './window-guard';
import type {Page,Project,WorkspaceStatus,Snapshot,Artifact,LaunchDraft,Prepared} from './types';
import {WalletSession} from './WalletSession';
import {MarketWorkspace} from './MarketWorkspace';
import {SignalsWorkspace} from './SignalsWorkspace';
import {Desktop,apps} from './Desktop';
import {WorkspaceAssistant} from './WorkspaceAssistant';
import {WorkspaceSignIn} from './WorkspaceSignIn';
import {routePage,workspaceToolPages,workspaceViewFor,workspacePageFor,primaryContentKey} from '../shared/workspace-navigation.mjs';
import type {CopilotView} from './ProjectToday';
import {EntryLoader,prefersLessMotion} from './EntryLoader';
import {hasSeenMateIntro,markMateIntroSeen} from './mate/intro-preference';
import {GuestWorkspace} from './GuestWorkspace';
import {LaunchWizard} from './LaunchWizard';
import {CopilotWorkspace} from './CopilotWorkspace';
import {ProjectsWorkspace} from './ProjectsWorkspace';
import {ProjectNavigation} from './ProjectNavigation';
import {MarketNavigation} from './MarketNavigation';
import {PublicProject} from './PublicProject';
import './product.css';
import './brand-theme.css';
import './motion.css';
import './pons.css';
import './premium.css';
import './workspace-design.css';
import './guest-workspace.css';
import './os-theme.css';
import './recovery.css';
import './system-shell.css';
import './command-board.css';
import './launch-system.css';
import './application-system.css';
import './copilot-system.css';
import './community-system.css';
import './treasury-system.css';
import './workspace-assistant.css';
import './single-workspace.css';

function Icon({name,size=20}:{name:string;size?:number}){const paths:Record<string,React.ReactNode>={grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,launch:<><path d="m12 3 4 9-4 9-4-9 4-9Z"/><path d="m3 12 9-4 9 4-9 4-9-4Z"/></>,vault:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8m-4-4h8M5 8v2m0 4v2"/></>,spark:<><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7L20 2Z"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="m9 3-.7 2.2L6 6l-2.2-.5L2 8.5l1.5 1.7v3.5L2 15.5l1.8 3 2.2-.5 2.3.8L9 21h6l.7-2.2 2.3-.8 2.2.5 1.8-3-1.5-1.8v-3.5L22 8.5l-1.8-3L18 6l-2.3-.8L15 3H9Z"/></>,arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,plus:<path d="M12 5v14M5 12h14"/>,wallet:<><path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/><path d="M17 14.5h.01"/></>,check:<path d="m5 12 4 4L19 6"/>,external:<><path d="M14 3h7v7m0-7-11 11"/><path d="M10 3H3v18h18v-7"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,shield:<><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,file:<><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5"/><path d="M8 12h8m-8 4h5"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,chart:<><path d="M3 3v18h18"/><path d="m6 15 4-5 4 3 6-7"/></>};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.file}</svg>;}
const shorten=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;
function Field({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
function initialPage():Page{
 const returned=new URLSearchParams(location.search);
 const routed=routePage(location.hash) as Page;
 return returned.has('x')&&returned.has('community')?'publishing':routed==='calculator'?'launch':routed;
}
function App(){
 const [entered,setEntered]=useState(()=>prefersLessMotion()||hasSeenMateIntro()),[fullIntro,setFullIntro]=useState(false),[introRevealed,setIntroRevealed]=useState(false);
 const replayIntro=()=>{setFullIntro(true);setIntroRevealed(false);setEntered(false);};
 return <>{!entered&&<EntryLoader fullMotion={fullIntro} onReveal={()=>setIntroRevealed(true)} onDone={()=>{markMateIntroSeen();setEntered(true);setFullIntro(false);}}/>}<WalletSession>{(wallet,connect,logout,signing)=><Workspace key={wallet.toLowerCase()||'guest'} wallet={wallet} connect={connect} logout={logout} signing={signing} entered={entered} introRevealed={introRevealed} replayIntro={replayIntro}/>}</WalletSession></>;
}
function Workspace({wallet,connect,logout,signing,entered,introRevealed,replayIntro}:{wallet:string;connect:()=>Promise<void>;logout:()=>Promise<void>;signing:boolean;entered:boolean;introRevealed:boolean;replayIntro:()=>void}){
 const [page,setPage]=useState<Page>(initialPage),[menu,setMenu]=useState(false),[projects,setProjects]=useState<Project[]>([]),[status,setStatus]=useState<WorkspaceStatus|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[selected,setSelected]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[chainError,setChainError]=useState(''),[importing,setImporting]=useState(false),[copyState,setCopyState]=useState('');
 const active=projects.find(p=>p.id===selected)||projects[0];
 const [treasuryBlocked,setTreasuryBlocked]=useState(false),[launchBlocked,setLaunchBlocked]=useState(false);
 const [editorGuards,setEditorGuards]=useState<Record<string,boolean>>({});
 useEffect(()=>{const update=(event:Event)=>{const detail=(event as CustomEvent<{id:string;blocked:boolean}>).detail;if(!detail?.id)return;setEditorGuards(current=>{if(!!current[detail.id]===detail.blocked)return current;const next={...current};if(detail.blocked)next[detail.id]=true;else delete next[detail.id];return next;});};window.addEventListener('memehelm-window-guard',update);return()=>window.removeEventListener('memehelm-window-guard',update);},[]);
 useWindowGuard('treasury',treasuryBlocked);useWindowGuard('launch',launchBlocked);
 const savedRoutes=React.useRef(new Map<Page,string>());
 const lastToolView=React.useRef<CopilotView>(workspaceViewFor(page) as CopilotView);
 if(workspaceToolPages.includes(page))lastToolView.current=workspaceViewFor(page) as CopilotView;
 const [projectsState,setProjectsState]=useState<'loading'|'ready'|'error'>(wallet?'loading':'ready');
 const [payoutReview,setPayoutReview]=useState<{projectId:string;version:number}|null>(null);
 useEffect(()=>{const open=(event:Event)=>{const id=(event as CustomEvent<{projectId?:string}>).detail?.projectId;if(!id||!projects.some(project=>project.id===id))return;if(selectProject(id)){setPayoutReview({projectId:id,version:Date.now()});go('treasury');}};window.addEventListener('memehelm-open-distribution-review',open);return()=>window.removeEventListener('memehelm-open-distribution-review',open);},[projects,selected]);
 function selectProject(id:string){if(id!==active?.id&&!window.dispatchEvent(new CustomEvent('memehelm-before-project-change',{cancelable:true}))){setMessage('Finish the current request, save your edits or close the open review before changing projects.');return false;}setSelected(id);return true;}
 function unresolved(kind:'launch'|'vault'){return pendingTransactions(wallet).some(record=>record.intent.kind===kind);}
 function saveActivatedVault(address:string,source:LaunchDraft){
  if((draft.name&&draft.name!==source.name)||(draft.symbol&&draft.symbol!==source.symbol))throw new Error('Save your current draft before restoring this earlier activation. Its transaction is confirmed and will stay available here.');
  const next={...draft,splitEnabled:source.splitEnabled,holdersEnabled:source.holdersEnabled,socialEnabled:source.socialEnabled,projectTreasury:source.projectTreasury,auditTreasury:source.auditTreasury,auditBps:source.auditBps,vaultAddress:address,creatorFeeRecipient:address};
  localStorage.setItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()}:draft`,JSON.stringify(next));setDraft(next);setPrepared(null);setReviewed(false);
 }
 async function reload(){setProjectsState('loading');try{const list=await api<Project[]>('/projects');setProjects(list);setProjectsState('ready');const returnedProject=new URLSearchParams(location.search).get('community');if(returnedProject&&list.some(project=>project.id===returnedProject))setSelected(returnedProject);return list;}catch(reason){setProjectsState('error');throw reason;}}
 async function refreshStatus(){try{setStatus(await api<WorkspaceStatus>('/status'));}catch(e:any){setError(e.message);}}
 useEffect(()=>{if(wallet)reload().catch(e=>setError(e.message));refreshStatus();},[]);

 useEffect(()=>{const controller=new AbortController();setSnapshot(null);setChainError('');if(active?.tokenAddress){api<Snapshot>(`/projects/${active.id}/snapshot`,undefined,controller.signal).then(value=>{if(!controller.signal.aborted)setSnapshot(value);}).catch(e=>{if(!controller.signal.aborted)setChainError(e.message);});}return()=>controller.abort();},[active?.id,active?.tokenAddress]);
 async function run(label:string,fn:()=>Promise<void>){if(busy)return;setBusy(label);setError('');setMessage('');try{await fn();}catch(e:any){setError(e.shortMessage||e.message||'The action failed.');}finally{setBusy('');}}
 useEffect(()=>{if(!Number.isInteger(history.state?.memehelmDepth))history.replaceState({...history.state,memehelmDepth:0},'',location.href);const sync=()=>{setPage(initialPage());setMenu(false);if(location.hash==='#app/copilot')window.dispatchEvent(new CustomEvent('memehelm-open-assistant'));if(location.hash==='#app/calculator')requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('memehelm-open-launch-revenue')));};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync);};},[]);
 function go(next:Page){
  if(next==='copilot'){window.dispatchEvent(new CustomEvent('memehelm-open-assistant'));return;}
  if(next==='calculator'){go('launch');requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('memehelm-open-launch-revenue')));return;}
  const previous=initialPage();savedRoutes.current.set(previous,location.hash);
  const target=next==='home'?location.pathname:savedRoutes.current.get(next)||'#app/'+next;
  if(initialPage()!==next||location.hash!==(next==='home'?'':target)){history.pushState({...history.state,memehelmDepth:(Number(history.state?.memehelmDepth)||0)+1},'',target);}
  setPage(next);setMenu(false);setError('');setMessage('');
 }

 async function deploy(){await run(draft.holdersEnabled?'Activating your holders vault':draft.socialEnabled?'Activating your community escrow':'Activating your revenue split',async()=>{
  if(!wallet)throw new Error('Connect your wallet first.');if(unresolved('vault'))throw new Error('Check your earlier vault activation in transaction recovery before requesting another.');
  const source={...draft},tx=await api<any>('/vault/prepare',source),receipt=await sendTransaction(wallet,tx,{kind:'vault',label:source.holdersEnabled?'Activate holders vault':source.socialEnabled?'Activate community escrow':'Activate revenue split',payload:{draft:source}});
  if(!receipt.contractAddress)throw new Error('Activation is confirmed, but its vault address is unavailable. Keep the recovery record and check it again.');
  saveActivatedVault(receipt.contractAddress,source);completeTransaction(wallet,receipt.recoveryId);setMessage('Your vault is active. Continue to review your launch.');
 });}
 const [draftVersion,setDraftVersion]=useState(0);
 function startNewDraft(){if(busy||!window.dispatchEvent(new CustomEvent('memehelm-before-launch-reset',{cancelable:true})))return;setDraft({...defaultDraft,projectTreasury:wallet,creatorFeeRecipient:wallet});setDraftId('');setPrepared(null);setReviewed(false);localStorage.setItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()||"guest"}:launch-step`,'0');setDraftVersion(value=>value+1);go('launch');}
 const [draftId,setDraftId]=useState(()=>localStorage.getItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()||"guest"}:draft-id`)||'');
 useEffect(()=>{localStorage.setItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()||"guest"}:draft-id`,draftId);},[draftId]);
 const [draft,setDraft]=useState<LaunchDraft>(()=>{try{return {...defaultDraft,...JSON.parse(localStorage.getItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()||"guest"}:draft`)||'{}')};}catch{return defaultDraft;}}),[prepared,setPrepared]=useState<Prepared|null>(null),[reviewed,setReviewed]=useState(false);
 const patch=(key:keyof LaunchDraft,value:string|number|boolean|string[])=>{if(busy)return;setDraft(d=>({...d,[key]:value,...(['projectTreasury','auditTreasury','auditBps'].includes(key)?{vaultAddress:'',creatorFeeRecipient:d.creatorFeeRecipient===d.vaultAddress?'':d.creatorFeeRecipient}:{})}));setPrepared(null);setReviewed(false);};
 useEffect(()=>{localStorage.setItem(`memehelm:4663:pons-v2:${wallet.toLowerCase()||"guest"}:draft`,JSON.stringify(draft));},[draft]);
 async function saveDraft(){await run('Saving draft',async()=>{const project=await api<Project>('/projects',{...draft,draft,draftId:draftId||undefined});setDraftId(project.id);await reload();selectProject(project.id);setMessage('Draft saved. Pick it up whenever you’re ready.');});}
 async function prepare(){await run('Preparing launch',async()=>{const result=await api<Prepared>('/launch/prepare',{...draft,creatorFeeRecipient:draft.splitEnabled?draft.vaultAddress:draft.creatorFeeRecipient||wallet});setPrepared(result);setReviewed(false);setMessage('Your launch is ready to review. Check the details before signing.');});}
 const recoveryKey=`memehelm:4663:pons-v2:${wallet.toLowerCase()||'guest'}:confirmed-launch`;
 const [pendingLaunch,setPendingLaunch]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem(recoveryKey)||'null');}catch{return null;}});
 async function assist(task:'identity'|'fee',idea:string){return await api<any>('/launch/assist',{task,idea,draft:{name:draft.name,symbol:draft.symbol,description:draft.description,website:draft.website,x:draft.x,telegram:draft.telegram,configId:draft.configId}});}
 async function recordLaunch(input:any){const project=await api<Project>('/projects',input);localStorage.removeItem(recoveryKey);setPendingLaunch(null);setDraftId('');setPrepared(null);await reload();selectProject(project.id);go('overview');setMessage(`${project.symbol} launched on Robinhood Chain.`);for(const record of pendingTransactions(wallet))if(record.intent.kind==='launch'&&record.hash?.toLowerCase()===input.launchHash?.toLowerCase())completeTransaction(wallet,record.id);if(status?.aiConfigured)api('/copilot',{projectId:project.id,task:'brief'}).then(()=>setMessage(current=>current.endsWith('launched on Robinhood Chain.')?`${current} Copilot drafted your first operations brief.`:current)).catch(()=>{});}
 function rememberLaunch(input:any){localStorage.setItem(recoveryKey,JSON.stringify(input));setPendingLaunch(input);}
 async function restoreTransaction(record:StoredTransaction){
  if(!record.receipt)throw new Error('The confirmed receipt is not available yet. Check again before continuing.');
  const payload=record.intent.payload||{};
  if(record.intent.kind==='launch'){
   if(!payload.prepared)throw new Error('This older record has no launch details. Check the transaction and import its token into My Projects.');
   const input=confirmedLaunchInput(wallet,payload.prepared,record.receipt,payload.draftId);rememberLaunch(input);await recordLaunch(input);
  }else if(record.intent.kind==='vault'){
   if(!payload.draft||!record.receipt.contractAddress)throw new Error('The vault details could not be restored. Keep this record and check the transaction in your wallet.');
   saveActivatedVault(record.receipt.contractAddress,payload.draft);setMessage('Your confirmed vault activation is restored. Review the launch before signing.');
  }else{
   window.dispatchEvent(new CustomEvent('memehelm-transaction-confirmed',{detail:{...payload,kind:record.intent.kind,hash:record.hash}}));
   setMessage(record.intent.kind==='trade'?'Your earlier transaction is confirmed. Review a fresh quote before any further trade.':`Your transaction is confirmed: ${record.hash}`);
  }
 }
 async function launch(){await run('Launching on Robinhood Chain',async()=>{
  if(pendingLaunch){await recordLaunch(pendingLaunch);return;}
  if(!wallet||!prepared||!reviewed)throw new Error('Connect a wallet and review the prepared launch first.');
  if(unresolved('launch'))throw new Error('Check your earlier launch in transaction recovery before requesting another.');
  if(Date.parse(prepared.expiresAt)<=Date.now())throw new Error('Your launch terms expired. Refresh them before signing.');
  const tx=prepared,receipt=await sendTransaction(wallet,tx,{kind:'launch',label:`Launch $${tx.settings.symbol}`,payload:{prepared:tx,draftId}});
  setPrepared(null);setReviewed(false);const input=confirmedLaunchInput(wallet,tx,receipt,draftId);rememberLaunch(input);await recordLaunch(input);completeTransaction(wallet,receipt.recoveryId);
 });}
 async function copy(text:string){await navigator.clipboard.writeText(text);setCopyState(text);setTimeout(()=>setCopyState(''),2000);}
 const projectSelector=<select aria-label="Active project" value={active?.id||''} onChange={e=>selectProject(e.target.value)}><option value="" disabled>Select a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} · ${p.symbol}</option>)}</select>;
 useEffect(()=>{const open=(event:Event)=>{const detail=(event as CustomEvent<{projectId?:string;kind?:string}>).detail;if(!detail||detail.projectId!==active?.id)return;if(detail.kind==='calendar')go('calendar');else if(detail.kind==='event')go('community');};window.addEventListener('memehelm-open-assistant-result',open);return()=>window.removeEventListener('memehelm-open-assistant-result',open);},[active?.id]);
 const renderPage=(view:Page)=><div className={`content app-page app-${view} ${view==='workspace'?'app-copilot':''}`}>
    {wallet&&['workspace','treasury'].includes(view)&&<ProjectNavigation page={view==='workspace'?workspacePageFor(lastToolView.current) as Page:view} project={active} selector={projects.length?projectSelector:null} navigate={go} blocked={!!busy||!!signing||Object.values(editorGuards).some(Boolean)}/>}
    {['discover','signals'].includes(view)&&<MarketNavigation page={view} navigate={go}/>}
    {view==='discover'&&<MarketWorkspace wallet={wallet} connect={connect}/>}
    {view==='signals'&&<SignalsWorkspace wallet={wallet} connect={connect} discover={()=>go('discover')}/>}
    {!wallet&&['overview','treasury'].includes(view)&&<GuestWorkspace page={view} connect={connect} navigate={go}/>}
    {!wallet&&view==='workspace'&&<WorkspaceSignIn page={workspacePageFor(lastToolView.current) as Page} connect={connect} launch={()=>go('launch')}/>}
    {error&&view===primaryContentKey(page)&&<div className="notice error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><Icon name="close" size={16}/></button></div>}
    {message&&view===primaryContentKey(page)&&<div className="notice success" role="status"><span>{message}</span><button aria-label="Dismiss notification" onClick={()=>setMessage('')}><Icon name="close" size={16}/></button></div>}
    {pendingLaunch&&view===primaryContentKey(page)&&<div className="notice success" role="status">Your launch is confirmed. Save it to your workspace to continue.<button disabled={!!busy} onClick={()=>run('Saving your confirmed launch',()=>recordLaunch(pendingLaunch))}>Save confirmed launch</button></div>}
    {busy&&view===primaryContentKey(page)&&<div className="busy" role="status"><span className="spinner"/>{busy}…</div>}

    {wallet&&view==='overview'&&<ProjectsWorkspace projects={projects} active={active} snapshot={snapshot} state={projectsState} busy={!!busy} chainError={chainError} select={selectProject} create={startNewDraft} importToken={()=>setImporting(true)} retry={()=>{void reload().catch(e=>setError(e.message));}} navigate={go} edit={project=>{if(!project.draft||busy||!window.dispatchEvent(new CustomEvent('memehelm-before-launch-reset',{cancelable:true})))return;setDraftVersion(value=>value+1);setDraft({...defaultDraft,...project.draft});setDraftId(project.id);setPrepared(null);setReviewed(false);go('launch');}} updated={project=>setProjects(previous=>previous.map(item=>item.id===project.id?project:item))}/>}

    {view==='launch'&&<LaunchWizard key={draftVersion} draft={draft} patch={patch} wallet={wallet} busy={busy} prepared={prepared} reviewed={reviewed} setReviewed={setReviewed} connect={connect} deploy={deploy} save={saveDraft} prepare={prepare} launch={launch} assist={assist} onBlocked={setLaunchBlocked}/>}

    {wallet&&view==='treasury'&&<TreasuryWorkspace key={active?.id||'empty'} project={active} wallet={wallet} selector={null} createProject={()=>go('launch')} reviewRequest={payoutReview?.projectId===active?.id?payoutReview?.version:undefined} onReviewHandled={version=>setPayoutReview(previous=>previous?.version===version?null:previous)} onProjectUpdated={project=>setProjects(previous=>previous.map(item=>item.id===project.id?project:item))} onBlocked={setTreasuryBlocked}/>}

    {wallet&&view==='workspace'&&<CopilotWorkspace presentation="workspace" activeView={lastToolView.current} onNavigate={next=>go(next==='chat'?'copilot':workspacePageFor(next) as Page)} project={active} selector={projects.length?projectSelector:undefined} available={!!status?.aiConfigured} createProject={()=>go('launch')} openProjects={()=>go('overview')} updated={project=>setProjects(previous=>previous.map(item=>item.id===project.id?project:item))}/>}

 </div>;
 return <>
  <Desktop assistant={<WorkspaceAssistant wallet={wallet} connect={connect} project={active} selector={projects.length?projectSelector:undefined} available={!!status?.aiConfigured} currentPageLabel={apps.find(app=>app.id===page)?.title||'Command'} createProject={()=>go('launch')} openProjects={()=>go('overview')} updated={project=>setProjects(previous=>previous.map(item=>item.id===project.id?project:item))}/>} selectProject={selectProject} page={page} navigate={go} renderPage={renderPage} projects={projects} projectsState={projectsState} refreshProjects={()=>{void reload().catch(e=>setError(e.message));}} wallet={wallet} busy={signing?"Signing in":busy} connect={connect} logout={logout} entered={entered} introRevealed={introRevealed} replayIntro={replayIntro} openProject={id=>{if(!selectProject(id))return false;go('workspace');return true;}} useSplit={reserve=>{if(busy||!window.dispatchEvent(new CustomEvent('memehelm-before-launch-reset',{cancelable:true})))return;setDraft(d=>({...d,splitEnabled:true,auditBps:reserve*100,projectTreasury:d.projectTreasury||wallet,vaultAddress:'',creatorFeeRecipient:''}));setPrepared(null);setReviewed(false);go('launch');}}/>
  {entered&&<TransactionRecovery wallet={wallet} resolved={restoreTransaction}/>}
  {importing&&<ImportModal close={()=>setImporting(false)} save={async(input)=>{const project=await api<Project>('/projects',input);await reload();selectProject(project.id);setImporting(false);setMessage('Your project is in.');}}/>}
 </>;
}
const defaultDraft:LaunchDraft={name:'',symbol:'',description:'',image:'',website:'',x:'',telegram:'',creatorFeeRecipient:'',creatorTaxBps:0,configId:0,splitEnabled:false,holdersEnabled:false,socialEnabled:false,projectTreasury:'',auditTreasury:'',auditBps:1000,vaultAddress:'',snipeTaxExemptions:[]};
function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}){return <div className="page-title"><div className="eyebrow">{eyebrow}</div><div><h1>{title}</h1>{action}</div><p>{description}</p></div>;}
function ImportModal({close,save}:{close:()=>void;save:(input:unknown)=>Promise<void>}){const panel=React.useRef<HTMLElement>(null);useModalFocus(panel,()=>{if(!saving)close();});const[name,setName]=useState(''),[symbol,setSymbol]=useState(''),[token,setToken]=useState(''),[vault,setVault]=useState(''),[saving,setSaving]=useState(false),[importError,setImportError]=useState('');return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)close();}}><section ref={panel} tabIndex={-1} className="modal panel" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="section-title"><h2 id="import-title">Import your token</h2><button aria-label="Close import" disabled={saving} onClick={close}><Icon name="close"/></button></div><p className="panel-copy">Bring a Robinhood Chain token into your workspace. Add its MemeHelm vault to see revenue and balances.</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);setImportError('');try{await save({name,symbol,tokenAddress:token,vaultAddress:vault});}catch(reason:any){setImportError(reason.message||'This token could not be verified. Check the address and try again.');}finally{setSaving(false);}}}>{importError&&<div className="notice error" role="alert">{importError}</div>}<Field label="Project name"><input required maxLength={32} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Symbol"><input required pattern="[A-Za-z0-9]{2,10}" value={symbol} onChange={e=>setSymbol(e.target.value)}/></Field><Field label="Token address"><input required pattern="0x[0-9a-fA-F]{40}" value={token} onChange={e=>setToken(e.target.value)} placeholder="0x…"/></Field><Field label="MemeHelm vault address (optional)"><input pattern="0x[0-9a-fA-F]{40}" value={vault} onChange={e=>setVault(e.target.value)} placeholder="0x…"/></Field><button className="button primary full" disabled={saving} type="submit">{saving?'Importing…':'Import project'}</button></form></section></div>;}
function AppRoot(){const project=location.pathname.match(/^\/project\/([a-f0-9-]+)$/);return project?<PublicProject id={project[1]}/>:<App/>;}
createRoot(document.getElementById('root')!).render(<AppRoot/>);
