import {randomBytes,createHash} from 'node:crypto';
import {createSiweMessage} from 'viem/siwe';
import {verifyMessage,isAddress,getAddress} from 'viem';
import {NETWORK} from '../shared/config.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(item=>item.trim().split('=')));
export function createAuth({origin=process.env.APP_ORIGIN||'http://127.0.0.1:4318',now=()=>Date.now()}={}){
  const url=new URL(origin);if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Public deployments require an HTTPS APP_ORIGIN.');
  const challenges=new Map(),sessions=new Map();
  function prune(){for(const map of [challenges,sessions])for(const [key,value] of map)if(value.expires<=now())map.delete(key);}
  function cookie(res,name,value,seconds){res.setHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${url.protocol==='https:'?'; Secure':''}`);}
  return {
    origin:url.origin,
    challenge(req,res,address){prune();if(challenges.size>=1000)throw Object.assign(new Error('Sign-in is busy. Please try again shortly.'),{status:429});if(!isAddress(address,{strict:false}))throw new Error('Choose a valid wallet.');const token=randomBytes(32).toString('hex'),expires=now()+300000;const localOrigin=['127.0.0.1','localhost'].includes(url.hostname)&&/^http:\/\/(127\.0\.0\.1|localhost):(4317|4318)$/.test(req.headers.origin||'')?new URL(req.headers.origin):url;const message=createSiweMessage({domain:localOrigin.host,address:getAddress(address.toLowerCase()),statement:'Sign in to your MemeHelm workspace. This does not authorize a transaction or spending.',uri:localOrigin.origin,version:'1',chainId:NETWORK.id,nonce:randomBytes(16).toString('hex'),issuedAt:new Date(now()),expirationTime:new Date(expires)});challenges.set(digest(token),{address:getAddress(address.toLowerCase()),message,expires});cookie(res,'mh_challenge',token,300);return {message};},
    async verify(req,res,{message,signature}){prune();const key=digest(cookies(req).mh_challenge||''),challenge=challenges.get(key);challenges.delete(key);if(!challenge||challenge.message!==message||typeof signature!=='string'||signature.length>2048)throw new Error('Sign-in expired. Request a new signature.');if(!await verifyMessage({address:challenge.address,message,signature}))throw new Error('The wallet signature could not be verified.');const token=randomBytes(32).toString('hex');if(sessions.size>=10000)throw new Error('Sign-in is busy.');sessions.set(digest(token),{address:challenge.address,expires:now()+86400000});cookie(res,'mh_session',token,86400);return {address:challenge.address,expiresAt:new Date(now()+86400000).toISOString()};},
    session(req){prune();return sessions.get(digest(cookies(req).mh_session||''))||null;},
    logout(req,res){sessions.delete(digest(cookies(req).mh_session||''));cookie(res,'mh_session','',0);return {address:null};},
  };
}
