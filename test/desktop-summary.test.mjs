import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,settle} from './helpers/component-harness.mjs';

const file=new URL('../src/useDesktopSummary.ts',import.meta.url);
const iso=hour=>`2026-11-20T${String(hour).padStart(2,'0')}:00:00.000Z`;
const watches=[{enabled:true},{enabled:false},{enabled:true}];
const alerts=Array.from({length:5},(_,index)=>({id:`alert-${index}`,title:`Signal ${index}`,createdAt:iso(index+1),read:index===1}));
const overview={content:[{title:'Later content',scheduledAt:iso(8),status:'planned'},{title:'Finished content',scheduledAt:iso(1),status:'done'},{title:'Early content',scheduledAt:iso(2),status:'planned'},{title:'Invalid date',scheduledAt:'unknown',status:'planned'}],events:[{title:'An event',startsAt:iso(3),status:'upcoming'},{title:'Cancelled event',startsAt:iso(1),status:'cancelled'},{title:'Later event',startsAt:iso(9),status:'upcoming'},{title:'Fifth entry',startsAt:iso(10),status:'upcoming'}]};
const operations={actions:[{id:'done',title:'Closed task',status:'done',dueAt:null},...Array.from({length:4},(_,index)=>({id:`action-${index}`,title:`Task ${index}`,status:index%2?'approved':'proposed',dueAt:iso(index+1)}))]};
const response=path=>path==='/watches'?watches:path==='/alerts'?alerts:path.endsWith('/overview')?overview:operations;
function harness(api,changes={}){const props={wallet:'0xWALLET-A',projectId:'project-one',enabled:true,...changes};return{props,component:componentHarness(file,'useDesktopSummary',props,{'./api':{api}})};}
async function loaded(component){component.render();component.effects();await settle();return component.render();}
function deferred(){let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return{promise,resolve,reject};}

test('desktop summary remains unknown for guests and disabled desktops without API requests',async()=>{
  for(const changes of [{wallet:''},{enabled:false}]){
    const calls=[],{component}=harness(async path=>{calls.push(path);return response(path);},changes),state=await loaded(component);
    assert.deepEqual(calls,[]);assert.equal(state.loading,false);assert.equal(state.watchCount,null);assert.equal(state.unreadCount,null);assert.equal(state.agenda,null);assert.equal(state.actions,null);assert.equal(state.alerts,null);assert.deepEqual(state.errors,[]);component.unmount();
  }
});

test('desktop summary reads saved resources, counts full arrays and bounds useful previews',async()=>{
  const calls=[],{component}=harness(async(path,body,signal)=>{calls.push({path,body,signal});return response(path);}),state=await loaded(component);
  assert.deepEqual(calls.map(item=>item.path),['/watches','/alerts','/projects/project-one/overview','/projects/project-one/operations']);assert.ok(calls.every(item=>item.body===undefined&&item.signal instanceof AbortSignal));
  assert.equal(state.loading,false);assert.equal(state.watchCount,2);assert.equal(state.unreadCount,4);assert.deepEqual(state.alerts.map(item=>item.id),['alert-4','alert-3','alert-2']);
  assert.deepEqual(state.agenda,[{title:'Early content',at:iso(2),kind:'Content plan'},{title:'An event',at:iso(3),kind:'Community event'},{title:'Later content',at:iso(8),kind:'Content plan'},{title:'Later event',at:iso(9),kind:'Community event'}]);
  assert.deepEqual(state.actions.map(item=>item.id),['action-0','action-1','action-2']);assert.deepEqual(state.errors,[]);component.unmount();
});

