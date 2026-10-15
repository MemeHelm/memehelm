import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWindow,initialWindow,moveWindow,resizeWindow} from '../shared/desktop-layout.mjs';

function contained(rect,bounds){assert.ok(rect.width>0&&rect.height>0);assert.ok(rect.x>=0&&rect.y>=0);assert.ok(rect.x+rect.width<=bounds.width);assert.ok(rect.y+rect.height<=bounds.height);}

test('desktop apps remain reachable across desktop, phone, and short viewports',()=>{
  for(const bounds of [{width:1440,height:800},{width:800,height:500},{width:390,height:650},{width:320,height:260}]){
    for(const page of ['home','launch','overview','treasury','copilot','calculator','guide']){
      const rect=initialWindow(page,bounds,5);contained(rect,bounds);
      contained(moveWindow(rect,99999,-99999,bounds),bounds);
      contained(moveWindow(rect,-99999,99999,bounds),bounds);
      contained(resizeWindow(rect,99999,99999,bounds),bounds);
      contained(resizeWindow(rect,-99999,-99999,bounds),bounds);
    }
  }
});

test('resizing preserves a window origin and keeps its titlebar inside the desktop',()=>{
  const bounds={width:1200,height:800},rect={x:170,y:40,width:700,height:500};
  const enlarged=resizeWindow(rect,9999,9999,bounds);assert.equal(enlarged.x,170);assert.equal(enlarged.y,40);assert.equal(enlarged.width,1030);assert.equal(enlarged.height,760);
  const moved=moveWindow(rect,-9999,-9999,bounds);assert.deepEqual(moved,{x:0,y:0,width:700,height:500});
  const smaller=fitWindow(rect,{width:600,height:300});assert.deepEqual(smaller,{x:0,y:0,width:600,height:300});
});
