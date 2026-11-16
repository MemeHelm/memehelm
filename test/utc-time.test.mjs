import test from 'node:test';
import assert from 'node:assert/strict';
import {utcDateTime,utcDate,utcTime,utcInput,utcFromInput} from '../src/time.ts';

test('UTC formatting and editing remain identical across host zones and UTC midnight',()=>{
  const previous=process.env.TZ;
  try{
    const value='2026-11-16T00:15:00.000Z';
    for(const zone of ['UTC','Asia/Shanghai','America/New_York']){
      process.env.TZ=zone;
      assert.equal(utcInput(value),'2026-11-16T00:15');
      assert.equal(utcFromInput('2026-11-16T00:15'),value);
      assert.equal(utcDate(value,{year:'numeric',month:'2-digit',day:'2-digit'}),'11/16/2026 UTC');
      assert.equal(utcTime(value,{hour:'2-digit',minute:'2-digit',hour12:false}),'00:15 UTC');
      assert.equal(utcDateTime(value,{dateStyle:'medium',timeStyle:'short'}),'Nov 16, 2026, 12:15 AM UTC');
      assert.equal(utcInput('2026-11-16T15:00:00+08:00'),'2026-11-16T07:00');
      assert.equal(utcInput('2026-11-16T15:00'),'2026-11-16T15:00');
      assert.equal(utcFromInput('2026-03-08T02:30'),'2026-03-08T02:30:00.000Z','a UTC clock has no local daylight-saving gap');
    }
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('UTC inputs reject invalid calendar values without normalizing them to a different date',()=>{
  for(const value of ['', 'invalid','2026-02-30T12:00','2026-13-01T12:00','2026-01-01T24:00','2026-01-01T12:60','2026-01-01T12:00Z'])assert.equal(utcFromInput(value),null,value);
  assert.equal(utcFromInput('2028-02-29T12:00:30.2'),'2028-02-29T12:00:30.200Z');
  assert.equal(utcInput(null),'');assert.equal(utcInput('invalid'),'');
  assert.equal(utcDateTime(null),'Time unavailable');
});
