import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createAssistantActions,parseAssistantPlan,normalizeAssistantPayload} from '../server/assistant-actions.mjs';
import {createCommunity} from '../server/community.mjs';
import {createContentCalendar} from '../server/content-calendar.mjs';

const time=Date.UTC(2026,10,15,12),owner='0x1111111111111111111111111111111111111111';
const later=(days=1)=>new Date(time+days*86400000).toISOString();
const calendar=()=>({kind:'calendar',title:'A week of useful updates',rationale:'Owner requested a content plan.',payload:{items:[{title:'Useful lesson',content:'Share one useful thing you built this week.',channel:'x',scheduledAt:later()},{title:'Weekly recap',content:'Record what actually happened before sharing the recap.',channel:'project',scheduledAt:later(2)}]}});
const event=()=>({kind:'event',title:'Builder meetup',rationale:'Owner requested a community session.',payload:{title:'Builder meetup',description:'Bring a demo and share one lesson.',startsAt:later(3),endsAt:new Date(time+3*86400000+3600000).toISOString(),capacity:20,url:''}});
async function fixture(run){await mkdir('qa',{recursive:true});const base=resolve('qa'),directory=await mkdtemp(resolve(base,'assistant-unit-'));try{const store=createWorkspaceStore(directory),project={id:randomUUID(),owner,chainId:4663,name:'Orbit',symbol:'ORBIT',tokenAddress:null,vaultAddress:null,published:true};await store.mutateProjects(rows=>rows.push(project));const service=createAssistantActions(store,{now:()=>time});await run({store,project,service});}finally{assert.ok(resolve(directory).startsWith(base+sep));await rm(directory,{recursive:true,force:true});}}

test('assistant plans are proposals, and approved calendar/event writes are private, atomic and idempotent',()=>fixture(async({store,project,service})=>{
  const requestId=randomUUID(),plan=await service.record(project,{reply:'Review these private drafts.',proposals:[calendar(),event()],requestId});
  assert.equal(store.read('content_calendar').length,0);assert.equal(store.read('community').length,0);
  const replay=await service.record(project,{reply:'Review these private drafts.',proposals:[calendar(),event()],requestId});assert.deepEqual(replay.items,plan.items);
  const first=plan.items[0];await assert.rejects(service.change(project,first.id,{action:'apply',revision:0}),/confirm/);
  const copies=await Promise.all([service.change(project,first.id,{action:'apply',revision:0,confirm:true}),service.change(project,first.id,{action:'apply',revision:0,confirm:true})]);
  assert.deepEqual(copies[0],copies[1]);assert.equal(store.read('content_calendar').length,2);assert.equal(copies[0].action.status,'applied');assert.equal(copies[0].result.ids.length,2);
  assert.equal(createContentCalendar(store,{now:()=>time}).get(project).items.length,2);assert.equal(store.read('activity').length,0);
  const saved=await service.change(project,plan.items[1].id,{action:'apply',revision:0,confirm:true});assert.equal(saved.result.kind,'event');
  const community=createCommunity(store,{now:()=>time});assert.equal(community.get(project).events.length,1);assert.equal(community.publicView(project).events.length,0);assert.equal(store.read('community')[0].events[0].publishedDetails,null);
}));

test('action reviews isolate owners, reject stale revisions, preserve edits and never accept unsupported financial instructions',()=>fixture(async({store,project,service})=>{
  const [item]=(await service.record(project,{reply:'Draft',proposals:[calendar()],requestId:randomUUID()})).items;
  const stranger={...project,owner:'0x2222222222222222222222222222222222222222'};assert.equal(service.get(stranger).items.length,0);await assert.rejects(service.change(stranger,item.id,{action:'apply',revision:0,confirm:true}),/not found/);
  const edited=await service.change(project,item.id,{action:'edit',revision:0,title:'Edited plan',payload:{items:[{...calendar().payload.items[0],content:'Owner-reviewed text.'}]}});assert.equal(edited.action.revision,1);
  await assert.rejects(service.change(project,item.id,{action:'apply',revision:0,confirm:true}),/another window/);assert.equal(store.read('content_calendar').length,0);
  const result=await service.change(project,item.id,{action:'apply',revision:1,confirm:true});assert.equal(result.action.appliedRevision,1);assert.equal(store.read('content_calendar')[0].body,'Owner-reviewed text.');
  assert.throws(()=>normalizeAssistantPayload('distribution',{recipient:owner,amount:'1'}),/unsupported/);assert.throws(()=>normalizeAssistantPayload('transfer',{}),/available|Choose/);
  assert.throws(()=>parseAssistantPlan(JSON.stringify({reply:'Sent funds.',proposals:[{kind:'transfer',title:'Send',rationale:'x',payload:{}}]})),{code:'AI_RESPONSE_INVALID'});
}));

