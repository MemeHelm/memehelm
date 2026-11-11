import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export function createWorkspaceStore(directory){
  mkdirSync(directory,{recursive:true});
  const filename=resolve(directory,'workspace.sqlite');
  function connection(){const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, value TEXT NOT NULL)');return db;}
  const db=connection();
  try{for(const name of ['projects','activity']){const old=resolve(directory,name+'.json');if(existsSync(old)&&!db.prepare('SELECT name FROM documents WHERE name=?').get(name))db.prepare('INSERT INTO documents VALUES (?,?)').run(name,readFileSync(old,'utf8'));}}finally{db.close();}
  function read(name){const db=connection();try{const row=db.prepare('SELECT value FROM documents WHERE name=?').get(name);return row?JSON.parse(row.value):[];}finally{db.close();}}
  function change(name,fn){const db=connection();try{db.exec('BEGIN IMMEDIATE');const row=db.prepare('SELECT value FROM documents WHERE name=?').get(name),records=row?JSON.parse(row.value):[];const result=fn(records);if(result?.then)throw new Error('Store transactions must be synchronous.');db.prepare('INSERT INTO documents VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(name,JSON.stringify(records));db.exec('COMMIT');return Promise.resolve(result);}catch(error){try{db.exec('ROLLBACK');}catch{}return Promise.reject(error);}finally{db.close();}}
  return {
    read,change,
    projects:async()=>read('projects'),
    mutateProjects:fn=>change('projects',fn),
    async activity(projectId,{publicOnly=false}={}){return (await read('activity')).filter(item=>item.projectId===projectId&&(!publicOnly||item.public)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);},
    appendActivity(projectId,entry){return change('activity',records=>{const item={...entry,id:randomUUID(),projectId,createdAt:entry.createdAt||new Date().toISOString(),public:!!entry.public};records.push(item);const own=records.filter(record=>record.projectId===projectId);const remove=new Set(own.slice(0,Math.max(0,own.length-200)).map(record=>record.id));for(let index=records.length-1;index>=0;index--)if(remove.has(records[index].id))records.splice(index,1);return item;});},
    publishActivity(projectId,id,isPublic){return change('activity',records=>{const entry=records.find(item=>item.id===id&&item.projectId===projectId);if(!entry)throw new Error('Update not found.');entry.public=isPublic;return entry;});},
  };
}
