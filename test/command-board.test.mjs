import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf} from './helpers/component-harness.mjs';

const file=new URL('../src/CommandBoard.tsx',import.meta.url);
const projects=Array.from({length:6},(_,index)=>({id:`project-${index}`,name:`Private Project ${index}`,symbol:`P${index}`,status:['draft','launched','imported'][index%3],description:'Private project context',tokenAddress:null,vaultAddress:null,launchHash:null,chainId:4663,createdAt:'2026-11-20T01:00:00.000Z'}));
const emptySummary=()=>({loading:false,watchCount:0,unreadCount:0,alerts:[],agenda:[],actions:[],errors:[],refresh(){}});
const text=node=>textOf(node).replace(/\s+/g,' ').trim();
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&(typeof label==='string'?text(node)===label:label.test(text(node))));
function nodes(tree,predicate){const found=[];function visit(node){if(node==null||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(predicate(node))found.push(node);visit(node.props?.children);}visit(tree);return found;}
function fixture(changes={},summaryChanges={}){
  const calls={summary:[],pages:[],projects:[],hide:0,refresh:0},summary={...emptySummary(),...summaryChanges,refresh(){calls.refresh++;}};
  const props={projects,wallet:'0xowner',visible:true,enabled:true,navigate:page=>calls.pages.push(page),openProject:id=>calls.projects.push(id),hide:()=>calls.hide++,icon:()=>null,...changes};
  const component=componentHarness(file,'CommandBoard',props,{'./Brand':{Arrow:()=>null,HelmMark:()=>null},'./mate/MateCharacter':{MateCharacter:()=>null},'./useDesktopSummary':{useDesktopSummary:options=>{calls.summary.push(options);return summary;}},'../shared/project.mjs':{imageSource:value=>value}});
  return{component,props,calls,summary};
}

test('guest command board does not expose projects even if private records are accidentally supplied',()=>{
  const {component,calls}=fixture({wallet:''},{actions:[{id:'private-action',title:'Private task that must stay hidden',status:'proposed',dueAt:null}],agenda:[{title:'Private appointment',at:'2026-11-20T01:00:00.000Z',kind:'Content plan'}],alerts:[{id:'private-alert',title:'Private saved alert',createdAt:'2026-11-20T01:00:00.000Z',read:false}]});
  const tree=component.render(),copy=text(tree);assert.doesNotMatch(copy,/Private Project|Private task|Private appointment|Private saved alert|Private project context/);assert.ok(button(tree,'Start a coin'));assert.ok(button(tree,/^Keep your own watchlist/));assert.equal(findNode(tree,node=>node.type==='select'),null);assert.equal(calls.summary[0].wallet,'');assert.equal(calls.summary[0].projectId,undefined);assert.equal(button(tree,'Open Copilot'),null);assert.match(copy,/Create or import a project to give MATE context/);button(tree,'Create project').props.onClick();button(tree,'Import token').props.onClick();button(tree,'Open Projects').props.onClick();assert.deepEqual(calls.pages,['launch','overview','overview']);assert.deepEqual(calls.projects,[]);component.unmount();
});

test('project filters count the full owned collection while limiting rendered rows',()=>{
  const {component}=fixture();let tree=component.render();const filters=findNode(tree,node=>node.props?.['aria-label']==='Filter desktop projects');assert.equal(text(filters),'All 6 Drafts 2 Launched 2 Imported 2');assert.equal(nodes(tree,node=>node.type==='button'&&node.props.className==='command-project-row').length,4);
  button(tree,'Imported 2').props.onClick();tree=component.render();let rows=nodes(tree,node=>node.type==='button'&&node.props.className==='command-project-row');assert.equal(rows.length,2);assert.ok(rows.every(row=>/Imported/.test(text(row))));assert.equal(button(tree,'Imported 2').props['aria-pressed'],true);
  button(tree,'Drafts 2').props.onClick();tree=component.render();rows=nodes(tree,node=>node.type==='button'&&node.props.className==='command-project-row');assert.deepEqual(rows.map(row=>text(findNode(row,node=>node.type==='strong'))),['Private Project 0','Private Project 3']);component.unmount();
});

test('desktop project selection scopes summaries and Copilot opens that exact project',()=>{
  const {component,calls}=fixture({}, {actions:[{id:'action',title:'Review a launch decision',status:'approved',dueAt:null}]});let tree=component.render();assert.equal(calls.summary.at(-1).projectId,'project-0');findNode(tree,node=>node.type==='select'&&node.props['aria-label']==='Desktop project').props.onChange({target:{value:'project-2'}});tree=component.render();assert.equal(calls.summary.at(-1).projectId,'project-2');button(tree,'Open Copilot').props.onClick();findNode(tree,node=>node.type==='button'&&node.props['aria-label']==='Open Copilot for Review a launch decision').props.onClick();assert.deepEqual(calls.projects,['project-2','project-2']);
  const row=findNode(tree,node=>node.type==='button'&&node.props.className==='command-project-row'&&text(node).includes('Private Project 1'));row.props.onClick();assert.equal(calls.projects.at(-1),'project-1');component.unmount();
});

test('workbench only navigates on demand and desktop and refresh remain explicit controls',()=>{
  const {component,calls,props}=fixture();let tree=component.render();component.effects();assert.deepEqual(calls.pages,[]);assert.deepEqual(calls.projects,[]);assert.equal(calls.refresh,0);assert.equal(calls.hide,0);
  for(const [label,page] of [['New coin','launch'],['Open Signals','signals'],['All projects','overview']]){button(tree,label).props.onClick();assert.equal(calls.pages.at(-1),page);}
  assert.equal(findNode(tree,node=>node.props?.className==='mh-home-deck'),null);assert.ok(findNode(tree,node=>node.props?.className==='mh-saved-workspace'));assert.doesNotMatch(text(tree),/AI workflow|Look closer|Your coin\. Your story\./);
  assert.equal(findNode(tree,node=>node.type==='input'&&node.props.type==='range'),null);assert.doesNotMatch(text(tree),/Revenue split|Hey, I’m MATE|Example allocation/);
  findNode(tree,node=>node.type==='button'&&node.props['aria-label']==='Show desktop').props.onClick();assert.equal(calls.hide,1);button(tree,'Refresh').props.onClick();assert.equal(calls.refresh,1);props.visible=false;tree=component.render();assert.equal(tree.props.hidden,true);assert.equal(calls.summary.at(-1).enabled,false);assert.equal(calls.refresh,1);assert.deepEqual(calls.projects,[]);component.unmount();
});

test('unavailable values stay unknown while partial errors retain valid project and plan content',()=>{
  const {component,calls}=fixture({}, {watchCount:null,unreadCount:null,alerts:null,errors:['Saved signals are unavailable.'],actions:[{id:'review',title:'Review the community proposal',status:'proposed',dueAt:null}],agenda:[{title:'Weekly builder call',at:'2026-11-20T15:00:00.000Z',kind:'Community event'}]});
  const tree=component.render(),signals=findNode(tree,node=>node.props?.className==='command-signal-summary');assert.equal(text(signals),'— watching — unread in recent signals');assert.match(text(tree),/Saved signals are unavailable/);assert.match(text(tree),/Private Project 0/);assert.match(text(tree),/Review the community proposal/);assert.match(text(tree),/Weekly builder call/);assert.match(text(tree),/UTC/);assert.doesNotMatch(text(signals),/\b0\b/);button(tree,'Refresh signals').props.onClick();assert.equal(calls.refresh,1);button(tree,'Try again').props.onClick();assert.equal(calls.refresh,2);assert.deepEqual(calls.projects,[]);component.unmount();
});

test('unread projects show loading and retry rather than a false empty workspace',()=>{
  let retries=0;
  const {component,props}=fixture({projects:[],projectsState:'loading',refreshProjects:()=>retries++});
  let tree=component.render();assert.match(text(tree),/Reading your projects/);assert.doesNotMatch(text(tree),/Launch your first coin|Your saved projects will appear here/);
  assert.equal(findNode(tree,node=>node.props?.className==='mh-saved-workspace'),null);assert.equal(findNode(tree,node=>node.props?.className==='command-project-list'),null);assert.doesNotMatch(text(tree),/0 projects|No projects saved|No projects yet/);
  props.projectsState='error';tree=component.render();assert.match(text(tree),/Your projects could not be refreshed/);assert.doesNotMatch(text(tree),/Launch your first coin/);button(tree,'Retry projects').props.onClick();assert.equal(retries,1);
  props.projects=projects;tree=component.render();assert.match(text(tree),/Private Project 0/);assert.match(text(tree),/Your projects could not be refreshed/);component.unmount();
});

test('community agenda links open the matching view for the selected project',()=>{
  const views=[];
  const {component}=fixture({openWorkspace:(...args)=>views.push(args)},{agenda:[{title:'Builder call',at:'2030-01-01T12:00:00.000Z',kind:'Community event'},{title:'Builder update',at:'2030-01-01T15:00:00.000Z',kind:'Content plan'}]});
  const tree=component.render();button(tree,'View plans').props.onClick();
  findNode(tree,node=>node.props?.['aria-label']==='Open Copilot for Builder call').props.onClick();
  findNode(tree,node=>node.props?.['aria-label']==='Open Copilot for Builder update').props.onClick();
  assert.deepEqual(views,[['content','project-0'],['community','project-0'],['content','project-0']]);component.unmount();
});

test('first visit has four concrete previews without invented metrics or a second chat',()=>{
  const {component,calls}=fixture({wallet:'',projects:[]});const tree=component.render(),copy=text(tree);
  for(const className of ['mh-home-launch','mh-home-workflow','mh-home-community','mh-home-market'])assert.ok(findNode(tree,node=>node.type==='section'&&node.props.className?.includes(className)));
  assert.match(copy,/Your coin.*Revenue.*Economics.*Review/);assert.match(copy,/Project knowledge.*Draft.*Your review.*Saved result/);assert.match(copy,/Weekly plan.*UTC.*Mon.*Tue.*Wed.*Thu.*Fri.*Sat.*Sun/);assert.match(copy,/You’re invited.*Community call/);assert.equal(nodes(tree,node=>node.props?.className==='mh-preview-label').length,3);
  assert.equal(findNode(tree,node=>node.type==='textarea'),null);assert.equal(findNode(tree,node=>node.type==='input'&&node.props.type==='range'),null);assert.doesNotMatch(copy,/\$[\d,]+|\d+%|Live users|Revenue split|Example allocation|Hey, I’m MATE/);assert.deepEqual(calls.pages,[]);assert.deepEqual(calls.projects,[]);component.unmount();
});

test('market lookup rejects invalid addresses, keeps the input, and opens valid tokens through shell navigation',()=>{
  const {component,calls}=fixture({wallet:'',projects:[]});let tree=component.render();
  let input=findNode(tree,node=>node.type==='input');input.props.onChange({target:{value:'bad token'}});tree=component.render();findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();input=findNode(tree,node=>node.type==='input');assert.equal(input.props.value,'bad token');assert.equal(input.props['aria-invalid'],true);assert.match(text(tree),/0x followed by 40 hexadecimal characters/);assert.deepEqual(calls.pages,[]);
  const token='0x1234567890123456789012345678901234567890',originals=Object.fromEntries(['history','window','HashChangeEvent'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),replaced=[],events=[];
  try{
    Object.defineProperty(globalThis,'history',{configurable:true,value:{state:{memehelm:true,index:7},replaceState:(...args)=>replaced.push(args)}});Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:event=>events.push(event)}});Object.defineProperty(globalThis,'HashChangeEvent',{configurable:true,value:class{constructor(type){this.type=type;}}});
    input.props.onChange({target:{value:' '+token+' '}});tree=component.render();assert.equal(findNode(tree,node=>node.type==='input').props['aria-invalid'],false);findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();assert.deepEqual(calls.pages,['discover']);assert.deepEqual(replaced,[[{memehelm:true,index:7},'','#app/discover/'+token]]);assert.equal(events[0].type,'hashchange');assert.equal(findNode(tree,node=>node.type==='input').props.value,' '+token+' ');
  }finally{for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}component.unmount();}
});
