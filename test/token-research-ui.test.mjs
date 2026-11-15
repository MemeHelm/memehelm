import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,findNode,textOf,settle} from './helpers/component-harness.mjs';
const address='0x1111111111111111111111111111111111111111',creator='0x2222222222222222222222222222222222222222',date='2026-11-15T00:00:00Z';
const covered={fromBlock:'5001',toBlock:'25000',partial:false,scope:'Official factory / latest 20,000 blocks.'};
const report={address,checkedAt:date,registration:{status:'available',registered:true,deployer:creator},launchHistory:{status:'available',count:1,items:[{token:address,name:'Example Coin',symbol:'EX',timestamp:date,blockNumber:'24000',current:true,evidenceId:'launch-1'}],coverage:covered},creatorTrading:{status:'available',count:1,buys:0,sells:1,items:[{kind:'sell',amount:'100',value:'0.01',currency:'ETH',timestamp:date,evidenceId:'trade-1'}],coverage:covered,poolEventsNotAttributed:1,message:'Pool senders can be routers and are excluded.'},fundingRelationships:{status:'unknown',message:'Funding sources have not been established.'},evidence:[{id:'launch-1',kind:'launch',label:'Launch receipt',source:'TokenLaunched',timestamp:date,checkedAt:date,coverage:covered,transactionHash:'0x'+'1'.repeat(64),url:'https://robinhoodchain.blockscout.com/tx/0x'+'1'.repeat(64)},{id:'trade-1',kind:'trade',label:'Sell receipt',source:'CurveSell',timestamp:date,checkedAt:date,coverage:covered,transactionHash:'0x'+'2'.repeat(64),url:'https://robinhoodchain.blockscout.com/tx/0x'+'2'.repeat(64)}],limitations:['Not complete creator history.','No safety rating.']};

test('research renders actual receipt links, stated coverage and explicit attribution limits',async()=>{
  const harness=componentHarness(new URL('../src/TokenResearch.tsx',import.meta.url),'TokenResearch',{address},{'./api':{api:async()=>report}});
  try{let tree=harness.render();assert.match(textOf(tree),/Reading the launch registry/);harness.effects();await settle();tree=harness.render();const text=textOf(tree);assert.match(text,/Example Coin/);const coverage=findNode(tree,node=>typeof node.type==='function'&&node.type.name==='CoverageNote');assert.match(textOf(coverage.type(coverage.props)),/5001\s*–\s*25000/);assert.match(text,/0 buys · 1 sells/);assert.match(text,/1\s+pool events were excluded/);assert.match(text,/Funding sources have not been established/);assert.match(text,/No safety rating/);assert.ok(findNode(tree,node=>node.type==='a'&&node.props.href==='#app/discover/'+address));
    // Receipt is a pure child component; evaluate it to check its destination without a DOM.
    const receipt=findNode(tree,node=>typeof node.type==='function'&&node.type.name==='Receipt');assert.equal(receipt.type(receipt.props).props.href,report.evidence[0].url);
  }finally{harness.unmount();}
});

test('research errors retry independently and preserve previously successful evidence',async()=>{
  let fail=true,calls=[];const harness=componentHarness(new URL('../src/TokenResearch.tsx',import.meta.url),'TokenResearch',{address},{'./api':{api:async path=>{calls.push(path);if(fail)throw new Error('Temporary chain outage');return report;}}});
  try{let tree=harness.render();harness.effects();await settle();tree=harness.render();assert.match(textOf(tree),/Temporary chain outage/);assert.doesNotMatch(textOf(tree),/0 found in coverage/);
    fail=false;findNode(tree,node=>node.type==='button'&&textOf(node)==='Retry research').props.onClick();tree=harness.render();harness.effects();await settle();tree=harness.render();assert.match(textOf(tree),/Example Coin/);assert.doesNotMatch(textOf(tree),/Temporary chain outage/);assert.ok(calls.at(-1).endsWith('?refresh=1'));
    fail=true;findNode(tree,node=>node.type==='button'&&textOf(node)==='Refresh research').props.onClick();tree=harness.render();harness.effects();await settle();tree=harness.render();assert.match(textOf(tree),/last successful evidence remains/);assert.match(textOf(tree),/Example Coin/);
  }finally{harness.unmount();}
});

test('unknown and outside-scope data never present zero activity as a finding',async()=>{
  const unavailable={...report,registration:{status:'unavailable',registered:null,deployer:null},launchHistory:{status:'unavailable',count:null,items:[],coverage:null,message:'Source unavailable.'},creatorTrading:{status:'unavailable',count:null,buys:null,sells:null,items:[],coverage:null,message:'No event coverage.'},evidence:[]};
  const harness=componentHarness(new URL('../src/TokenResearch.tsx',import.meta.url),'TokenResearch',{address},{'./api':{api:async()=>unavailable}});
  try{harness.render();harness.effects();await settle();const text=textOf(harness.render());assert.match(text,/Could not be verified/);assert.match(text,/Unavailable/);assert.doesNotMatch(text,/0 found|0 buys|never traded|No launches from this wallet were found/);}finally{harness.unmount();}
});

test('unmounted research responses cannot overwrite the next view',async()=>{
  let resolve,captured;const harness=componentHarness(new URL('../src/TokenResearch.tsx',import.meta.url),'TokenResearch',{address},{'./api':{api:async(path,body,signal)=>{captured=signal;return new Promise(done=>resolve=done);}}});
  harness.render();harness.effects();harness.unmount();assert.equal(captured.aborted,true);resolve(report);await settle();assert.doesNotMatch(textOf(harness.render()),/Example Coin/);
});
