import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as choreography from '../src/mate/choreography.ts';
import {flightGeometry,mateTime,MATE_DURATION,MATE_DEADLINE,MATE_REVEAL,MATE_LAND,mateStage} from '../src/mate/choreography.ts';
import {resolveMateAnchor} from '../src/mate/landing-target.ts';
import {componentHarness,findNode,settle} from './helpers/component-harness.mjs';

test('MATE completes its story in five and a half seconds and every exit remains within six seconds',()=>{
 assert.equal(MATE_DURATION,5500);assert.equal(MATE_REVEAL,4.35);assert.equal(MATE_LAND,5.15);
 assert.ok(MATE_REVEAL<MATE_LAND&&MATE_LAND*1000<MATE_DURATION);
 assert.ok(MATE_DEADLINE>MATE_DURATION);assert.ok(MATE_DEADLINE+180<=6000,'even the safety deadline and exit must fit the requested six-second maximum');
 assert.ok(mateTime(8)-mateTime(4.6)>mateTime(9)-mateTime(8),'the assembly receives more time than its quiet identity hold');
 const poses=[0,.12,1.2,1.85,2.48,3.4,4.6,7.78,8,9,10.6,12.4,14.2,14.98,15].map(mateTime);
 assert.ok(poses.every((at,index)=>at>=0&&at<=MATE_DURATION/1000&&(index===0||at>poses[index-1])));
 assert.equal(mateStage(MATE_REVEAL),'landing');assert.equal(mateStage(MATE_LAND),'settle');assert.equal(mateStage(MATE_DURATION/1000),'settle');
});

test('the flight ends centered and contained in the visible welcome mascot or mobile MATE control',()=>{
 for(const layout of [
  {width:1440,height:900,actorWidth:300,actorHeight:364.286,target:{x:1170,y:214,width:100,height:120}},
  {width:1280,height:720,actorWidth:300,actorHeight:364.286,target:{x:1095,y:195,width:80,height:100}},
  {width:768,height:1024,actorWidth:230.4,actorHeight:279.77,target:{x:620,y:62,width:80,height:44}},
  {width:390,height:844,actorWidth:220,actorHeight:267.143,target:{x:258,y:62,width:64,height:44}},
  {width:320,height:568,actorWidth:220,actorHeight:267.143,target:{x:207,y:62,width:56,height:44}},
  {width:1280,height:400,actorWidth:180,actorHeight:218.571,target:{x:1100,y:142,width:70,height:84}},
 ]){
  const path=flightGeometry(layout),{target}=layout;
  assert.ok(Number.isFinite(path.scale)&&path.scale>0);
  assert.ok(Math.abs(layout.width*.5+path.x-(target.x+target.width/2))<1e-8);
  assert.ok(Math.abs(layout.height*.44+path.y-(target.y+target.height/2))<1e-8);
  assert.ok(layout.actorWidth*path.scale<=target.width+1e-8);assert.ok(layout.actorHeight*path.scale<=target.height+1e-8);
  assert.ok(layout.width*.5+path.portalX+65<layout.width);
 }
});

test('changing from a welcome mascot to the collapsed MATE control retargets the endpoint',()=>{
 const layout={width:1280,height:720,actorWidth:300,actorHeight:364.286};
 const expanded=flightGeometry({...layout,target:{x:1095,y:195,width:80,height:100}}),compact=flightGeometry({...layout,target:{x:1120,y:62,width:64,height:44}});
 assert.ok(compact.scale<expanded.scale);assert.notEqual(compact.x,expanded.x);assert.notEqual(compact.y,expanded.y);assert.equal(compact.portalX,expanded.portalX);
});

