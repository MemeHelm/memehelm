import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createGrowth} from '../server/growth.mjs';
import {createContentCalendar} from '../server/content-calendar.mjs';
import {createOperations} from '../server/operations.mjs';
import {projectIntelligence} from '../server/project-intelligence.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';
const owner=testWallet(160).address.toLowerCase(),visitor=testWallet(161).address.toLowerCase(),other=testWallet(162).address.toLowerCase();
async function fixture(run){await mkdir('qa',{recursive:true});const dir=await mkdtemp(resolve('qa','growth-test-'));try{const store=createWorkspaceStore(dir),project={id:randomUUID(),owner,chainId:4663,name:'Orbit QA',symbol:'ORBIT',status:'imported',published:true,tokenAddress:'0x1111111111111111111111111111111111111111',createdAt:new Date().toISOString()};await store.mutateProjects(rows=>rows.push(project));await run({store,project,dir});}finally{assert.ok(resolve(dir).startsWith(resolve('qa')+sep));await rm(dir,{recursive:true,force:true});}}
const details=()=>({title:'Useful demos',description:'Submit a demo and what you learned.',target:10,deadline:new Date(Date.now()+86400000).toISOString()});
async function published(growth,project){let state=await growth.change(project,null,{details:details()});let goal=state.goals[0];state=await growth.change(project,goal.id,{action:'publish',revision:goal.revision,confirm:true});return state.goals[0];}

