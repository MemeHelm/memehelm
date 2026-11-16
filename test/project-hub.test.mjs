import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const noop=()=>null,project={id:'illustrative-project',name:'Orbit Club',symbol:'ORB',description:'Illustrative project.',tokenAddress:null,published:false,chainId:4663};
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node).trim()===label.trim());
const children=(tree,predicate)=>{const results=[];const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(predicate(node))results.push(node);visit(node.props?.children);};visit(tree);return results;};
const toolNodes=tree=>children(tree,node=>typeof node.type==='function'&&node.type.name==='PersistentCopilotTool');
async function cycle(component){for(let index=0;index<3;index++){component.render();component.effects();await settle();}return component.render();}
function environment(t){const saved={window:globalThis.window,location:globalThis.location,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};globalThis.window=new EventTarget();globalThis.location={search:''};globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};t.after(()=>{for(const[key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});}
const Calendar=()=>null,Community=()=>null,Operations=()=>null,Studio=()=>null,Publication=()=>null,Chat=()=>null;
const imports={ './api':{},'./Brand':{Arrow:noop},'./AIRequestRecovery':{AIRequestRecovery:noop},'./DraftEditor':{DraftEditor:noop},'./OperationsWorkspace':{OperationsWorkspace:Operations},'./GrowthWorkspace':{GrowthWorkspace:noop},'./ContentCalendar':{ContentCalendar:Calendar},'./CommunityWorkspace':{CommunityWorkspace:Community},'./MemeStudio':{MemeStudio:Studio},'./ProjectPublication':{ProjectPublication:Publication},'./ProjectChat':{ProjectChat:Chat},'./CopilotEntry':{CopilotEntry:noop},'./window-guard':{useWindowGuard(){}}};

test('project navigation groups every project route and exposes only its matching secondary tools',()=>{
 const calls=[],props={page:'calendar',project,selector:createElement('select',{'aria-label':'Active project'}),navigate:page=>calls.push(page),blocked:false};
 const component=componentHarness(new URL('../src/ProjectNavigation.tsx',import.meta.url),'ProjectNavigation',props,{});
 let tree=component.render();assert.deepEqual(children(tree,node=>node.type==='nav')[0].props.children.map(node=>textOf(node)),['Overview','Content','Community','Treasury','AI setup']);
 for(const [page,group,secondary]of [['workspace','Overview',['Overview','Activity']],['activity','Overview',['Overview','Activity']],['writing','Content',['Writing','Assets','Calendar','Publishing']],['assets','Content',['Writing','Assets','Calendar','Publishing']],['publishing','Content',['Writing','Assets','Calendar','Publishing']],['community','Community',['Events & links','Goals','Public page']],['goals','Community',['Events & links','Goals','Public page']],['publication','Community',['Events & links','Goals','Public page']],['treasury','Treasury',[]],['memory','AI setup',[]]]){
  props.page=page;tree=component.render();const navs=children(tree,node=>node.type==='nav');assert.equal(textOf(findNode(navs[0],node=>node.props?.['aria-current']==='page')),group);assert.deepEqual(navs[1]?.props.children.map(node=>textOf(node))||[],secondary);
 }
 props.blocked=true;tree=component.render();assert.equal(findNode(tree,node=>node.type==='fieldset').props.disabled,true);assert.equal(children(tree,node=>node.type==='select').length,1);button(tree,'Projects').props.onClick();button(tree,'Content').props.onClick();assert.deepEqual(calls,['overview','writing']);component.unmount();
});

test('content, publishing and public page retain stable visited editor slots with one operations host',t=>{
 environment(t);const props={project,selector:'Parent owns selector',available:true,createProject:noop,openProjects:noop,activeView:'today',onNavigate:noop};
 const component=componentHarness(new URL('../src/CopilotWorkspace.tsx',import.meta.url),'PersistentCopilotWorkspace',props,imports,{expose:true});
 component.render();component.effects();for(const view of ['memory','activity','content','assets','publishing','community','publication','writing']){props.activeView=view;component.render();component.effects();}
 props.activeView='assets';const tree=component.render(),tools=toolNodes(tree);assert.deepEqual(tools.map(tool=>tool.key),['operations','content','assets','publishing','community','publication','writing']);assert.equal(tools.filter(tool=>!tool.props.hidden).length,1);assert.equal(tools.find(tool=>!tool.props.hidden).key,'assets');assert.equal(findNode(tree,node=>node.type==='nav'),null);assert.equal(findNode(tree,node=>node.type==='fieldset'),null);
 tools[1].props.reportGuard('content',true);assert.equal(component.render().props['data-has-unsaved-work'],true);tools[1].props.reportGuard('content',false);assert.equal(component.render().props['data-has-unsaved-work'],false);component.unmount();
});

test('assets has the single studio host and publishing uses its own community mode with a separate guard',t=>{
 environment(t);const guards=[],props={project,selector:null,available:true,createProject:noop,openProjects:noop,view:'assets',hidden:false,onNavigate:noop,reportGuard:(...args)=>guards.push(args)};
 const component=componentHarness(new URL('../src/CopilotWorkspace.tsx',import.meta.url),'PersistentCopilotTool',props,imports,{expose:true});
 let tree=component.render();assert.equal(children(tree,node=>node.type===Studio).length,1);assert.equal(findNode(tree,node=>node.type===Calendar),null);findNode(tree,node=>node.type===Studio).props.onDirty(true);props.hidden=true;tree=component.render();assert.equal(tree.props.inert,true);assert.deepEqual(guards.at(-1),['assets',true]);
 props.view='publishing';tree=component.render();assert.equal(findNode(tree,node=>node.type===Community).props.mode,'publishing');props.view='community';tree=component.render();assert.equal(findNode(tree,node=>node.type===Community).props.mode,'community');props.view='publication';tree=component.render();assert.equal(typeof findNode(tree,node=>node.type===Publication).props.onBlocked,'function');assert.equal(findNode(tree,node=>node.type===Chat),null);component.unmount();
});

test('community and publishing modes expose their own work without invoking a mutation',async t=>{
 environment(t);const calls=[],state={revision:0,events:[],links:{x:'',discord:'',telegram:'',website:''},sharedLinks:null,social:{account:null,available:false,posts:[]},drafts:[]};
 for(const mode of ['community','publishing']){
  const component=componentHarness(new URL('../src/CommunityWorkspace.tsx',import.meta.url),'CommunityWorkspace',{project,onBlocked:noop,mode},{'./api':{api:async(path,input)=>{calls.push({path,input});return state;}},'./DraftText':{DraftText:noop},'./ManualPostRecord':{ManualPostRecord:noop}});
  const tree=await cycle(component),x=findNode(tree,node=>typeof node.type==='function'&&node.type.name==='XWorkspace');
  assert.equal(!!x,mode==='publishing');assert.equal(!!button(tree,'Create event'),mode==='community');assert.equal(!!button(tree,'Community links'),mode==='community');component.unmount();
 }
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.input===undefined));
});

