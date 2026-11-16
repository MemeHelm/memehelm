import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';
import * as workspaceNavigation from '../shared/workspace-navigation.mjs';
const {workspaceToolPages,workspaceViewFor,workspacePageFor,primaryContentKey,routePage,guardDestination}=workspaceNavigation;

const copilotFile=new URL('../src/CopilotWorkspace.tsx',import.meta.url);
const assistantFile=new URL('../src/WorkspaceAssistant.tsx',import.meta.url);
const project={id:'11111111-1111-4111-8111-111111111111',name:'Orbit Club',symbol:'ORB',description:'An explicitly illustrative project.',tokenAddress:null,vaultAddress:null,chainId:4663};
const noop=()=>null;
const Chat=()=>null,Calendar=()=>null,Community=()=>null,Operations=()=>null,Growth=()=>null,Entry=()=>null;

function nodes(tree,predicate){const found=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(predicate(node))found.push(node);visit(node.props?.children);}visit(tree);return found;}
function environment(t){
  const saved={window:globalThis.window,location:globalThis.location};
  globalThis.window=new EventTarget();globalThis.location={search:''};
  t.after(()=>{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
}
function imports(guards=[]){return{
  './api':{api:async()=>{throw new Error('A navigation test must never request AI or write data.');}},
  './Brand':{Arrow:noop},'./AIRequestRecovery':{AIRequestRecovery:noop},'./DraftEditor':{DraftEditor:noop},
  './OperationsWorkspace':{OperationsWorkspace:Operations},'./GrowthWorkspace':{GrowthWorkspace:Growth},
  './ContentCalendar':{ContentCalendar:Calendar},'./CommunityWorkspace':{CommunityWorkspace:Community},
  './ProjectChat':{ProjectChat:Chat},'./CopilotEntry':{CopilotEntry:Entry},
  './window-guard':{useWindowGuard:(id,blocked)=>guards.push({id,blocked})},
};}
const toolNodes=tree=>nodes(tree,node=>typeof node.type==='function'&&node.type.name==='PersistentCopilotTool');
const selector=tree=>findNode(tree,node=>node.type==='fieldset');

test('workspace routes round-trip to their tool while sharing one mounted primary content key',()=>{
  for(const page of workspaceToolPages){assert.equal(routePage(`#app/${page}`),page);assert.equal(workspacePageFor(workspaceViewFor(page)),page);assert.equal(primaryContentKey(page),'workspace');}
  for(const page of ['launch','overview','treasury','discover','signals','calculator','guide']){assert.equal(routePage(`#app/${page}`),page);assert.equal(primaryContentKey(page),page);}
  assert.equal(routePage('#app/copilot'),'workspace');assert.equal(primaryContentKey('copilot'),'workspace');
  assert.equal(routePage('#app/discover/0x1234567890abcdef1234567890abcdef12345678'),'discover');
  for(const hash of ['','#app/unknown','#app/discover/0x1234','#app/calendar/unknown'])assert.equal(routePage(hash),'home');
});

test('unsaved-work guards reveal the originating tool or assistant rather than an unrelated page',()=>{
  assert.equal(guardDestination('assistant-chat'),'copilot');
  for(const [id,page] of [['workspace-content','calendar'],['workspace-community','community'],['workspace-writing','writing'],['workspace-operations','workspace'],['launch','launch'],['treasury','treasury']])assert.equal(guardDestination(id),page);
});

test('visited project tools retain stable editor slots and share one operations instance',t=>{
  environment(t);const props={project,selector:null,available:true,createProject:noop,openProjects:noop,activeView:'today',onNavigate:noop};
  const component=componentHarness(copilotFile,'PersistentCopilotWorkspace',props,imports(),{expose:true});
  let tree=component.render();component.effects();let tools=toolNodes(tree);assert.equal(tools.length,1);const original=tools[0];assert.equal(original.key,'operations');assert.equal(original.props.view,'today');assert.equal(original.props.hidden,false);
  for(const next of ['memory','activity']){props.activeView=next;tree=component.render();component.effects();tools=toolNodes(tree);assert.equal(tools.length,1);assert.equal(tools[0].type,original.type);assert.equal(tools[0].key,original.key);assert.equal(tools[0].props.view,next);}
  for(const next of ['content','community','writing']){props.activeView=next;tree=component.render();component.effects();}
  props.activeView='today';tree=component.render();component.effects();tools=toolNodes(tree);
  assert.deepEqual(tools.map(tool=>tool.key),['operations','content','community','writing']);
  assert.equal(tools.filter(tool=>!tool.props.hidden).length,1);assert.equal(tools[0].props.hidden,false);
  assert.ok(tools.slice(1).every(tool=>tool.props.hidden));assert.equal(tools[0].type,original.type);
  // A single operations component owns memory and activity; switching their presentation cannot multiply its polling.
  const tool=componentHarness(copilotFile,'PersistentCopilotTool',tools[0].props,imports(),{expose:true});
  const toolTree=tool.render();assert.equal(nodes(toolTree,node=>node.type===Operations).length,1);assert.equal(findNode(toolTree,node=>node.type===Chat),null);tool.unmount();component.unmount();
});

test('hidden editors keep separate guards until every dirty editor is resolved',t=>{
  environment(t);const props={project,selector:'Project selector',available:true,createProject:noop,openProjects:noop,activeView:'content',onNavigate:noop};
  const component=componentHarness(copilotFile,'PersistentCopilotWorkspace',props,imports(),{expose:true});
  let tree=component.render();component.effects();const report=toolNodes(tree)[0].props.reportGuard;
  report('content',true);tree=component.render();assert.equal(tree.props['data-has-unsaved-work'],true);
  props.activeView='community';tree=component.render();component.effects();const tools=toolNodes(tree);assert.equal(tools.find(tool=>tool.key==='content').props.hidden,true);assert.equal(tools[1].props.reportGuard,report);
  report('community',true);report('content',false);tree=component.render();assert.equal(tree.props['data-has-unsaved-work'],true);
  report('community',false);tree=component.render();assert.equal(tree.props['data-has-unsaved-work'],false);component.unmount();
});

test('persistent tool hiding blocks focus while preserving its local close guard',t=>{
  environment(t);const guards=[],reports=[],props={project,selector:null,available:true,createProject:noop,openProjects:noop,view:'content',hidden:false,onNavigate:noop,reportGuard:(...args)=>reports.push(args)};
  const component=componentHarness(copilotFile,'PersistentCopilotTool',props,imports(guards),{expose:true});
  let tree=component.render();const editor=findNode(tree,node=>node.type===Calendar);assert.ok(editor);editor.props.onBlocked(true);
  props.hidden=true;tree=component.render();assert.equal(tree.props.hidden,true);assert.equal(tree.props.inert,true);assert.equal(tree.props['aria-hidden'],true);assert.equal(findNode(tree,node=>node.type===Calendar).type,Calendar);assert.deepEqual(guards.at(-1),{id:'workspace-content',blocked:true});
  findNode(tree,node=>node.type===Calendar).props.onBlocked(false);component.render();assert.deepEqual(guards.at(-1),{id:'workspace-content',blocked:false});assert.deepEqual(reports,[['content',true],['content',false]]);component.unmount();
});

test('the workspace presentation delegates navigation without subscribing to legacy chat events',t=>{
  environment(t);const events=[];window.addEventListener('memehelm-copilot-view',event=>events.push(event.detail));
  const props={project,selector:null,available:true,createProject:noop,openProjects:noop,presentation:'workspace',activeView:'content',onNavigate:noop};
  const component=componentHarness(copilotFile,'CopilotWorkspace',props,imports());let tree=component.render();component.effects();
  const first=tree.type;assert.equal(first.name,'PersistentCopilotWorkspace');assert.equal(tree.props.activeView,'content');assert.equal(findNode(tree,node=>node.type===Chat),null);assert.deepEqual(events,[]);
  window.dispatchEvent(new CustomEvent('memehelm-open-copilot-view',{detail:{view:'chat'}}));window.dispatchEvent(new CustomEvent('memehelm-open-assistant-result',{detail:{projectId:project.id,kind:'event'}}));
  tree=component.render();component.effects();assert.equal(tree.type,first);assert.equal(tree.props.activeView,'content');assert.deepEqual(events,[]);component.unmount();
});

test('the assistant owns exactly one project chat and protects the selected project while it has work',t=>{
  environment(t);const guards=[],props={wallet:'0xowner',connect:noop,project,selector:'Selected project',available:true,createProject:noop,openProjects:noop,currentPageLabel:'Launchpad'};
  const component=componentHarness(assistantFile,'WorkspaceAssistant',props,imports(guards));
  let tree=component.render(),chat=findNode(tree,node=>node.type===Chat);assert.equal(nodes(tree,node=>node.type===Chat).length,1);assert.equal(chat.key,project.id);assert.equal(chat.props.presentation,'sidebar');assert.match(textOf(tree),/Launchpad/);
  chat.props.onBlocked(true);tree=component.render();assert.equal(selector(tree).props.disabled,true);assert.deepEqual(guards.at(-1),{id:'assistant-chat',blocked:true});
  props.currentPageLabel='Community';tree=component.render();assert.equal(nodes(tree,node=>node.type===Chat).length,1);assert.equal(findNode(tree,node=>node.type===Chat).key,project.id);assert.match(textOf(tree),/Community/);assert.equal(selector(tree).props.disabled,true);
  findNode(tree,node=>node.type===Chat).props.onBlocked(false);tree=component.render();assert.equal(selector(tree).props.disabled,false);assert.deepEqual(guards.at(-1),{id:'assistant-chat',blocked:false});component.unmount();
});

test('the assistant requires sign-in but gives a wallet a general chat without a project',t=>{
  environment(t);const props={wallet:'',connect:noop,project,selector:null,available:true,createProject:noop,openProjects:noop};
  const component=componentHarness(assistantFile,'WorkspaceAssistant',props,imports());let tree=component.render();assert.equal(findNode(tree,node=>node.type===Chat),null);assert.equal(findNode(tree,node=>node.type===Entry).props.mode,'guest');
  props.wallet='0xowner';props.project=undefined;tree=component.render();const chat=findNode(tree,node=>node.type===Chat);assert.ok(chat);assert.equal(nodes(tree,node=>node.type===Chat).length,1);assert.equal(chat.props.project,undefined);assert.equal(chat.props.presentation,'sidebar');assert.equal(findNode(tree,node=>node.type===Entry),null);component.unmount();
});

test('general conversations stay selected when a project appears and scope changes protect unfinished work',t=>{
  environment(t);const guards=[],props={wallet:'0xowner',connect:noop,project:undefined,selector:'Selected project',available:true,createProject:noop,openProjects:noop};
  const component=componentHarness(assistantFile,'WorkspaceAssistant',props,imports(guards));
  let tree=component.render(),general=findNode(tree,node=>node.type===Chat);assert.ok(general);assert.equal(general.props.project,undefined);
  props.project=project;tree=component.render();assert.equal(findNode(tree,node=>node.type===Chat).key,general.key);assert.equal(findNode(tree,node=>node.type===Chat).props.project,undefined);
  const scope=label=>findNode(tree,node=>node.type==='button'&&textOf(node).trim()===label);
  assert.equal(scope('Platform chat').props['aria-pressed'],true);assert.equal(scope('Project chat').props['aria-pressed'],false);
  findNode(tree,node=>node.type===Chat).props.onBlocked(true);tree=component.render();assert.equal(scope('Platform chat').props.disabled,true);assert.equal(scope('Project chat').props.disabled,true);assert.deepEqual(guards.at(-1),{id:'assistant-chat',blocked:true});
  findNode(tree,node=>node.type===Chat).props.onBlocked(false);tree=component.render();scope('Project chat').props.onClick();tree=component.render();assert.equal(findNode(tree,node=>node.type===Chat).props.project,project);assert.equal(scope('Project chat').props['aria-pressed'],true);
  scope('Platform chat').props.onClick();tree=component.render();assert.equal(findNode(tree,node=>node.type===Chat).props.project,undefined);assert.equal(findNode(tree,node=>node.type===Chat).key,general.key);assert.equal(nodes(tree,node=>node.type===Chat).length,1);component.unmount();
});

const shellFile=new URL('../src/SingleWorkspace.tsx',import.meta.url);
const Command=()=>null,Search=()=>null,Assistant=()=>null,PageSurface=()=>null;
const appTitles={home:'Workbench',workspace:'Project overview',community:'Community',calendar:'Calendar',memory:'Project memory',goals:'Community goals',activity:'Activity',writing:'Content studio',discover:'Market',signals:'Signals',launch:'Launchpad',copilot:'MATE',treasury:'Treasury',overview:'Projects',calculator:'Split Calculator',guide:'Quick Guide'};
const shellApps=Object.entries(appTitles).map(([id,title])=>({id,title,description:`Open ${title}`,icon:id,color:'brand'}));
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&(node.props['aria-label']===label||textOf(node).trim()===label));
const slotNodes=tree=>nodes(tree,node=>node.props?.['data-workspace-page']);
const reviewNode=tree=>findNode(tree,node=>typeof node.type==='function'&&node.type.name==='SignoutReview');

function shellFixture(t,changes={}){
  let component;t.after(()=>component?.unmount());
  environment(t);const saved={document:globalThis.document,localStorage:globalThis.localStorage,history:globalThis.history,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const storage=new Map(),frames=new Map();let frameId=0;
  const calls={pages:[],logout:0,back:0,selected:[]};
  window.innerWidth=1280;globalThis.document=new EventTarget();document.hidden=false;document.querySelector=()=>null;
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
  globalThis.history={state:{memehelmDepth:0},back(){calls.back++;}};
  globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  t.after(()=>{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const assistant=createElement(Assistant,{id:'one-assistant'},'assistant');
  const props={page:'home',assistant,renderPage:page=>createElement(PageSurface,{page},page),projects:[],projectsState:'ready',refreshProjects:noop,wallet:'0xowner',busy:'',connect:noop,logout:async()=>{calls.logout++;},useSplit:noop,openProject:()=>true,selectProject:id=>{calls.selected.push(id);return true;},entered:true,introRevealed:false,replayIntro:noop,...changes};
  props.navigate=page=>{calls.pages.push(page);props.page=page;};
  component=componentHarness(shellFile,'SingleWorkspace',props,{
    './Desktop':{apps:shellApps,AppTile:noop,DesktopIcon:noop,ShellIcon:noop,QuickGuide:noop,SplitCalculator:noop},
    './Brand':{Wordmark:noop,Arrow:noop},'./Wallpaper':{Wallpaper:noop},'./CommandBoard':{CommandBoard:Command},
    './SearchPalette':{SearchPalette:Search},'./useModalFocus':{useModalFocus:noop},'../shared/workspace-navigation.mjs':workspaceNavigation,
  });
  const render=()=>{let tree;for(let i=0;i<3;i++){tree=component.render();component.effects();}return tree;};
  return{component,props,calls,render,assistant};
}

test('all app shortcuts replace one main surface while visited pages retain stable hidden slots',t=>{
  const {render,props}=shellFixture(t);let tree=render();
  const slots=new Map(slotNodes(tree).map(slot=>[slot.key,slot.type]));
  const shortcutIds=nodes(tree,node=>node.type==='button'&&node.props.className==='desktop-shortcut').map(node=>textOf(node).trim());
  for(const title of shortcutIds){
    const shortcut=findNode(tree,node=>node.type==='button'&&node.props.className==='desktop-shortcut'&&textOf(node).trim()===title);shortcut.props.onClick();tree=render();
    assert.equal(nodes(tree,node=>node.props?.['data-window']==='main').length,1);assert.equal(nodes(tree,node=>node.props?.['data-window']==='assistant').length,1);
    const current=slotNodes(tree);assert.equal(current.filter(slot=>!slot.props.hidden).length,1);assert.equal(current.find(slot=>!slot.props.hidden).props['data-workspace-page'],primaryContentKey(props.page));
    for(const slot of current){if(slots.has(slot.key))assert.equal(slot.type,slots.get(slot.key));else slots.set(slot.key,slot.type);if(slot.props.hidden)assert.equal(slot.props.inert,true);}
    assert.equal(current.length,slots.size);
  }
  assert.deepEqual(shortcutIds,['Workbench','Launchpad','Projects','Market']);assert.ok(slots.has('launch'));assert.ok(slots.has('discover'));assert.ok(slots.has('overview'));assert.ok(slots.has('home'));
});

test('MATE opens and collapses independently without changing the route or creating another assistant',t=>{
  const {render,props,calls,assistant}=shellFixture(t,{page:'launch'});let tree=render();
  button(tree,'Collapse MATE panel').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.['data-window']==='assistant').props.hidden,true);
  for(let index=0;index<4;index++){button(tree,'Open MATE assistant').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.['data-window']==='assistant').props.hidden,false);assert.equal(nodes(tree,node=>node.type===Assistant).length,1);assert.equal(findNode(tree,node=>node.type===Assistant),assistant);}
  button(tree,'All apps').props.onClick();tree=render();const launcher=findNode(tree,node=>node.type==='nav'&&node.props['aria-label']==='All apps');const mate=findNode(launcher,node=>node.type==='button'&&textOf(node).trim().startsWith('MATE'));mate.props.onClick();tree=render();
  assert.equal(props.page,'launch');assert.deepEqual(calls.pages,[]);assert.equal(slotNodes(tree).length,1);assert.equal(findNode(tree,node=>node.type===Assistant),assistant);
  button(tree,'Enter focus mode').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.['data-window']==='assistant').props.hidden,true);assert.equal(findNode(tree,node=>node.type===Assistant),assistant);
  button(tree,'Exit focus mode').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.['data-window']==='assistant').props.hidden,false);
});

