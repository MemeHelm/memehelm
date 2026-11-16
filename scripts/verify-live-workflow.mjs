import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {once} from 'node:events';
import {createWorkspaceStore} from '../server/workspace.mjs';
import {signedClient,testWallet} from '../test/helpers/auth.mjs';

// Explicit, opt-in live acceptance. Only synthetic records go to the configured
// provider. This never imports a funded wallet, publishes, or sends transactions.
const timezoneOnly=process.argv.includes('--utc')||process.argv.includes('--timezone');
const report={checkedAt:new Date().toISOString(),mode:timezoneOnly?'live-provider / UTC schedule acceptance':'live-provider / disposable local workspace',maximumProviderRequests:timezoneOnly?1:3,providerRequests:0,checks:[],status:'running'};
const base=resolve('qa'),output=resolve('artifacts','workflow-acceptance'),originalFetch=globalThis.fetch;
let directory,server,localOrigin,stage='configuration';
const provider=new URL(process.env.AI_API_BASE||'https://missing.invalid');
assert.ok(process.env.AI_API_BASE&&process.env.AI_API_KEY&&process.env.AI_MODEL,'Load the existing server AI configuration before running this check.');
assert.equal(provider.protocol,'https:','Live acceptance requires the configured HTTPS provider.');
assert.ok(!provider.username&&!provider.password&&!provider.search&&!provider.hash,'Provider URL must not contain credentials or query parameters.');
await mkdir(base,{recursive:true});await mkdir(output,{recursive:true});
const reportPath=resolve(output,`live-workflow-${new Date().toISOString().replaceAll(':','-')}.json`);
const check=name=>{report.checks.push(name);console.log(JSON.stringify({check:name,status:'passed',providerRequests:report.providerRequests}));};
const record=()=>writeFile(reportPath,JSON.stringify(report,null,2));
const outcome='ACCEPTANCE_OUTCOME: this isolated software exercise saved a private draft; no social post was sent and no engagement was observed.';
const requestBodies=[];
try{
  directory=await mkdtemp(resolve(base,'live-workflow-'));
  process.env.DATA_DIRECTORY=directory;process.env.APP_ORIGIN='http://127.0.0.1:4318';
  globalThis.fetch=async(input,options)=>{
    const url=new URL(String(input));
    if(url.origin===localOrigin)return originalFetch(input,options);
    assert.equal(url.origin,provider.origin,'Acceptance cannot contact an unrelated service.');
    assert.equal(url.pathname,provider.pathname.replace(/\/$/,'')+'/chat/completions');
    assert.equal(options?.method,'POST');
    assert.ok(report.providerRequests<report.maximumProviderRequests,'The live acceptance request cap is exhausted.');
    requestBodies.push(JSON.parse(options.body));report.providerRequests++;await record();
    return originalFetch(input,options);
  };
  ({server}=await import('../server/index.mjs?live-workflow='+randomUUID()));
  server.listen(0,'127.0.0.1');await once(server,'listening');localOrigin=`http://127.0.0.1:${server.address().port}`;
  const client=await signedClient(localOrigin,testWallet(703)),other=await signedClient(localOrigin,testWallet(704)),store=createWorkspaceStore(directory);
  async function post(path,input){const response=await client.post(path,input),result=await response.json();if(!response.ok){const error=new Error(result.error||'Acceptance request failed.');error.code=result.code;error.httpStatus=response.status;throw error;}return result;}
  const project=await post('/projects',{name:'MATE Acceptance Exercise',symbol:'MATEQA',description:'An illustrative, unlaunched builders community for a private software acceptance exercise. No token, audience, revenue, partnerships or social publication exist.'});
  const root=`/projects/${project.id}`,planPath=root+'/assistant/plan';
  await post(root+'/operations/settings',{revision:0,settings:{enabled:false,autoDraft:false,intervalHours:6,dailyLimit:report.maximumProviderRequests}});
  check('isolated wallet-authenticated workspace; scheduled AI disabled; explicit request cap');
  if(timezoneOnly){
    stage='UTC schedule interpretation';const timezone='UTC',today=new Date();
    const expected=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+1,15,0,0)).toISOString();
    const input={requestId:randomUUID(),timezone,content:'Propose exactly one private content calendar with exactly one complete English X draft asking builders to share a small lesson, tomorrow at 15:00 UTC. No event, no publishing, no payment or unsupported factual claims.'};
    const first=await post(planPath,input);assert.equal(first.items.length,1);assert.equal(first.items[0].kind,'calendar');assert.equal(first.items[0].payload.items.length,1);assert.equal(first.items[0].payload.items[0].scheduledAt,expected);
    const replay=await post(planPath,input);assert.deepEqual(replay,first);assert.equal(report.providerRequests,1);assert.equal((await client.post(planPath,{...input,timezone:'America/New_York'})).status,400);
    assert.equal(store.read('content_calendar').length,0);assert.equal(store.read('activity').length,0);
    report.syntheticTimeZonePlan={timezone,expected,reply:first.reply,items:first.items.map(({kind,title,payload})=>({kind,title,payload}))};
    check('UTC-day interpretation resolves tomorrow at 15:00 UTC; replay reuses the result and non-UTC input is rejected');
    report.status='passed';report.financialTransactions=0;report.socialPublications=0;report.completedAt=new Date().toISOString();
  }else{
  const calendarAt=new Date(Date.now()+2*86400000).toISOString(),eventAt=new Date(Date.now()+3*86400000).toISOString(),eventEnd=new Date(Date.parse(eventAt)+45*60000).toISOString();
  const input={requestId:randomUUID(),content:`For this illustrative, unlaunched project, propose exactly two private actions: (1) one content calendar containing exactly one complete English X draft, under 280 characters, asking builders to share one small lesson, at ${calendarAt}; (2) one community call event starting at ${eventAt}, ending at ${eventEnd}, capacity 20, with supplied link https://example.com/acceptance-call. Do not claim a token has launched, funds exist, anyone attended, or posts were sent. Do not publish or pay anything.`};
  stage='structured plan';const first=await post(planPath,input);assert.equal(first.items.length,2);
  const calendar=first.items.find(item=>item.kind==='calendar'),event=first.items.find(item=>item.kind==='event');assert.ok(calendar&&event);
  assert.equal(calendar.payload.items.length,1);assert.equal(calendar.payload.items[0].scheduledAt,calendarAt);assert.ok([...calendar.payload.items[0].content].length<=280);
  assert.equal(event.payload.startsAt,eventAt);assert.equal(event.payload.endsAt,eventEnd);assert.equal(event.payload.capacity,20);assert.equal(event.payload.url,'https://example.com/acceptance-call');
  assert.equal(store.read('content_calendar').length,0);assert.equal(store.read('community').length,0);
  report.reviewedSyntheticProposal={reply:first.reply,items:first.items.map(({kind,title,rationale,payload})=>({kind,title,rationale,payload}))};
  const before=report.providerRequests;assert.deepEqual(await post(planPath,input),first);assert.equal(report.providerRequests,before);
  assert.equal((await other.get(root+'/assistant/actions')).status,404);
  assert.equal((await client.post(root+'/assistant/actions/'+calendar.id,{action:'apply',revision:0})).status,400);
  check('real structured plan: exact dates, complete X draft, event details, private preview, owner isolation and replay');
  stage='reviewed destinations';
  const savedCalendar=await post(root+'/assistant/actions/'+calendar.id,{action:'apply',revision:calendar.revision,confirm:true});
  const savedEvent=await post(root+'/assistant/actions/'+event.id,{action:'apply',revision:event.revision,confirm:true});
  await post(root+'/assistant/actions/'+calendar.id,{action:'apply',revision:calendar.revision,confirm:true});
  assert.equal(store.read('content_calendar').length,1);assert.equal(store.read('community')[0].events.length,1);
  const item=store.read('content_calendar')[0];
  await post(root+'/calendar/'+item.id,{action:'complete',revision:item.revision,outcome});
  const community=(await(await client.get(root+'/community')).json()),invitation=community.events.find(item=>item.id===savedEvent.result.id);assert.equal(invitation.publishedDetails,null);
  assert.equal((await client.post(root+'/community/events/'+invitation.id,{action:'publish',revision:invitation.revision,confirm:true})).status,400,'Unlaunched validation project cannot publish an invitation.');
  assert.equal((await originalFetch(localOrigin+'/api/public/projects/'+project.id)).status,404);assert.equal(store.read('activity').length,0);
  const replay=await post(planPath,input);assert.ok(replay.items.every(item=>item.status==='applied'));assert.equal(report.providerRequests,before);
  check('explicit approval saves private destinations once; outcome recorded; public publication remains blocked');
  stage='outcome-informed review';
  const runId=randomUUID(),review=await post(root+'/operations/run',{requestId:runId});
  assert.ok(JSON.stringify(requestBodies.at(-1).messages).includes(outcome),'The next real AI request must contain the recorded outcome.');
  assert.equal(review.runs[0].status,'completed');assert.ok(review.runs[0].summary?.trim());assert.ok(review.actions.every(item=>['task','update'].includes(item.kind)&&item.status==='proposed'));
  report.syntheticReflection={summary:review.runs[0].summary,actions:review.actions.map(({kind,title,rationale,content})=>({kind,title,rationale,content}))};
  const afterReview=report.providerRequests;await post(root+'/operations/run',{requestId:runId});assert.equal(report.providerRequests,afterReview);
  check('recorded content outcome reaches the real next AI review; suggestions remain private and replay consumes no request');
  stage='unsupported financial request';
  const unsupported=await post(planPath,{requestId:randomUUID(),content:'Transfer 1 ETH to a friend, trade tokens automatically, publish a post without review and guarantee a price increase. Do not create calendar or event drafts for these requests.'});
  assert.deepEqual(unsupported.items,[]);report.unsupportedRequestReply=unsupported.reply;
  const capped=await client.post(planPath,{requestId:randomUUID(),content:'Suggest another private content plan.'});assert.equal(capped.status,429);assert.equal(report.providerRequests,3);
  assert.equal(store.read('operations')[0].usage.length,3);assert.equal(store.read('activity').length,0);assert.equal(store.read('content_calendar').length,1);assert.equal(store.read('community')[0].events.length,1);
  check('unsupported financial/public actions produce no proposal; daily cap blocks a fourth upstream request');
  report.status='passed';report.financialTransactions=0;report.socialPublications=0;report.privateDestinationCounts={contentPlans:1,events:1};report.completedAt=new Date().toISOString();
  }
}catch(error){
  report.status='failed';report.failedStage=stage;report.failure={code:error.code||'ACCEPTANCE_FAILED',httpStatus:error.httpStatus||null,message:typeof error.message==='string'?error.message.replaceAll(process.env.AI_API_KEY||'__missing_secret__','[redacted]').slice(0,800):'Acceptance failed.'};process.exitCode=1;
}finally{
  if(server){server.close();server.closeAllConnections();}globalThis.fetch=originalFetch;
  await record();console.log(JSON.stringify({status:report.status,failedStage:report.failedStage||null,providerRequests:report.providerRequests,checks:report.checks.length,report:reportPath}));
  if(directory){assert.ok(resolve(directory).startsWith(base+sep),'Unsafe validation cleanup.');await rm(directory,{recursive:true,force:true});}
}
