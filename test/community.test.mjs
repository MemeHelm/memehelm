import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {once} from 'node:events';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {createCommunity} from '../server/community.mjs';
import {createXSocial} from '../server/social-x.mjs';
import {createOperations} from '../server/operations.mjs';
import {signedClient,testWallet} from './helpers/auth.mjs';

async function fixture(run){await mkdir('qa',{recursive:true});const directory=await mkdtemp(resolve('qa','community-test-'));try{const store=createWorkspaceStore(directory),project={id:randomUUID(),owner:testWallet(130).address.toLowerCase(),name:'Orbit Club',symbol:'ORBIT',description:'Local test fixture.',chainId:4663,published:true,tokenAddress:'0x1111111111111111111111111111111111111111'};await store.mutateProjects(list=>list.push(project));await run({store,project,directory});}finally{assert.ok(resolve(directory).startsWith(resolve('qa')+sep));await rm(directory,{recursive:true,force:true});}}
const details=time=>({title:'Community demo',description:'Share a useful demo and ask questions.',startsAt:new Date(time+3600000).toISOString(),endsAt:new Date(time+7200000).toISOString(),url:'https://discord.com/events/123/456',capacity:1});
const encryptionKey=Buffer.alloc(32,7).toString('base64');
function provider(){const state={calls:[],posts:0,refreshes:0,mode:'success',username:'orbit_test',accountId:'12345'};state.fetch=async(url,options={})=>{state.calls.push({url,options});if(url.endsWith('/oauth2/token')){const body=new URLSearchParams(options.body);if(body.get('grant_type')==='refresh_token')state.refreshes++;return Response.json({access_token:'fixture-access-token',refresh_token:'fixture-refresh-token',expires_in:3600,scope:'tweet.read tweet.write users.read offline.access'});}if(url.endsWith('/users/me'))return Response.json({data:{id:state.accountId,username:state.username,name:'Orbit test'}});if(url.endsWith('/2/tweets')){state.posts++;if(state.mode==='timeout')throw new Error('fixture secret must not be exposed');if(state.mode==='forbidden')return Response.json({secret:'provider-only details'},{status:403});return Response.json({data:{id:'98765',text:JSON.parse(options.body).text}});}if(url.includes('/2/tweets/98765?'))return Response.json({data:{id:'98765',author_id:state.accountId,public_metrics:{like_count:2,reply_count:1,retweet_count:0,quote_count:0}}});throw new Error('Unexpected provider request');};return state;}
function socialFor(store,provider,now=()=>Date.now()){return createXSocial(store,{origin:'http://127.0.0.1:4318',clientId:'fixture-client',clientSecret:'fixture-client-secret',encryptionKey,fetcher:provider.fetch,now});}
async function connect(social,project){const start=social.start(project),params=new URL(start.url).searchParams;const result=await social.callback(new URLSearchParams({state:params.get('state'),code:'fixture-code'}),start.binding);assert.equal(result.ok,true);return{...start,state:params.get('state'),connected:await social.finish(project,start.binding)};}

