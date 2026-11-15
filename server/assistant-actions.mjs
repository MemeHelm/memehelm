import {randomUUID} from 'node:crypto';
import {contentPlanDetails} from './content-calendar.mjs';
import {communityEventDetails} from './community.mjs';
import {projectLink} from '../shared/project.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const iso=value=>new Date(value).toISOString();
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(`${label} must be between 1 and ${max} characters.`);return value.trim();}
function keys(value,allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('This action contains unsupported fields. Review a new proposal.');}
function date(value,now,required=false){
  if(value===null||value===undefined||value===''){if(required)throw fail('Choose a future date and time before saving this action.');return null;}
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw fail('Use a complete date and time with a time zone.');
  const [year,month,day,hour,minute,second]=value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/).slice(1).map(part=>Number(part??0));
  if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||(second??0)>59)throw fail('Choose a valid calendar date and time.');
  const time=Date.parse(value);if(!Number.isFinite(time)||time<=now||time>now+365*86400000)throw fail('Choose a future date within one year.');return iso(time);
}

export function normalizeAssistantPayload(kind,payload,{now=Date.now(),ready=false}={}){
  if(kind==='distribution'){keys(payload,[]);return{};}
  if(kind==='calendar'){
    keys(payload,['items']);if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>7)throw fail('A content plan needs between 1 and 7 items.');
    return{items:payload.items.map(item=>{keys(item,['title','content','channel','scheduledAt']);const title=text(item.title,120,'Content title'),content=text(item.content,8000,'Content');
      if(!['x','project','discord','telegram'].includes(item.channel))throw fail('Choose an available content channel.');
      if(item.channel==='x'&&Array.from(content).length>280)throw fail('Keep each X draft within 280 characters.');
      return{title,content,channel:item.channel,scheduledAt:date(item.scheduledAt,now,ready)};
    })};
  }
  if(kind==='event'){
    keys(payload,['title','description','startsAt','endsAt','capacity','url']);
    const result={title:text(payload.title,120,'Event title'),description:text(payload.description,4000,'Event description'),startsAt:date(payload.startsAt,now,ready),endsAt:date(payload.endsAt,now,ready),capacity:payload.capacity??null,url:projectLink(payload.url)};
    if(result.capacity!==null&&(!Number.isSafeInteger(result.capacity)||result.capacity<1||result.capacity>500))throw fail('Choose a capacity from 1 to 500, or leave it open.');
    if(result.startsAt&&result.endsAt&&(Date.parse(result.endsAt)<=Date.parse(result.startsAt)||Date.parse(result.endsAt)-Date.parse(result.startsAt)>7*86400000))throw fail('The event must end after it starts, within seven days.');
    return result;
  }
  throw fail('Choose a content plan, community event or holder-payout review.');
}

