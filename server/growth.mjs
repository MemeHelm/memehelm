import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const stamp=time=>new Date(time).toISOString();
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(`Enter ${label} between 1 and ${max} characters.`);return value.trim();}
function revision(record,value){if(!Number.isSafeInteger(value)||value!==record.revision)throw fail('This changed in another window. Copy your edits, then reload the saved version.',409);}
function link(value){if(!value)return '';let url;try{url=new URL(value);}catch{throw fail('Use a complete HTTPS evidence link.');}if(url.protocol!=='https:'||url.username||url.password||url.href.length>2000)throw fail('Use a complete HTTPS evidence link without credentials.');return url.href;}
function details(input,now){
  const title=text(input?.title,100,'a goal title'),description=text(input?.description,3000,'the contribution instructions');
  if(!Number.isSafeInteger(input.target)||input.target<1||input.target>500)throw fail('Choose a target from 1 to 500 approved contributions.');
  const deadline=input.deadline?Date.parse(input.deadline):null;
  if(deadline!==null&&(!Number.isFinite(deadline)||deadline<=now||deadline>now+365*86400000))throw fail('Choose a future closing date within one year.');
  return {title,description,target:input.target,deadline:deadline===null?null:stamp(deadline)};
}

// Private drafts and public snapshots are separate. Contributions never transfer funds.
export function createGrowth(store,{now=()=>Date.now()}={}){
  const stateFor=(records,project)=>{let state=records.find(item=>item.projectId===project.id&&item.owner===project.owner);if(!state){state={projectId:project.id,owner:project.owner,goals:[]};records.push(state);}return state;};
  const read=project=>store.read('growth').find(item=>item.projectId===project.id&&item.owner===project.owner)||{goals:[]};
  const submissions=(project,id)=>store.read('contributions').filter(item=>item.projectId===project.id&&(!id||item.goalId===id));
  const goalFor=(state,id)=>{const goal=state.goals.find(item=>item.id===id);if(!goal)throw fail('Community goal not found.',404);return goal;};
  function get(project){return{goals:read(project).goals.map(goal=>({...goal,accepted:submissions(project,goal.id).filter(item=>item.status==='accepted').length,pending:goal.status==='open'?submissions(project,goal.id).filter(item=>item.status==='pending').length:0})),submissions:submissions(project)};}
  function publicView(project,wallet){
    if(!project.published||!project.tokenAddress)return {goals:[],scoreboard:[]};
    const all=submissions(project),visible=read(project).goals.filter(item=>item.published);
    const visibleIds=new Set(visible.map(item=>item.id)),scores=new Map();
    for(const item of all.filter(item=>visibleIds.has(item.goalId)&&item.status==='accepted'&&item.share)){
      const score=scores.get(item.wallet)||{alias:item.alias,points:0};score.points++;scores.set(item.wallet,score);
    }
    return{
      goals:visible.map(goal=>{const entries=all.filter(item=>item.goalId===goal.id),own=entries.find(item=>item.wallet===wallet);return {
        id:goal.id,...goal.published,status:goal.status,publishedAt:goal.publishedAt,completedAt:goal.completedAt||null,
        accepted:entries.filter(item=>item.status==='accepted').length,recap:goal.sharedRecap||null,
        mySubmission:own?{id:own.id,status:own.status,revision:own.revision,note:own.note,url:own.url,alias:own.alias,share:own.share,reviewNote:own.reviewNote||'',submittedAt:own.submittedAt}:null,
        contributions:entries.filter(item=>item.status==='accepted'&&item.share).map(({id,alias,note,url,reviewedAt})=>({id,alias,note,url,reviewedAt})),
      };}),scoreboard:[...scores.values()].sort((a,b)=>b.points-a.points||a.alias.localeCompare(b.alias)).slice(0,50),
    };
  }
  async function change(project,id,input){
    await store.transaction(['growth','projects','contributions'],documents=>{
      const current=documents.projects.find(item=>item.id===project.id&&item.owner===project.owner);if(!current)throw fail('Project not found.',404);
      const state=stateFor(documents.growth,project);
      if(!id){if(state.goals.length>=50)throw fail('This project supports up to 50 community goals.');state.goals.unshift({id:randomUUID(),details:details(input.details,now()),revision:0,status:'open',createdAt:stamp(now()),published:null});return;}
      const goal=goalFor(state,id);revision(goal,input.revision);
      if(input.action==='edit'){
        if(goal.status!=='open')throw fail('Only open goals can be edited.');goal.details=details(input.details,now());
      }else if(input.action==='publish'){
        if(input.confirm!==true)throw fail('Review and confirm the goal before publishing.');
        if(!current.published||!current.tokenAddress)throw fail('Publish your verified project page before sharing a goal.');
        if(goal.status!=='open')throw fail('Only open goals can be published.');
        if(goal.details.deadline&&Date.parse(goal.details.deadline)<=now())throw fail('Update the closing date before publishing.');
        const accepted=documents.contributions.filter(item=>item.projectId===project.id&&item.goalId===id&&item.status==='accepted').length;
        if(goal.details.target<accepted)throw fail('The target cannot be below the approved contribution count.');
        // Once someone contributes, keep the published instructions and points contract stable.
        if(goal.lockedDetails&&JSON.stringify(goal.lockedDetails)!==JSON.stringify(goal.details))throw fail('This goal already has contributions. Create a new goal to change its instructions.');
        goal.published={...goal.details};goal.publishedAt=stamp(now());
      }else if(input.action==='hide'){goal.published=null;
      }else if(input.action==='complete'){
        if(goal.status!=='open'||input.confirm!==true)throw fail('Confirm completion of an open goal.');
        goal.recap=text(input.recap,2000,'a factual recap');goal.sharedRecap=input.shareRecap===true?goal.recap:null;goal.status='completed';goal.completedAt=stamp(now());
      }else if(input.action==='recap'){
        if(goal.status!=='completed'||input.confirm!==true)throw fail('Confirm the recap you want to share.');
        goal.recap=text(input.recap,2000,'a factual recap');goal.sharedRecap=input.shareRecap===true?goal.recap:null;
      }else throw fail('Choose a valid goal action.');
      goal.revision++;goal.updatedAt=stamp(now());
    });return get(project);
  }
  async function submit(project,id,wallet,input){
    await store.transaction(['growth','projects','contributions'],documents=>{
      const current=documents.projects.find(item=>item.id===project.id&&item.owner===project.owner&&item.published&&item.tokenAddress);if(!current)throw fail('This project page is unavailable.',404);
      const state=stateFor(documents.growth,project),goal=goalFor(state,id);
      if(!goal.published)throw fail('This community goal is unavailable.',404);
      const list=documents.contributions;let item=list.find(entry=>entry.projectId===project.id&&entry.goalId===id&&entry.wallet===wallet);
      if(input.action==='withdraw'){
        if(!item)throw fail('Contribution not found.',404);revision(item,input.revision);item.status='withdrawn';item.share=false;item.revision++;return;
      }
      if(goal.status!=='open'||goal.published.deadline&&Date.parse(goal.published.deadline)<=now())throw fail('Submissions for this goal are closed.');
      if(item){revision(item,input.revision);if(item.status==='accepted')throw fail('An approved contribution cannot be edited. Withdraw it first.');}
      else if(list.filter(entry=>entry.projectId===project.id&&entry.goalId===id).length>=500)throw fail('This goal has reached its submission limit.');
      const fields={note:text(input.note,2000,'your contribution'),url:link(input.url),alias:text(input.alias,40,'a display name'),share:input.share===true};
      goal.lockedDetails||={...goal.published};
      if(!item){item={id:randomUUID(),projectId:project.id,goalId:id,wallet,revision:-1};list.push(item);}
      Object.assign(item,fields,{status:'pending',submittedAt:stamp(now()),reviewNote:'',reviewedAt:null});item.revision++;
    });return publicView(project,wallet);
  }
  async function review(project,id,input){
    await store.transaction(['growth','projects','contributions'],documents=>{
      if(!documents.projects.some(item=>item.id===project.id&&item.owner===project.owner))throw fail('Project not found.',404);
      const item=documents.contributions.find(entry=>entry.id===id&&entry.projectId===project.id);if(!item)throw fail('Contribution not found.',404);
      revision(item,input.revision);const goal=goalFor(stateFor(documents.growth,project),item.goalId);
      if(item.status!=='pending'||goal.status!=='open')throw fail('Only pending contributions to an open goal can be reviewed.');
      if(!['accept','decline'].includes(input.action)||input.confirm!==true)throw fail('Review and confirm this contribution.');
      const note=text(input.note,1000,'your review note');item.status=input.action==='accept'?'accepted':'declined';item.reviewNote=note;item.reviewedAt=stamp(now());item.revision++;
    });return get(project);
  }
  function context(project){return{goals:get(project).goals.map(goal=>({title:goal.details.title,description:goal.details.description,status:goal.status,target:goal.details.target,approvedByCreator:goal.accepted,pending:goal.pending,deadline:goal.details.deadline,recap:goal.recap||null})).slice(0,15),pointsAreNonFinancial:true,approvalIsCreatorJudgment:true};}
  return {get,change,submit,review,publicView,context};
}
