import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
// Public, deterministic test wallets. They are never used for funded transactions.
export const testWallet=number=>privateKeyToAccount('0x'+number.toString(16).padStart(64,'0'));
export async function signedClient(endpoint,account=testWallet(1),fetcher=fetch){
  const headers={'content-type':'application/json',origin:'http://127.0.0.1:4318'};
  const challenge=await fetcher(endpoint+'/api/auth/challenge',{method:'POST',headers,body:JSON.stringify({address:account.address})});assert.equal(challenge.status,200);
  const {message}=await challenge.json(),signature=await account.signMessage({message});
  const verified=await fetcher(endpoint+'/api/auth/verify',{method:'POST',headers:{...headers,cookie:challenge.headers.getSetCookie()[0].split(';')[0]},body:JSON.stringify({message,signature})});assert.equal(verified.status,200);
  const cookie=verified.headers.getSetCookie()[0].split(';')[0];
  const request=(input,options={})=>fetcher(input,{...options,headers:{cookie,...options.headers}});
  const get=path=>request(endpoint+'/api'+path);
  const post=(path,input,origin=headers.origin)=>request(endpoint+'/api'+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)});
  return {account,cookie,request,get,post};
}
