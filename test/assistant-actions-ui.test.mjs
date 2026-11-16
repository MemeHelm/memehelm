import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';
const require=createRequire(import.meta.url),file=new URL('../src/AssistantActions.tsx',import.meta.url);
class ApiError extends Error{constructor(message,status,code){super(message);Object.assign(this,{status,code});}}
const Recovery=()=>null;
const future=new Date(Date.now()+3*86400000).toISOString();
const calendar=()=>({id:'action-one',projectId:'project-one',kind:'calendar',title:'Next week’s community plan',rationale:'Keep the supplied community goal visible.',status:'proposed',revision:2,payload:{items:[{title:'Community question',content:'What did you build this week?',channel:'x',scheduledAt:future}]},createdAt:new Date().toISOString()});
const byText=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node)===label);
function harness(api,props={}){return componentHarness(file,'AssistantActions',{projectId:'project-one',available:true,...props},{'./api':{api,ApiError,resetAIRequest:async()=>{}},'./AIRequestRecovery':{AIRequestRecovery:Recovery},'./DraftText':{DraftText:()=>null}});}
async function mounted(component){component.render();component.effects();await settle();component.render();component.effects();return component.render();}
function validation(){const module={exports:{}};const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',source)(name=>name==='react/jsx-runtime'?require(name):{},module,module.exports);return module.exports.assistantActionIssues;}

test('action review requires complete, future dates and validates full X content without truncation',()=>{
  const issues=validation(),action=calendar();assert.deepEqual(issues(action),[]);
  action.payload.items[0].scheduledAt=null;assert.match(issues(action).join(' '),/future date/);assert.deepEqual(issues(action,Date.now(),false),[]);
  action.payload.items[0].content='界'.repeat(281);assert.match(issues(action).join(' '),/280 characters/);
  const event={...calendar(),kind:'event',payload:{title:'Community call',description:'A private invitation draft.',startsAt:future,endsAt:null,capacity:null}};
  assert.match(issues(event).join(' '),/end after/);event.payload.endsAt=new Date(Date.parse(future)+3600000).toISOString();assert.deepEqual(issues(event),[]);
  event.payload.capacity=501;assert.match(issues(event).join(' '),/1 to 500/);
});

test('private content is only created after an explicit confirmation of the displayed revision',async()=>{
  const action=calendar(),calls=[];let resolveApply;
  const component=harness(async(path,body)=>{calls.push({path,body});if(!body)return{items:[action]};return new Promise(resolve=>{resolveApply=resolve;});});
  let tree=await mounted(component),apply=byText(tree,'Create private drafts');assert.equal(apply.props.disabled,true);await apply.props.onClick();assert.equal(calls.filter(call=>call.body).length,0);
  const confirmation=findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox');confirmation.props.onChange({target:{checked:true}});tree=component.render();apply=byText(tree,'Create private drafts');assert.equal(apply.props.disabled,false);
  const pending=apply.props.onClick();await apply.props.onClick();assert.equal(calls.filter(call=>call.body).length,1);assert.deepEqual(calls.at(-1).body,{action:'apply',revision:2,confirm:true});
  resolveApply({action:{...action,status:'applied',revision:3,result:{kind:'calendar',ids:['draft-one'],message:'1 private content plan saved. No posts were sent.'}}});await pending;tree=component.render();
  assert.match(textOf(tree),/Private drafts created/);assert.match(textOf(tree),/Open the content calendar/);assert.equal(calls.some(call=>/publish|distribution|transaction/.test(call.path)),false);component.unmount();
});

test('an apply failure retains its proposal and requires a fresh review after saved edits',async()=>{
  const action=calendar(),calls=[];const component=harness(async(path,body)=>{calls.push({path,body});if(!body)return{items:[action]};if(body.action==='apply')throw new Error('This action changed in another window. Reload before approving it.');return{action:{...action,title:body.title,payload:body.payload,revision:3}};});
  let tree=await mounted(component);findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});tree=component.render();await byText(tree,'Create private drafts').props.onClick();tree=component.render();assert.match(textOf(tree),/changed in another window/);assert.ok(byText(tree,'Edit details'));
  byText(tree,'Edit details').props.onClick();tree=component.render();const editor=findNode(tree,node=>typeof node.type==='function'&&node.type.name==='ActionEditor');editor.props.setDraft({...action,title:'Reviewed community plan'});tree=component.render();await byText(tree,'Save review').props.onClick();tree=component.render();assert.equal(byText(tree,'Create private drafts').props.disabled,true);assert.equal(calls.at(-1).body.action,'edit');assert.equal(calls.at(-1).body.title,'Reviewed community plan');component.unmount();
});

