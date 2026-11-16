import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';
const base={fromBlock:'5001',toBlock:'10000',targetBlock:'25000',count:5,partial:true,status:'syncing',lastSuccessAt:'2026-11-16T12:00:00Z',verifiedAt:'2026-11-16T12:01:00Z',missingRanges:[{fromBlock:'10001',toBlock:'25000'}]};
test('coverage exposes gaps, observed bounds, UTC and receipt fallback without implying full history',()=>{
  const harness=componentHarness(new URL('../src/LaunchHistoryCoverage.tsx',import.meta.url),'LaunchHistoryCoverage',{coverage:base,shown:3,metadataPartial:true},{});
  const tree=harness.render(),text=textOf(tree).replace(/\s+/g,' ');assert.match(text,/Partial history/);assert.match(text,/5001\s*–\s*10000/);assert.match(text,/10001–25000/);assert.match(text,/3 shown · 5 stored/);assert.match(text,/UTC/);assert.match(text,/receipts are retained/);assert.match(text,/not an all-time or final record/);assert.ok(findNode(tree,node=>node.type==='summary'&&textOf(node)==='View covered blocks'));
});
test('saved or absent coverage never becomes an up-to-date zero finding',()=>{
  for(const coverage of [base,null]){
    const harness=componentHarness(new URL('../src/LaunchHistoryCoverage.tsx',import.meta.url),'LaunchHistoryCoverage',{coverage,shown:0,stale:true},{});
    const text=textOf(harness.render());assert.doesNotMatch(text,/up to date|no launches exist|complete history/i);assert.match(text,coverage?/not been checked against the latest chain state/:/could not be established/);
  }
});
test('known changed history is explicitly withdrawn instead of presented as saved results',()=>{
  const harness=componentHarness(new URL('../src/LaunchHistoryCoverage.tsx',import.meta.url),'LaunchHistoryCoverage',{coverage:{...base,fromBlock:null,toBlock:null,invalidated:true},shown:0,stale:true},{});
  const text=textOf(harness.render());assert.match(text,/Chain history changed/);assert.match(text,/results have been withdrawn/);assert.doesNotMatch(text,/Saved results/);
});
test('Discover uses server coverage and retains saved items after refresh failure independently of community pages',async()=>{
  const originalLocation=globalThis.location,originalWindow=globalThis.window,originalInterval=globalThis.setInterval,originalClear=globalThis.clearInterval;let poll,offline=false;
  globalThis.location={hash:''};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.setInterval=work=>(poll=work,1);globalThis.clearInterval=()=>{};
  const token='0x1111111111111111111111111111111111111111';
  const api=async path=>{if(path==='/public/discover')return{projects:[]};if(offline)throw Error('Launch source unavailable');return{items:[{id:token,tokenAddress:token,name:'Observed coin',symbol:'—',createdAt:'2026-11-16T12:00:00Z'}],coverage:base,checkedAt:base.verifiedAt,stale:false,metadataPartial:true};};
  const noop=()=>null,imports={'./Brand':{Arrow:noop,HelmMark:noop,TokenPlaceholder:noop},'./api':{api},'./LaunchHistoryCoverage':{LaunchHistoryCoverage:noop},'../shared/project.mjs':{imageSource:value=>value}};
  const harness=componentHarness(new URL('../src/MarketWorkspace.tsx',import.meta.url),'MarketWorkspace',{wallet:'',connect:async()=>{}},imports);
  try{
    harness.render();harness.effects();await settle();let tree=harness.render();assert.match(textOf(tree),/Observed coin/);assert.match(textOf(tree),/Ticker unavailable/);assert.doesNotMatch(textOf(tree),/Recent 20,000 blocks/);
    let child=findNode(tree,node=>node.type===noop&&node.props.coverage);assert.deepEqual(child.props.coverage,base);
    offline=true;poll();await settle();tree=harness.render();child=findNode(tree,node=>node.type===noop&&node.props.coverage);assert.equal(child.props.stale,true);assert.match(textOf(tree),/Observed coin/);assert.match(textOf(tree),/Launch source unavailable/);
    findNode(tree,node=>node.type==='button'&&textOf(node)==='Community pages').props.onClick();tree=harness.render();assert.match(textOf(tree),/No community pages to show/);assert.doesNotMatch(textOf(tree),/Launch source unavailable/);
  }finally{harness.unmount();globalThis.location=originalLocation;globalThis.window=originalWindow;globalThis.setInterval=originalInterval;globalThis.clearInterval=originalClear;}
});