test('community links and event edits require explicit publication and retain a public snapshot',()=>fixture(async({store,project})=>{
 let time=Date.now();const community=createCommunity(store,{now:()=>time});
 await assert.rejects(()=>community.saveLinks(project,{revision:0,share:true,links:{discord:'https://evil.example/invite/abc'}}),/invitation/);
 let state=await community.saveLinks(project,{revision:0,share:false,links:{discord:'https://discord.gg/orbit'}});assert.deepEqual(community.publicView(project).links,{});
 await assert.rejects(()=>community.saveLinks(project,{revision:0,share:true,links:{}}),error=>error.status===409);
 state=await community.saveLinks(project,{revision:state.revision,share:true,links:state.links});assert.equal(community.publicView(project).links.discord,'https://discord.gg/orbit');
 state=await community.changeEvent(project,null,{details:details(time)});let event=state.events[0];assert.equal(community.publicView(project).events.length,0);
 await assert.rejects(()=>community.changeEvent(project,event.id,{action:'publish',revision:event.revision}),/confirm/);
 state=await community.changeEvent(project,event.id,{action:'publish',revision:event.revision,confirm:true});event=state.events[0];
 state=await community.changeEvent(project,event.id,{action:'edit',revision:event.revision,details:{...event.details,title:'A private revised title'}});event=state.events[0];assert.equal(community.publicView(project).events[0].title,'Community demo');
 state=await community.changeEvent(project,event.id,{action:'publish',revision:event.revision,confirm:true});event=state.events[0];assert.equal(community.publicView(project).events[0].title,'A private revised title');
 await assert.rejects(()=>community.changeEvent(project,event.id,{action:'complete',revision:event.revision,confirm:true,outcome:'Too early',shareRecap:true}),/start time/);
 time+=3600001;state=await community.changeEvent(project,event.id,{action:'complete',revision:event.revision,confirm:true,outcome:'Private feedback: simplify the next agenda.',shareRecap:false});assert.equal(community.publicView(project).events[0].recap,null);assert.match(community.context(project).events[0].outcome,/Private feedback/);
}));

test('RSVP capacity is atomic, wallets are private, cancellations and attendance are bounded',()=>fixture(async({store,project,directory})=>{
 let time=Date.now();const community=createCommunity(store,{now:()=>time});let state=await community.changeEvent(project,null,{details:details(time)}),event=state.events[0];state=await community.changeEvent(project,event.id,{action:'publish',revision:0,confirm:true});event=state.events[0];
 const alice=testWallet(131).address.toLowerCase(),bob=testWallet(132).address.toLowerCase();
 const attempts=await Promise.allSettled([community.rsvp(project,event.id,alice,{attending:true}),community.rsvp(project,event.id,bob,{attending:true})]);assert.equal(attempts.filter(item=>item.status==='fulfilled').length,1);assert.equal(community.publicView(project).events[0].going,1);
 const serialized=JSON.stringify(community.publicView(project));assert.ok(!serialized.includes(alice)&&!serialized.includes(bob));assert.equal(community.publicView(project,alice).events[0].attending,true);
 await community.rsvp(project,event.id,alice,{attending:true});assert.equal(community.attendees(project,event.id).length,1);
 await community.rsvp(project,event.id,alice,{attending:false});await community.rsvp(project,event.id,bob,{attending:true});
 await assert.rejects(()=>community.changeEvent(project,event.id,{action:'attendance',revision:event.revision,wallet:bob,attended:true}),/after the event/);
 time+=3600001;state=await community.changeEvent(project,event.id,{action:'attendance',revision:event.revision,wallet:bob,attended:true});event=state.events[0];assert.equal(event.attended,1);
 const operations=createOperations(store,{communityContext:()=>community.context(project)});assert.equal((await operations.context(project)).community.events[0].attendanceRecordedByCreator,1);
 state=await community.changeEvent(project,event.id,{action:'cancel',revision:event.revision,confirm:true,reason:'Host is unavailable.'});assert.equal(community.publicView(project).events[0].status,'cancelled');
 await assert.rejects(()=>community.rsvp(project,event.id,alice,{attending:true}),/closed/);await community.rsvp(project,event.id,bob,{attending:false});
 assert.equal(createCommunity(createWorkspaceStore(directory),{now:()=>time}).get(project).events[0].status,'cancelled');
}));

