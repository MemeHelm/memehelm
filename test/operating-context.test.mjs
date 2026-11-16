import test from 'node:test';
import assert from 'node:assert/strict';
import {createContentCalendar} from '../server/content-calendar.mjs';
import {createCommunity} from '../server/community.mjs';
import {createXSocial} from '../server/social-x.mjs';
import {createOperations} from '../server/operations.mjs';
import {createGrowth} from '../server/growth.mjs';

const time=Date.parse('2026-11-16T12:00:00Z'),iso=offset=>new Date(time+offset).toISOString(),day=86400000;
const project={id:'context-project',owner:'context-owner',chainId:4663,published:true,tokenAddress:'fixture-token'};
function fixture(){
  const documents={projects:[project],content_calendar:[],community:[],community_rsvps:[],social_posts:[],social_x:[],operations:[],activity:[],growth:[],contributions:[]};
  const store={read:name=>structuredClone(documents[name]||[]),async change(name,work){const records=structuredClone(documents[name]||[]),result=work(records);documents[name]=records;return result;},async transaction(names,work){const pending=Object.fromEntries(names.map(name=>[name,structuredClone(documents[name]||[])])),result=work(pending);Object.assign(documents,pending);return result;},async activity(id){return store.read('activity').filter(item=>item.projectId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);}};
  return{documents,store};
}

test('calendar context reserves recent creator outcomes alongside the nearest plans',()=>{
  const {documents,store}=fixture();
  for(let index=0;index<25;index++)documents.content_calendar.push({id:'plan-'+index,projectId:project.id,owner:project.owner,title:'Future '+index,channel:'x',scheduledAt:iso((index+1)*day),status:'planned'});
  for(let index=0;index<10;index++)documents.content_calendar.push({id:'done-'+index,projectId:project.id,owner:project.owner,title:'Completed '+index,channel:'x',scheduledAt:iso(-(index+1)*day),status:'done',outcome:'Creator result '+index,completedAt:iso(-index*1000)});
  documents.content_calendar.push({projectId:project.id,owner:'another-owner',title:'Other wallet private result',channel:'x',scheduledAt:iso(day),status:'done',outcome:'PRIVATE',completedAt:iso(1000)});
  const before=structuredClone(documents),context=createContentCalendar(store).context(project);
  assert.equal(context.length,20);assert.equal(context.filter(item=>item.status==='done').length,8);
  assert.equal(context[0].title,'Future 0');assert.equal(context.some(item=>item.title==='Future 24'),false);
  const result=context.find(item=>item.title==='Completed 0');assert.equal(result.outcome,'Creator result 0');assert.equal(result.outcomeSource,'creator');assert.equal(result.outcomeVerified,false);
  assert.equal(context.some(item=>item.outcome==='PRIVATE'),false);assert.deepEqual(documents,before,'building AI context does not change saved plans');
});

test('recent recaps on old goals remain in context alongside open community goals',()=>{
  const {documents,store}=fixture(),details={title:'Open goal',description:'Creator instructions',target:5,deadline:null};
  documents.growth.push({projectId:project.id,owner:project.owner,goals:[...Array.from({length:20},(_,index)=>({id:'goal-'+index,details:{...details,title:'Open '+index},published:null,status:'open',createdAt:iso(-index*1000)})),{id:'older-goal',details:{...details,title:'Older goal'},published:null,status:'completed',createdAt:iso(-30*day),completedAt:iso(-day),updatedAt:iso(1000),recap:'Recently recorded private lessons',sharedRecap:null}]});
  const before=structuredClone(documents),context=createGrowth(store).context(project);
  assert.equal(context.goals.length,15);assert.ok(context.goals.some(goal=>goal.recap==='Recently recorded private lessons'));assert.equal(JSON.stringify(createGrowth(store).publicView(project)).includes('Recently recorded private lessons'),false);assert.deepEqual(documents,before);
});

