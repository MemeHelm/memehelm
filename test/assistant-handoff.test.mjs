import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const wallet='0x1111111111111111111111111111111111111111';
const project={id:'11111111-1111-4111-8111-111111111111',name:'Orbit Club',symbol:'ORB',tokenAddress:'0x2222222222222222222222222222222222222222',vaultAddress:'0x3333333333333333333333333333333333333333',chainId:4663};
const noop=()=>null;
const snapshot=(kind='holders')=>({symbol:'ORB',vault:{kind,address:project.vaultAddress,controller:wallet,distributable:'1',totalReceived:'2',totalDistributed:'1',totalReleased:'1',rounds:1,projectTreasury:wallet,auditTreasury:wallet,projectPending:'0',auditPending:'0',auditBps:1000},revenue:null});
const review=()=>({chainId:4663,to:project.vaultAddress,data:'0x1234',value:'0',label:'distribute',expiresAt:new Date(Date.now()+60000).toISOString(),reviewId:'review-one',total:'1',retained:'0',recipients:[wallet],amounts:['1'],reviewRecipients:[{address:wallet,amount:'1'}],excludedRecipients:[],round:{included:1,eligible:1,sampled:1,holdersCount:1,minimum:'0.001',coveredBalance:'1',dropped:[]}});

function environment(t){
  const saved={window:globalThis.window,location:globalThis.location,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  globalThis.window=new EventTarget();globalThis.location={search:''};globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};
  t.after(()=>{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
}
async function cycle(component,count=3){let tree;for(let index=0;index<count;index++){tree=component.render();component.effects();await settle();}return component.render();}
function treasury(props,api,walletCalls){return componentHarness(new URL('../src/TreasuryWorkspace.tsx',import.meta.url),'TreasuryWorkspace',props,{'./api':{api},'./wallet':{sendTransaction:async()=>{walletCalls.push('send');throw new Error('No wallet call is allowed in a handoff test.');},completeTransaction:()=>walletCalls.push('complete')},'./Brand':{Arrow:noop}});}

test('a MATE payout handoff waits for the snapshot, prepares only once and does not reopen after its intent is consumed',async t=>{
  environment(t);const calls=[],walletCalls=[],handled=[];let finishSnapshot,first=true;
  const props={project,wallet,selector:null,createProject(){},reviewRequest:31,onReviewHandled(version){handled.push(version);if(props.reviewRequest===version)props.reviewRequest=undefined;}};
  const api=async(path,body)=>{calls.push({path,body});if(path.endsWith('/snapshot')){if(first){first=false;return new Promise(resolve=>{finishSnapshot=resolve;});}return snapshot();}if(path.endsWith('/distribution/prepare'))return review();throw new Error(`Unexpected handoff request: ${path}`);};
  const component=treasury(props,api,walletCalls);component.render();component.effects();await settle();await cycle(component,1);
  assert.equal(calls.length,1);assert.match(calls[0].path,/\/snapshot$/);assert.deepEqual(handled,[]);assert.deepEqual(walletCalls,[]);
  finishSnapshot(snapshot());await settle();let tree=await cycle(component,4);
  assert.deepEqual(handled,[31]);assert.equal(props.reviewRequest,undefined);assert.equal(calls.filter(call=>call.path.endsWith('/distribution/prepare')).length,1);assert.deepEqual(calls.find(call=>call.body).body,{action:'distribute'});assert.match(textOf(tree),/Review holder payout/);assert.deepEqual(walletCalls,[]);
  component.unmount();const reopened=treasury(props,api,walletCalls);tree=await cycle(reopened,4);
  assert.equal(calls.filter(call=>call.path.endsWith('/distribution/prepare')).length,1);assert.doesNotMatch(textOf(tree),/Review holder payout/);assert.deepEqual(handled,[31]);assert.deepEqual(walletCalls,[]);reopened.unmount();
});

test('a non-holders vault consumes a payout handoff with an actionable error and never prepares or signs it',async t=>{
  environment(t);const calls=[],walletCalls=[],handled=[];
  const props={project,wallet,selector:null,createProject(){},reviewRequest:42,onReviewHandled(version){handled.push(version);props.reviewRequest=undefined;}};
  const component=treasury(props,async(path,body)=>{calls.push({path,body});if(path.endsWith('/snapshot'))return snapshot('split');throw new Error('A non-holders handoff must not prepare a payout.');},walletCalls);
  const tree=await cycle(component,4);assert.match(textOf(tree),/does not use a holders vault/);assert.deepEqual(handled,[42]);assert.equal(props.reviewRequest,undefined);assert.equal(calls.filter(call=>call.body).length,0);assert.deepEqual(walletCalls,[]);component.unmount();
});

test('a failed payout preparation consumes the original handoff and can only retry through a new explicit review',async t=>{
  environment(t);const calls=[],walletCalls=[];let fail=true;
  const props={project,wallet,selector:null,createProject(){},reviewRequest:53,onReviewHandled(){props.reviewRequest=undefined;}};
  const api=async(path,body)=>{calls.push({path,body});if(path.endsWith('/snapshot'))return snapshot();if(path.endsWith('/distribution/prepare')){if(fail)throw new Error('Payout observations are temporarily unavailable.');return review();}throw new Error('Unexpected request.');};
  const component=treasury(props,api,walletCalls);let tree=await cycle(component,4);assert.equal(props.reviewRequest,undefined);assert.match(textOf(tree),/temporarily unavailable/);assert.equal(calls.filter(call=>call.body).length,1);
  await cycle(component,3);assert.equal(calls.filter(call=>call.body).length,1);fail=false;const retry=findNode(tree,node=>node.type==='button'&&textOf(node).startsWith('Preview sample payout'));assert.ok(retry);await retry.props.onClick();tree=await cycle(component,2);assert.match(textOf(tree),/Review holder payout/);assert.equal(calls.filter(call=>call.body).length,2);assert.deepEqual(walletCalls,[]);component.unmount();
});

function copilot(props){
  const Chat=()=>null,Calendar=()=>null,Community=()=>null,Entry=()=>null;
  return{Chat,Calendar,Community,Entry,component:componentHarness(new URL('../src/CopilotWorkspace.tsx',import.meta.url),'CopilotWorkspace',props,{'./api':{},'./AIRequestRecovery':{AIRequestRecovery:noop},'./Brand':{Arrow:noop},'./DraftEditor':{DraftEditor:noop},'./OperationsWorkspace':{OperationsWorkspace:noop},'./GrowthWorkspace':{GrowthWorkspace:noop},'./ContentCalendar':{ContentCalendar:Calendar},'./CommunityWorkspace':{CommunityWorkspace:Community},'./ProjectChat':{ProjectChat:Chat},'./CopilotEntry':{CopilotEntry:Entry},'./window-guard':{useWindowGuard(){}}})};
}
const openResult=detail=>window.dispatchEvent(new CustomEvent('memehelm-open-assistant-result',{detail}));

test('approved-action navigation accepts only the active project and supported result kinds',async t=>{
  environment(t);const props={project,selector:null,available:true,createProject(){},openProjects(){}},fixture=copilot(props),{component,Chat,Calendar,Community}=fixture;
  let tree=await cycle(component,1);assert.ok(findNode(tree,node=>node.type===Chat));
  for(const detail of [undefined,{}, {projectId:'another-project',kind:'calendar'}, {projectId:project.id,kind:'distribution'}, {projectId:project.id,kind:'unknown'}]){openResult(detail);tree=component.render();assert.ok(findNode(tree,node=>node.type===Chat));}
  openResult({projectId:project.id,kind:'calendar'});tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Calendar));assert.equal(findNode(tree,node=>node.type===Calendar).props.project.id,project.id);
  openResult({projectId:project.id,kind:'event'});tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Community));assert.equal(findNode(tree,node=>node.type===Community).props.project.id,project.id);component.unmount();
});

