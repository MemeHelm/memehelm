import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
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
        const title=typeof input.title==='string'?input.title.trim():'',body=typeof input.body==='string'?input.body.trim():'';
        const scheduled=Date.parse(input.scheduledAt);
        if(!title||title.length>120||!body||body.length>8000)throw fail('Add a title under 120 characters and content under 8,000 characters.');
        if(!['x','project','discord','telegram'].includes(input.channel))throw fail('Choose a content channel.');
        if(!Number.isFinite(scheduled)||scheduled>now()+365*86400000)throw fail('Choose a valid content date within one year.');
        if(!item){if(records.filter(row=>row.projectId===project.id).length>=200)throw fail('This project supports up to 200 content plans.');item={id:randomUUID(),projectId:project.id,owner:project.owner,revision:-1,createdAt:new Date(now()).toISOString()};records.push(item);}
        Object.assign(item,{title,body,channel:input.channel,scheduledAt:new Date(scheduled).toISOString(),status:'planned'});
      }
      item.revision++;item.updatedAt=new Date(now()).toISOString();
    });return get(project);
  }
  return {get,save,context:project=>get(project).items.filter(item=>item.status!=='cancelled').slice(-20).map(({title,channel,scheduledAt,status,outcome})=>({title,channel,scheduledAt,status,outcome}))};
}