test('missing dates disable creation while keeping the proposal editable and preserving unsaved protection',async()=>{
  const action=calendar();action.payload.items[0].scheduledAt=null;const blocked=[];const component=harness(async()=>({items:[action]}),{onBlocked:value=>blocked.push(value)});
  let tree=await mounted(component);assert.equal(byText(tree,'Create private drafts').props.disabled,true);assert.match(textOf(tree),/choose a future date/i);byText(tree,'Edit details').props.onClick();component.render();component.effects();assert.equal(blocked.at(-1),true);
  tree=component.render();assert.equal(byText(tree,'Save review').props.disabled,false);byText(tree,'Discard edits').props.onClick();component.render();component.effects();assert.equal(blocked.at(-1),false);component.unmount();
});

test('payout proposals only open the existing review; repeat navigation makes no extra API mutation',async t=>{
  const original=globalThis.window,events=[];globalThis.window={dispatchEvent:event=>{events.push(event);return true;}};t.after(()=>{globalThis.window=original;});
  const action={...calendar(),kind:'distribution',title:'Review holder payout',payload:{}},calls=[];const component=harness(async(path,body)=>{calls.push({path,body});return body?{action:{...action,status:'applied',revision:3},result:{kind:'distribution',projectId:'project-one'}}:{items:[action]};});
  let tree=await mounted(component);findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});tree=component.render();await byText(tree,'Open payout review').props.onClick();tree=component.render();assert.equal(events[0].type,'memehelm-open-distribution-review');assert.deepEqual(events[0].detail,{projectId:'project-one'});byText(tree,'Open payout review again').props.onClick();assert.equal(events.length,2);assert.equal(calls.filter(call=>call.body).length,1);assert.equal(calls.some(call=>/prepare|execute|distribution|transaction/.test(call.path)),false);component.unmount();
});

test('planning retry preserves exact failed input and chat binding, then loads saved proposals',async()=>{
  const calls=[],action=calendar();let fail=true;const component=harness(async(path,body)=>{calls.push({path,body});if(!body)return{items:[]};if(fail){fail=false;throw new Error('Service interrupted.');}return{reply:'Review the supplied dates before creating drafts.',items:[action]};},{chatId:'chat-one'});
  let tree=await mounted(component);findNode(tree,node=>node.type==='textarea').props.onChange({target:{value:'Plan next week’s updates.'}});tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();assert.equal(findNode(tree,node=>node.type==='textarea').props.value,'Plan next week’s updates.');await byText(tree,'Retry request').props.onClick();tree=component.render();const expected={chatId:'chat-one',content:'Plan next week’s updates.',timezone:'UTC'};assert.deepEqual(calls.filter(call=>call.body).map(call=>call.body),[expected,expected]);assert.match(textOf(tree),/Next week’s community plan/);assert.equal(findNode(tree,node=>node.type==='textarea').props.value,'');component.unmount();
});

test('interrupted AI requests expose saved-action inspection before an explicit fresh request',async()=>{
  const action=calendar();let getCount=0;const component=harness(async(path,body)=>{if(!body){getCount++;return{items:[action]};}throw new ApiError('Earlier request interrupted.',409,'AI_REQUEST_INTERRUPTED');});let tree=await mounted(component);findNode(tree,node=>node.type==='textarea').props.onChange({target:{value:'Make a content plan.'}});tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();const recovery=findNode(tree,node=>node.type===Recovery);assert.ok(recovery);assert.equal(recovery.props.label,'drafts');assert.match(await recovery.props.inspect(),/What did you build this week/);assert.equal(getCount,2);component.unmount();
});

test('saved actions survive a list reload error and a successful retry clears the error',async()=>{
  const action=calendar();let fail=false;const component=harness(async()=>{if(fail)throw new Error('Network unavailable.');return{items:[action]};});let tree=await mounted(component);fail=true;await byText(tree,'Refresh').props.onClick();tree=component.render();assert.match(textOf(tree),/Network unavailable/);assert.match(textOf(tree),/Next week’s community plan/);fail=false;await byText(tree,'Try loading proposals again').props.onClick();tree=component.render();assert.doesNotMatch(textOf(tree),/Network unavailable/);component.unmount();
});

