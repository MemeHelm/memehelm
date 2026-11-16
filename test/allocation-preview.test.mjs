import test from 'node:test';
import assert from 'node:assert/strict';
import * as viem from 'viem';
import {componentHarness,findNode,textOf} from './helpers/component-harness.mjs';
import {launchStepErrors} from '../shared/launch-steps.mjs';

const noop=()=>null;
const normalized=node=>textOf(node).replace(/\s+/g,' ').trim();
function preview(reserveBps=1000){
  const props={reserveBps},harness=componentHarness(new URL('../src/AllocationPreview.tsx',import.meta.url),'AllocationPreview',props,{'viem':viem});
  const amount=tree=>findNode(tree,node=>node.type==='input');
  const values=tree=>{
    const outputs=[];
    function collect(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return;}if(node.type==='output')outputs.push(textOf(node));collect(node.props?.children);}
    collect(tree);return outputs;
  };
  return{props,harness,amount,values,enter(value){amount(harness.render()).props.onChange({target:{value}});return harness.render();}};
}

test('allocation preview uses the current split without a second setting or financial action',()=>{
  const f=preview(2500);let tree=f.harness.render();
  assert.equal(tree.type,'details');assert.equal(tree.props.open,undefined);
  assert.match(normalized(tree),/Preview allocation Example only/);
  assert.deepEqual(f.values(tree),['0.75','0.25']);
  tree=f.enter('12.5');assert.deepEqual(f.values(tree),['9.375','3.125']);
  f.props.reserveBps=4000;tree=f.harness.render();assert.deepEqual(f.values(tree),['7.5','5']);
  assert.match(normalized(tree),/Project receives 60\s*%/);assert.match(normalized(tree),/Reserve receives 40\s*%/);
  assert.match(normalized(tree),/does not move funds or change your split/);
  assert.equal(findNode(tree,node=>node.type==='input'&&node.props.type==='range'),null);
  assert.equal(findNode(tree,node=>node.type==='button'||node.type==='a'),null);
});

test('allocation preview keeps every wei accounted for, including full and zero shares',()=>{
  const f=preview(3333);
  assert.deepEqual(f.values(f.enter('0.000000000000000001')),['0.000000000000000001','0']);
  assert.deepEqual(f.values(f.enter('9007199254740993.000000000000000001')),['6005099743135820.033100000000000001','3002099511605172.9669']);
  f.props.reserveBps=10000;assert.deepEqual(f.values(f.harness.render()),['0','9007199254740993.000000000000000001']);
  f.props.reserveBps=0;assert.deepEqual(f.values(f.harness.render()),['9007199254740993.000000000000000001','0']);
  assert.deepEqual(f.values(f.enter('0')),['0','0']);
});

test('invalid example amounts show unavailable results instead of negative or rounded allocations',()=>{
  const f=preview();
  for(const value of ['-1','Infinity','1e6','0.1234567890123456789']){
    const tree=f.enter(value);assert.deepEqual(f.values(tree),['—','—']);
    assert.equal(f.amount(tree).props['aria-invalid'],true);assert.match(normalized(tree),/up to 18 decimal places/);
  }
  const empty=f.enter('');assert.deepEqual(f.values(empty),['—','—']);assert.equal(f.amount(empty).props['aria-invalid'],false);
  assert.deepEqual(f.values(f.enter('1.25')),['1.125','0.125']);
});