test('community context distinguishes the published invitation from private edits',async()=>{
  const {documents,store}=fixture(),community=createCommunity(store,{now:()=>time});
  let state=await community.changeEvent(project,null,{details:{title:'Approved invitation',description:'Public agenda',startsAt:iso(day),endsAt:iso(day+3600000),capacity:null,url:''}}),event=state.events[0];
  state=await community.changeEvent(project,event.id,{action:'publish',revision:event.revision,confirm:true});event=state.events[0];
  await community.changeEvent(project,event.id,{action:'edit',revision:event.revision,details:{...event.details,title:'Private revision',description:'Unapproved private agenda',startsAt:iso(2*day),endsAt:iso(2*day+3600000)}});
  const before=structuredClone(documents),context=community.context(project).events[0],shared=community.publicView(project).events[0];
  assert.equal(context.title,shared.title);assert.equal(context.startsAt,shared.startsAt);assert.equal(context.published,true);assert.equal(context.detailsSource,'published invitation snapshot');assert.equal(context.hasUnpublishedEdits,true);
  assert.equal(context.privateDraft.title,'Private revision');assert.equal(context.privateDraft.startsAt,iso(2*day));assert.equal(JSON.stringify(shared).includes('Private revision'),false);
  assert.deepEqual(documents,before,'context never publishes private changes');
});

test('community context retains new outcomes and attendance on older events',()=>{
  const {documents,store}=fixture(),details=index=>({title:'Event '+index,description:'Fixture invitation',startsAt:iso(day),endsAt:iso(day+3600000),capacity:null,url:''});
  const events=Array.from({length:20},(_,index)=>({id:'event-'+index,details:details(index),publishedDetails:null,status:'upcoming',createdAt:iso(-index*1000)}));
  events.push({id:'old-completed',details:details('completed'),publishedDetails:details('completed'),status:'completed',createdAt:iso(-30*day),completedAt:iso(-day),updatedAt:iso(0),outcome:'Private lessons from the event',publicRecap:null});
  events.push({id:'old-attendance',details:details('attendance'),publishedDetails:details('attendance'),status:'upcoming',createdAt:iso(-40*day),updatedAt:iso(1000)});
  documents.community.push({projectId:project.id,owner:project.owner,revision:0,links:{},sharedLinks:{},events});
  documents.community_rsvps.push({projectId:project.id,eventId:'old-attendance',wallet:'private-participant-wallet',attended:true});
  const context=createCommunity(store).context(project),outcome=context.events.find(item=>item.outcome);
  assert.equal(context.events.length,15);assert.equal(outcome.outcome,'Private lessons from the event');assert.equal(outcome.outcomeVerified,false);assert.equal(outcome.recapPublic,false);
  assert.equal(context.events.find(item=>item.title==='Event attendance').attendanceRecordedByCreator,1);assert.equal(JSON.stringify(context).includes('private-participant-wallet'),false);
});

test('social context reserves fresh feedback on older posts without reviving reports for a replaced link',()=>{
  const {documents,store}=fixture(),social=createXSocial(store,{origin:'http://localhost',now:()=>time});
  const post=(id,createdAt)=>({id,projectId:project.id,owner:project.owner,status:'recorded',text:'Saved draft '+id,createdAt,manualPublication:{postId:id,url:'https://x.com/fixture/status/'+id,publishedAt:null,recordedAt:createdAt,source:'creator',verification:'unverified'}});
  for(let index=0;index<12;index++)documents.social_posts.push(post(String(index),iso(-index*1000)));
  documents.social_posts.push({...post('older',iso(-30*day)),manualReports:[{postId:'older',recordedAt:iso(1000),observedAt:iso(-day),notes:'Fresh creator feedback',counts:{likes:0,views:null},source:'creator',verification:'unverified'}]});
  documents.social_posts.push({...post('replaced',iso(-40*day)),manualReports:[{postId:'previous-link',recordedAt:iso(2000),notes:'STALE_TARGET_RESULT',source:'creator',verification:'unverified'}]});
  documents.social_posts.push({...post('api-post',iso(-50*day)),status:'published',manualPublication:undefined,receipt:{id:'api-post',url:'https://x.com/fixture/status/api-post'},publishedAt:iso(-50*day),metrics:{like_count:1,checkedAt:iso(1500)}});
  documents.social_posts.push({...post('other-owner',iso(2000)),owner:'another-owner',manualReports:[{postId:'other-owner',recordedAt:iso(3000),notes:'OTHER_WALLET_PRIVATE'}]});
  const before=structuredClone(documents),context=social.context(project),record=context.find(item=>item.url.endsWith('/older'));
  assert.equal(context.length,8);assert.ok(record);assert.equal(record.publicationVerified,false);assert.equal(record.publishedAt,null);assert.equal(record.publicMetrics,null);
  assert.equal(record.creatorReportedResults[0].source,'creator');assert.equal(record.creatorReportedResults[0].verification,'unverified');assert.equal(record.creatorReportedResults[0].counts.likes,0);assert.equal(record.creatorReportedResults[0].counts.views,null);
  assert.equal(context[0].publicMetrics.like_count,1);assert.equal(context[0].publicationVerified,true);assert.equal(JSON.stringify(context).includes('STALE_TARGET_RESULT'),false);assert.equal(JSON.stringify(context).includes('OTHER_WALLET_PRIVATE'),false);
  assert.deepEqual(documents,before,'context selection does not alter publication records');
});

