import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const file=new URL('../src/ProjectChat.tsx',import.meta.url);
const Recovery=()=>null,Actions=()=>null;
class ApiError extends Error{constructor(message,status,code){super(message);Object.assign(this,{status,code});}}
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node).trim()===label);
const composer=tree=>findNode(tree,node=>node.type==='textarea');
const form=tree=>findNode(tree,node=>node.type==='form'&&node.props.className==='chat-composer');
const turn=(role,content)=>({role,content,createdAt:'2026-11-16T01:00:00.000Z'});
const summary=(id,preview)=>({id,preview,messageCount:2,createdAt:'2026-11-16T01:00:00.000Z',updatedAt:'2026-11-16T01:00:00.000Z'});
const reply=(chatId,content)=>({chatId,messages:[turn('user',content),turn('assistant','An explicitly mocked general reply.')],coverage:null,hasMore:false});

function fixture(t,respond,changes={}){
  const calls=[],resets=[],downloads=[],blocked=[];
  const props={project:undefined,available:true,presentation:'sidebar',onBlocked:value=>blocked.push(value),...changes};
  const component=componentHarness(file,'ProjectChat',props,{
    './api':{ApiError,api:async(path,body,signal)=>{calls.push({path,body,signal});return respond(path,body,signal);},resetAIRequest:async(path,body)=>resets.push({path,body}),saveFile:(name,data)=>downloads.push({name,data})},
    './AIRequestRecovery':{AIRequestRecovery:Recovery},'./AssistantActions':{AssistantActions:Actions},
  });
  t.after(()=>component.unmount());
  const render=()=>{const tree=component.render();component.effects();return tree;};
  const cycle=async()=>{let tree;for(let index=0;index<4;index++){tree=render();await settle();}return render();};
  const write=value=>{const tree=render();composer(tree).props.onChange({target:{value}});return render();};
  return{component,props,calls,resets,downloads,blocked,render,cycle,write};
}

test('a signed-in general chat has an editable composer without token reads or a project action planner',async t=>{
  const f=fixture(t,async path=>{assert.equal(path,'/assistant/chats?limit=20');return{items:[]};});
  let tree=await f.cycle();assert.equal(composer(tree).props.disabled,false);assert.match(composer(tree).props['aria-label'],/MATE/);assert.doesNotMatch(composer(tree).props.placeholder,/undefined|\$/);assert.equal(button(tree,'Send').props.disabled,true);
  assert.equal(button(tree,'Plan an action'),null);assert.equal(findNode(tree,node=>node.type===Actions),null);assert.doesNotMatch(textOf(tree),/Link an issued token|Choose a project to.*chat|Reading observed facts/);
  tree=f.write('Help me shape a coin idea.');assert.equal(composer(tree).props.value,'Help me shape a coin idea.');assert.equal(button(tree,'Send').props.disabled,false);assert.equal(f.blocked.at(-1),true);assert.deepEqual(f.calls.map(call=>call.path),['/assistant/chats?limit=20']);
  button(tree,'Discard unsent question').props.onClick();f.render();assert.equal(f.blocked.at(-1),false);
});

test('general sends use the wallet chat route, prevent duplicate submissions and keep the busy guard until resolved',async t=>{
  let finish;const f=fixture(t,async(path,body)=>body?new Promise(resolve=>{finish=resolve;}):{items:[]});
  await f.cycle();let tree=f.write('  Help me plan a welcoming community.  ');form(tree).props.onSubmit({preventDefault(){}});form(tree).props.onSubmit({preventDefault(){}});tree=f.render();
  const sends=f.calls.filter(call=>call.body);assert.equal(sends.length,1);assert.deepEqual({path:sends[0].path,body:sends[0].body},{path:'/assistant/chat',body:{chatId:undefined,content:'Help me plan a welcoming community.'}});assert.equal(composer(tree).props.disabled,true);assert.equal(f.blocked.at(-1),true);assert.match(textOf(tree),/Help me plan a welcoming community/);assert.doesNotMatch(textOf(tree),/Reading the observed facts/);
  finish(reply('general-one','Help me plan a welcoming community.'));tree=await f.cycle();assert.match(textOf(tree),/mocked general reply/);assert.equal(composer(tree).props.disabled,false);assert.equal(composer(tree).props.value,'');assert.equal(f.blocked.at(-1),false);assert.ok(f.calls.every(call=>call.path.startsWith('/assistant/')));
  tree=f.write('What should I do first?');form(tree).props.onSubmit({preventDefault(){}});assert.deepEqual(f.calls.filter(call=>call.body).at(-1).body,{chatId:'general-one',content:'What should I do first?'});finish(reply('general-one','What should I do first?'));await f.cycle();
});

