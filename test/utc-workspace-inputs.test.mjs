import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf} from './helpers/component-harness.mjs';

const noop=()=>null;
const change=(node,value)=>node.props.onChange({target:{value}});
const event={preventDefault(){}};
const button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node)===label);
const timeInput=tree=>findNode(tree,node=>node.type==='input'&&node.props.type==='datetime-local');

function nonUTCHost(t){
  const timezone=process.env.TZ,frame=globalThis.requestAnimationFrame;
  process.env.TZ='America/New_York';globalThis.requestAnimationFrame=()=>0;
  t.after(()=>{if(timezone===undefined)delete process.env.TZ;else process.env.TZ=timezone;if(frame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=frame;});
}

test('the manual post journal edits and saves UTC publication and observation times on a non-UTC host',async t=>{
  nonUTCHost(t);const calls=[];
  const post={id:'post-one',revision:4,manualPublication:{url:'https://x.com/example/status/123',postId:'123',publishedAt:'2026-11-15T23:45:00-05:00',recordedAt:'2026-11-16T04:50:00Z'}};
  const component=componentHarness(new URL('../src/ManualPostRecord.tsx',import.meta.url),'ManualPostRecord',{post,busy:false,pending:false,onDirty(){},perform:async(...args)=>{calls.push(args);return true;}},{'./DraftText':{DraftText:noop}});
  t.after(()=>component.unmount());let tree=component.render();
  assert.match(textOf(tree),/Nov 16, 2026, 4:45 AM UTC/);
  button(tree,'Edit recorded link').props.onClick();tree=component.render();
  assert.match(textOf(tree),/Publication time \(UTC, optional\)/);
  assert.equal(timeInput(tree).props.value,'2026-11-16T04:45');
  change(timeInput(tree),'2026-11-20T15:30');
  findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});
  tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit(event);
  assert.equal(calls[0][1].publishedAt,'2026-11-20T15:30:00.000Z');assert.equal(calls[0][1].revision,4);
  tree=component.render();button(tree,'Record results').props.onClick();tree=component.render();
  assert.match(textOf(tree),/Observed at \(UTC\)/);change(timeInput(tree),'2026-11-21T09:15');
  tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit(event);
  assert.equal(calls[1][1].observedAt,'2026-11-21T09:15:00.000Z');
  assert.deepEqual(calls[1][1].counts,{likes:null,replies:null,reposts:null,quotes:null,views:null});
});

test('community goal deadlines retain UTC fields across editing and keep optional dates nullable',async t=>{
  nonUTCHost(t);const calls=[];
  const goal={id:'goal-one',revision:7,status:'open',accepted:0,pending:0,details:{title:'Share a demo',description:'Explain one useful lesson.',target:10,deadline:'2026-11-15T23:45:00-05:00'}};
  const resource={data:{goals:[goal],submissions:[]},loading:false,busy:false,error:'',notice:'',conflict:false,reload:async()=>true,save:async(...args)=>{calls.push(args);return true;}};
  const component=componentHarness(new URL('../src/GrowthWorkspace.tsx',import.meta.url),'GrowthWorkspace',{project:{id:'project-one',published:false},onBlocked(){}},{'./Brand':{Arrow:noop},'./DraftText':{DraftText:noop},'./useWorkspaceData':{useWorkspaceData:()=>resource}});
  t.after(()=>component.unmount());let tree=component.render();
  findNode(tree,node=>node.type==='button'&&node.props['aria-pressed']===false).props.onClick();tree=component.render();
  assert.match(textOf(tree),/Nov 16, 2026, 4:45 AM UTC/);
  button(tree,'Edit draft').props.onClick();tree=component.render();
  assert.match(textOf(tree),/Submissions close \(UTC, optional\)/);assert.equal(timeInput(tree).props.value,'2026-11-16T04:45');
  change(timeInput(tree),'2026-11-24T18:20');tree=component.render();await findNode(tree,node=>node.type==='form').props.onSubmit(event);
  assert.equal(calls[0][0],'/goals/goal-one');assert.equal(calls[0][1].revision,7);assert.equal(calls[0][1].details.deadline,'2026-11-24T18:20:00.000Z');
  tree=component.render();button(tree,'Create a goal').props.onClick();tree=component.render();
  assert.equal(timeInput(tree).props.value,'');
  change(findNode(tree,node=>node.type==='input'&&node.props.required&&node.props.maxLength===100),'Collect useful examples');tree=component.render();
  change(findNode(tree,node=>node.type==='textarea'&&node.props.required),'Share a demo and explain what you learned.');tree=component.render();
  await findNode(tree,node=>node.type==='form').props.onSubmit(event);
  assert.equal(calls[1][0],'/goals');assert.equal(calls[1][1].details.deadline,null);
});
