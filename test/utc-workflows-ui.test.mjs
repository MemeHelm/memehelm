import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const project={id:'utc-project',name:'Orbit',symbol:'ORB',published:false,tokenAddress:null};
const noop=()=>null,button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node)===label);
const field=(tree,label)=>findNode(tree,node=>node.type==='label'&&textOf(node).includes(label));
const control=(tree,label,type='input')=>findNode(field(tree,label),node=>node.type===type);
const submit=tree=>findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});
async function cycle(component){for(let index=0;index<3;index++){component.render();component.effects();await settle();}return component.render();}
function nonUTC(t){
 const previous=process.env.TZ;process.env.TZ='Asia/Shanghai';
 assert.equal(new Date('2030-01-01T23:30:00.000Z').getDate(),2,'The browser-like host zone must cross the UTC date boundary.');
 t.after(()=>{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;});
}
const due='2030-01-01T23:30:00.000Z';

test('content calendar edits and saves the UTC calendar day in a non-UTC host zone',async t=>{
 nonUTC(t);const calls=[],item={id:'plan-one',title:'Community update',body:'Share one useful lesson.',channel:'x',scheduledAt:due,status:'planned',revision:3};
 const component=componentHarness(new URL('../src/ContentCalendar.tsx',import.meta.url),'ContentCalendar',{project,onBlocked(){}},{'./useWorkspaceData':{useWorkspaceData:()=>({data:{items:[item]},loading:false,busy:false,error:'',notice:'',conflict:false,reload:async()=>true,setNotice(){},save:async(path,input)=>{calls.push({path,input});return true;}})},'./MemeStudio':{MemeStudio:noop}});t.after(()=>component.unmount());
 let tree=await cycle(component);assert.match(textOf(tree),/All times are UTC/);assert.match(textOf(tree),/Jan 1 UTC/);assert.match(textOf(tree),/11:30 PM UTC/);button(tree,'Edit plan').props.onClick();tree=await cycle(component);
 assert.equal(control(tree,'Planned publication time · UTC').props.value,'2030-01-01T23:30');
 control(tree,'Planned publication time · UTC').props.onChange({target:{value:'2030-01-02T00:15'}});tree=await cycle(component);await submit(tree);
 assert.equal(calls[0].input.scheduledAt,'2030-01-02T00:15:00.000Z');
});

test('assistant calendar and event review inputs preserve UTC instead of applying host offsets',async t=>{
 nonUTC(t);let changed;
 const action={id:'proposal',title:'Review UTC schedule',kind:'calendar',payload:{items:[{title:'A post',content:'A draft.',channel:'x',scheduledAt:due}]}};
 const component=componentHarness(new URL('../src/AssistantActions.tsx',import.meta.url),'ActionEditor',{draft:action,setDraft:value=>{changed=value;},disabled:false},{},{expose:true});t.after(()=>component.unmount());let tree=await cycle(component);
 assert.equal(control(tree,'Scheduled time · UTC').props.value,'2030-01-01T23:30');control(tree,'Scheduled time · UTC').props.onChange({target:{value:'2030-01-02T00:15'}});assert.equal(changed.payload.items[0].scheduledAt,'2030-01-02T00:15:00.000Z');
 const event=componentHarness(new URL('../src/AssistantActions.tsx',import.meta.url),'ActionEditor',{draft:{...action,kind:'event',payload:{title:'A call',description:'Discuss one demo.',startsAt:due,endsAt:'2030-01-02T00:30:00.000Z',capacity:null}},setDraft:value=>{changed=value;},disabled:false},{},{expose:true});t.after(()=>event.unmount());tree=await cycle(event);
 assert.equal(control(tree,'Starts · UTC').props.value,'2030-01-01T23:30');assert.equal(control(tree,'Ends · UTC').props.value,'2030-01-02T00:30');control(tree,'Starts · UTC').props.onChange({target:{value:'2030-01-01T23:45'}});assert.equal(changed.payload.startsAt,'2030-01-01T23:45:00.000Z');
});