test('minimizing or showing the desktop keeps visited tools and the assistant mounted for restoration',t=>{
  const {render,calls,assistant}=shellFixture(t,{page:'launch'});let tree=render();
  const slot=findNode(tree,node=>node.props?.['data-workspace-page']==='launch'),surface=findNode(tree,node=>node.type===PageSurface);
  button(tree,'Minimize workspace').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.className==='workspace-stage').props.hidden,true);assert.equal(findNode(tree,node=>node.props?.['data-workspace-page']==='launch').key,slot.key);assert.equal(findNode(tree,node=>node.type===PageSurface).type,surface.type);assert.equal(findNode(tree,node=>node.type===Assistant),assistant);
  button(tree,'Open Launchpad').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.className==='workspace-stage').props.hidden,false);assert.deepEqual(calls.pages,[]);
  button(tree,'Show desktop').props.onClick();tree=render();assert.equal(findNode(tree,node=>node.props?.className==='workspace-stage').props.hidden,true);assert.equal(nodes(tree,node=>node.props?.['data-window']==='main').length,1);assert.equal(findNode(tree,node=>node.type===Assistant),assistant);
});

test('external route changes and the back control do not push a second navigation entry',t=>{
  const {render,props,calls}=shellFixture(t,{page:'launch'});let tree=render();assert.equal(button(tree,'Go back').props.disabled,true);
  for(const page of ['community','calendar','discover','launch']){props.page=page;tree=render();assert.equal(slotNodes(tree).find(slot=>!slot.props.hidden).props['data-workspace-page'],primaryContentKey(page));}
  assert.deepEqual(calls.pages,[]);history.state={memehelmDepth:3};tree=render();assert.equal(button(tree,'Go back').props.disabled,false);button(tree,'Go back').props.onClick();assert.equal(calls.back,1);assert.deepEqual(calls.pages,[]);
  button(tree,'Open Launchpad').props.onClick();tree=render();assert.deepEqual(calls.pages,[]);
});

