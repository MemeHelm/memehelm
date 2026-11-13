import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const iso=time=>new Date(time).toISOString();
export function xPostLink(value){
  let url;try{url=new URL(value);}catch{throw fail('Paste the full HTTPS link to a published X post.');}
  const path=url.pathname.match(/^\/(?:([A-Za-z0-9_]{1,15})\/status|i\/web\/status|i\/status)\/(\d{1,30})\/?$/);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)||!path)throw fail('Use an HTTPS post link from x.com or twitter.com.');
  return{postId:path[2],url:`https://x.com/${path[1]?path[1]+'/status':'i/web/status'}/${path[2]}`};
}
function note(value,max=2000){if(value==null)return'';if(typeof value!=='string'||value.length>max)throw fail(`Keep your notes within ${max} characters.`);return value.trim();}
function timestamp(value,now,required=false){
  if(value==null||value===''){if(required)throw fail('Choose when you observed these results.');return null;}
  const time=typeof value==='string'?Date.parse(value):NaN;
  if(!Number.isFinite(time)||time<0||time>now+300000)throw fail('Choose a valid date and time that is not in the future.');
  return iso(time);
}
export function createManualSocial(store,{now,records,locked,checkRevision,get}){
  function owned(list,project,id,input){const post=list.find(item=>item.id===id&&item.projectId===project.id&&item.owner===project.owner);if(!post)throw fail('Post not found.',404);checkRevision(post,input.revision);return post;}
  async function record(project,id,input){
    if(locked(project.id))throw fail('Wait for the current X request before recording a link.',409);
    if(input.confirm!==true)throw fail('Confirm that you checked the published post before saving its link.');
    const link=xPostLink(input.url),publishedAt=timestamp(input.publishedAt,now()),notes=note(input.notes);
    await store.change('social_posts',list=>{
      const post=owned(list,project,id,input);
      if(post.receipt||post.status==='published')throw fail('The confirmed X receipt is already saved. You can record results below.');
      if(!['draft','approved','failed','recorded','uncertain','sending'].includes(post.status))throw fail('This post cannot be recorded.');
      if(records(project).some(item=>item.id!==id&&(item.receipt?.id===link.postId||item.manualPublication?.postId===link.postId)))throw fail('This X post is already recorded in your project. Open its existing entry.');
      if(post.manualPublication)post.publicationHistory=[post.manualPublication,...(post.publicationHistory||[])].slice(0,10);
      post.manualPublication={...link,publishedAt,notes,recordedAt:iso(now()),source:'creator',verification:'unverified'};
      post.status='recorded';post.revision++;post.updatedAt=iso(now());
      delete post.approvedAccount;delete post.approvedGeneration;delete post.error;
    });return get(project);
  }
  async function report(project,id,input){
    const observedAt=timestamp(input.observedAt,now(),true),notes=note(input.notes),counts={};
    for(const name of ['likes','replies','reposts','quotes','views']){
      const value=input.counts?.[name];
      if(value==null||value==='')counts[name]=null;
      else if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw fail('Enter whole numbers of zero or more. Leave unknown results blank.');
      else counts[name]=value;
    }
    if(!notes&&Object.values(counts).every(value=>value===null))throw fail('Add at least one result or a note about what happened.');
    await store.change('social_posts',list=>{
      const post=owned(list,project,id,input),target=post.manualPublication||post.receipt;
      if(!target)throw fail('Record the published post link before adding results.');
      if(post.manualPublication?.publishedAt&&Date.parse(observedAt)<Date.parse(post.manualPublication.publishedAt))throw fail('Results cannot be observed before the recorded publication time.');
      const result={id:randomUUID(),postId:target.postId||target.id,url:target.url,counts,notes,observedAt,recordedAt:iso(now()),source:'creator',verification:'unverified'};
      post.manualReports=[result,...(post.manualReports||[])].slice(0,30);post.revision++;post.updatedAt=iso(now());
    });return get(project);
  }
  return{record,report};
}
