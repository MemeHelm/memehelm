import {randomUUID} from 'node:crypto';
import {NETWORK} from '../shared/config.mjs';
import {chatPage,chatListPage} from './chat-history.mjs';
import {MATE_SCOPE_VERSION,currentMateResult} from './mate-scope.mjs';

const scope='assistant-chat',kind='general';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const utcDay=time=>new Date(time).toISOString().slice(0,10);
const belongs=(record,owner)=>record.owner===owner&&record.kind===kind&&record.chainId===NETWORK.id;
// Only persisted user and assistant messages enter model context. Full history stays in storage.
function storedTurns(messages){
 const turns=(Array.isArray(messages)?messages:[]).map(turn=>{
  const content=typeof turn?.content==='string'?turn.content.trim().slice(0,4000):'';
  return ['user','assistant'].includes(turn?.role)&&content?{role:turn.role,content}:null;
 }).filter(Boolean).slice(-12);
 let total=turns.reduce((sum,turn)=>sum+turn.content.length,0);
 while(total>20000&&turns.length>1)total-=turns.shift().content.length;
 return turns;
}

/** Owner-scoped conversations without a project, project memory or action permissions. */
export function createGeneralChat(store,{journal,generate,withAI,withPreparation,isPreparing,isInFlight,now=()=>Date.now(),dailyLimit=10}){
 const find=(owner,id)=>store.read('assistant_chats').find(record=>record.id===id&&belongs(record,owner));
 async function reserve(owner){
  const id=randomUUID(),time=now();
  await store.change('assistant_usage',records=>{
   const used=records.filter(record=>belongs(record,owner)&&utcDay(Date.parse(record.createdAt))===utcDay(time)).length;
   if(used>=dailyLimit)throw fail('Your general chat daily AI request limit is reached. Try again after 00:00 UTC.',429);
   for(let index=records.length-1;index>=0;index--)if(Date.parse(records[index].createdAt)<time-14*86400000)records.splice(index,1);
   records.push({id,owner,kind,chainId:NETWORK.id,task:'chat',source:'manual',status:'started',createdAt:new Date(time).toISOString()});
  });return id;
 }
 async function send(owner,input){
  const content=typeof input.content==='string'?input.content.trim():'';
  if(!content||content.length>4000)throw fail('Write a message between 1 and 4,000 characters.');
  const chatId=input.chatId??null;
  if(chatId!==null&&typeof chatId!=='string')throw fail('Choose a chat.');
  const result=await journal.execute({owner,scope,requestId:input.requestId,payload:{chatId,content}},()=>withPreparation(owner,async()=>{
   const chat=chatId===null?null:find(owner,chatId);
   if(chatId!==null&&!chat)throw fail('Chat not found.',404);
   if(isInFlight(owner))throw fail('Your chat reply is already being written.',429);
   return withAI(owner,async()=>{
    const usageId=await reserve(owner);
    try{
     const result=await generate({task:'general-chat',facts:{currentTime:new Date(now()).toISOString(),timezone:'UTC',contextScope:'general',projectSelected:false},messages:[...storedTurns(chat?.messages),{role:'user',content}]});
     const saved=await store.transaction(['assistant_chats','assistant_usage'],documents=>{
      let record=chat?documents.assistant_chats.find(item=>item.id===chat.id&&belongs(item,owner)):null;
      if(chat&&!record)throw fail('Chat not found.',404);
      if(!record){record={id:randomUUID(),owner,kind,chainId:NETWORK.id,createdAt:result.generatedAt,updatedAt:result.generatedAt,messages:[]};documents.assistant_chats.push(record);}
      record.messages.push({role:'user',content,createdAt:result.generatedAt},{role:'assistant',content:result.content,createdAt:result.generatedAt});record.updatedAt=result.generatedAt;
      const usage=documents.assistant_usage.find(item=>item.id===usageId&&belongs(item,owner));
      if(usage)Object.assign(usage,{status:'completed',finishedAt:new Date(now()).toISOString()});
      return record;
     });
     const page=chatPage(saved);
     return {mateScopeVersion:MATE_SCOPE_VERSION,chatId:saved.id,reply:result.content,coverage:null,generatedAt:result.generatedAt,messages:page.messages,hasMore:page.hasMore,before:page.before,totalMessages:page.totalMessages};
    }catch(error){await store.change('assistant_usage',records=>{const usage=records.find(item=>item.id===usageId&&belongs(item,owner));if(usage&&usage.status==='started')Object.assign(usage,{status:'failed',finishedAt:new Date(now()).toISOString()});});throw error;}
   });
  }));
  return currentMateResult(result);
 }
 function list(owner,options){
  const summaries=store.read('assistant_chats').filter(record=>belongs(record,owner)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(chat=>({id:chat.id,createdAt:chat.createdAt,updatedAt:chat.updatedAt,messageCount:chat.messages.length,preview:(chat.messages.find(message=>message.role==='user')?.content||'').slice(0,120)}));
  return chatListPage(summaries,options);
 }
 function page(owner,id,options){const chat=find(owner,id);if(!chat)throw fail('Chat not found.',404);return chatPage(chat,options);}
 function exported(owner,id){const chat=find(owner,id);if(!chat)throw fail('Chat not found.',404);return{id:chat.id,messages:chat.messages,createdAt:chat.createdAt,updatedAt:chat.updatedAt};}
 async function remove(owner,id){
  if(isPreparing(owner)||store.read('ai_requests').some(record=>record.owner===owner&&record.scope===scope&&record.status==='running'&&record.leaseUntil>now()))throw fail('Wait for the current chat request to finish before deleting a conversation.',409);
  await store.transaction(['assistant_chats','ai_requests'],documents=>{
   const index=documents.assistant_chats.findIndex(record=>record.id===id&&belongs(record,owner));if(index<0)throw fail('Chat not found.',404);documents.assistant_chats.splice(index,1);
   for(const entry of documents.ai_requests){if(entry.owner===owner&&entry.scope===scope&&entry.result?.chatId===id){entry.status='failed';entry.error={status:410,code:'CHAT_DELETED',message:'This conversation was deleted. Start a new chat.'};delete entry.result;}}
  });return{ok:true};
 }
 return{send,list,page,export:exported,remove};
}
