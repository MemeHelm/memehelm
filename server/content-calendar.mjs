import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function contentPlanDetails(input,{now=Date.now()}={}){
  const title=typeof input.title==='string'?input.title.trim():'',body=typeof input.body==='string'?input.body.trim():'';
  const scheduled=Date.parse(input.scheduledAt);
  if(!title||title.length>120||!body||body.length>8000)throw fail('Add a title under 120 characters and content under 8,000 characters.');
  if(!['x','project','discord','telegram'].includes(input.channel))throw fail('Choose a content channel.');
  if(!Number.isFinite(scheduled)||scheduled>now+365*86400000)throw fail('Choose a valid content date within one year.');
  return{title,body,channel:input.channel,scheduledAt:new Date(scheduled).toISOString()};
}
export function createContentCalendar(store,{now=()=>Date.now()}={}){
  const get=project=>({items:store.read('content_calendar').filter(item=>item.projectId===project.id&&item.owner===project.owner).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))});
  async function save(project,id,input){
    await store.change('content_calendar',records=>{
      let item=id?records.find(item=>item.id===id&&item.projectId===project.id&&item.owner===project.owner):null;
      if(id&&!item)throw fail('Content plan not found.',404);
      if(item&&input.revision!==item.revision)throw fail('This plan changed in another window. Copy your edits, then reload.',409);
      if(input.action==='cancel'){if(!item||item.status!=='planned')throw fail('Only planned content can be cancelled.');item.status='cancelled';}
      else if(input.action==='complete'){
        if(!item||item.status!=='planned')throw fail('Only planned content can be completed.');
        if(typeof input.outcome!=='string'||!input.outcome.trim()||input.outcome.length>2000)throw fail('Record an outcome under 2,000 characters.');
        item.status='done';item.outcome=input.outcome.trim();item.completedAt=new Date(now()).toISOString();
      }else{
        if(item&&item.status!=='planned')throw fail('Only planned content can be edited.');
        const details=contentPlanDetails(input,{now:now()});
        if(!item){if(records.filter(row=>row.projectId===project.id).length>=200)throw fail('This project supports up to 200 content plans.');item={id:randomUUID(),projectId:project.id,owner:project.owner,revision:-1,createdAt:new Date(now()).toISOString()};records.push(item);}
        Object.assign(item,{...details,status:'planned'});
      }
      item.revision++;item.updatedAt=new Date(now()).toISOString();
    });return get(project);
  }
  function context(project){
    const items=get(project).items,completed=items.filter(item=>item.status==='done').sort((a,b)=>(b.completedAt||b.updatedAt||b.scheduledAt).localeCompare(a.completedAt||a.updatedAt||a.scheduledAt));
    // Reserve room for recent results even when the calendar contains many future plans.
    const planned=items.filter(item=>item.status==='planned').slice(0,20-Math.min(8,completed.length));
    return [...planned,...completed.slice(0,20-planned.length)].map(({title,channel,scheduledAt,status,outcome,completedAt})=>({title,channel,scheduledAt,status,outcome,completedAt,...(status==='done'?{outcomeSource:'creator',outcomeVerified:false}:{})}));
  }
  return {get,save,context};
}