test('goals preserve private edits, freeze contributed instructions and support explicit visibility',()=>fixture(async({store,project,dir})=>{
  const growth=createGrowth(store);let state=await growth.change(project,null,{details:details()}),goal=state.goals[0];assert.equal(growth.publicView(project).goals.length,0);
  await assert.rejects(()=>growth.change(project,goal.id,{action:'publish',revision:0}),/confirm/);
  state=await growth.change(project,goal.id,{action:'publish',revision:0,confirm:true});goal=state.goals[0];
  state=await growth.change(project,goal.id,{action:'edit',revision:goal.revision,details:{...goal.details,title:'Private changes'}});goal=state.goals[0];assert.equal(growth.publicView(project).goals[0].title,'Useful demos');
  await growth.submit(project,goal.id,visitor,{alias:'Builder',note:'A useful demo.',url:'https://example.com/demo',share:false});
  await assert.rejects(()=>growth.change(project,goal.id,{action:'publish',revision:goal.revision,confirm:true}),/already has contributions/);
  state=await growth.change(project,goal.id,{action:'hide',revision:goal.revision});assert.equal(growth.publicView(project).goals.length,0);assert.equal(createGrowth(createWorkspaceStore(dir)).get(project).submissions.length,1);
  assert.equal(growth.publicView({...project,published:false}).goals.length,0);
}));
test('contribution consent, revision checks and withdrawals control public evidence and points',()=>fixture(async({store,project})=>{
  const growth=createGrowth(store),goal=await published(growth,project);
  await assert.rejects(()=>growth.submit(project,goal.id,visitor,{alias:'Builder',note:'hello',url:'javascript:alert(1)',share:true}),/HTTPS/);
  await growth.submit(project,goal.id,visitor,{alias:'Builder',note:'Shared demo',url:'https://example.com/demo',share:true});
  let entry=growth.get(project).submissions[0];assert.equal(growth.publicView(project).goals[0].contributions.length,0);
  await assert.rejects(()=>growth.review(project,entry.id,{action:'accept',revision:0,note:'Checked'}),/confirm/);
  await growth.review(project,entry.id,{action:'accept',revision:0,note:'Checked the supplied demo.',confirm:true});
  let publicData=growth.publicView(project);assert.equal(publicData.scoreboard[0].points,1);assert.equal(publicData.goals[0].accepted,1);assert.ok(!JSON.stringify(publicData).includes(visitor));assert.ok(!JSON.stringify(publicData).includes('Checked the supplied demo.'));
  await assert.rejects(()=>growth.review(project,entry.id,{action:'accept',revision:0,note:'again',confirm:true}),error=>error.status===409);
  await growth.submit(project,goal.id,other,{alias:'Private builder',note:'PRIVATE CONTENT',url:'',share:false});entry=growth.get(project).submissions.find(item=>item.wallet===other);await growth.review(project,entry.id,{action:'accept',revision:0,note:'Checked privately.',confirm:true});
  publicData=growth.publicView(project);assert.equal(publicData.goals[0].accepted,2);assert.equal(publicData.scoreboard.length,1);assert.ok(!JSON.stringify(publicData).includes('PRIVATE CONTENT'));assert.equal(publicData.goals[0].mySubmission,null);
  const own=growth.publicView(project,visitor).goals[0].mySubmission;await growth.submit(project,goal.id,visitor,{action:'withdraw',revision:own.revision});assert.equal(growth.publicView(project).scoreboard.length,0);assert.equal(growth.publicView(project).goals[0].accepted,1);
}));
test('completed goals close review, keep recaps private until shared, and allow contribution withdrawal',()=>fixture(async({store,project})=>{
  const growth=createGrowth(store),goal=await published(growth,project);await growth.submit(project,goal.id,visitor,{alias:'Builder',note:'Work',url:'',share:true});let state=await growth.change(project,goal.id,{action:'complete',revision:goal.revision,confirm:true,recap:'Private lessons',shareRecap:false});assert.equal(growth.publicView(project).goals[0].recap,null);
  assert.equal(state.goals[0].pending,0);
  await assert.rejects(()=>growth.submit(project,goal.id,other,{alias:'Builder',note:'late'}),/closed/);
  await assert.rejects(()=>growth.review(project,state.submissions[0].id,{action:'accept',revision:0,confirm:true,note:'Late'}),/open goal/);
  state=await growth.change(project,goal.id,{action:'recap',revision:state.goals[0].revision,confirm:true,recap:'Reviewed recap',shareRecap:true});assert.equal(growth.publicView(project).goals[0].recap,'Reviewed recap');await growth.submit(project,goal.id,visitor,{action:'withdraw',revision:0});
  assert.equal(growth.context(project).goals[0].recap,'Reviewed recap');
}));
test('content calendar persists plans and manual outcomes without external publishing',()=>fixture(async({store,project,dir})=>{
  const calendar=createContentCalendar(store);let state=await calendar.save(project,null,{title:'Weekly recap',body:'Our next steps.',channel:'x',scheduledAt:new Date().toISOString()}),item=state.items[0];
  await assert.rejects(()=>calendar.save(project,item.id,{action:'complete',revision:0,outcome:''}),/outcome/);
  state=await calendar.save(project,item.id,{action:'complete',revision:0,outcome:'Posted manually. Three replies observed by the creator.'});assert.equal(state.items[0].status,'done');assert.equal((await store.activity(project.id)).length,0);assert.equal(createContentCalendar(createWorkspaceStore(dir)).get(project).items.length,1);
  await assert.rejects(()=>calendar.save(project,item.id,{action:'cancel',revision:0}),error=>error.status===409);assert.equal(calendar.get({...project,owner:other}).items.length,0);
  const operations=createOperations(store,{communityContext:()=>({contentPlans:calendar.context(project)})});assert.match(JSON.stringify(await operations.context(project)),/Three replies/);
}));
test('task outcome sharing requires confirmation and exposes no private instructions',()=>fixture(async({store,project})=>{
  const operations=createOperations(store);let state=await operations.add(project,{kind:'task',title:'Demo review',content:'PRIVATE participant contact details'}),item=state.actions[0];
  state=await operations.action(project,item.id,{action:'approve',revision:0});state=await operations.action(project,item.id,{action:'complete',revision:1,outcome:'Reviewed three demos.'});
  await assert.rejects(()=>operations.action(project,item.id,{action:'shareOutcome',revision:2}),/confirm/);
  state=await operations.action(project,item.id,{action:'shareOutcome',revision:2,confirm:true});const activity=await store.activity(project.id,{publicOnly:true});assert.equal(activity.length,1);assert.equal(activity[0].source,'creator-outcome');assert.equal(activity[0].content,'Reviewed three demos.');assert.ok(!JSON.stringify(activity).includes('PRIVATE'));
  await assert.rejects(()=>operations.action(project,item.id,{action:'shareOutcome',revision:3,confirm:true}),error=>error.status===409);
}));
test('holder evidence uses integer balances, missing values and source timestamps without inferring ownership',()=>{
  const address='0x1111111111111111111111111111111111111111',time=new Date().toISOString();
  assert.equal(projectIntelligence({price:null,holdersCount:null},address).distribution,null);
  const data={totalSupply:'1000000000000000000000000000',holderDataAvailable:true,holdersCheckedAt:time,holders:[{address,balance:'250000000000000000000000000'},{address:'0x2222222222222222222222222222222222222222',balance:'500000000000000000000000000'}]};
  const result=projectIntelligence(data,address);assert.equal(result.distribution.share,75);assert.equal(result.distribution.largestCount,2);assert.equal(result.distribution.checkedAt,time);assert.equal(result.holdersCount,null);assert.match(result.notes.join(' '),/not a complete ownership/);
  assert.equal(projectIntelligence({...data,totalSupply:'1'},address).distribution,null);
});
test('authenticated growth APIs protect creator data, participant identities and publication boundaries',()=>fixture(async({store,project,dir})=>{
  const previous=process.env.DATA_DIRECTORY;let server;
  try{process.env.DATA_DIRECTORY=dir;({server}=await import(`../server/index.mjs?growth-api=${Date.now()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(160)),bob=await signedClient(endpoint,testWallet(161)),base=`/projects/${project.id}`;
    assert.equal((await fetch(endpoint+'/api'+base+'/growth')).status,401);assert.equal((await bob.get(base+'/overview')).status,404);assert.equal((await bob.get(base+'/calendar')).status,404);assert.equal((await bob.post(base+'/growth/goals',{details:details()})).status,404);
    const created=await alice.post(base+'/growth/goals',{details:details()});assert.equal(created.status,200);let goal=(await created.json()).goals[0];assert.equal((await alice.post(base+'/growth/goals/'+goal.id,{action:'publish',revision:0,confirm:true})).status,200);
    const submitPath=`/public/projects/${project.id}/goals/${goal.id}/submit`;assert.equal((await fetch(endpoint+'/api'+submitPath,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    const submitted=await bob.post(submitPath,{alias:'Private tester',note:'SECRET contribution',url:'',share:false});assert.equal(submitted.status,200);
    let publicResponse=await fetch(endpoint+'/api/public/projects/'+project.id);let publicData=await publicResponse.json();assert.equal(publicData.growth.goals[0].mySubmission,null);assert.ok(!JSON.stringify(publicData).includes('SECRET'));
    assert.equal((await alice.get(base+'/growth')).status,200);assert.equal((await bob.get(base+'/growth')).status,404);
    await store.mutateProjects(rows=>rows.find(item=>item.id===project.id).published=false);assert.equal((await bob.post(submitPath,{alias:'Again',note:'x'})).status,404);
  }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(previous===undefined)delete process.env.DATA_DIRECTORY;else process.env.DATA_DIRECTORY=previous;}
}));