test('launch keeps allocation preview inside fixed split and retains all four revenue destinations',()=>{
  const oldStorage=globalThis.localStorage;globalThis.localStorage={getItem:()=> '1',setItem(){}};
  function AllocationPreview(){return null;}
  const props={draft:{name:'Orbit',symbol:'ORB',description:'Builder community.',image:'',website:'',x:'',telegram:'',creatorFeeRecipient:'',creatorTaxBps:0,configId:0,splitEnabled:true,holdersEnabled:false,socialEnabled:false,projectTreasury:'',auditTreasury:'',auditBps:2500,vaultAddress:'',snipeTaxExemptions:[]},wallet:'0x1111111111111111111111111111111111111111',busy:'',prepared:null,reviewed:false,setReviewed:noop,connect:noop,deploy:noop,save:noop,prepare:noop,launch:noop,assist:noop};
  props.patch=(key,value)=>{props.draft={...props.draft,[key]:value};};
  const harness=componentHarness(new URL('../src/LaunchWizard.tsx',import.meta.url),'LaunchWizard',props,{'viem':viem,'./Brand':{Arrow:noop,TokenPlaceholder:noop},'./AllocationPreview':{AllocationPreview},'../shared/project.mjs':{imageSource:value=>value}});
  try{
    let tree=harness.render();assert.equal(findNode(tree,node=>node.type===AllocationPreview).props.reserveBps,2500);
    assert.match(normalized(tree),/Recipients and percentages cannot be changed after activation/);
    for(const label of ['One recipient','Two-wallet split','Holder payouts','Community escrow'])assert.ok(findNode(tree,node=>node.type==='button'&&normalized(node).includes(label)));
    findNode(tree,node=>node.type==='input'&&node.props['aria-label']==='Reserve share').props.onChange({target:{value:'3700'}});
    tree=harness.render();assert.equal(findNode(tree,node=>node.type===AllocationPreview).props.reserveBps,3700);
    for(const [label,mode] of [['One recipient','direct'],['Holder payouts','holders'],['Community escrow','social']]){
      findNode(tree,node=>node.type==='button'&&normalized(node).includes(label)).props.onClick();tree=harness.render();
      assert.equal(findNode(tree,node=>node.type===AllocationPreview),null);
      assert.equal(props.draft.splitEnabled,false);assert.equal(props.draft.holdersEnabled,mode==='holders');assert.equal(props.draft.socialEnabled,mode==='social');
    }
  }finally{harness.unmount();if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;}
});

test('revenue navigation preserves the draft, respects busy and prepared reviews, and keeps later validation',()=>{
  const saved={localStorage:globalThis.localStorage,window:globalThis.window,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  globalThis.localStorage={getItem:()=> '0',setItem(){}};globalThis.window=new EventTarget();globalThis.setInterval=()=>1;globalThis.clearInterval=noop;
  const props={draft:{name:'',symbol:'',description:'',image:'',website:'',x:'',telegram:'',creatorFeeRecipient:'',creatorTaxBps:0,configId:0,splitEnabled:false,holdersEnabled:false,socialEnabled:false,projectTreasury:'',auditTreasury:'',auditBps:1000,vaultAddress:'',snipeTaxExemptions:[]},patch:noop,wallet:'',busy:'',prepared:null,reviewed:false,setReviewed:noop,connect:noop,deploy:noop,save:noop,prepare:noop,launch:noop,assist:noop};
  const harness=componentHarness(new URL('../src/LaunchWizard.tsx',import.meta.url),'LaunchWizard',props,{'viem':viem,'./Brand':{Arrow:noop,TokenPlaceholder:noop},'./AllocationPreview':{AllocationPreview:noop},'../shared/project.mjs':{imageSource:value=>value},'../shared/launch-steps.mjs':{launchStepErrors},'./api':{api:async()=>({configs:[]})}});
  const openRevenue=()=>window.dispatchEvent(new Event('memehelm-open-launch-revenue'));
  const heading=tree=>normalized(findNode(tree,node=>node.type==='h2'&&node.props.tabIndex===-1));
  try{
    harness.render();harness.effects();props.busy='Confirming in wallet';harness.render();harness.effects();openRevenue();assert.equal(heading(harness.render()),'Make it yours.');
    props.busy='';props.prepared={expiresAt:'2099-01-01T00:00:00Z'};harness.render();harness.effects();openRevenue();assert.equal(heading(harness.render()),'Make it yours.');
    props.prepared=null;harness.render();harness.effects();const draftBefore={...props.draft};openRevenue();let tree=harness.render();assert.equal(heading(tree),'Choose your fee recipient.');assert.deepEqual(props.draft,draftBefore);
    findNode(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=harness.render();assert.equal(heading(tree),'Make it yours.');assert.ok(findNode(tree,node=>node.type==='input'&&node.props.id==='launch-name').props['aria-invalid']);
  }finally{harness.unmount();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('guest revenue planning opens Launchpad and keeps launched or imported projects explicit',()=>{
  const pages=[],harness=componentHarness(new URL('../src/GuestWorkspace.tsx',import.meta.url),'GuestWorkspace',{page:'treasury',connect:noop,navigate:page=>pages.push(page)},{'./Brand':{Arrow:noop},'./Desktop':{DesktopIcon:noop}});
  const tree=harness.render();findNode(tree,node=>node.type==='button'&&normalized(node)==='Plan revenue in Launchpad').props.onClick();
  assert.deepEqual(pages,['launch']);assert.match(normalized(tree),/launched or imported pons v2 project/);assert.match(normalized(tree),/Activated vault rules stay fixed/);
  assert.doesNotMatch(normalized(tree),/split calculator/i);
});
