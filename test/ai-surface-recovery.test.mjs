import test from 'node:test';
import assert from 'node:assert/strict';
import * as viem from 'viem';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';

const noop=()=>null,button=(tree,label)=>findNode(tree,node=>node.type==='button'&&textOf(node)===label);
class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
function globals(){const saved={localStorage:globalThis.localStorage,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};return()=>{for(const[key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}};}
const draft=()=>({name:'Orbit',symbol:'ORB',description:'Builders community.',image:'',website:'',x:'',telegram:'',creatorFeeRecipient:'0x1111111111111111111111111111111111111111',creatorTaxBps:0,configId:0,splitEnabled:false,holdersEnabled:false,socialEnabled:false,projectTreasury:'',auditTreasury:'',auditBps:1000,vaultAddress:'',snipeTaxExemptions:[]});
const options={aiConfigured:true,configs:[],maxCreatorTaxBps:1000,feeETH:'0',canLaunch:true};
function launchHarness(code){
  let calls=0;const resets=[],requests=[],props={draft:draft(),patch:()=>{},wallet:'0x1111111111111111111111111111111111111111',busy:'',prepared:null,reviewed:false,setReviewed(){},connect:async()=>{},deploy:async()=>{},save:async()=>{},prepare:async()=>{},launch:async()=>{},assist:async()=>{calls++;throw new ApiError('Illustrative request interruption.',409,code);}};
  const harness=componentHarness(new URL('../src/LaunchWizard.tsx',import.meta.url),'LaunchWizard',props,{'viem':viem,'./Brand':{Arrow:noop,TokenPlaceholder:noop},'../shared/project.mjs':{imageSource:value=>value},'../shared/launch-steps.mjs':{launchStepErrors:()=>({})},'./api':{ApiError,api:async(path,body)=>{if(path==='/launch/options')return options;requests.push({path,body});return{task:'identity',candidates:[{name:'New Orbit',symbol:'NEW',story:'New idea.'}]};},resetAIRequest:async(path,body)=>resets.push({path,body})}});
  return{harness,props,resets,requests,calls:()=>calls};
}

test('interrupted launch assistance requires checking saved work and consent before a fresh exact request',async()=>{
  const restore=globals(),f=launchHarness('AI_REQUEST_INTERRUPTED');
  try{let tree=f.harness.render();f.harness.effects();await settle();tree=f.harness.render();
    findNode(tree,node=>node.type==='input'&&node.props['aria-label']==='Describe your coin idea for Copilot').props.onChange({target:{value:'A builders coin'}});tree=f.harness.render();await button(tree,'Draft identities').props.onClick();tree=f.harness.render();
    assert.equal(f.calls(),1);assert.equal(f.resets.length,0);assert.equal(button(tree,'Start a new request').props.disabled,true);assert.equal(button(tree,'Draft identities').props.disabled,true);
    button(tree,'Check draft & suggestions').props.onClick();tree=f.harness.render();assert.match(textOf(tree),/original identity request: A builders coin/);assert.equal(f.resets.length,0);
    const checkbox=findNode(tree,node=>node.type==='input'&&node.props.type==='checkbox');assert.equal(checkbox.props.disabled,false);checkbox.props.onChange({target:{checked:true}});tree=f.harness.render();assert.equal(button(tree,'Start a new request').props.disabled,false);
    const original={task:'identity',idea:'A builders coin',draft:{name:'Orbit',symbol:'ORB',description:'Builders community.',website:'',x:'',telegram:'',configId:0}};
    await button(tree,'Start a new request').props.onClick();await settle();tree=f.harness.render();assert.deepEqual(f.resets,[{path:'/launch/assist',body:original}]);assert.deepEqual(f.requests,[{path:'/launch/assist',body:original}]);assert.match(textOf(tree),/New Orbit/);
  }finally{f.harness.unmount();restore();}
});

test('pending launch assistance retries the original request without resetting its billing identity',async()=>{
  const restore=globals(),f=launchHarness('AI_REQUEST_PENDING');
  try{let tree=f.harness.render();f.harness.effects();await settle();tree=f.harness.render();await button(tree,'Draft identities').props.onClick();tree=f.harness.render();assert.equal(button(tree,'Start a new request'),null);await button(tree,'Retry original request').props.onClick();tree=f.harness.render();assert.equal(f.resets.length,0);assert.equal(f.requests.length,1);assert.match(textOf(tree),/New Orbit/);}
  finally{f.harness.unmount();restore();}
});

test('Signals inspects private saved briefs before explicit fresh generation and keeps pending retries stable',async()=>{
  for(const code of ['AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED','AI_REQUEST_PENDING']){
    const restore=globals(),resets=[],requests=[];let fail=true;
    const watch={id:'watch-a',address:'0x1111111111111111111111111111111111111111',symbol:'ORB',enabled:false,priceThreshold:10,checkedAt:new Date().toISOString(),error:null},saved={id:'brief-a',symbol:'ORB',content:'Previously saved private result.',createdAt:new Date().toISOString()};
    const Recovery=()=>null,harness=componentHarness(new URL('../src/SignalsWorkspace.tsx',import.meta.url),'SignalsWorkspace',{wallet:watch.address,connect:async()=>{},discover:()=>{}},{'./Brand':{Arrow:noop,HelmMark:noop},'./DraftText':{DraftText:noop},'./MarketWorkspace':{short:value=>value},'./AIRequestRecovery':{AIRequestRecovery:Recovery},'./api':{ApiError,resetAIRequest:async(path,body)=>resets.push({path,body}),api:async(path,body)=>{if(path==='/watches')return[watch];if(path==='/alerts')return[];if(path==='/watches/briefs')return[saved];if(path==='/watches/brief'){requests.push({path,body});if(fail)throw new ApiError('Interrupted brief.',409,code);return {...saved,id:'brief-new'};}throw new Error('Unexpected fixture request');}}});
    try{let tree=harness.render();harness.effects();await settle();tree=harness.render();await findNode(tree,node=>node.type==='button'&&node.props['aria-label']==='Write AI brief for ORB').props.onClick();tree=harness.render();assert.equal(resets.length,0);fail=false;
      if(code==='AI_REQUEST_PENDING'){assert.equal(findNode(tree,node=>node.type===Recovery),null);await button(tree,'Try again').props.onClick();assert.equal(resets.length,0);}
      else{const recovery=findNode(tree,node=>node.type===Recovery);assert.ok(recovery);assert.match(await recovery.props.inspect(),/Previously saved private result/);assert.equal(resets.length,0);await recovery.props.restart();assert.deepEqual(resets,[{path:'/watches/brief',body:{id:watch.id}}]);}
      assert.deepEqual(requests,[{path:'/watches/brief',body:{id:watch.id}},{path:'/watches/brief',body:{id:watch.id}}]);
    }finally{harness.unmount();restore();}
  }
});
