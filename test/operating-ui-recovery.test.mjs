import test from 'node:test';
import assert from 'node:assert/strict';
import {createXSocial} from '../server/social-x.mjs';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

class ApiError extends Error{constructor(message,status){super(message);this.status=status;}}
const noop=()=>null,clone=value=>structuredClone(value);
const project={id:'11111111-1111-4111-8111-111111111111',owner:'0x1111111111111111111111111111111111111111',name:'Orbit Club',symbol:'ORB',chainId:4663,published:false};
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node)===label);
const field=(tree,label)=>findNode(tree,node=>node.type==='label'&&textOf(node).includes(label));
async function cycle(component,count=3){for(let index=0;index<count;index++){component.render();component.effects();await settle();}return component.render();}
function environment(t){
 const saved={requestAnimationFrame:globalThis.requestAnimationFrame,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 globalThis.requestAnimationFrame=callback=>{callback();return 0;};globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};
 t.after(()=>{for(const[key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
}
function operatingState(){return{revision:0,memory:{story:'',audience:'',roadmap:'',commitments:'',boundaries:''},settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:10},usage:{used:0,limit:10,remaining:10,resetsAt:new Date().toISOString()},lastCheckedAt:null,nextCheckAt:null,running:false,observations:[],runs:[],logs:[],actions:[{id:'task-one',kind:'task',title:'Collect community demos',content:'Ask for demo links.',rationale:'Learn what people need.',status:'approved',revision:1,createdAt:new Date().toISOString(),dueAt:null,evidenceIds:[]}]};}
function operations(api,blocked){return componentHarness(new URL('../src/OperationsWorkspace.tsx',import.meta.url),'OperationsWorkspace',{project,view:'today',available:true,onBlocked:value=>blocked.push(value)},{'./api':{api,ApiError},'./DraftText':{DraftText:noop},'./ProjectToday':{ProjectToday:noop}});}
async function enterOutcome(component,value){
 let tree=await cycle(component);findNode(tree,node=>node.type==='button'&&textOf(node).includes('Collect community demos')).props.onClick();tree=await cycle(component);
 findNode(field(tree,'What happened?'),node=>node.type==='textarea').props.onChange({target:{value}});tree=await cycle(component);
 findNode(tree,node=>node.type==='form'&&textOf(node).includes('Record outcome & complete')).props.onSubmit({preventDefault(){}});
 return cycle(component);
}

test('a lost completion response reads back the exact saved outcome and releases navigation without resubmitting',async t=>{
 environment(t);const blocked=[],saved=operatingState(),result='Received three demo links and two useful questions.';let writes=0;
 const component=operations(async(_path,input)=>{if(!input)return clone(saved);writes++;assert.equal(input.action,'complete');Object.assign(saved.actions[0],{status:'done',revision:2,outcome:input.outcome,completedAt:new Date().toISOString()});throw new Error('Response was lost.');},blocked);t.after(()=>component.unmount());
 const tree=await enterOutcome(component,result);
 assert.equal(writes,1);assert.match(textOf(tree),/Outcome saved for your next review/);assert.match(textOf(tree),/Recorded outcome/);assert.match(textOf(tree),/Received three demo links/);assert.doesNotMatch(textOf(tree),/Response was lost/);assert.equal(blocked.at(-1),false);assert.equal(button(tree,'Refresh').props.disabled,false);assert.equal(button(tree,'Record outcome & complete'),null);
});

test('a concurrent completion preserves the unsaved outcome visibly beside the actual saved result',async t=>{
 environment(t);const blocked=[],saved=operatingState(),local='My draft result: two demos.';
 const component=operations(async(_path,input)=>{if(!input)return clone(saved);Object.assign(saved.actions[0],{status:'done',revision:2,outcome:'Saved in another window: three demos.',completedAt:new Date().toISOString()});throw new ApiError('This action changed in another window.',409);},blocked);t.after(()=>component.unmount());
 let tree=await enterOutcome(component,local);
 assert.match(textOf(tree),/Saved in another window: three demos/);const backup=findNode(field(tree,'Your unsaved outcome'),node=>node.type==='textarea');assert.equal(backup.props.readOnly,true);assert.equal(backup.props.value,local);assert.equal(blocked.at(-1),false);
 await button(tree,'Discard local edits and refresh').props.onClick();tree=await cycle(component);assert.equal(blocked.at(-1),false);assert.equal(findNode(field(tree,'Your unsaved outcome'),node=>node.type==='textarea').props.value,local);assert.equal(button(tree,'Refresh').props.disabled,false);
});

test('a completion that was not saved keeps its editable outcome until an explicit retry succeeds',async t=>{
 environment(t);const blocked=[],saved=operatingState(),result='Five people joined the demo.';let attempts=0;
 const component=operations(async(_path,input)=>{if(!input)return clone(saved);attempts++;if(attempts===1)throw new Error('Connection interrupted.');Object.assign(saved.actions[0],{status:'done',revision:2,outcome:input.outcome,completedAt:new Date().toISOString()});return clone(saved);},blocked);t.after(()=>component.unmount());
 let tree=await enterOutcome(component,result);assert.equal(attempts,1);assert.equal(findNode(field(tree,'What happened?'),node=>node.type==='textarea').props.value,result);assert.equal(blocked.at(-1),true);
 findNode(tree,node=>node.type==='form'&&textOf(node).includes('Record outcome & complete')).props.onSubmit({preventDefault(){}});tree=await cycle(component);assert.equal(attempts,2);assert.match(textOf(tree),/Five people joined the demo/);assert.equal(blocked.at(-1),false);
});

test('discarding a conflicting new action closes its form and releases navigation',async t=>{
 environment(t);const blocked=[],saved=operatingState(),component=operations(async(_path,input)=>{if(input)throw new ApiError('Another action changed.',409);return clone(saved);},blocked);t.after(()=>component.unmount());let tree=await cycle(component);
 button(tree,'Add action').props.onClick();tree=await cycle(component);findNode(tree,node=>node.type==='form'&&textOf(node).includes('Add your next action')).props.onSubmit({preventDefault(){}});tree=await cycle(component);assert.equal(blocked.at(-1),true);
 await button(tree,'Discard local edits and refresh').props.onClick();tree=await cycle(component);assert.equal(findNode(tree,node=>node.type==='form'&&textOf(node).includes('Add your next action')),null);assert.equal(blocked.at(-1),false);
});

function eventDetails(){return{title:'Illustrative community demo',description:'Discuss the community demos.',startsAt:new Date(Date.now()-7200000).toISOString(),endsAt:new Date(Date.now()-3600000).toISOString(),url:'',capacity:40};}
function eventEditor(event,perform){return componentHarness(new URL('../src/CommunityWorkspace.tsx',import.meta.url),'EventEditor',{event,busy:false,pending:false,project,path:`/projects/${project.id}/community`,perform,onDirty(){},cancel(){},saved(){}},{'./api':{api:async()=>[{wallet:project.owner,joinedAt:new Date(Date.now()-86400000).toISOString(),attended:false}]},'./DraftText':{DraftText:noop}},{expose:true});}

test('a hidden invitation keeps its published start available for private outcomes and attendance',async t=>{
 environment(t);const details=eventDetails(),event={id:'event-one',revision:3,details,publishedDetails:null,lastPublishedDetails:details,status:'upcoming',going:1,attended:0},calls=[];
 const component=eventEditor(event,async(suffix,input)=>{calls.push({suffix,input});return true;});t.after(()=>component.unmount());let tree=await cycle(component);
 assert.match(textOf(tree),/Hidden invitation/);assert.ok(button(tree,'Record outcome'));assert.equal(button(tree,'Hide invitation'),null);await button(tree,'View registrations').props.onClick();tree=await cycle(component);
 const attendance=findNode(field(tree,'Attended'),node=>node.type==='input');assert.ok(attendance);await attendance.props.onChange({target:{checked:true}});tree=await cycle(component);assert.equal(calls[0].input.action,'attendance');assert.equal(calls[0].input.wallet,project.owner);
 button(tree,'Record outcome').props.onClick();tree=await cycle(component);assert.match(textOf(tree),/This outcome will stay private/);assert.doesNotMatch(textOf(tree),/Publish this recap/);findNode(field(tree,'What happened?'),node=>node.type==='textarea').props.onChange({target:{value:'We received four useful demos.'}});tree=await cycle(component);
 await findNode(tree,node=>node.type==='form'&&textOf(node).includes('Save outcome')).props.onSubmit({preventDefault(){}});assert.equal(calls[1].input.action,'complete');assert.equal(calls[1].input.outcome,'We received four useful demos.');assert.equal(calls[1].input.shareRecap,false);
});

test('an expired event that was never published does not expose published-event outcome or attendance controls',async t=>{
 environment(t);const event={id:'private-event',revision:0,details:eventDetails(),publishedDetails:null,status:'upcoming',going:1,attended:0},component=eventEditor(event,async()=>{throw new Error('No event mutation expected');});t.after(()=>component.unmount());let tree=await cycle(component);
 assert.match(textOf(tree),/Private draft/);assert.equal(button(tree,'Record outcome'),null);await button(tree,'View registrations').props.onClick();tree=await cycle(component);assert.equal(field(tree,'Attended'),null);assert.match(textOf(tree),/Registered/);
});

function memoryStore(){const documents={};return{read:key=>clone(documents[key]||[]),async change(key,work){const records=clone(documents[key]||[]);await work(records);documents[key]=records;}};}
async function connect(social){const start=social.start(project),state=new URL(start.url).searchParams.get('state');assert.equal((await social.callback(new URLSearchParams({state,code:'fixture-code'}),start.binding)).ok,true);await social.finish(project,start.binding);}
for(const changeAccount of[false,true])test(`an approved X post can be reviewed again after ${changeAccount?'changing accounts':'reconnecting the same account'} without bypassing generation checks`,async t=>{
 environment(t);const store=memoryStore(),provider={account:'12345',username:'orbit_first',published:0};
 const social=createXSocial(store,{origin:'http://127.0.0.1:4318',clientId:'fixture-client',clientSecret:'fixture-client-secret',encryptionKey:Buffer.alloc(32,7).toString('base64'),fetcher:async(url,options)=>{
  if(url.endsWith('/oauth2/token'))return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:'tweet.read tweet.write users.read offline.access'});
  if(url.endsWith('/users/me'))return Response.json({data:{id:provider.account,username:provider.username,name:'Fixture'}});
  if(url.endsWith('/2/tweets')){provider.published++;assert.equal(JSON.parse(options.body).text,'Share your community demo.');return Response.json({data:{id:'98765'}});}
  throw new Error('Unexpected fixture request');
 }});
 await connect(social);let post=(await social.save(project,null,{text:'Share your community demo.'})).posts[0];post=(await social.save(project,post.id,{action:'approve',revision:post.revision})).posts[0];const firstApproval=store.read('social_posts')[0].approvedGeneration;
 await social.disconnect(project);if(changeAccount){provider.account='54321';provider.username='orbit_next';}await connect(social);assert.notEqual(store.read('social_x')[0].generation,firstApproval);await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}),/approve/);assert.equal(provider.published,0);
 const calls=[],props={state:{revision:0,links:{x:'',discord:'',telegram:'',website:''},sharedLinks:null,events:[],social:social.get(project),drafts:[]},busy:false,pending:false,reviewEpoch:0,path:`/projects/${project.id}/community`,onDirty(){},setError(){},perform:async(_suffix,input)=>{calls.push(input);if(input.action==='approve')await social.save(project,post.id,input);else await social.publish(project,post.id,input);props.state={...props.state,social:social.get(project)};return true;}};
 const component=componentHarness(new URL('../src/CommunityWorkspace.tsx',import.meta.url),'XWorkspace',props,{'./api':{api:async()=>{throw new Error('Unexpected API call');}},'./DraftText':{DraftText:noop},'./ManualPostRecord':{ManualPostRecord:noop}},{expose:true});t.after(()=>component.unmount());
 let tree=await cycle(component);findNode(tree,node=>node.type==='button'&&textOf(node).includes('Share your community demo.')).props.onClick();tree=await cycle(component);assert.match(textOf(tree),new RegExp('@'+provider.username));assert.equal(button(tree,'Approve again for X').props.disabled,true);
 findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});tree=await cycle(component);await button(tree,'Approve again for X').props.onClick();tree=await cycle(component);
 assert.deepEqual(calls.map(call=>call.action),['approve']);assert.equal(provider.published,0);assert.equal(store.read('social_posts')[0].approvedAccount,provider.account);assert.equal(store.read('social_posts')[0].approvedGeneration,store.read('social_x')[0].generation);assert.equal(button(tree,'Publish on X').props.disabled,true);
 findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});tree=await cycle(component);await button(tree,'Publish on X').props.onClick();await cycle(component);assert.deepEqual(calls.map(call=>call.action),['approve','publish']);assert.equal(provider.published,1);assert.equal(social.get(project).posts[0].receipt.username,provider.username);
});