test('wallet and project changes hide private data before effects and reject late responses',async()=>{
  const requests=[],{props,component}=harness((path,body,signal)=>{const pending=deferred();requests.push({path,signal,...pending});return pending.promise;});
  component.render();component.effects();assert.equal(requests.length,4);
  for(const item of requests)item.resolve(response(item.path));await settle();let state=component.render();assert.equal(state.watchCount,2);assert.equal(state.agenda.length,4);
  state.refresh();component.render();component.effects();const stale=requests.slice(4);assert.equal(stale.length,4);
  props.wallet='0xWALLET-B';props.projectId='project-two';state=component.render();assert.equal(state.watchCount,null);assert.equal(state.unreadCount,null);assert.equal(state.agenda,null);assert.equal(state.actions,null);assert.equal(state.alerts,null);component.effects();assert.ok(stale.every(item=>item.signal.aborted));
  const current=requests.slice(8);for(const item of current)item.resolve(item.path==='/watches'?[]:item.path==='/alerts'?[]:item.path.endsWith('/overview')?{content:[],events:[]}:{actions:[]});await settle();state=component.render();assert.equal(state.watchCount,0);assert.deepEqual(state.agenda,[]);
  for(const item of stale)item.resolve(response(item.path));await settle();state=component.render();assert.equal(state.watchCount,0);assert.deepEqual(state.alerts,[]);assert.deepEqual(state.agenda,[]);assert.deepEqual(state.actions,[]);component.unmount();
});

test('project switch clears project previews immediately even when the wallet is unchanged',async()=>{
  const {props,component}=harness(async path=>response(path));await loaded(component);props.projectId='project-two';const state=component.render();assert.equal(state.agenda,null);assert.equal(state.actions,null);assert.equal(state.alerts,null);component.effects();await settle();assert.equal(component.render().agenda.length,4);component.unmount();
});

test('individual resources appear independently while a slow resource remains pending',async()=>{
  const pending=deferred(),{component}=harness(async path=>path==='/watches'?pending.promise:response(path));
  component.render();component.effects();await settle();let state=component.render();assert.equal(state.loading,true);assert.equal(state.watchCount,null);assert.equal(state.unreadCount,4);assert.equal(state.agenda.length,4);assert.equal(state.actions.length,3);
  pending.reject(new Error('Offline'));await settle();state=component.render();assert.equal(state.loading,false);assert.equal(state.watchCount,null);assert.equal(state.unreadCount,4);assert.deepEqual(state.errors,['Your watchlist could not be refreshed.']);component.unmount();
});

test('explicit refresh preserves valid data after partial failure and clears recovered errors',async()=>{
  let failure=false,round=0;const calls=[],{component}=harness(async path=>{calls.push(path);if(failure&&path.endsWith('/overview'))throw new Error('Offline');if(path==='/watches')return round?[{enabled:true}]:watches;return response(path);});
  let state=await loaded(component),refresh=state.refresh;failure=true;round++;refresh();state=component.render();component.effects();state=component.render();assert.equal(state.loading,true);assert.equal(state.agenda.length,4);await settle();state=component.render();assert.equal(state.loading,false);assert.equal(state.watchCount,1);assert.equal(state.agenda.length,4);assert.deepEqual(state.errors,['Your upcoming plans could not be refreshed.']);assert.equal(state.refresh,refresh);assert.equal(calls.length,8);
  failure=false;state.refresh();component.render();component.effects();await settle();state=component.render();assert.deepEqual(state.errors,[]);assert.equal(calls.length,12);component.unmount();
});

test('logout aborts private reads and a signed-in wallet without a project loads only signals',async()=>{
  const pending=[],{props,component}=harness((path,body,signal)=>{const request=deferred();pending.push({path,signal,...request});return request.promise;});
  component.render();component.effects();props.wallet='';let state=component.render();assert.equal(state.watchCount,null);assert.equal(state.agenda,null);assert.equal(state.loading,false);component.effects();assert.ok(pending.every(item=>item.signal.aborted));for(const item of pending)item.resolve(response(item.path));await settle();assert.equal(component.render().watchCount,null);component.unmount();
  const calls=[],noProject=harness(async path=>{calls.push(path);return response(path);},{projectId:undefined});state=await loaded(noProject.component);assert.deepEqual(calls,['/watches','/alerts']);assert.equal(state.watchCount,2);assert.equal(state.agenda,null);assert.equal(state.actions,null);noProject.component.unmount();
});

test('unmount aborts every pending read without exposing late results',async()=>{
  const requests=[],{component}=harness((path,body,signal)=>{const request=deferred();requests.push({path,signal,...request});return request.promise;});component.render();component.effects();component.unmount();assert.equal(requests.length,4);assert.ok(requests.every(item=>item.signal.aborted));for(const item of requests)item.resolve(response(item.path));await settle();assert.equal(component.render().watchCount,null);
});