const selectors=['#workspace-mate-panel [data-mate-landing="welcome"]','#workspace-mate-panel [data-mate-landing="identity"]','button[aria-controls="workspace-mate-panel"]','[aria-label="Open MATE assistant"]'];
function anchorDocument(entries){
 const doc={defaultView:{getComputedStyle:node=>({display:node.display||'block',visibility:node.visibility||'visible',opacity:node.opacity??'1'})},querySelectorAll:selector=>entries[selector]||[]};
 for(const nodes of Object.values(entries))for(const node of nodes)node.ownerDocument=doc;
 return doc;
}
function anchor(overrides={}){return{hidden:false,display:'block',visibility:'visible',rect:{x:1160,y:200,left:1160,top:200,right:1240,bottom:300,width:80,height:100},getBoundingClientRect(){return this.rect;},getClientRects(){return this.hidden?[]:[this.rect];},closest(selector){return selector==='[hidden]'&&this.hidden?this:null;},...overrides};}

test('visible welcome MATE wins over identity, toggle and the dock even during the inert entrance',()=>{
 const welcome=anchor({opacity:'0',inert:true,ariaHidden:true}),identity=anchor(),toggle=anchor(),dock=anchor(),doc=anchorDocument({[selectors[0]]:[welcome],[selectors[1]]:[identity],[selectors[2]]:[toggle],[selectors[3]]:[dock]});
 assert.equal(resolveMateAnchor(doc,{width:1440,height:900}),welcome,'pending handoff opacity, aria-hidden and inert do not make the visually revealed desktop ineligible');
 welcome.hidden=true;assert.equal(resolveMateAnchor(doc,{width:1440,height:900}),identity);identity.hidden=true;assert.equal(resolveMateAnchor(doc,{width:1440,height:900}),toggle);
 toggle.hidden=true;assert.equal(resolveMateAnchor(doc,{width:1440,height:900}),dock);dock.hidden=true;assert.equal(resolveMateAnchor(doc,{width:1440,height:900}),null);
});

test('landing selection ignores stale hidden, zero-size, invisible and offscreen anchors',()=>{
 const hidden=anchor({hidden:true}),none=anchor({display:'none'}),invisible=anchor({visibility:'hidden'}),collapsed=anchor({visibility:'collapse'}),zero=anchor({rect:{x:0,y:0,left:0,top:0,right:0,bottom:0,width:0,height:0}}),outside=anchor({rect:{x:500,y:900,left:500,top:900,right:580,bottom:1000,width:80,height:100}}),toggle=anchor({rect:{x:258,y:62,left:258,top:62,right:322,bottom:106,width:64,height:44}});
 const doc=anchorDocument({[selectors[0]]:[hidden,none,invisible,collapsed,zero,outside],[selectors[2]]:[toggle]});
 assert.equal(resolveMateAnchor(doc,{width:390,height:844}),toggle);
 outside.rect={x:360,y:200,left:360,top:200,right:440,bottom:300,width:80,height:100};assert.equal(resolveMateAnchor(doc,{width:390,height:844}),outside,'a partially intersecting welcome target is visible');
});

