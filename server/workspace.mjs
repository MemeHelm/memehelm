import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export function createWorkspaceStore(directory){
  let pending=Promise.resolve();
  async function read(name){try{return JSON.parse(await readFile(resolve(directory,name+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
  async function write(name,records){await mkdir(directory,{recursive:true});const target=resolve(directory,name+'.json');await writeFile(target+'.tmp',JSON.stringify(records,null,2));await rename(target+'.tmp',target);}
  function change(name,fn){const result=pending.then(async()=>{const records=await read(name),value=await fn(records);await write(name,records);return value;});pending=result.catch(()=>{});return result;}
  return {
    projects:()=>read('projects'),
    mutateProjects:fn=>change('projects',fn),
    async activity(projectId,{publicOnly=false}={}){return (await read('activity')).filter(item=>item.projectId===projectId&&(!publicOnly||item.public)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);},
    appendActivity(projectId,entry){return change('activity',records=>{const item={...entry,id:randomUUID(),projectId,createdAt:entry.createdAt||new Date().toISOString(),public:!!entry.public};records.push(item);const own=records.filter(record=>record.projectId===projectId);const remove=new Set(own.slice(0,Math.max(0,own.length-200)).map(record=>record.id));for(let index=records.length-1;index>=0;index--)if(remove.has(records[index].id))records.splice(index,1);return item;});},
    publishActivity(projectId,id,isPublic){return change('activity',records=>{const entry=records.find(item=>item.id===id&&item.projectId===projectId);if(!entry)throw new Error('Update not found.');entry.public=isPublic;return entry;});},
  };
}