test('assistant profile retains local changes through project refresh and uses the existing save contract',async()=>{
 const blocked=[],calls=[],updates=[],props={project:{...project,aiName:'MATE'},onBlocked:value=>blocked.push(value),updated:value=>updates.push(value)};
 const component=componentHarness(new URL('../src/AssistantProfile.tsx',import.meta.url),'AssistantProfile',props,{'./api':{api:async(path,input)=>{calls.push({path,input});return{...props.project,...input};}},'./window-guard':{useWindowGuard(){}}});
 let tree=await cycle(component);findNode(tree,node=>node.type==='input').props.onChange({target:{value:'Orbit mate'}});tree=await cycle(component);assert.equal(blocked.at(-1),true);props.project={...props.project,aiGoal:'A refreshed goal'};tree=await cycle(component);assert.equal(findNode(tree,node=>node.type==='input').props.value,'Orbit mate');assert.equal(findNode(tree,node=>node.type==='textarea').props.value,'');
 await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=await cycle(component);assert.equal(calls[0].path,'/projects/illustrative-project/assistant');assert.deepEqual(calls[0].input,{aiName:'Orbit mate',aiVoice:'Clear & practical',aiGoal:''});assert.equal(updates.length,1);assert.equal(blocked.at(-1),false);assert.match(textOf(tree),/Assistant profile saved/);component.unmount();
});

test('AI setup keeps profile mounted across operation views and contains limits and pause controls',async t=>{
 environment(t);const Profile=()=>null,state={revision:0,memory:{story:'',audience:'',roadmap:'',commitments:'',boundaries:''},settings:{enabled:true,autoDraft:false,intervalHours:6,dailyLimit:10},usage:{used:0,limit:10,remaining:10,resetsAt:'2030-01-02T00:00:00Z'},lastCheckedAt:null,nextCheckAt:null,running:false,observations:[],runs:[],logs:[],actions:[]},blocked=[],props={project,view:'memory',available:true,onBlocked:value=>blocked.push(value)};
 const component=componentHarness(new URL('../src/OperationsWorkspace.tsx',import.meta.url),'OperationsWorkspace',props,{'./api':{api:async()=>state},'./DraftText':{DraftText:noop},'./AssistantProfile':{AssistantProfile:Profile},'./ProjectToday':{ProjectToday:noop}});
 let tree=await cycle(component),setup=findNode(tree,node=>node.props?.className==='project-ai-setup');assert.equal(setup.props.hidden,false);assert.match(textOf(setup),/Daily project AI request limit/);assert.ok(button(setup,'Pause operations'));findNode(setup,node=>node.type===Profile).props.onBlocked(true);await cycle(component);assert.equal(blocked.at(-1),true);
 props.view='today';tree=await cycle(component);setup=findNode(tree,node=>node.props?.className==='project-ai-setup');assert.equal(setup.props.hidden,true);assert.equal(setup.props.inert,true);assert.equal(children(tree,node=>node.type===Profile).length,1);assert.equal(blocked.at(-1),true);component.unmount();
});

test('public page approval and request state protect the project while preserving explicit consent',async()=>{
 let resolve;const blocked=[],writes=[],updates=[],component=componentHarness(new URL('../src/ProjectPublication.tsx',import.meta.url),'ProjectPublication',{project:{...project,tokenAddress:'0x123'},updated:value=>updates.push(value),onBlocked:value=>blocked.push(value)},{'./api':{api:(path,input)=>{writes.push({path,input});return new Promise(done=>{resolve=done;});}},'./Brand':{Arrow:noop}});
 let tree=await cycle(component);assert.equal(button(tree,'Publish project page ').props.disabled,true);findNode(tree,node=>node.type==='input').props.onChange({target:{checked:true}});tree=await cycle(component);assert.equal(blocked.at(-1),true);const pending=button(tree,'Publish project page ').props.onClick();tree=await cycle(component);assert.equal(blocked.at(-1),true);assert.equal(writes.length,1);resolve({...project,published:true});await pending;await cycle(component);assert.equal(updates.length,1);assert.equal(blocked.at(-1),false);component.unmount();
});