function loaderFixture(t,{reduced=false,fullMotion=false,setupFailure=false}={}){
 const previous={window:globalThis.window,document:globalThis.document},timers=new Map();let nextId=0,done=0,reveals=0,created=0,disposed=0,sequence;
 const preference=new EventTarget();preference.matches=reduced;
 const doc=new EventTarget();doc.querySelectorAll=()=>[];doc.querySelector=()=>null;
 globalThis.document=doc;globalThis.window={innerWidth:1440,innerHeight:900,matchMedia:()=>preference,setTimeout:(callback,delay)=>{timers.set(++nextId,{callback,delay});return nextId;},clearTimeout:id=>timers.delete(id)};
 const component=componentHarness(new URL('../src/EntryLoader.tsx',import.meta.url),'EntryLoader',{onDone:()=>done++,onReveal:()=>reveals++,fullMotion},{'./Brand':{Arrow:()=>null},'./mate/MateStory':{MateStory:()=>null},'./mate/choreography':{MATE_DEADLINE,MATE_REVEAL,mateStage},'./mate/landing-target':{resolveMateAnchor},'./mate/sequence':{createMateSequence:(_surface,options)=>{created++;sequence=options;if(setupFailure)throw new Error('Illustrative animation setup failure');return{dispose:()=>disposed++};}}});
 const tree=component.render();tree.props.ref.current={dataset:{}};component.effects();
 t.after(()=>{component.unmount();for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 function runTimer(delay){const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry,'Expected a scheduled '+delay+'ms timer');timers.delete(entry[0]);entry[1].callback();}
 return{component,tree,timers,preference,doc,runTimer,get sequence(){return sequence;},counts:()=>({done,reveals,created,disposed})};
}

test('the entrance reveals once and Escape or repeated completion exits only once',async t=>{
 const fixture=loaderFixture(t);await settle();assert.equal(fixture.counts().created,1);
 fixture.sequence.onFrame(MATE_REVEAL-.01);assert.equal(fixture.counts().reveals,0);fixture.sequence.onFrame(MATE_REVEAL);fixture.sequence.onFrame(MATE_REVEAL+.1);assert.equal(fixture.counts().reveals,1);
 const escape=new Event('keydown',{cancelable:true});Object.defineProperty(escape,'key',{value:'Escape'});fixture.doc.dispatchEvent(escape);assert.equal(escape.defaultPrevented,true);
 fixture.sequence.onComplete();findNode(fixture.component.render(),node=>node.type==='button').props.onClick();fixture.runTimer(180);assert.equal(fixture.counts().done,1);
 fixture.component.unmount();assert.equal(fixture.counts().disposed,1);assert.equal(fixture.timers.size,0);
});

test('reduced motion releases the workspace without starting the story',async t=>{
 const fixture=loaderFixture(t,{reduced:true});await settle();assert.equal(fixture.counts().created,0);fixture.runTimer(0);assert.equal(fixture.counts().done,1);fixture.component.unmount();assert.equal(fixture.timers.size,0);
});

test('an explicit full-motion replay honors its request and reacts to a new reduced-motion preference',async t=>{
 const fixture=loaderFixture(t,{reduced:true,fullMotion:true});await settle();assert.equal(fixture.counts().created,1);assert.equal(fixture.counts().done,0);
 fixture.preference.dispatchEvent(new Event('change'));fixture.runTimer(180);assert.equal(fixture.counts().done,1);
});

test('a runtime animation failure releases the workspace and cleans up',async t=>{
 const fixture=loaderFixture(t);await settle();fixture.sequence.onFailure();fixture.runTimer(180);assert.equal(fixture.counts().done,1);fixture.component.unmount();assert.equal(fixture.timers.size,0);
});

test('the safety deadline bounds a story that never reports completion',async t=>{
 const fixture=loaderFixture(t);await settle();fixture.runTimer(MATE_DEADLINE);fixture.runTimer(180);assert.equal(fixture.counts().done,1);fixture.component.unmount();assert.equal(fixture.counts().disposed,1);assert.equal(fixture.timers.size,0);
});

test('animation setup failure falls back to entering the workspace',async t=>{
 const fixture=loaderFixture(t,{setupFailure:true});await settle();assert.equal(fixture.counts().created,1);fixture.runTimer(1800);fixture.runTimer(180);assert.equal(fixture.counts().done,1);fixture.component.unmount();assert.equal(fixture.timers.size,0);
});

test('an unmounted entrance cancels timers and never starts its delayed animation module',async t=>{
 const fixture=loaderFixture(t);fixture.component.unmount();await settle();assert.equal(fixture.counts().created,0);assert.equal(fixture.counts().done,0);assert.equal(fixture.timers.size,0);
});


function sequenceFixture(t,{failOnFrame=false}={}){
 const previous=Object.fromEntries(['document','getComputedStyle','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','DOMRect'].map(key=>[key,globalThis[key]])),nodes=new Map(),animations=[],clones=[],frames=new Map(),observed=new Set();let frameId=0,failed=0,selected;
 const rect=(x,y,width,height)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
 function node(name){
  const attributes=new Map();
  const item={name,style:{},offsetWidth:name==='[data-mate-portal]'?190:300,offsetHeight:name==='[data-mate-portal]'?248:364.286,parentNode:{insertBefore(){}},removed:false,
   get attributes(){return[...attributes].map(([name,value])=>({name,value}));},getAttribute:key=>attributes.get(key)??null,setAttribute:(key,value)=>attributes.set(key,String(value)),removeAttribute:key=>attributes.delete(key),
   querySelector:selector=>get(name+' '+selector),querySelectorAll:()=>[],getBBox:()=>({x:0,y:0,width:20,height:10}),getBoundingClientRect:()=>rect(0,0,1280,720),remove(){this.removed=true;},
   cloneNode(){const clone=node(name+' clone');clones.push(clone);return clone;},
   animate(keyframes,options){const animation={node:item,keyframes,options,currentTime:0,cancelled:false,finished:new Promise(()=>{}),effect:{setKeyframes(next){animation.keyframes=next;}},cancel(){this.cancelled=true;}};animations.push(animation);return animation;}
  };return item;
 }
 function get(name){if(!nodes.has(name))nodes.set(name,node(name));return nodes.get(name);}
 const surface=get('surface');surface.querySelector=get;
 const first=node('welcome');first.getBoundingClientRect=()=>rect(1095,195,80,100);first.setAttribute('data-mate-arrival','previous-value');selected=first;
 globalThis.document={timeline:{currentTime:0}};globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(item){observed.add(item);}unobserve(item){observed.delete(item);}disconnect(){observed.clear();}};
 globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);globalThis.DOMRect=class{constructor(x,y,width,height){Object.assign(this,rect(x,y,width,height));}};
 const source=ts.transpileModule(readFileSync(new URL('../src/mate/sequence.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,module={exports:{}};
 new Function('require','module','exports',source)(name=>name==='./choreography'?choreography:{},module,module.exports);
 const controller=module.exports.createMateSequence(surface,{anchor:()=>selected,onFrame:()=>{if(failOnFrame)throw new Error('Illustrative frame failure');},onComplete(){},onFailure:()=>failed++});
 t.after(()=>{controller.dispose();for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const advance=seconds=>{for(const animation of animations)animation.currentTime=seconds*1000;const next=frames.entries().next().value;assert.ok(next,'The running story should schedule a frame');frames.delete(next[0]);next[1]();};
 return{controller,first,animations,clones,observed,frames,advance,failed:()=>failed,retarget:()=>{const next=node('toggle');next.getBoundingClientRect=()=>rect(1120,62,64,44);selected=next;return next;},clearTarget:()=>{selected=null;}};
}

test('the real sequence hands off to the live target and restores attributes, observers and animations on disposal',t=>{
 const fixture=sequenceFixture(t);assert.equal(fixture.first.getAttribute('data-mate-arrival'),'pending');assert.ok(fixture.observed.has(fixture.first));
 const toggle=fixture.retarget();fixture.advance(MATE_REVEAL);assert.equal(fixture.first.getAttribute('data-mate-arrival'),'previous-value');assert.equal(fixture.observed.has(fixture.first),false);assert.equal(toggle.getAttribute('data-mate-arrival'),'pending');assert.ok(fixture.observed.has(toggle));
 fixture.advance(MATE_LAND+.2);assert.equal(toggle.getAttribute('data-mate-arrival'),'settled');fixture.controller.dispose();assert.equal(toggle.getAttribute('data-mate-arrival'),null);assert.equal(fixture.first.getAttribute('data-mate-arrival'),'previous-value');assert.equal(fixture.observed.size,0);assert.equal(fixture.frames.size,0);assert.ok(fixture.animations.every(animation=>animation.cancelled));assert.ok(fixture.clones.every(clone=>clone.removed));
});

test('a real sequence frame failure releases its pending target and all animation resources',t=>{
 const fixture=sequenceFixture(t,{failOnFrame:true});fixture.advance(.1);assert.equal(fixture.failed(),1);assert.equal(fixture.first.getAttribute('data-mate-arrival'),'previous-value');assert.equal(fixture.frames.size,0);assert.equal(fixture.observed.size,0);assert.ok(fixture.animations.every(animation=>animation.cancelled));assert.ok(fixture.clones.every(clone=>clone.removed));
});