test('missing schedules stay editable and failed or expired approvals leave all target documents unchanged',()=>fixture(async({store,project,service})=>{
  const draft=calendar();draft.payload.items[1].scheduledAt=null;const [item]=(await service.record(project,{reply:'Choose a time.',proposals:[draft],requestId:randomUUID()})).items;
  await assert.rejects(service.change(project,item.id,{action:'apply',revision:0,confirm:true}),/future date/);assert.equal(store.read('content_calendar').length,0);assert.equal(service.get(project).items[0].status,'proposed');
  assert.throws(()=>normalizeAssistantPayload('event',{...event().payload,startsAt:'2027-02-31T12:00:00Z'}),/valid calendar/);
  assert.throws(()=>normalizeAssistantPayload('calendar',{items:[{...draft.payload.items[0],scheduledAt:'2026-11-16T12:00'}]}),/time zone/);
  const blocked=createAssistantActions(store,{now:()=>time+4*86400000});await assert.rejects(blocked.change(project,item.id,{action:'apply',revision:0,confirm:true}),/future date/);assert.equal(store.read('content_calendar').length,0);
  await service.change(project,item.id,{action:'dismiss',revision:0});await assert.rejects(service.change(project,item.id,{action:'apply',revision:1,confirm:true}),/closed/);
}));

test('target capacity failure rolls back an entire reviewed content batch and distribution stores no transaction',()=>fixture(async({store,project,service})=>{
  await store.change('content_calendar',rows=>{for(let index=0;index<199;index++)rows.push({id:randomUUID(),projectId:project.id,owner,status:'planned'});});
  const [item]=(await service.record(project,{reply:'Review',proposals:[calendar()],requestId:randomUUID()})).items;
  await assert.rejects(service.change(project,item.id,{action:'apply',revision:0,confirm:true}),/200/);assert.equal(store.read('content_calendar').length,199);assert.equal(service.get(project).items[0].status,'proposed');
  const [payout]=(await service.record(project,{reply:'Open a review',proposals:[{kind:'distribution',title:'Review holder payout',rationale:'Prepare a fresh review only.',payload:{}}],requestId:randomUUID()})).items;
  await assert.rejects(service.change(project,payout.id,{action:'apply',revision:0,confirm:true}),/Link an issued/);
  await store.mutateProjects(rows=>Object.assign(rows[0],{tokenAddress:owner,vaultAddress:owner}));
  const result=await service.change({...project,tokenAddress:owner,vaultAddress:owner},payout.id,{action:'apply',revision:0,confirm:true});assert.equal(result.result.kind,'distribution');assert.equal(result.result.data,undefined);assert.equal(result.result.value,undefined);assert.equal(store.read('activity').length,0);
}));

test('structured action output rejects unsupported fields, overlong posts and unbounded plans without fallback execution',()=>{
  assert.throws(()=>parseAssistantPlan('not json'),{code:'AI_RESPONSE_INVALID'});
  assert.throws(()=>parseAssistantPlan(JSON.stringify({reply:'Review',proposals:[{...calendar(),owner:'someone-else'}]})),{code:'AI_RESPONSE_INVALID'});
  assert.throws(()=>normalizeAssistantPayload('calendar',{items:Array.from({length:8},()=>calendar().payload.items[0])}),/1 and 7/);
  assert.throws(()=>normalizeAssistantPayload('calendar',{items:[{...calendar().payload.items[0],content:'a'.repeat(281)}]}),/280/);
});