test('launcher, search and widget links use the same primary route and selected-project boundary',t=>{
  const {render,props,calls}=shellFixture(t);let tree=render();const command=findNode(tree,node=>node.type===Command);
  command.props.openWorkspace('content',project.id);tree=render();assert.deepEqual(calls.selected,[project.id]);assert.equal(props.page,'calendar');assert.equal(slotNodes(tree).find(slot=>!slot.props.hidden).props['data-workspace-page'],'workspace');
  const beforeChat=[...calls.pages];command.props.openWorkspace('chat',project.id);tree=render();assert.deepEqual(calls.pages,beforeChat);assert.equal(props.page,'calendar');
  button(tree,'Search apps and projects').props.onClick();tree=render();const search=findNode(tree,node=>node.type===Search);assert.ok(search);search.props.close();search.props.navigate('discover');tree=render();assert.equal(props.page,'discover');assert.equal(findNode(tree,node=>node.type===Search),null);
  button(tree,'All apps').props.onClick();tree=render();const allApps=findNode(tree,node=>node.type==='nav'&&node.props['aria-label']==='All apps');
  assert.equal(nodes(allApps,node=>node.type==='button').length,5);assert.doesNotMatch(textOf(allApps),/Split Calculator|Project memory|Community goals/);
  button(tree,'All apps').props.onClick();tree=render();
  for(const id of ['memory','goals','activity','writing']){
    button(tree,'Search apps and projects').props.onClick();tree=render();const palette=findNode(tree,node=>node.type===Search);palette.props.navigate(id);palette.props.close();tree=render();
    assert.equal(props.page,id);assert.equal(nodes(tree,node=>node.props?.['data-window']==='main').length,1);assert.equal(slotNodes(tree).filter(slot=>slot.props['data-workspace-page']==='workspace').length,1);
    const nav=findNode(tree,node=>node.type==='nav'&&node.props['aria-label']==='Main apps');assert.equal(button(nav,'Projects').props['aria-pressed'],true);
  }
});

