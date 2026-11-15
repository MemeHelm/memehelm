import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSeenMateIntro,markMateIntroSeen,MATE_INTRO_SEEN_KEY} from '../src/mate/intro-preference.ts';

function memoryStorage(initial=[]){
  const values=new Map(initial);
  return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};
}

function withWindow(descriptor,run){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,...descriptor});
  try{return run();}
  finally{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;}
}

test('finishing or skipping the intro remembers this version for the next visit only in this browser',()=>{
  const storage=memoryStorage(),otherBrowser=memoryStorage();
  assert.equal(hasSeenMateIntro(storage),false);
  assert.equal(markMateIntroSeen(storage),true);
  assert.equal(storage.values.get(MATE_INTRO_SEEN_KEY),'1');
  assert.equal(hasSeenMateIntro(storage),true);
  assert.equal(hasSeenMateIntro(otherBrowser),false);
  assert.equal(markMateIntroSeen(storage),true);
  assert.equal(storage.values.size,1);
});

test('legacy, corrupt or empty values do not suppress the new story',()=>{
  for(const value of [undefined,'','0','true','{"seen":true}']){
    const storage=memoryStorage([['memehelm:intro:mate-v1','1'],...(value===undefined?[]:[[MATE_INTRO_SEEN_KEY,value]])]);
    assert.equal(hasSeenMateIntro(storage),false);
    assert.equal(markMateIntroSeen(storage),true);
    assert.equal(hasSeenMateIntro(storage),true);
    assert.equal(storage.values.get('memehelm:intro:mate-v1'),'1');
  }
});

test('unavailable storage and browser security or quota exceptions never interrupt entry',()=>{
  const blocked={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');}};
  assert.equal(hasSeenMateIntro(null),false);
  assert.equal(markMateIntroSeen(null),false);
  assert.equal(hasSeenMateIntro(blocked),false);
  assert.equal(markMateIntroSeen(blocked),false);
  withWindow({value:Object.create(null,{localStorage:{get(){throw new Error('SecurityError');}}})},()=>{
    assert.equal(hasSeenMateIntro(),false);
    assert.equal(markMateIntroSeen(),false);
  });
});

test('default storage access works in a browser and safely falls back without window',()=>{
  const storage=memoryStorage();
  withWindow({value:{localStorage:storage}},()=>{
    assert.equal(hasSeenMateIntro(),false);
    assert.equal(markMateIntroSeen(),true);
    assert.equal(hasSeenMateIntro(),true);
  });
  withWindow({value:undefined},()=>{
    assert.equal(hasSeenMateIntro(),false);
    assert.equal(markMateIntroSeen(),false);
  });
});