test('X PKCE is browser/project bound, one-use, encrypted and absent from public state',()=>fixture(async({store,project})=>{
 const mock=provider(),social=socialFor(store,mock),flow=social.start(project),params=new URL(flow.url).searchParams;
 assert.equal(params.get('code_challenge_method'),'S256');assert.equal(params.get('redirect_uri'),'http://127.0.0.1:4318/api/social/x/callback');
 await assert.rejects(()=>social.callback(new URLSearchParams({state:params.get('state'),code:'fixture'}),'wrong-browser'),/expired/);assert.equal(mock.calls.length,0);
 await social.callback(new URLSearchParams({state:params.get('state'),code:'fixture'}),flow.binding);
 const tokenCall=mock.calls.find(call=>call.url.endsWith('/oauth2/token'));const verifier=new URLSearchParams(tokenCall.options.body).get('code_verifier');assert.equal(createHash('sha256').update(verifier).digest('base64url'),params.get('code_challenge'));
 assert.equal(social.get(project).account,null,'callback alone does not link an account');
 await assert.rejects(()=>social.finish({...project,owner:testWallet(133).address.toLowerCase()},flow.binding),/wallet/);
 await social.finish(project,flow.binding);await assert.rejects(()=>social.finish(project,flow.binding),/wallet/);
 const stored=JSON.stringify(store.read('social_x')),visible=JSON.stringify(social.get(project));assert.ok(!stored.includes('fixture-access-token')&&!stored.includes('fixture-refresh-token'));assert.ok(!visible.includes('sealed')&&!visible.includes('fixture-access-token'));
 assert.equal(social.get({...project,id:randomUUID()}).account,null);
 await social.disconnect(project);assert.equal(social.get(project).account,null);assert.equal(store.read('social_x').length,0);
}));

test('X approval follows exact revisions/accounts; receipts, refresh and observed metrics survive',()=>fixture(async({store,project,directory})=>{
 let time=Date.now();const mock=provider(),social=socialFor(store,mock,()=>time);await connect(social,project);
 let state=await social.save(project,null,{text:'Join our next community demo.'}),post=state.posts[0];
 await assert.rejects(()=>social.publish(project,post.id,{revision:0,confirm:true}),/approve/);assert.equal(mock.posts,0);
 state=await social.save(project,post.id,{action:'approve',revision:0});post=state.posts[0];state=await social.save(project,post.id,{action:'edit',revision:post.revision,text:'Join the next demo. Bring one question.'});post=state.posts[0];assert.equal(post.status,'draft');
 await assert.rejects(()=>social.save(project,post.id,{action:'approve',revision:0}),error=>error.status===409);
 state=await social.save(project,post.id,{action:'approve',revision:post.revision});post=state.posts[0];await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision}),/Confirm/);
 time+=3601000;state=await social.publish(project,post.id,{revision:post.revision,confirm:true});assert.equal(state.posts[0].status,'published');assert.equal(mock.posts,1);assert.equal(mock.refreshes,1);
 await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}));assert.equal(mock.posts,1,'repeated publishing cannot duplicate a post');
 state=await social.metrics(project,post.id);assert.equal(state.posts[0].metrics.reply_count,1);assert.equal(social.context(project)[0].publicMetrics.like_count,2);
 assert.equal(socialFor(createWorkspaceStore(directory),mock,()=>time).get(project).posts[0].receipt.url,'https://x.com/orbit_test/status/98765');
 state=await social.save(project,null,{text:'Second approved draft.'});post=state.posts[0];state=await social.save(project,post.id,{action:'approve',revision:0});post=state.posts[0];await social.disconnect(project);await connect(social,project);await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}),/approve/);assert.equal(mock.posts,1);
}));

test('uncertain X sends cannot be retried; definitive rejection remains recoverable without leaks',()=>fixture(async({store,project})=>{
 const mock=provider(),social=socialFor(store,mock);await connect(social,project);
 async function approved(text){let state=await social.save(project,null,{text}),post=state.posts[0];state=await social.save(project,post.id,{action:'approve',revision:0});return state.posts[0];}
 let post=await approved('A reviewable post.');mock.mode='timeout';await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}),error=>!error.message.includes('fixture secret'));post=social.get(project).posts[0];assert.equal(post.status,'uncertain');await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}));assert.equal(mock.posts,1);
 post=await approved('A separate post that X rejects.');mock.mode='forbidden';await assert.rejects(()=>social.publish(project,post.id,{revision:post.revision,confirm:true}),error=>!error.message.includes('provider-only'));assert.equal(social.get(project).posts[0].status,'failed');
}));

