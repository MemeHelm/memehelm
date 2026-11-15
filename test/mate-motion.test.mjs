import test from 'node:test';
import assert from 'node:assert/strict';
import {flightGeometry,mateTime,MATE_DURATION,MATE_DEADLINE,MATE_REVEAL,MATE_LAND,mateStage} from '../src/mate/choreography.ts';

test('the full character story completes after desktop reveal and before the safety deadline',()=>{
  assert.equal(MATE_DURATION,10000);
  assert.ok(MATE_REVEAL*1000<MATE_LAND*1000&&MATE_LAND*1000<MATE_DURATION);
  assert.ok(MATE_DEADLINE>MATE_DURATION+180);
  assert.equal(mateStage(6.4),'window');
  assert.equal(MATE_REVEAL,8.1);
  assert.equal(MATE_LAND,9.25);
  assert.ok(mateTime(8.9)-mateTime(8.2)<.4,'the identity hold is shortened');
  assert.ok(mateTime(8)-mateTime(4.6)>2.4,'armor assembly keeps readable travel time');
  const poses=[0,.12,1.2,1.85,2.48,3.4,4.6,7.78,8,9,10.6,12.4,14.2,14.98,15].map(mateTime);
  assert.ok(poses.every((at,index)=>at>=0&&at<=10&&(index===0||at>poses[index-1])));
  assert.equal(mateStage(MATE_REVEAL),'landing');
  assert.equal(mateStage(MATE_LAND),'settle');
  assert.equal(mateStage(MATE_DURATION/1000),'settle');
});

test('MATE lands centered and contained in the current assistant anchor at every layout',()=>{
  for(const layout of [
    {width:1280,height:720,actorWidth:300,actorHeight:364.286,target:{x:1180,y:514,width:76,height:94}},
    {width:768,height:1024,actorWidth:230.4,actorHeight:279.77,target:{x:688,y:940,width:56,height:64}},
    {width:379,height:812,actorWidth:220,actorHeight:267.143,target:{x:317,y:736,width:48,height:56}},
    {width:320,height:568,actorWidth:220,actorHeight:267.143,target:{x:258,y:492,width:48,height:56}},
    {width:1280,height:400,actorWidth:180,actorHeight:218.571,target:{x:1212,y:336,width:44,height:44}},
  ]){
    const path=flightGeometry(layout),{target}=layout;
    assert.ok(Number.isFinite(path.scale)&&path.scale>0);
    assert.ok(Math.abs(layout.width*.5+path.x-(target.x+target.width/2))<1e-8);
    assert.ok(Math.abs(layout.height*.44+path.y-(target.y+target.height/2))<1e-8);
    assert.ok(layout.actorWidth*path.scale<=target.width+1e-8);
    assert.ok(layout.actorHeight*path.scale<=target.height+1e-8);
    assert.ok(layout.width*.5+path.portalX+65<layout.width);
  }
});

test('a resized or collapsed anchor changes the flight endpoint without changing the layout origin',()=>{
  const layout={width:1280,height:720,actorWidth:300,actorHeight:364.286};
  const expanded=flightGeometry({...layout,target:{x:1180,y:514,width:76,height:94}});
  const compact=flightGeometry({...layout,target:{x:1212,y:564,width:44,height:44}});
  assert.ok(compact.scale<expanded.scale);
  assert.notEqual(compact.x,expanded.x);assert.notEqual(compact.y,expanded.y);
  assert.equal(compact.portalX,expanded.portalX);
});