test('rejecting a project change preserves the current primary tool and collapsed assistant',t=>{
  const {render,props,calls}=shellFixture(t,{selectProject:()=>false});let tree=render();button(tree,'Collapse MATE panel').props.onClick();tree=render();
  findNode(tree,node=>node.type===Command).props.openProject(project.id);tree=render();assert.equal(props.page,'home');assert.deepEqual(calls.pages,[]);assert.equal(findNode(tree,node=>node.props?.['data-window']==='assistant').props.hidden,true);
});

test('dirty hidden tools block project changes and signing out requires an explicit decision',t=>{
  const {render,calls}=shellFixture(t,{page:'launch'});let tree=render();
  window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id:'workspace-community',blocked:true}}));
  const change=new Event('memehelm-before-project-change',{cancelable:true});assert.equal(window.dispatchEvent(change),false);tree=render();assert.equal(calls.pages.at(-1),'community');
  button(tree,'Sign out').props.onClick();tree=render();assert.ok(reviewNode(tree));assert.equal(calls.logout,0);
  reviewNode(tree).props.keep();tree=render();assert.equal(reviewNode(tree),null);assert.equal(calls.logout,0);
  const leave=new Event('beforeunload',{cancelable:true});assert.equal(window.dispatchEvent(leave),false);
  button(tree,'Sign out').props.onClick();tree=render();reviewNode(tree).props.discard();tree=render();assert.equal(calls.logout,1);assert.equal(reviewNode(tree),null);
});