test('general history opens, paginates, exports and removes conversations without project endpoints',async t=>{
  let removed=false;const first=summary('general-one','First saved idea'),second=summary('general-two','Second saved idea');
  const f=fixture(t,async(path,body)=>{
    if(path==='/assistant/chats?limit=20')return{items:[first],hasMore:!removed,nextOffset:removed?null:20};
    if(path==='/assistant/chats?limit=20&offset=20')return{items:[first,second],hasMore:false};
    if(path==='/assistant/chats/general-one?limit=40')return{...first,messages:[turn('assistant','Latest saved general message.')],hasMore:true,before:40};
    if(path==='/assistant/chats/general-one?limit=40&before=40')return{...first,messages:[turn('user','Earlier general question.')],hasMore:false};
    if(path==='/assistant/chats/general-two?limit=40')return{...second,messages:[turn('assistant','Another saved conversation.')],hasMore:false};
    if(path==='/assistant/chats/general-two/export')return{...second,messages:[turn('assistant','Another saved conversation.')]};
    if(path==='/assistant/chats/remove'){assert.deepEqual(body,{chatId:'general-two'});removed=true;return{ok:true};}
    throw new Error(`Unexpected general history request: ${path}`);
  });
  let tree=await f.cycle();assert.match(textOf(tree),/Latest saved general message/);await button(tree,'Load earlier messages').props.onClick();tree=await f.cycle();assert.match(textOf(tree),/Earlier general question/);assert.match(textOf(tree),/Latest saved general message/);
  await button(tree,'Load more conversations').props.onClick();tree=await f.cycle();const historyButtons=()=>findNode(tree,node=>node.type==='button'&&textOf(node).includes('Second saved idea'));await historyButtons().props.onClick();tree=await f.cycle();assert.match(textOf(tree),/Another saved conversation/);assert.doesNotMatch(textOf(tree),/Earlier general question/);
  await button(tree,'Download chat').props.onClick();assert.equal(f.downloads.length,1);assert.equal(f.downloads[0].data.id,'general-two');assert.match(f.downloads[0].name,/general-two\.json$/);assert.doesNotMatch(f.downloads[0].name,/undefined/);
  await findNode(tree,node=>node.type==='button'&&node.props['aria-label']==='Delete chat: Second saved idea').props.onClick();tree=await f.cycle();assert.doesNotMatch(textOf(tree),/Another saved conversation|Second saved idea/);assert.ok(f.calls.every(call=>call.path.startsWith('/assistant/')));
});

test('interrupted general requests inspect saved wallet chats before an explicit fresh retry',async t=>{
  for(const code of ['AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED']){
    let fail=true,inspect=false;const f=fixture(t,async(path,body)=>{
      if(body){if(fail)throw new ApiError('The general reply was interrupted.',409,code);return reply('general-saved',body.content);}
      if(path==='/assistant/chats?limit=20')return{items:inspect?[summary('general-saved','Recovered idea')]:[]};
      if(path==='/assistant/chats/general-saved?limit=4')return{messages:[turn('assistant','Saved general result to inspect.')]};
      throw new Error(`Unexpected recovery request: ${path}`);
    });
    await f.cycle();let tree=f.write('Keep the exact private idea.');form(tree).props.onSubmit({preventDefault(){}});tree=await f.cycle();assert.equal(composer(tree).props.value,'Keep the exact private idea.');const recovery=findNode(tree,node=>node.type===Recovery);assert.ok(recovery);assert.equal(f.resets.length,0);
    inspect=true;assert.match(await recovery.props.inspect(),/Saved general result to inspect/);assert.equal(f.calls.filter(call=>call.body).length,1);fail=false;await recovery.props.restart();tree=await f.cycle();assert.deepEqual(f.resets,[{path:'/assistant/chat',body:{chatId:undefined,content:'Keep the exact private idea.'}}]);assert.equal(f.calls.filter(call=>call.body).length,2);assert.match(textOf(tree),/mocked general reply/);assert.equal(f.blocked.at(-1),false);f.component.unmount();
  }
});