test('approved-action navigation respects unsaved work and updates its project boundary after selection changes',async t=>{
  environment(t);const props={project,selector:null,available:true,createProject(){},openProjects(){}},{component,Chat,Calendar,Community}=copilot(props);
  let tree=await cycle(component,1);findNode(tree,node=>node.type===Chat).props.onBlocked(true);component.render();component.effects();openResult({projectId:project.id,kind:'calendar'});tree=component.render();assert.ok(findNode(tree,node=>node.type===Chat));assert.equal(findNode(tree,node=>node.type==='fieldset').props.disabled,true);
  findNode(tree,node=>node.type===Chat).props.onBlocked(false);component.render();component.effects();openResult({projectId:project.id,kind:'calendar'});tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Calendar));
  findNode(tree,node=>node.type===Calendar).props.onBlocked(true);component.render();component.effects();openResult({projectId:project.id,kind:'event'});tree=component.render();assert.ok(findNode(tree,node=>node.type===Calendar));findNode(tree,node=>node.type===Calendar).props.onBlocked(false);component.render();component.effects();
  props.project={...project,id:'44444444-4444-4444-8444-444444444444'};component.render();component.effects();openResult({projectId:project.id,kind:'event'});tree=component.render();assert.ok(findNode(tree,node=>node.type===Calendar));openResult({projectId:props.project.id,kind:'event'});tree=component.render();assert.ok(findNode(tree,node=>node.type===Community));assert.equal(findNode(tree,node=>node.type===Community).props.project.id,props.project.id);component.unmount();
});

test('a result event cannot open a project tool when no private project is selected',async t=>{
  environment(t);const {component,Entry,Calendar,Community}=copilot({project:undefined,selector:null,available:true,createProject(){},openProjects(){}});let tree=await cycle(component,1);openResult({projectId:project.id,kind:'calendar'});openResult({projectId:project.id,kind:'event'});tree=component.render();assert.ok(findNode(tree,node=>node.type===Entry));assert.equal(findNode(tree,node=>node.type===Calendar||node.type===Community),null);component.unmount();
});

test('OS app shortcuts enter the requested Copilot view and preserve unsaved work',async t=>{
  environment(t);const changes=[];window.addEventListener('memehelm-copilot-view',event=>changes.push(event.detail.view));
  const {component,Chat,Community,Calendar}=copilot({project,selector:null,available:true,createProject(){},openProjects(){}});
  await cycle(component,1);assert.equal(changes.at(-1),'chat');
  const open=view=>window.dispatchEvent(new CustomEvent('memehelm-open-copilot-view',{detail:{view}}));
  open('not-a-view');assert.ok(findNode(component.render(),node=>node.type===Chat));
  open('community');let tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Community));assert.equal(changes.at(-1),'community');
  findNode(tree,node=>node.type===Community).props.onBlocked(true);component.render();component.effects();open('content');tree=component.render();assert.ok(findNode(tree,node=>node.type===Community));
  findNode(tree,node=>node.type===Community).props.onBlocked(false);component.render();component.effects();open('content');tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Calendar));assert.equal(changes.at(-1),'content');
  findNode(tree,node=>node.type==='button'&&textOf(node)==='Chat').props.onClick();tree=component.render();component.effects();assert.ok(findNode(tree,node=>node.type===Chat));assert.equal(changes.at(-1),'chat');
  component.unmount();const count=changes.length;open('community');assert.equal(changes.length,count);
});