test('an unconfigured X service supports private drafts without pretending an account or receipt exists',()=>fixture(async({store,project})=>{
 let calls=0;const social=createXSocial(store,{origin:'http://127.0.0.1:4318',clientId:'',clientSecret:'',encryptionKey:'',fetcher:async()=>{calls++;throw new Error('No external call is allowed.');}});
 assert.equal(social.get(project).available,false);assert.equal(social.get(project).account,null);assert.throws(()=>social.start(project),error=>error.status===503);
 const state=await social.save(project,null,{text:'A private draft to review manually.'}),post=state.posts[0];assert.equal(post.status,'draft');assert.equal(post.receipt,undefined);
 await assert.rejects(()=>social.save(project,post.id,{action:'approve',revision:0}),/Connect/);await assert.rejects(()=>social.publish(project,post.id,{revision:0,confirm:true}),error=>error.status===503);assert.equal(calls,0);
}));

test('community HTTP APIs isolate owners, protect registrations and complete X connection with a signed session',()=>fixture(async({store,project,directory})=>{
 const environment={...process.env},nativeFetch=globalThis.fetch,mock=provider();let server;
 try{Object.assign(process.env,{DATA_DIRECTORY:directory,X_CLIENT_ID:'fixture-client',X_CLIENT_SECRET:'fixture-client-secret',SOCIAL_ENCRYPTION_KEY:encryptionKey});globalThis.fetch=(url,options)=>String(url).startsWith('https://api.x.com/')?mock.fetch(url,options):nativeFetch(url,options);
   ({server}=await import(`../server/index.mjs?community=${randomUUID()}`));server.listen(0,'127.0.0.1');await once(server,'listening');const endpoint=`http://127.0.0.1:${server.address().port}`,alice=await signedClient(endpoint,testWallet(130),nativeFetch),bob=await signedClient(endpoint,testWallet(131),nativeFetch),path=`/projects/${project.id}/community`;
   assert.equal((await nativeFetch(endpoint+'/api'+path)).status,401);assert.equal((await bob.get(path)).status,404);assert.equal((await bob.post(path+'/links',{revision:0,share:true,links:{}})).status,404);
   let response=await alice.post(path+'/events',{details:details(Date.now())});assert.equal(response.status,200);let state=await response.json(),event=state.events[0];assert.equal((await alice.post(path+'/events/'+event.id,{action:'publish',revision:0,confirm:true})).status,200);
   const rsvpPath=`/public/projects/${project.id}/events/${event.id}/rsvp`;assert.equal((await nativeFetch(endpoint+'/api'+rsvpPath,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({attending:true})})).status,401);assert.equal((await bob.post(rsvpPath,{attending:true})).status,200);
   assert.equal((await bob.get(path+'/events/'+event.id+'/attendees')).status,404);const publicData=await (await nativeFetch(endpoint+`/api/public/projects/${project.id}`)).json();assert.equal(publicData.community.events[0].going,1);assert.ok(!JSON.stringify(publicData).includes(bob.account.address.toLowerCase()));
   response=await alice.post(path+'/x/connect',{});assert.equal(response.status,200);const flowCookie=response.headers.getSetCookie()[0].split(';')[0],authorization=await response.json(),stateParam=new URL(authorization.url).searchParams.get('state');assert.match(response.headers.getSetCookie()[0],/HttpOnly; SameSite=Lax/);
   response=await nativeFetch(endpoint+'/api/social/x/callback?'+new URLSearchParams({state:stateParam,code:'fixture-code'}),{headers:{cookie:flowCookie},redirect:'manual'});assert.equal(response.status,303);assert.ok(!response.headers.get('location').includes('fixture-code'));
   assert.equal((await bob.post(path+'/x/finish',{})).status,404);
   response=await alice.request(endpoint+'/api'+path+'/x/finish',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:4318',cookie:alice.cookie+'; '+flowCookie},body:'{}'});assert.equal(response.status,200);assert.equal((await response.json()).account.username,'orbit_test');assert.equal(mock.posts,0);
   assert.equal((await alice.post(path+'/links',{revision:0,share:true,links:{}},'https://attacker.example')).status,400);
 }finally{globalThis.fetch=nativeFetch;process.env=environment;if(server){server.close();server.closeAllConnections();}}
}));
