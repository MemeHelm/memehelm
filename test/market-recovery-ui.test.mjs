import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';
const noop=()=>null;
const common={'./Brand':{Arrow:noop,HelmMark:noop,TokenPlaceholder:noop},'../shared/project.mjs':{imageSource:value=>value},'./TradePanel':{TradePanel:noop},'./DraftText':{DraftText:noop},'./MarketWorkspace':{short:value=>value}};

test('X-Ray presents unknown registry/account types without negative facts and uses quote-asset units',async()=>{
  const address='0x1111111111111111111111111111111111111111';
  for(const registered of [null,true,'unavailable']){
    const api=async path=>{
      if(path.endsWith('/forensics')){if(registered==='unavailable')throw new Error('RPC down');return{registration:{registered,phase:0,pairToken:address,graduationThreshold:registered?'2.5':null,graduationCurrency:registered?'USDG':null,deployer:address},creatorEconomics:registered?{creatorTaxBps:100,recipient:address,recipientIsContract:null,buybackEnabled:false}:null,flags:[],scope:'Bounded reads',disclaimer:'Not an audit'};}
      if(path.endsWith('/holders'))return{holders:[],holdersCount:null,holderDataAvailable:false};
      if(path.endsWith('/trades'))return{items:[],available:false};
      return{token:{address,name:'Coin',symbol:'COIN',decimals:18,totalSupply:'1',holders:[],checkedAt:'2026-11-15T00:00:00Z'},history:[]};
    };
    const harness=componentHarness(new URL('../src/MarketWorkspace.tsx',import.meta.url),'TokenDetail',{item:{id:address,tokenAddress:address,name:'Coin',symbol:'COIN'},wallet:'',connect:async()=>{},back:()=>{}},{...common,'./api':{api}});
    try{
      let tree=harness.render();harness.effects();await settle();tree=harness.render();findNode(tree,node=>node.type==='button'&&textOf(node)==='X-Ray').props.onClick();tree=harness.render();
      const text=textOf(tree);assert.doesNotMatch(text,/Not registered|was not issued/);
      if(registered===true){assert.match(text,/2\.5 USDG graduation target/);assert.doesNotMatch(text,/2\.5 ETH|contract \(code read unavailable\)/);assert.match(text,/Fee-recipient account type is unavailable/);}
      else assert.match(text,/launch registry could not be checked/);
    }finally{harness.unmount();}
  }
});

test('community discovery has its own failure/retry state while the chain feed is still pending',async()=>{
  const originalLocation=globalThis.location,originalWindow=globalThis.window;let fail=true,calls=0;
  globalThis.location={hash:''};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  const api=async path=>{if(path==='/market/launches')return new Promise(()=>{});if(path==='/public/discover'){calls++;if(fail)throw new Error('Community service is unavailable');return{projects:[]};}throw new Error('Unexpected request');};
  const harness=componentHarness(new URL('../src/MarketWorkspace.tsx',import.meta.url),'MarketWorkspace',{wallet:'',connect:async()=>{}},{...common,'./api':{api}});
  try{
    let tree=harness.render();harness.effects();await settle();tree=harness.render();
    findNode(tree,node=>node.type==='button'&&textOf(node)==='Community pages').props.onClick();tree=harness.render();
    assert.match(textOf(tree),/Community pages are unavailable/);assert.match(textOf(tree),/Community service is unavailable/);assert.doesNotMatch(textOf(tree),/Loading community pages|Published community pages will appear here/);
    fail=false;findNode(tree,node=>node.type==='button'&&textOf(node)==='Retry community pages').props.onClick();tree=harness.render();harness.effects();await settle();tree=harness.render();
    assert.equal(calls,2);assert.match(textOf(tree),/No community pages to show/);assert.doesNotMatch(textOf(tree),/Community service is unavailable|Community pages are unavailable|Finding the latest launches/);
  }finally{harness.unmount();if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('Signals clears recovered polling errors and preserves a separate failed wallet action',async()=>{
  const originalInterval=globalThis.setInterval,originalClear=globalThis.clearInterval;let poll,offline=true;
  globalThis.setInterval=work=>{poll=work;return 1;};globalThis.clearInterval=()=>{};
  const watch={id:'watch-a',address:'0x1111111111111111111111111111111111111111',symbol:'COIN',enabled:true,priceThreshold:10,priceAvailable:true,checkedAt:'2026-11-15T00:00:00Z',error:null};
  const api=async(path,body)=>{if(body&&path==='/watches/check'){offline=true;return{};}if(body)throw new Error('Your watch setting could not be saved');if(offline)throw new Error('Temporary Signals outage');return path==='/watches'?[watch]:[];};
  const harness=componentHarness(new URL('../src/SignalsWorkspace.tsx',import.meta.url),'SignalsWorkspace',{wallet:'0x1111111111111111111111111111111111111111',connect:async()=>{},discover:()=>{}},{...common,'./api':{api,ApiError:class extends Error{}}});
  try{
    let tree=harness.render();harness.effects();await settle();tree=harness.render();assert.match(textOf(tree),/Temporary Signals outage/);
    offline=false;await poll();await settle();tree=harness.render();assert.doesNotMatch(textOf(tree),/Temporary Signals outage/);assert.match(textOf(tree),/COIN/);
    findNode(tree,node=>node.type==='button'&&node.props.className==='watch-toggle').props.onClick();await settle();tree=harness.render();assert.match(textOf(tree),/Your watch setting could not be saved/);
    await poll();await settle();tree=harness.render();assert.match(textOf(tree),/Your watch setting could not be saved/);
    findNode(tree,node=>node.type==='button'&&textOf(node).includes('Check now')).props.onClick();await settle();tree=harness.render();assert.match(textOf(tree),/Temporary Signals outage/);assert.doesNotMatch(textOf(tree),/Your watch setting could not be saved/);
    offline=false;await poll();await settle();tree=harness.render();assert.doesNotMatch(textOf(tree),/Temporary Signals outage/);
  }finally{harness.unmount();globalThis.setInterval=originalInterval;globalThis.clearInterval=originalClear;}
});