test('busy work and every independent editor guard protect page exit until all are clear',t=>{
  const {render,props,calls,component}=shellFixture(t);render();
  props.busy='Preparing transaction';render();let leave=new Event('beforeunload',{cancelable:true});assert.equal(window.dispatchEvent(leave),false);
  props.busy='';render();
  for(const id of ['assistant-chat','workspace-content'])window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id,blocked:true}}));
  window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id:'workspace-content',blocked:false}}));
  leave=new Event('beforeunload',{cancelable:true});assert.equal(window.dispatchEvent(leave),false);
  const change=new Event('memehelm-before-project-change',{cancelable:true});assert.equal(window.dispatchEvent(change),false);assert.deepEqual(calls.pages,[]);
  window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id:'assistant-chat',blocked:false}}));
  leave=new Event('beforeunload',{cancelable:true});assert.equal(window.dispatchEvent(leave),true);
  const tree=render();button(tree,'Sign out').props.onClick();assert.equal(calls.logout,1);
  component.unmount();window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id:'assistant-chat',blocked:true}}));assert.equal(window.dispatchEvent(new Event('beforeunload',{cancelable:true})),true);
});

test('a hidden Treasury review and unfinished escrow draft keep the shell protected until explicitly cleared',async t=>{
  let treasury;t.after(()=>treasury?.unmount());
  const {render,calls}=shellFixture(t,{page:'treasury'}),guardStates=[],requests=[],walletCalls=[];
  const wallet='0x1111111111111111111111111111111111111111',vault='0x3333333333333333333333333333333333333333';
  const selectedProject={...project,tokenAddress:'0x2222222222222222222222222222222222222222',vaultAddress:vault};
  let kind='holders';
  const api=async(path,body)=>{
    requests.push({path,body});
    if(path.endsWith('/snapshot'))return{symbol:'ORB',vault:{kind,address:vault,controller:wallet,distributable:'1',totalReceived:'2',totalDistributed:'1',totalReleased:'1',rounds:1,projectTreasury:wallet,auditTreasury:wallet,projectPending:'0',auditPending:'0',auditBps:1000,proposalCount:0},revenue:null};
    if(path.endsWith('/distribution/prepare'))return{chainId:4663,to:vault,data:'0x1234',value:'0',label:'distribute',expiresAt:new Date(Date.now()+60000).toISOString(),reviewId:'review-guard',total:'1',retained:'0',recipients:[wallet],amounts:['1'],reviewRecipients:[{address:wallet,amount:'1'}],excludedRecipients:[],round:{included:1,eligible:1,sampled:1,holdersCount:1,minimum:'0.001',coveredBalance:'1',dropped:[]}};
    if(path.endsWith('/community/proposals'))return{proposals:[],nextBefore:null};
    throw new Error(`Unexpected Treasury guard request: ${path}`);
  };
  const onBlocked=blocked=>{guardStates.push(blocked);window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id:'treasury',blocked}}));};
  const makeTreasury=props=>componentHarness(new URL('../src/TreasuryWorkspace.tsx',import.meta.url),'TreasuryWorkspace',props,{'./api':{api},'./wallet':{sendTransaction:()=>{walletCalls.push('send');throw new Error('Guard verification never signs.');},completeTransaction:()=>walletCalls.push('complete')},'./Brand':{Arrow:noop}});
  const cycle=async()=>{let tree;for(let i=0;i<4;i++){tree=treasury.render();treasury.effects();await settle();}return treasury.render();};
  render();const props={project:selectedProject,wallet,selector:null,createProject:noop,onBlocked,reviewRequest:73,onReviewHandled(){props.reviewRequest=undefined;}};
  treasury=makeTreasury(props);let tree=await cycle();assert.match(textOf(tree),/Review holder payout/);assert.equal(guardStates.at(-1),true);assert.equal(requests.filter(request=>request.path.endsWith('/distribution/prepare')).length,1);
  assert.equal(window.dispatchEvent(new Event('beforeunload',{cancelable:true})),false);
  let shell=render();button(shell,'Open Launchpad').props.onClick();shell=render();assert.equal(calls.pages.at(-1),'launch');assert.match(textOf(treasury.render()),/Review holder payout/);assert.equal(guardStates.at(-1),true);
  assert.equal(window.dispatchEvent(new Event('memehelm-before-project-change',{cancelable:true})),false);assert.equal(calls.pages.at(-1),'treasury');render();
  button(tree,'Close review').props.onClick();tree=await cycle();assert.equal(button(tree,'Close review'),null);assert.equal(guardStates.at(-1),false);assert.equal(window.dispatchEvent(new Event('beforeunload',{cancelable:true})),true);
  treasury.unmount();kind='social';treasury=makeTreasury({...props,reviewRequest:undefined});tree=await cycle();
  const input=label=>findNode(tree,node=>node.type==='input'&&node.props['aria-label']===label);
  input('Release recipient').props.onChange({target:{value:wallet}});tree=await cycle();input('Release amount in ETH').props.onChange({target:{value:'0.25'}});tree=await cycle();assert.equal(guardStates.at(-1),true);
  input('Release recipient').props.onChange({target:{value:''}});tree=await cycle();assert.equal(input('Release amount in ETH').props.value,'0.25');assert.equal(guardStates.at(-1),true);assert.equal(window.dispatchEvent(new Event('beforeunload',{cancelable:true})),false);
  input('Release amount in ETH').props.onChange({target:{value:''}});await cycle();assert.equal(guardStates.at(-1),false);assert.equal(window.dispatchEvent(new Event('memehelm-before-project-change',{cancelable:true})),true);assert.deepEqual(walletCalls,[]);
});

