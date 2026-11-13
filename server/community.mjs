import {randomUUID} from 'node:crypto';
import {projectLink} from '../shared/project.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const iso=time=>new Date(time).toISOString();
const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)throw fail(`${label} must be under ${max} characters.`);return value.trim();};
const revision=(record,value)=>{if(!Number.isSafeInteger(value)||value!==(record.revision||0))throw fail('This changed in another window. Refresh before saving.',409);};
const legacyLinks=project=>({website:project.website||'',x:project.x||'',telegram:project.telegram||'',discord:''});
function links(input){const result={};for(const key of ['website','x','telegram','discord']){result[key]=projectLink(input?.[key],key);if(key==='discord'&&result[key]){const url=new URL(result[key]);if(!(['discord.gg','www.discord.gg'].includes(url.hostname)&&/^\/[\w-]+\/?$/.test(url.pathname))&&!(['discord.com','www.discord.com'].includes(url.hostname)&&/^\/invite\/[\w-]+\/?$/.test(url.pathname)))throw fail('Use a discord.gg or discord.com/invite invitation link.');}}return result;}

export function createCommunity(store,{now=()=>Date.now()}={}){
  const fresh=project=>({projectId:project.id,owner:project.owner,revision:0,links:legacyLinks(project),sharedLinks:legacyLinks(project),events:[]});
  const getState=project=>store.read('community').find(item=>item.projectId===project.id&&item.owner===project.owner)||fresh(project);
  const entries=(project,id)=>store.read('community_rsvps').filter(item=>item.projectId===project.id&&item.eventId===id);
  function stateFor(records,project){let state=records.find(item=>item.projectId===project.id&&item.owner===project.owner);if(!state){state=fresh(project);records.push(state);}return state;}
  function eventFor(state,id){const event=state.events.find(item=>item.id===id);if(!event)throw fail('Event not found.',404);return event;}
  function eventDetails(input){
    const title=text(input?.title,120,'Event title'),description=text(input?.description,4000,'Event description');
    if(!title||!description)throw fail('Add a title and event description.');
    const start=Date.parse(input.startsAt),end=Date.parse(input.endsAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>7*86400000||start>now()+365*86400000)throw fail('Choose valid start and end times, up to seven days apart and within a year.');
    const capacity=input.capacity===null||input.capacity===''?null:Number(input.capacity);
    if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>500))throw fail('Choose a capacity from 1 to 500, or leave it open.');
    return{title,description,startsAt:iso(start),endsAt:iso(end),url:projectLink(input.url),capacity};
  }
  function get(project){const state=getState(project);return{...state,events:state.events.map(event=>({...event,going:entries(project,event.id).length,attended:entries(project,event.id).filter(item=>item.attended).length}))};}
  async function saveLinks(project,input){await store.change('community',records=>{const state=stateFor(records,project);revision(state,input.revision);if(typeof input.share!=='boolean')throw fail('Choose whether to show the community links.');state.links=links(input.links);state.sharedLinks=input.share?{...state.links}:null;state.revision++;});return get(project);}
  async function changeEvent(project,id,input){
    await store.transaction(['community','community_rsvps','projects'],documents=>{
      const current=documents.projects.find(item=>item.id===project.id&&item.owner===project.owner);if(!current)throw fail('Project not found.',404);
      const state=stateFor(documents.community,project),time=iso(now());
      if(!id){if(state.events.length>=100)throw fail('This project supports up to 100 events.');const details=eventDetails(input.details);if(Date.parse(details.startsAt)<=now())throw fail('Choose a future start time.');state.events.unshift({id:randomUUID(),revision:0,details,publishedDetails:null,status:'upcoming',createdAt:time});state.revision++;return;}
      const event=eventFor(state,id);revision(event,input.revision);const rsvps=documents.community_rsvps.filter(item=>item.projectId===project.id&&item.eventId===id);
      if(input.action==='edit'){
        if(event.status!=='upcoming')throw fail('Closed events cannot be edited.');event.details=eventDetails(input.details);event.approved=false;
      }else if(input.action==='publish'){
        if(input.confirm!==true||event.status!=='upcoming')throw fail('Review and confirm this event before publishing.');
        if(!current.published||!current.tokenAddress)throw fail('Publish your verified project page in My Projects first.');
        if(Date.parse(event.details.startsAt)<=now())throw fail('Choose a future start time before publishing.');
        if(event.details.capacity!==null&&event.details.capacity<rsvps.length)throw fail('Capacity cannot be lower than the existing registrations.');
        event.publishedDetails={...event.details};event.publishedRevision=event.revision+1;event.publishedAt=time;
      }else if(input.action==='unpublish'){
        if(input.confirm!==true||!event.publishedDetails)throw fail('Confirm that you want to hide this event.');event.publishedDetails=null;
      }else if(input.action==='cancel'){
        if(input.confirm!==true||event.status!=='upcoming')throw fail('Confirm that you want to cancel this event.');event.cancellation=text(input.reason||'',1000,'Cancellation note');if(!event.cancellation)throw fail('Add a cancellation note.');event.status='cancelled';
      }else if(input.action==='complete'){
        if(input.confirm!==true||event.status!=='upcoming'||!event.publishedDetails||Date.parse(event.publishedDetails.startsAt)>now())throw fail('An event can be completed after its published start time.');
        event.outcome=text(input.outcome,4000,'Event outcome');if(!event.outcome)throw fail('Record what happened at the event.');if(typeof input.shareRecap!=='boolean')throw fail('Choose whether to share the recap.');event.publicRecap=input.shareRecap?event.outcome:null;event.status='completed';event.completedAt=time;
      }else if(input.action==='attendance'){
        if(!event.publishedDetails||Date.parse(event.publishedDetails.startsAt)>now()||event.status==='cancelled')throw fail('Record attendance after the event starts.');
        if(typeof input.attended!=='boolean')throw fail('Choose an attendance state.');const participant=rsvps.find(item=>item.wallet===input.wallet);if(!participant)throw fail('Registration not found.',404);participant.attended=input.attended;
      }else throw fail('Choose an available event action.');
      event.revision++;event.updatedAt=time;state.revision++;
    });return get(project);
  }
  function publicView(project,viewer=null){const state=getState(project);return{links:state.sharedLinks||{},events:state.events.filter(event=>event.publishedDetails).map(event=>{
    const members=entries(project,event.id);return{id:event.id,...event.publishedDetails,status:event.status,cancellation:event.cancellation||null,recap:event.publicRecap||null,going:members.length,attending:viewer?members.some(item=>item.wallet===viewer):false};
  })};}
  async function rsvp(project,id,wallet,input){
    if(typeof input.attending!=='boolean')throw fail('Choose whether you are attending.');
    await store.transaction(['community','community_rsvps','projects'],documents=>{
      const current=documents.projects.find(item=>item.id===project.id&&item.published&&item.tokenAddress);if(!current)throw fail('This project page is not available.',404);
      const state=documents.community.find(item=>item.projectId===project.id&&item.owner===project.owner);if(!state)throw fail('Event not found.',404);const event=eventFor(state,id);
      const list=documents.community_rsvps,index=list.findIndex(item=>item.projectId===project.id&&item.eventId===id&&item.wallet===wallet);
      if(!input.attending){if(index>=0)list.splice(index,1);return;}
      if(!event.publishedDetails||event.status!=='upcoming'||Date.parse(event.publishedDetails.startsAt)<=now())throw fail('Registration for this event is closed.');
      if(index>=0)return;const count=list.filter(item=>item.projectId===project.id&&item.eventId===id).length;
      if(count>=Math.min(event.publishedDetails.capacity??500,500))throw fail('This event is full.',409);
      list.push({projectId:project.id,eventId:id,wallet,joinedAt:iso(now()),attended:false});
    });return publicView(project,wallet);
  }
  function attendees(project,id){eventFor(getState(project),id);return entries(project,id).map(({wallet,joinedAt,attended})=>({wallet,joinedAt,attended}));}
  function context(project){const state=get(project);return{channels:state.sharedLinks||{},events:state.events.slice(0,15).map(event=>({title:event.details.title,status:event.status,startsAt:event.details.startsAt,published:!!event.publishedDetails,registrations:event.going,attendanceRecordedByCreator:event.attended,outcome:event.outcome||null})),countsAreLocalRegistrations:true,socialAudienceSizeIsUnknown:true};}
  return{get,saveLinks,changeEvent,publicView,rsvp,attendees,context};
}