export function parseAssistantPlan(content,{now=Date.now()}={}){
  let value;try{value=JSON.parse(String(content).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw Object.assign(fail('The proposed actions could not be read. Your saved work is unchanged.',503),{code:'AI_RESPONSE_INVALID'});}
  try{
    keys(value,['reply','proposals']);const reply=text(value.reply,4000,'Assistant reply');
    if(!Array.isArray(value.proposals)||value.proposals.length>3)throw fail('Propose at most three actions.');
    const proposals=value.proposals.map(item=>{keys(item,['kind','title','rationale','payload']);return{kind:item.kind,title:text(item.title,120,'Action title'),rationale:text(item.rationale,1200,'Action rationale'),payload:normalizeAssistantPayload(item.kind,item.payload,{now})};});
    return{reply,proposals};
  }catch{throw Object.assign(fail('The assistant returned an incomplete action. No plans were saved or executed. Check your saved work before starting a new request.',503),{code:'AI_RESPONSE_INVALID'});}
}

/** Applies only to private workspace documents. This module has no signer, publisher or fetch client. */
export function createAssistantActions(store,{now=()=>Date.now()}={}){
  const owns=(item,project)=>item.projectId===project.id&&item.owner===project.owner;
  const get=project=>({items:store.read('assistant_actions').filter(item=>owns(item,project)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  async function record(project,{reply,proposals,requestId,chatId=null}){
    const createdAt=iso(now());
    return store.transaction(['assistant_actions','projects','chats'],documents=>{
      if(!documents.projects.some(item=>item.id===project.id&&item.owner===project.owner))throw fail('Project not found.',404);
      if(chatId&&!documents.chats.some(item=>item.id===chatId&&owns(item,project)))throw fail('Chat not found.',404);
      const existing=documents.assistant_actions.filter(item=>owns(item,project)&&item.requestId===requestId);
      if(existing.length)return{reply,items:existing,chatId,generatedAt:createdAt};
      const own=documents.assistant_actions.filter(item=>owns(item,project));
      if(own.filter(item=>item.status==='proposed').length+proposals.length>30)throw fail('Review or dismiss your open actions before requesting more.',409);
      const items=proposals.map(item=>({id:randomUUID(),projectId:project.id,owner:project.owner,chatId,requestId,kind:item.kind,title:item.title,rationale:item.rationale,payload:normalizeAssistantPayload(item.kind,item.payload,{now:now()}),status:'proposed',revision:0,createdAt}));
      documents.assistant_actions.push(...items);return{reply,items,chatId,generatedAt:createdAt};
    });
  }
  async function change(project,id,input){
    return store.transaction(['assistant_actions','projects','content_calendar','community'],documents=>{
      const current=documents.projects.find(item=>item.id===project.id&&item.owner===project.owner);if(!current)throw fail('Project not found.',404);
      const item=documents.assistant_actions.find(item=>item.id===id&&owns(item,project));if(!item)throw fail('Action not found.',404);
      if(input.action==='apply'&&input.confirm!==true)throw fail('Review and confirm this action before continuing.');
      if(input.action==='apply'&&item.status==='applied')return{action:item,result:item.result};
      if(item.status!=='proposed')throw fail('This action is already closed. Reload the current action.',409);
      if(!Number.isSafeInteger(input.revision)||input.revision!==item.revision)throw fail('This action changed in another window. Reload before approving it.',409);
      const time=iso(now());
      if(input.action==='edit'){
        item.payload=normalizeAssistantPayload(item.kind,input.payload,{now:now()});item.title=text(input.title,120,'Action title');
      }else if(input.action==='dismiss')item.status='dismissed';
      else if(input.action==='apply'){
        const payload=normalizeAssistantPayload(item.kind,item.payload,{now:now(),ready:true});
        if(item.kind==='calendar'){
          if(documents.content_calendar.filter(row=>row.projectId===project.id).length+payload.items.length>200)throw fail('This project supports up to 200 content plans.');
          const saved=payload.items.map(plan=>({id:randomUUID(),projectId:project.id,owner:project.owner,revision:0,createdAt:time,updatedAt:time,status:'planned',...contentPlanDetails({...plan,body:plan.content},{now:now()}),assistantActionId:item.id}));
          documents.content_calendar.push(...saved);item.result={kind:'calendar',ids:saved.map(row=>row.id),message:`${saved.length} private content plan${saved.length===1?'':'s'} saved. No posts were sent.`};
        }else if(item.kind==='event'){
          let state=documents.community.find(row=>owns(row,project));
          if(!state){const links={website:current.website||'',x:current.x||'',telegram:current.telegram||'',discord:''};state={projectId:project.id,owner:project.owner,revision:0,links,sharedLinks:{...links},events:[]};documents.community.push(state);}
          if(state.events.length>=100)throw fail('This project supports up to 100 events.');
          const event={id:randomUUID(),revision:0,details:communityEventDetails(payload,{now:now()}),publishedDetails:null,status:'upcoming',createdAt:time,assistantActionId:item.id};
          state.events.unshift(event);state.revision++;item.result={kind:'event',id:event.id,message:'Private event saved. Publish it separately from Community when ready.'};
        }else{
          if(!current.tokenAddress||!current.vaultAddress)throw fail('Link an issued token and its holders vault before opening a payout review.');
          item.result={kind:'distribution',projectId:project.id,message:'Open Treasury to check the current vault and prepare a fresh holder payout. Nothing has been signed or sent.'};
        }
        item.status='applied';item.appliedAt=time;item.appliedRevision=item.revision;
      }else throw fail('Choose an available action.');
      item.revision++;item.updatedAt=time;return{action:item,...(item.result?{result:item.result}:{})};
    });
  }
  return{get,record,change,context:project=>get(project).items.slice(0,15).map(({id,kind,title,status,result})=>({id,kind,title,status,result}))};
}
