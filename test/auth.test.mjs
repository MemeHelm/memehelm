import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuth} from '../server/auth.mjs';
import {testWallet} from './helpers/auth.mjs';
const response=()=>({headers:{},setHeader(name,value){this.headers[name]=value;}});
const cookie=res=>res.headers['Set-Cookie'].split(';')[0];
test('wallet sign-in binds exact origin, address and chain and consumes each nonce once',async()=>{
  let now=Date.parse('2026-11-12T00:00:00Z');const auth=createAuth({origin:'https://memehelm.example',now:()=>now}),account=testWallet(1),other=testWallet(2),res=response();
  const challenge=auth.challenge({headers:{}},res,account.address),req={headers:{cookie:cookie(res)}};
  assert.match(challenge.message,/memehelm\.example wants you to sign in/);assert.match(challenge.message,/Chain ID: 4663/);assert.match(res.headers['Set-Cookie'],/HttpOnly; SameSite=Strict.*Secure/);
  const signature=await account.signMessage({message:challenge.message});const signed=response();await auth.verify(req,signed,{message:challenge.message,signature});
  const sessionReq={headers:{cookie:cookie(signed)}};assert.equal(auth.session(sessionReq).address,account.address);assert.equal(auth.session({headers:{}}),null);
  await assert.rejects(()=>auth.verify(req,response(),{message:challenge.message,signature}),/expired/);
  const badRes=response(),bad=auth.challenge({headers:{}},badRes,account.address);await assert.rejects(async()=>auth.verify({headers:{cookie:cookie(badRes)}},response(),{message:bad.message,signature:await other.signMessage({message:bad.message})}),/signature/);
  const changedRes=response(),changed=auth.challenge({headers:{}},changedRes,account.address);await assert.rejects(()=>auth.verify({headers:{cookie:cookie(changedRes)}},response(),{message:changed.message.replace('4663','46630'),signature}),/expired/);
  const expiredRes=response(),expired=auth.challenge({headers:{}},expiredRes,account.address);now+=300001;await assert.rejects(()=>auth.verify({headers:{cookie:cookie(expiredRes)}},response(),{message:expired.message,signature}),/expired/);
  auth.logout(sessionReq,response());assert.equal(auth.session(sessionReq),null);
});
test('wallet sessions expire and insecure public origins are rejected',async()=>{
  assert.throws(()=>createAuth({origin:'http://public.example'}),/HTTPS/);let now=0;const auth=createAuth({now:()=>now}),account=testWallet(3),res=response();const {message}=auth.challenge({headers:{}},res,account.address),signed=response();await auth.verify({headers:{cookie:cookie(res)}},signed,{message,signature:await account.signMessage({message})});now+=86400001;assert.equal(auth.session({headers:{cookie:cookie(signed)}}),null);
});
