export function projectLink(value,kind='website'){
  const text=String(value||'').trim();if(!text)return '';
  let url;try{url=new URL(text);}catch{throw new Error('Use a complete HTTPS link.');}
  if(url.protocol!=='https:'||url.username||url.password||text.length>500)throw new Error('Use a public HTTPS link without login details.');
  if(kind==='x'&&!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname))throw new Error('Use an x.com or twitter.com profile link.');
  if(kind==='telegram'&&!['t.me','www.t.me'].includes(url.hostname))throw new Error('Use a t.me community link.');
  return url.toString();
}
export function imageLink(value){
  const text=String(value||'').trim();if(!text)return '';
  if(/^ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})(?:\/[A-Za-z0-9._/-]+)?$/.test(text))return text;
  return projectLink(text);
}
export function imageSource(value){return value?.startsWith('ipfs://')?'https://ipfs.io/ipfs/'+value.slice(7):value||'';}
export function publicProject(project){
  return Object.fromEntries(['id','name','symbol','description','image','website','x','telegram','tokenAddress','vaultAddress','launchHash','status','chainId','createdAt','publishedAt'].map(key=>[key,project[key]??null]));
}