test('operations context orders outcomes and edited updates by when their results changed',async()=>{
  const {documents,store}=fixture(),operations=createOperations(store,{now:()=>time});
  await operations.add(project,{kind:'task',title:'Old task completed today',content:'Private task instructions'});
  const state=documents.operations[0],old=state.actions[0];Object.assign(old,{status:'done',createdAt:iso(-30*day),completedAt:iso(0),outcome:'Fresh task outcome'});
  for(let index=0;index<8;index++)state.actions.unshift({id:'task-'+index,kind:'task',title:'Newer task '+index,status:'done',createdAt:iso(-2*day-index*1000),completedAt:iso(-day-index*1000),outcome:'Older outcome'});
  for(let index=0;index<110;index++)documents.activity.push({projectId:project.id,title:'Newer update '+index,content:'Existing draft',createdAt:iso(-index*1000),public:false});
  documents.activity.push({projectId:project.id,title:'Old draft edited today',content:'Fresh private revision',createdAt:iso(-30*day),updatedAt:iso(1000),public:false});
  documents.activity.push({projectId:'another-project',title:'OTHER_PROJECT_PRIVATE',content:'Private',createdAt:iso(2000),public:false});
  const before=structuredClone(documents),context=await operations.context(project);
  assert.equal(context.recentOutcomes.length,5);assert.equal(context.recentOutcomes[0].outcome,'Fresh task outcome');assert.equal(context.recentUpdates[0].title,'Old draft edited today');assert.equal(context.recentUpdates[0].shared,false);assert.equal(context.recentUpdates[0].updatedAt,iso(1000));
  assert.equal(context.creatorNotesAreUnverified,true);assert.equal(JSON.stringify(context).includes('OTHER_PROJECT_PRIVATE'),false);assert.deepEqual(documents,before);
});

test('closing an old task preserves its new outcome when more than ninety newer tasks are closed',async()=>{
  const {documents,store}=fixture(),operations=createOperations(store,{now:()=>time});
  await operations.add(project,{kind:'task',title:'Old task newly completed',content:'Record the result'});
  const state=documents.operations[0],old=state.actions[0];Object.assign(old,{status:'approved',createdAt:iso(-90*day)});
  for(let index=0;index<95;index++)state.actions.unshift({id:'closed-'+index,kind:'task',title:'More recently created '+index,status:'done',revision:0,createdAt:iso(-day-index*1000),completedAt:iso(-day-index*1000),outcome:'Prior result'});
  state.actions.push({id:'recently-updated',kind:'task',title:'Old closed task with a fresh update',status:'done',revision:0,createdAt:iso(-100*day),completedAt:'invalid-legacy-date',updatedAt:iso(-500),outcome:'Retained updated result'});
  const saved=await operations.action(project,old.id,{action:'complete',revision:0,outcome:'Newest result from the oldest task'});
  assert.equal(saved.actions.filter(item=>item.status==='done').length,90);assert.ok(saved.actions.some(item=>item.id===old.id));assert.ok(saved.actions.some(item=>item.id==='recently-updated'),'a valid updatedAt still counts when a legacy completedAt is invalid');
  assert.equal((await operations.context(project)).recentOutcomes[0].outcome,'Newest result from the oldest task');assert.equal(documents.operations[0].actions.some(item=>item.id===old.id),true);
});