test('community invitation review and editing use UTC through a midnight boundary',async t=>{
 nonUTC(t);const calls=[],details={title:'Community call',description:'Discuss useful demos.',startsAt:due,endsAt:'2030-01-02T00:30:00.000Z',url:'',capacity:null};
 const component=componentHarness(new URL('../src/CommunityWorkspace.tsx',import.meta.url),'EventEditor',{event:{id:'event-one',details,status:'upcoming',revision:2,publishedDetails:null,going:0,attended:0},project,busy:false,pending:false,path:'/community',perform:async(path,input)=>{calls.push({path,input});return true;},onDirty(){},cancel(){},saved(){}},{'./DraftText':{DraftText:noop}},{expose:true});t.after(()=>component.unmount());
 let tree=await cycle(component);assert.match(textOf(tree),/Jan 1, 2030, 11:30 PM UTC/);button(tree,'Edit invitation').props.onClick();tree=await cycle(component);assert.equal(control(tree,'Starts · UTC').props.value,'2030-01-01T23:30');
 control(tree,'Starts · UTC').props.onChange({target:{value:'2030-01-02T00:10'}});tree=await cycle(component);control(tree,'Ends · UTC').props.onChange({target:{value:'2030-01-02T01:10'}});tree=await cycle(component);await submit(tree);
 assert.equal(calls[0].input.details.startsAt,'2030-01-02T00:10:00.000Z');assert.equal(calls[0].input.details.endsAt,'2030-01-02T01:10:00.000Z');
});

test('new and edited operating action due dates are interpreted as UTC in a non-UTC zone',async t=>{
 nonUTC(t);const oldRAF=globalThis.requestAnimationFrame,oldInterval=globalThis.setInterval,oldClear=globalThis.clearInterval;globalThis.requestAnimationFrame=callback=>{callback();return 0;};globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};t.after(()=>{globalThis.requestAnimationFrame=oldRAF;globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClear;});
 const calls=[],state={revision:1,memory:{},settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:10},usage:{used:0,limit:10,remaining:10,resetsAt:due},lastCheckedAt:due,nextCheckAt:null,running:false,observations:[],runs:[],logs:[],actions:[{id:'task-one',kind:'task',title:'Collect demos',content:'Ask for demo links.',rationale:'Learn.',status:'approved',revision:1,createdAt:due,dueAt:due,evidenceIds:[]}]};
 const component=componentHarness(new URL('../src/OperationsWorkspace.tsx',import.meta.url),'OperationsWorkspace',{project,view:'today',available:true,onBlocked(){}},{'./api':{api:async(path,input)=>{if(input)calls.push({path,input});return structuredClone(state);},ApiError:class extends Error{}},'./ProjectToday':{ProjectToday:noop},'./DraftText':{DraftText:noop}});t.after(()=>component.unmount());
 let tree=await cycle(component);assert.match(textOf(tree),/Jan 1, 11:30 PM UTC/);button(tree,'Add action').props.onClick();tree=await cycle(component);control(tree,'Due date · UTC').props.onChange({target:{value:'2030-01-02T00:15'}});tree=await cycle(component);await submit(tree);assert.equal(calls[0].input.dueAt,'2030-01-02T00:15:00.000Z');tree=await cycle(component);
 button(tree,'Edit action').props.onClick();tree=await cycle(component);assert.equal(control(tree,'Due date · UTC').props.value,'2030-01-01T23:30');control(tree,'Due date · UTC').props.onChange({target:{value:'2030-01-02T01:00'}});tree=await cycle(component);await submit(tree);assert.equal(calls[1].input.dueAt,'2030-01-02T01:00:00.000Z');
});

test('project overview agenda dates stay on their UTC day in non-UTC zones',async t=>{
 nonUTC(t);const component=componentHarness(new URL('../src/ProjectToday.tsx',import.meta.url),'ProjectToday',{project,state:{actions:[]},onSelect(){},disabled:false},{'./api':{api:async()=>({goals:[],events:[],content:[{id:'plan',title:'UTC plan',scheduledAt:due,status:'planned'}]})}});t.after(()=>component.unmount());
 const tree=await cycle(component);assert.match(textOf(tree),/Jan 1, 11:30 PM UTC/);assert.doesNotMatch(textOf(tree),/Jan 2, 7:30 AM/);
});