test('a pending general request retries the same input without resetting its request identity',async t=>{
  let fail=true;const f=fixture(t,async(path,body)=>{if(!body)return{items:[]};if(fail)throw new ApiError('Still pending.',409,'AI_REQUEST_PENDING');return reply('general-pending',body.content);});
  await f.cycle();let tree=f.write('An exact retry question.');form(tree).props.onSubmit({preventDefault(){}});tree=await f.cycle();assert.equal(findNode(tree,node=>node.type===Recovery),null);assert.ok(button(tree,'Retry question'));fail=false;await button(tree,'Retry question').props.onClick();await f.cycle();assert.equal(f.resets.length,0);assert.deepEqual(f.calls.filter(call=>call.body).map(call=>call.body),[{chatId:undefined,content:'An exact retry question.'},{chatId:undefined,content:'An exact retry question.'}]);
});

test('general unsent questions keep history navigation guarded and unavailable AI retains readable history',async t=>{
  const saved=summary('general-one','Saved conversation');const f=fixture(t,async path=>path==='/assistant/chats?limit=20'?{items:[saved]}:{messages:[turn('assistant','Saved general answer.')],hasMore:false});
  await f.cycle();let tree=f.write('An unfinished question.');assert.equal(f.blocked.at(-1),true);assert.equal(button(tree,'New chat').props.disabled,true);assert.equal(findNode(tree,node=>node.type==='button'&&node.props['aria-label']==='Delete chat: Saved conversation').props.disabled,true);
  button(tree,'Discard unsent question').props.onClick();tree=f.render();assert.equal(f.blocked.at(-1),false);f.props.available=false;tree=f.render();assert.equal(composer(tree).props.disabled,true);assert.match(textOf(tree),/Saved general answer/);assert.equal(button(tree,'New chat').props.disabled,false);f.component.unmount();assert.equal(f.blocked.at(-1),false);assert.equal(f.calls.filter(call=>call.body).length,0);
});

test('general chat ignores late replies and history loads after its scope unmounts',async t=>{
  let finishReply;const sending=fixture(t,async(path,body)=>body?new Promise(resolve=>{finishReply=resolve;}):{items:[]});
  await sending.cycle();let tree=sending.write('A request from the previous chat scope.');form(tree).props.onSubmit({preventDefault(){}});sending.render();assert.equal(sending.blocked.at(-1),true);sending.component.unmount();assert.equal(sending.blocked.at(-1),false);
  const guardCount=sending.blocked.length,requestCount=sending.calls.length;finishReply(reply('general-stale','A request from the previous chat scope.'));await settle();await settle();assert.equal(sending.calls.length,requestCount,'an abandoned reply must not refresh the old scope');assert.equal(sending.blocked.length,guardCount,'an abandoned reply must not overwrite a new scope’s guard');
  let finishList;const opening=fixture(t,async()=>new Promise(resolve=>{finishList=resolve;}));opening.render();const signal=opening.calls[0].signal;opening.component.unmount();assert.equal(signal.aborted,true);finishList({items:[summary('general-stale','A stale saved chat')]});await settle();await settle();assert.equal(opening.calls.length,1,'a stale list must not open a conversation after unmount');
});

test('general keyboard entry waits for composition and Shift+Enter before submitting a question',async t=>{
  const f=fixture(t,async(path,body)=>body?reply('general-keyboard',body.content):{items:[]});await f.cycle();let tree=f.write('A question typed with an input method.');let prevented=0;
  const key=(changes={})=>({key:'Enter',shiftKey:false,nativeEvent:{isComposing:false},preventDefault(){prevented++;},...changes});
  composer(tree).props.onKeyDown(key({nativeEvent:{isComposing:true}}));composer(tree).props.onKeyDown(key({shiftKey:true}));assert.equal(f.calls.filter(call=>call.body).length,0);assert.equal(prevented,0);
  composer(tree).props.onKeyDown(key());tree=await f.cycle();assert.equal(prevented,1);assert.equal(f.calls.filter(call=>call.body).length,1);assert.match(textOf(tree),/mocked general reply/);
});