test('a phone assistant drawer waits until entry completes before trapping Escape or focus',t=>{
  const {component,props}=shellFixture(t,{page:'copilot',entered:false}),savedObserver=globalThis.ResizeObserver,savedElement=globalThis.HTMLElement;
  t.after(()=>{if(savedObserver===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=savedObserver;if(savedElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=savedElement;});
  window.innerWidth=390;location.hash='#app/copilot';globalThis.HTMLElement=class{};
  globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback([{contentRect:{width:390,height:844}}]);}disconnect(){}};
  const attached=new Set(),add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
  document.querySelectorAll=()=>[];
  document.addEventListener=(type,handler,capture)=>{if(type==='keydown'&&capture===true)attached.add(handler);add(type,handler,capture);};
  document.removeEventListener=(type,handler,capture)=>{if(type==='keydown'&&capture===true)attached.delete(handler);remove(type,handler,capture);};
  const panel={querySelectorAll:()=>[],contains:()=>false,focus(){}};
  let tree=component.render();findNode(tree,node=>node.props?.className==='desktop-surface').props.ref.current={};findNode(tree,node=>node.props?.id==='workspace-mate-panel').props.ref.current=panel;component.effects();
  for(let count=0;count<3;count++){tree=component.render();component.effects();}
  assert.equal(findNode(tree,node=>node.props?.id==='workspace-mate-panel').props.role,'dialog');assert.equal(attached.size,0,'the entry overlay must own Escape while the desktop is inert');
  const introEscape=new Event('keydown',{cancelable:true});Object.defineProperty(introEscape,'key',{value:'Escape'});document.dispatchEvent(introEscape);assert.equal(introEscape.defaultPrevented,false);
  props.entered=true;component.render();component.effects();assert.equal(attached.size,1,'the drawer becomes keyboard-modal after entry');
  const drawerEscape=new Event('keydown',{cancelable:true});Object.defineProperty(drawerEscape,'key',{value:'Escape'});document.dispatchEvent(drawerEscape);assert.equal(drawerEscape.defaultPrevented,true);
  tree=component.render();component.effects();assert.equal(findNode(tree,node=>node.props?.id==='workspace-mate-panel').props.hidden,true);assert.equal(attached.size,0);
});