test('goal context keeps contributed public instructions separate from a private revision',async()=>{
  const {documents,store}=fixture(),growth=createGrowth(store,{now:()=>time}),original={title:'Approved contribution goal',description:'Submit one useful demo',target:10,deadline:iso(day)};
  let state=await growth.change(project,null,{details:original}),goal=state.goals[0];
  state=await growth.change(project,goal.id,{action:'publish',revision:goal.revision,confirm:true});goal=state.goals[0];
  await growth.submit(project,goal.id,'private-participant',{alias:'Builder',note:'Private contribution evidence',url:'',share:false});
  state=await growth.change(project,goal.id,{action:'edit',revision:goal.revision,details:{title:'Unapproved private goal',description:'Different private instructions',target:20,deadline:iso(2*day)}});goal=state.goals[0];
  await assert.rejects(growth.change(project,goal.id,{action:'publish',revision:goal.revision,confirm:true}),/already has contributions/);
  const before=structuredClone(documents),context=growth.context(project),item=context.goals[0],shared=growth.publicView(project).goals[0];
  assert.equal(item.title,shared.title);assert.equal(item.description,shared.description);assert.equal(item.target,10);assert.equal(item.deadline,iso(day));assert.equal(item.published,true);assert.equal(item.detailsSource,'published contribution instructions snapshot');assert.equal(item.hasUnpublishedEdits,true);
  assert.equal(item.privateDraft.description,'Different private instructions');assert.equal(item.privateDraft.target,20);assert.equal(context.approvalIsCreatorJudgment,true);assert.equal(context.pointsAreNonFinancial,true);
  assert.equal(JSON.stringify(context).includes('private-participant'),false);assert.equal(JSON.stringify(context).includes('Private contribution evidence'),false);assert.equal(JSON.stringify(shared).includes('Different private instructions'),false);assert.deepEqual(documents,before);
});

test('hidden invitations retain their published start for private attendance and outcomes',async()=>{
  const {documents,store}=fixture();let clock=time;const community=createCommunity(store,{now:()=>clock}),details={title:'Published community call',description:'Approved invitation',startsAt:iso(day),endsAt:iso(day+3600000),capacity:null,url:''};
  let state=await community.changeEvent(project,null,{details}),event=state.events[0];
  state=await community.changeEvent(project,event.id,{action:'publish',revision:event.revision,confirm:true});event=state.events[0];assert.deepEqual(event.lastPublishedDetails,details);
  await community.rsvp(project,event.id,'registered-participant',{attending:true});
  state=await community.changeEvent(project,event.id,{action:'edit',revision:event.revision,details:{...details,title:'Private unapproved call',startsAt:iso(-day),endsAt:iso(-day+3600000)}});event=state.events[0];
  // A record saved before historical snapshots were added still backs up the actual public invitation when hidden.
  delete documents.community[0].events[0].lastPublishedDetails;
  state=await community.changeEvent(project,event.id,{action:'unpublish',revision:event.revision,confirm:true});event=state.events[0];
  assert.equal(event.publishedDetails,null);assert.deepEqual(event.lastPublishedDetails,details);assert.equal(community.publicView(project).events.length,0);
  await assert.rejects(community.changeEvent(project,event.id,{action:'complete',revision:event.revision,confirm:true,outcome:'Too early',shareRecap:false}),/published start/);
  await assert.rejects(community.changeEvent(project,event.id,{action:'attendance',revision:event.revision,wallet:'registered-participant',attended:true}),/after the event starts/);
  clock+=day+1000;
  state=await community.changeEvent(project,event.id,{action:'attendance',revision:event.revision,wallet:'registered-participant',attended:true});event=state.events[0];assert.equal(event.attended,1);
  state=await community.changeEvent(project,event.id,{action:'complete',revision:event.revision,confirm:true,outcome:'Private retrospective after hiding the invitation',shareRecap:false});event=state.events[0];
  const context=community.context(project).events[0];assert.equal(event.status,'completed');assert.equal(context.published,false);assert.equal(context.detailsSource,'private event draft');assert.equal(context.lastPublishedInvitation.title,details.title);assert.equal(context.lastPublishedInvitation.startsAt,details.startsAt);assert.equal(context.outcome,event.outcome);assert.equal(context.attendanceRecordedByCreator,1);
  assert.equal(community.publicView(project).events.length,0);assert.equal(JSON.stringify(community.publicView(project)).includes('Private retrospective'),false);
});

test('an event that was never published cannot acquire attendance or a completed outcome',async()=>{
  const {store}=fixture();let clock=time;const community=createCommunity(store,{now:()=>clock});
  const state=await community.changeEvent(project,null,{details:{title:'Private draft',description:'Never published',startsAt:iso(day),endsAt:iso(day+3600000),capacity:null,url:''}}),event=state.events[0];
  clock+=day+1000;
  await assert.rejects(community.changeEvent(project,event.id,{action:'complete',revision:event.revision,confirm:true,outcome:'No publication evidence',shareRecap:false}),/published start/);
  await assert.rejects(community.changeEvent(project,event.id,{action:'attendance',revision:event.revision,wallet:'any-participant',attended:true}),/after the event starts/);
  assert.equal(community.get(project).events[0].status,'upcoming');assert.equal(community.context(project).events[0].lastPublishedInvitation,undefined);assert.equal(community.publicView(project).events.length,0);
});
