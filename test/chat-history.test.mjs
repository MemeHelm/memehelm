import test from 'node:test';
import assert from 'node:assert/strict';
import {chatPage,chatListPage} from '../server/chat-history.mjs';
import {chatTurns} from '../server/copilot.mjs';

test('long conversations page backwards without dropping, duplicating or rewriting stored messages',()=>{
  const messages=Array.from({length:123},(_,index)=>({role:index%2?'assistant':'user',content:'Message '+index}));
  const chat={id:'chat-1',messages,createdAt:'2026-01-01',updatedAt:'2026-01-02'},saved=structuredClone(chat);
  const latest=chatPage(chat),second=chatPage(chat,{before:latest.before}),third=chatPage(chat,{before:second.before}),first=chatPage(chat,{before:third.before});
  assert.equal(latest.messages.length,40);assert.equal(latest.totalMessages,123);assert.equal(latest.before,83);
  assert.equal(first.messages.length,3);assert.equal(first.hasMore,false);assert.equal(first.before,null);
  assert.deepEqual([...first.messages,...third.messages,...second.messages,...latest.messages],messages);assert.deepEqual(chat,saved);
});

test('conversation lists remain available beyond 20 with explicit bounded pages',()=>{
  const all=Array.from({length:53},(_,index)=>({id:'chat-'+index})),saved=structuredClone(all);
  const first=chatListPage(all),second=chatListPage(all,{offset:String(first.nextOffset)}),last=chatListPage(all,{offset:second.nextOffset});
  assert.equal(first.items.length,20);assert.equal(last.items.length,13);assert.equal(last.nextOffset,null);assert.equal(last.hasMore,false);assert.deepEqual([...first.items,...second.items,...last.items],all);assert.deepEqual(all,saved);
});

test('stored history and model context have separate limits, with malformed page requests rejected',()=>{
  const messages=Array.from({length:101},(_,index)=>({role:index%2?'assistant':'user',content:'Message '+index})),chat={id:'chat-1',messages};
  const context=chatTurns(messages);assert.equal(context.length,12);assert.equal(messages.length,101);assert.equal(chatPage(chat,{limit:100}).messages.length,100);
  for(const options of [{limit:0},{limit:101},{before:-1},{before:'1e6'},{before:Infinity}])assert.throws(()=>chatPage(chat,options),error=>error.status===400);
  for(const options of [{limit:0},{limit:51},{offset:'-1'},{offset:1.5}])assert.throws(()=>chatListPage([],options),error=>error.status===400);
  assert.deepEqual(chatPage({id:'empty',messages:[]}).messages,[]);assert.equal(chatPage(chat,{before:0}).messages.length,0);
});