test('chat and action planning keep separate entry modes and share the existing unsaved-work guard',async()=>{
  const Actions=()=>null,blocked=[];
  const component=componentHarness(new URL('../src/ProjectChat.tsx',import.meta.url),'ProjectChat',{project:{id:'project-one',symbol:'ORB',tokenAddress:null},available:true,onBlocked:value=>blocked.push(value)},{'./api':{api:async()=>({items:[]}),ApiError,saveFile(){},resetAIRequest:async()=>{}},'./AIRequestRecovery':{AIRequestRecovery:Recovery},'./AssistantActions':{AssistantActions:Actions}});
  let tree=await mounted(component);assert.equal(byText(tree,'Ask a question').props['aria-pressed'],true);assert.equal(findNode(tree,node=>node.type===Actions),null);
  byText(tree,'Plan an action').props.onClick();tree=component.render();const actions=findNode(tree,node=>node.type===Actions);assert.ok(actions);assert.equal(findNode(tree,node=>node.type==='textarea'),null);actions.props.onBlocked(true);component.render();component.effects();tree=component.render();assert.equal(blocked.at(-1),true);assert.equal(byText(tree,'Ask a question').props.disabled,true);
  actions.props.onBlocked(false);tree=component.render();byText(tree,'Ask a question').props.onClick();tree=component.render();const question=findNode(tree,node=>node.type==='textarea');question.props.onChange({target:{value:'Keep this unsent question.'}});component.render();component.effects();tree=component.render();assert.equal(byText(tree,'Plan an action').props.disabled,true);assert.equal(findNode(tree,node=>node.type==='textarea').props.value,'Keep this unsent question.');assert.equal(blocked.at(-1),true);component.unmount();
});

test('a replayed AI response cannot revert an applied or edited proposal to an older revision',async()=>{
  const stale=calendar(),applied={...calendar(),status:'applied',revision:5,title:'Already reviewed and saved',result:{kind:'calendar',ids:['draft-saved']}};
  const component=harness(async(path,body)=>body?{reply:'Recovered earlier request.',items:[stale]}:{items:[applied]});
  let tree=await mounted(component);findNode(tree,node=>node.type==='textarea').props.onChange({target:{value:'Retry the original request.'}});tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();
  assert.match(textOf(tree),/Already reviewed and saved/);assert.equal(byText(tree,'Create private drafts'),null);assert.ok(byText(tree,'Open content plan'));assert.doesNotMatch(textOf(tree),/Next week’s community plan/);component.unmount();
});

test('a slow initial list cannot erase a proposal returned by a faster planning request',async()=>{
  let finishList;const action=calendar(),component=harness(async(path,body)=>body?{reply:'Review the plan.',items:[action]}:new Promise(resolve=>{finishList=resolve;}));
  component.render();component.effects();let tree=component.render();findNode(tree,node=>node.type==='textarea').props.onChange({target:{value:'Create a content plan.'}});tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=component.render();assert.match(textOf(tree),/Next week’s community plan/);
  finishList({items:[]});await settle();tree=component.render();assert.match(textOf(tree),/Next week’s community plan/);assert.equal(byText(tree,'Create private drafts').props.disabled,true);component.unmount();
});

test('planning and its retry use UTC regardless of the browser time zone',async()=>{
  const original=Intl.DateTimeFormat.prototype.resolvedOptions;let zone='Asia/Shanghai',attempts=0;const calls=[];
  Intl.DateTimeFormat.prototype.resolvedOptions=function(){return{...original.call(this),timeZone:zone};};
  const component=harness(async(path,body)=>{if(!body)return{items:[]};calls.push(body);if(!attempts++)throw new Error('Transport interrupted.');return{reply:'Review the original local time.',items:[]};});
  try{let tree=await mounted(component);assert.match(textOf(tree),/All times are shown in\s+UTC/);findNode(tree,node=>node.type==='textarea').props.onChange({target:{value:'Draft an update tomorrow at 3pm.'}});tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});zone='America/New_York';tree=component.render();await byText(tree,'Retry request').props.onClick();assert.equal(calls.length,2);assert.equal(calls[0].timezone,'UTC');assert.deepEqual(calls[1],calls[0]);}finally{component.unmount();Intl.DateTimeFormat.prototype.resolvedOptions=original;}
});
