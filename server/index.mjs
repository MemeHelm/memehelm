import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAddress, getAddress, zeroAddress, encodeFunctionData, parseEther,erc20Abi,parseEventLogs } from 'viem';
import { NETWORK } from '../shared/config.mjs';
import {factoryAbi,PONS} from '../shared/pons.mjs';
import {pons} from './pons.mjs';
import { publicClient, artifact, chainStatus, snapshot, verifyChain } from './chain.mjs';
import { aiConfigured, generateCopilot, launchAssist } from './copilot.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createAuth} from './auth.mjs';
import {createMarket} from './market.mjs';
import {createMonitor} from './monitor.mjs';
import {createOperations} from './operations.mjs';
import {createCommunity} from './community.mjs';
import {createXSocial} from './social-x.mjs';
import {createGrowth} from './growth.mjs';
import {createContentCalendar} from './content-calendar.mjs';
import {createWorkspaceStore} from './workspace.mjs';
import {imageLink,projectLink,publicProject} from '../shared/project.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const dataDirectory = resolve(root, process.env.DATA_DIRECTORY || 'data/robinhood-mainnet-pons-v2');
const workspace=createWorkspaceStore(dataDirectory);
const auth=createAuth(),context=new AsyncLocalStorage(),market=createMarket(workspace),monitor=createMonitor(workspace,market);
const allProjects=async()=>(await workspace.projects()).filter(project=>project.chainId===NETWORK.id&&project.owner);
const projects=async()=>(await allProjects()).filter(project=>project.owner===context.getStore()?.owner),mutate=workspace.mutateProjects;
const aiRequests=new Map();
const aiInFlight=new Set();
function reserveAIRequest(owner){
  if(!aiConfigured())throw new Error('Copilot is temporarily unavailable. Please try again later.');
  const times=(aiRequests.get(owner)||[]).filter(time=>Date.now()-time<3600000);
  if(times.length>=20||times.filter(time=>Date.now()-time<60000).length>=5)throw Object.assign(new Error('Your writing limit is reached. Please try again later.'),{status:429});
  times.push(Date.now());aiRequests.set(owner,times);
}
async function withAI(owner,work){if(aiInFlight.has(owner))throw Object.assign(new Error('An AI request is already running for your wallet.'),{status:429});reserveAIRequest(owner);aiInFlight.add(owner);try{return await work();}finally{aiInFlight.delete(owner);}}
const community=createCommunity(workspace),social=createXSocial(workspace,{origin:auth.origin}),growth=createGrowth(workspace),calendar=createContentCalendar(workspace);
const operations=createOperations(workspace,{observe:project=>market.observe(project.tokenAddress),generate:generateCopilot,withAI,configured:aiConfigured,communityContext:project=>({community:community.context(project),xPosts:social.context(project),goals:growth.context(project),contentPlans:calendar.context(project)})});
const flowCookie=req=>String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('mh_x_flow='))?.slice(10)||'';
function setFlowCookie(res,value){res.setHeader('Set-Cookie',`mh_x_flow=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value?600:0}${auth.origin.startsWith('https:')?'; Secure':''}`);}
async function body(req,limit=20000) { req.setEncoding('utf8');let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>limit)throw new Error('Request is too large.');}return content?JSON.parse(content):{}; }
function address(value,optional=false) { if(optional&&!value)return null;if(typeof value!=='string'||!isAddress(value,{strict:false})||value.toLowerCase()===zeroAddress)throw new Error('A valid nonzero EVM address is required.');return getAddress(value.toLowerCase()); }
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data,(_,value)=>typeof value==='bigint'?String(value):value));}
async function findProject(id){const project=(await projects()).find(p=>p.id===id);if(!project)throw Object.assign(new Error('Project not found.'),{status:404});return project;}
// Chat answers are built only from observed facts: chain snapshot, X-Ray forensics, recent trades/holders and project memory.
async function projectChatFacts(project){
  const facts={};
  if(project.tokenAddress){
    const [chain,forensics,trades,holders]=await Promise.all([
      snapshot(project).catch(()=>null),
      market.forensics(project.tokenAddress).catch(()=>null),
      market.trades(project.tokenAddress).catch(()=>null),
      market.holders(project.tokenAddress).catch(()=>null),
    ]);
    if(chain)facts.snapshot=chain;
    if(forensics)facts.xray=forensics;
    if(trades)facts.recentTrades={currency:trades.currency,available:trades.available,partial:trades.partial||false,coverage:{fromBlock:trades.fromBlock,toBlock:trades.toBlock},items:(trades.items||[]).slice(0,20)};
    if(holders)facts.holders={holdersCount:holders.holdersCount,available:holders.holderDataAvailable,top:(holders.holders||[]).slice(0,10).map(({address,balance})=>({address,balance}))};
  }
  facts.operatingContext=await operations.context(project);
  return facts;
}
// Server-owned chat history: the model replays what the workspace actually stored,
// never what a request claims the assistant previously said.
const chatTurnShape=turn=>{const role=turn?.role,content=typeof turn?.content==='string'?turn.content.trim().slice(0,4000):'';return (role==='user'||role==='assistant')&&content?{role,content}:null;};
function storedTurns(messages){
  let turns=(Array.isArray(messages)?messages:[]).map(chatTurnShape).filter(Boolean);
  while(turns.length>12)turns.shift();
  let total=turns.reduce((sum,turn)=>sum+turn.content.length,0);
  while(total>20000&&turns.length>1){total-=turns[0].content.length;turns.shift();}
  return turns;
}
function chatSummaries(records,project,owner){
  return records.filter(item=>item.projectId===project.id&&item.owner===owner).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
    .map(chat=>({id:chat.id,createdAt:chat.createdAt,updatedAt:chat.updatedAt,messageCount:chat.messages.length,preview:(chat.messages.find(message=>message.role==='user')?.content||'').slice(0,120)}));
}
function writable(req){const origin=req.headers.origin;if(origin&&origin!==auth.origin&&!(/^http:\/\/(127\.0\.0\.1|localhost):(4317|4318)$/.test(origin)&&['127.0.0.1','localhost'].includes(new URL(auth.origin).hostname)))throw new Error('This local workspace rejects requests from other sites.');if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON content type is required.');}
export const server=createServer((req,res)=>context.run({owner:auth.session(req)?.address.toLowerCase()},async()=>{
  try {
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))throw new Error('Invalid local workspace host.');
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(req.method==='POST')writable(req);
    if(req.method==='GET'&&path==='/api/health')return json(res,200,{ok:true,chainId:NETWORK.id});
    if(req.method==='GET'&&path==='/api/auth/session')return json(res,200,{address:auth.session(req)?.address||null});
    if(req.method==='POST'&&path==='/api/auth/challenge')return json(res,200,auth.challenge(req,res,(await body(req)).address));
    if(req.method==='POST'&&path==='/api/auth/verify')return json(res,200,await auth.verify(req,res,await body(req)));
    if(req.method==='POST'&&path==='/api/auth/logout')return json(res,200,auth.logout(req,res));
    if(req.method==='GET'&&path==='/api/social/x/callback'){
      let result;try{result=await social.callback(new URL(req.url,auth.origin).searchParams,flowCookie(req));}catch{result={ok:false};}
      res.writeHead(303,{'Location':`${auth.origin}/?community=${result.projectId||''}&x=${result.ok?'connected':'failed'}#app/copilot`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
    }
    const publicApi=req.method==='GET'&&(path==='/api/status'||path==='/api/launch/options'||path.startsWith('/api/artifacts/')||path.startsWith('/api/public/')||path.startsWith('/api/market/'));
    if(path.startsWith('/api/')&&!publicApi&&!context.getStore()?.owner)return json(res,401,{error:'Sign in with your wallet to open your private workspace.'});
    const owner=context.getStore()?.owner;
    if(req.method==='GET'&&path==='/api/public/discover')return json(res,200,{projects:(await allProjects()).filter(item=>item.published&&item.tokenAddress).map(publicProject)});
    if(req.method==='GET'&&path==='/api/market/launches')return json(res,200,await market.feed());
    const marketPath=path.match(/^\/api\/market\/tokens\/(0x[a-fA-F0-9]{40})$/);
    if(req.method==='GET'&&marketPath){const token=await market.details(marketPath[1]);return json(res,200,{token,history:market.history(marketPath[1]),trades:{items:[],available:false,scope:'Load recent trades separately.'}});}
    const marketSection=path.match(/^\/api\/market\/tokens\/(0x[a-fA-F0-9]{40})\/(trades|holders|forensics)$/);
    if(req.method==='GET'&&marketSection)return json(res,200,await market[marketSection[2]](marketSection[1]));
    if(req.method==='GET'&&path==='/api/watches')return json(res,200,workspace.read('watches').filter(item=>item.owner===owner));
    if(req.method==='POST'&&path==='/api/watches'){
      const input=await body(req),tokenAddress=address(input.address).toLowerCase(),priceThreshold=Number(input.priceThreshold??10);if(!Number.isFinite(priceThreshold)||priceThreshold<1||priceThreshold>100)throw new Error('Choose a price threshold from 1% to 100%.');
      const token=await market.observe(tokenAddress);return json(res,200,await workspace.change('watches',records=>{let item=records.find(item=>item.owner===owner&&item.address===tokenAddress);if(!item){if(records.filter(item=>item.owner===owner).length>=20)throw new Error('Your watchlist supports up to 20 tokens.');item={id:randomUUID(),owner,address:tokenAddress};records.push(item);}Object.assign(item,{symbol:token.symbol||'TOKEN',enabled:input.enabled!==false,priceThreshold,last:{price:token.price,holdersCount:token.holdersCount,graduated:token.graduated},priceAvailable:token.price!==null,checkedAt:token.checkedAt,error:null});return item;}));
    }
    if(req.method==='POST'&&path==='/api/watches/check')return json(res,200,await monitor.check(owner));
    if(req.method==='POST'&&path==='/api/watches/remove'){const input=await body(req);await workspace.change('watches',records=>{const index=records.findIndex(item=>item.id===input.id&&item.owner===owner);if(index<0)throw Object.assign(new Error('Watch not found.'),{status:404});records.splice(index,1);});return json(res,200,{ok:true});}
    if(req.method==='GET'&&path==='/api/watches/briefs')return json(res,200,workspace.read('briefs').filter(item=>item.owner===owner).reverse().slice(0,30));
    if(req.method==='POST'&&path==='/api/watches/brief'){
      const input=await body(req),watch=workspace.read('watches').find(item=>item.id===input.id&&item.owner===owner);if(!watch)throw new Error('Watch not found.');
      if(aiInFlight.has(owner))return json(res,429,{error:'Your brief is already being written.'});
      reserveAIRequest(owner);aiInFlight.add(owner);
      try{const token=await market.details(watch.address),alerts=workspace.read('alerts').filter(item=>item.owner===owner&&item.address===watch.address).slice(-10);const result=await generateCopilot({project:{name:token.name||watch.symbol,symbol:token.symbol||watch.symbol,description:'A watched Robinhood Chain token. Explain observed changes and missing information without recommending trades.',status:'watched'},facts:{market:token,alerts},task:'brief'});const entry={id:randomUUID(),owner,address:watch.address,symbol:watch.symbol,content:result.content,createdAt:result.generatedAt};await workspace.change('briefs',records=>{records.push(entry);if(records.length>2000)records.splice(0,records.length-2000);});return json(res,200,entry);}finally{aiInFlight.delete(owner);}
    }
    if(req.method==='GET'&&path==='/api/alerts')return json(res,200,workspace.read('alerts').filter(item=>item.owner===owner).reverse().slice(0,100));
    if(req.method==='POST'&&path==='/api/alerts/read'){const input=await body(req);await workspace.change('alerts',records=>{for(const item of records)if(item.owner===owner&&(!input.id||item.id===input.id))item.read=true;});return json(res,200,{ok:true});}

    if(req.method==='GET'&&path==='/api/status')return json(res,200,{network:NETWORK,chain:await chainStatus(),aiConfigured:aiConfigured(),factory:PONS.factory.address,mode:'mainnet',auditStatus:'unaudited'});
    if(req.method==='GET'&&path.startsWith('/api/artifacts/'))return json(res,200,await artifact(path.split('/').pop()));
    if(req.method==='GET'&&path==='/api/projects')return json(res,200,await projects());
    const overviewPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/overview$/);
    if(req.method==='GET'&&overviewPath){const project=await findProject(overviewPath[1]);return json(res,200,{goals:growth.get(project).goals.map(({id,details,status,accepted,pending,published})=>({id,title:details.title,status,accepted,pending,public:!!published})),content:calendar.get(project).items,events:community.context(project).events});}
    const growthPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/growth(?:\/(goals|contributions)(?:\/([a-f0-9-]+))?)?$/);
    if(growthPath){const project=await findProject(growthPath[1]);if(req.method==='GET'&&!growthPath[2])return json(res,200,growth.get(project));if(req.method==='POST'){const input=await body(req);if(growthPath[2]==='goals')return json(res,200,await growth.change(project,growthPath[3],input));if(growthPath[2]==='contributions')return json(res,200,await growth.review(project,growthPath[3],input));}}
    const calendarPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/calendar(?:\/([a-f0-9-]+))?$/);
    if(calendarPath){const project=await findProject(calendarPath[1]);if(req.method==='GET'&&!calendarPath[2])return json(res,200,calendar.get(project));if(req.method==='POST')return json(res,200,await calendar.save(project,calendarPath[2],await body(req)));}
    const contributionPath=path.match(/^\/api\/public\/projects\/([a-f0-9-]+)\/goals\/([a-f0-9-]+)\/submit$/);
    if(req.method==='POST'&&contributionPath){const project=(await allProjects()).find(item=>item.id===contributionPath[1]&&item.published&&item.tokenAddress);if(!project)return json(res,404,{error:'This project page is unavailable.'});return json(res,200,await growth.submit(project,contributionPath[2],owner,await body(req)));}
    const communityPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/community(?:\/(links|events|x)(?:\/([a-f0-9-]+|connect|finish|disconnect)(?:\/(attendees|metrics))?)?)?$/);
    if(communityPath){
      const project=await findProject(communityPath[1]),section=communityPath[2],id=communityPath[3];
      if(req.method==='GET'&&!section)return json(res,200,{...community.get(project),social:social.get(project),drafts:(await workspace.activity(project.id)).filter(item=>item.kind==='post').map(({id,title,content})=>({id,title,content}))});
      if(req.method==='GET'&&section==='events'&&id&&communityPath[4]==='attendees')return json(res,200,community.attendees(project,id));
      if(req.method==='POST'){
        const input=await body(req,40000);
        if(section==='links')return json(res,200,await community.saveLinks(project,input));
        if(section==='events')return json(res,200,await community.changeEvent(project,id,input));
        if(section==='x'){
          if(id==='connect'){const flow=social.start(project);setFlowCookie(res,flow.binding);return json(res,200,{url:flow.url});}
          if(id==='finish'){const result=await social.finish(project,flowCookie(req));setFlowCookie(res,'');return json(res,200,result);}
          if(id==='disconnect'){const result=await social.disconnect(project);setFlowCookie(res,'');return json(res,200,result);}
          if(communityPath[4]==='metrics')return json(res,200,await social.metrics(project,id));
          if(input.action==='publish')return json(res,200,await social.publish(project,id,input));
          if(input.action==='record')return json(res,200,await social.record(project,id,input));
          if(input.action==='report')return json(res,200,await social.report(project,id,input));
          return json(res,200,await social.save(project,id,input));
        }
      }
    }
    const rsvpPath=path.match(/^\/api\/public\/projects\/([a-f0-9-]+)\/events\/([a-f0-9-]+)\/rsvp$/);
    if(req.method==='POST'&&rsvpPath){const project=(await allProjects()).find(item=>item.id===rsvpPath[1]&&item.published&&item.tokenAddress);if(!project)return json(res,404,{error:'This project page is not available.'});return json(res,200,await community.rsvp(project,rsvpPath[2],owner,await body(req)));}
    const operationsPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/operations(?:\/(memory|settings|check|run|actions)(?:\/([a-f0-9-]+))?)?$/);
    if(operationsPath){const project=await findProject(operationsPath[1]),section=operationsPath[2];if(req.method==='GET'&&!section)return json(res,200,operations.get(project));if(req.method==='POST'){const input=await body(req,100000);if(section==='memory')return json(res,200,await operations.memory(project,input));if(section==='settings')return json(res,200,await operations.settings(project,input));if(section==='check')return json(res,200,await operations.check(project));if(section==='run')return json(res,200,await operations.run(project,{requestId:input.requestId}));if(section==='actions')return json(res,200,operationsPath[3]?await operations.action(project,operationsPath[3],input):await operations.add(project,input));}}
    if(req.method==='POST'&&path==='/api/projects'){
      const input=await body(req);
      if(input.chainId!==undefined&&Number(input.chainId)!==NETWORK.id)throw new Error('This project belongs to another network.');
      const name=String(input.name||'').trim().slice(0,32),symbol=String(input.symbol||'').trim().toUpperCase();
      if(!name||!/^[A-Z0-9]{2,10}$/.test(symbol))throw new Error('A project name and 2–10 character symbol are required.');
      const tokenAddress=address(input.tokenAddress,true),suppliedVault=address(input.vaultAddress,true);
      const draftInput=input.draft&&typeof input.draft==='object'&&!Array.isArray(input.draft)?input.draft:null;
      if(suppliedVault&&!tokenAddress&&!draftInput)throw new Error('Save the vault in a launch draft or link it to an issued token.');
      // A pre-launch vault is draft configuration, not a verified token/vault link.
      const vaultAddress=tokenAddress?suppliedVault:null;
      const launchHash=input.launchHash?String(input.launchHash):null;
      if(launchHash&&!/^0x[0-9a-fA-F]{64}$/.test(launchHash))throw new Error('Invalid launch transaction hash.');
      if(launchHash&&!tokenAddress)throw new Error('A launch receipt needs a token address.');
      let launchFactory=null,curveAddress=null;
      if(launchHash){await pons.verify();const receipt=await publicClient.getTransactionReceipt({hash:launchHash});if(receipt.from?.toLowerCase()!==owner||receipt.status!=='success'||receipt.to?.toLowerCase()!==PONS.factory.address.toLowerCase())throw new Error('Launch transaction could not be verified.');const events=parseEventLogs({abi:factoryAbi,logs:receipt.logs,eventName:'TokenLaunched'});const event=events.find(e=>e.address.toLowerCase()===PONS.factory.address.toLowerCase()&&e.args.deployer.toLowerCase()===owner&&e.args.token.toLowerCase()===tokenAddress?.toLowerCase());if(!event)throw new Error('This receipt does not contain the token launched by your wallet.');const launch=await pons.launchRecord(tokenAddress);const [onchainName,onchainSymbol]=await Promise.all(['name','symbol'].map(functionName=>publicClient.readContract({address:tokenAddress,abi:erc20Abi,functionName})));if(onchainName!==name||onchainSymbol!==symbol)throw new Error('Project details do not match the issued token.');if(vaultAddress){await pons.verifyVault(vaultAddress,owner);if(launch.creatorFeeRecipient.toLowerCase()!==vaultAddress.toLowerCase())throw new Error('The vault is not this launch’s fee recipient.');}launchFactory=PONS.factory.address;curveAddress=launch.curve;}
      if(vaultAddress&&!launchHash){const launch=await pons.launchRecord(tokenAddress);await pons.verifyVault(vaultAddress,owner);if(launch.creatorFeeRecipient.toLowerCase()!==vaultAddress.toLowerCase())throw new Error('The vault is not this token’s fee recipient.');}
      if(launchHash){const existing=(await projects()).find(p=>p.launchHash===launchHash);if(existing){if(existing.tokenAddress?.toLowerCase()!==tokenAddress?.toLowerCase())throw new Error('This receipt is already linked to another token.');return json(res,200,existing);}}
      const previous=input.draftId?await findProject(input.draftId):null;if(previous&&previous.status!=='draft')throw new Error('This project has already launched. Start a new draft.');
      const project={id:previous?.id||randomUUID(),owner,name,symbol,description:String(input.description||'').slice(0,2000),image:imageLink(input.image),website:projectLink(input.website),x:projectLink(input.x,'x'),telegram:projectLink(input.telegram,'telegram'),tokenAddress,vaultAddress,launchHash,launchFactory,curveAddress,status:launchHash?'launched':tokenAddress?'imported':'draft',chainId:NETWORK.id,createdAt:previous?.createdAt||new Date().toISOString(),published:false};
      if(!tokenAddress&&draftInput){project.draft=Object.fromEntries(['name','symbol','description','image','website','x','telegram','projectTreasury','auditTreasury','auditBps','creatorFeeRecipient','creatorTaxBps','configId','splitEnabled','holdersEnabled','socialEnabled','vaultAddress'].filter(key=>['string','number','boolean'].includes(typeof draftInput[key])).map(key=>[key,typeof draftInput[key]==='string'?draftInput[key].slice(0,2000):draftInput[key]]));project.draft.vaultAddress=suppliedVault||address(draftInput.vaultAddress,true)||'';if(Array.isArray(draftInput.snipeTaxExemptions))project.draft.snipeTaxExemptions=[...new Set(draftInput.snipeTaxExemptions.filter(item=>typeof item==='string'&&isAddress(item,{strict:false})&&item.toLowerCase()!==zeroAddress).map(item=>getAddress(item.toLowerCase())))].slice(0,32);}
      const saved=await mutate(list=>{const confirmed=launchHash?list.find(item=>item.owner===owner&&item.launchHash===launchHash):null;if(confirmed)return confirmed;const index=list.findIndex(item=>item.id===project.id);if(index>=0){if(list[index].status!=='draft')throw new Error('This project has already launched. Start a new draft.');const record=Object.assign(list[index],project);if(tokenAddress)delete record.draft;return record;}list.push(project);return project;});
      if(saved.id!==project.id)return json(res,200,saved);
      if(launchHash)await workspace.appendActivity(project.id,{kind:'launch',title:'Token launched',content:`$${symbol} launched on Robinhood Chain.`,transactionHash:launchHash,public:true});
      return json(res,201,saved);
    }
    const activityPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity$/);
    if(req.method==='GET'&&activityPath){await findProject(activityPath[1]);return json(res,200,await workspace.activity(activityPath[1]));}
    const editUpdatePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity\/([a-f0-9-]+)\/content$/);
    if(req.method==='POST'&&editUpdatePath){const project=await findProject(editUpdatePath[1]),input=await body(req,100000);return json(res,200,await workspace.editActivity(project.id,editUpdatePath[2],input.content,input.revision));}
    const publishUpdatePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity\/([a-f0-9-]+)\/visibility$/);
    if(req.method==='POST'&&publishUpdatePath){const project=await findProject(publishUpdatePath[1]);const input=await body(req);if(typeof input.public!=='boolean')throw new Error('Choose whether to share this update.');if(input.public&&!project.published)throw new Error('Publish your project page before sharing an update.');return json(res,200,await workspace.publishActivity(project.id,publishUpdatePath[2],input.public,input.revision));}
    const publishPagePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/publication$/);
    if(req.method==='POST'&&publishPagePath){const project=await findProject(publishPagePath[1]),input=await body(req);if(typeof input.published!=='boolean')throw new Error('Choose whether to publish your project.');if(input.published){if(!project.tokenAddress)throw new Error('Launch or import an onchain token before publishing its page.');await verifyChain();const code=await publicClient.getCode({address:project.tokenAddress});if(!code||code==='0x')throw new Error('This token could not be verified on Robinhood Chain.');let tokenInfo;try{tokenInfo=await Promise.all(['symbol','decimals','totalSupply'].map(functionName=>publicClient.readContract({address:project.tokenAddress,abi:erc20Abi,functionName})));}catch{throw new Error('This address could not be verified as a token on Robinhood Chain.');}if(String(tokenInfo[0]).toUpperCase()!==project.symbol.toUpperCase())throw new Error('The project symbol does not match the onchain token. Import the correct token details.');const launch=await pons.launchRecord(project.tokenAddress);if(launch.deployer.toLowerCase()!==owner)throw new Error('Only the verified creating wallet can publish this project. Imported tokens can still be tracked privately.');}return json(res,200,await mutate(list=>{const record=list.find(item=>item.id===project.id);record.published=input.published;if(input.published)record.publishedAt=new Date().toISOString();return record;}));}
    const publicPath=path.match(/^\/api\/public\/projects\/([a-f0-9-]+)(\/snapshot)?$/);
    if(req.method==='GET'&&publicPath){const project=(await allProjects()).find(item=>item.id===publicPath[1]&&item.published&&item.tokenAddress);if(!project)return json(res,404,{error:'This project page is not available.'});if(publicPath[2])return json(res,200,await snapshot(project));return json(res,200,{project:publicProject(project),community:community.publicView(project,owner),growth:growth.publicView(project,owner),activity:(await workspace.activity(project.id,{publicOnly:true})).map(({id,kind,source,title,content,createdAt,updatedAt,transactionHash})=>({id,kind,source,title,content,createdAt,updatedAt,transactionHash}))});}
    const snapshotPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/snapshot$/);
    if(req.method==='GET'&&snapshotPath)return json(res,200,await snapshot(await findProject(snapshotPath[1])));
    const assistantPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/assistant$/);
    if(req.method==='POST'&&assistantPath){const project=await findProject(assistantPath[1]),input=await body(req),aiName=String(input.aiName||'Copilot').trim(),aiVoice=String(input.aiVoice||'Clear & practical'),aiGoal=String(input.aiGoal||'').trim();if(aiName.length>40||aiGoal.length>500||!['Clear & practical','Playful & bold','Warm & community-first'].includes(aiVoice))throw new Error('Choose a name under 40 characters, an available voice and a goal under 500 characters.');return json(res,200,await mutate(list=>{const record=list.find(p=>p.id===project.id);Object.assign(record,{aiName,aiVoice,aiGoal});return record;}));}
    const chatPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/chat$/);
    if(req.method==='POST'&&chatPath){
      const project=await findProject(chatPath[1]),input=await body(req,40000),content=typeof input.content==='string'?input.content.trim():'';
      if(!content||content.length>4000)throw new Error('Write a message between 1 and 4,000 characters.');
      let chat=null;
      if(input.chatId!==undefined&&input.chatId!==null){if(typeof input.chatId!=='string')throw new Error('Choose a chat.');chat=workspace.read('chats').find(item=>item.id===input.chatId&&item.projectId===project.id&&item.owner===owner);if(!chat)throw Object.assign(new Error('Chat not found.'),{status:404});}
      if(aiInFlight.has(owner))return json(res,429,{error:'Your chat reply is already being written.'});
      const turns=[...storedTurns(chat?.messages),{role:'user',content}];
      const facts=await projectChatFacts(project);
      const result=await operations.write(project,'chat',()=>generateCopilot({project,facts,task:'chat',messages:turns}));
      const saved=await workspace.change('chats',records=>{
        let record=chat?records.find(item=>item.id===chat.id):null;
        if(!record){const own=records.filter(item=>item.projectId===project.id&&item.owner===owner).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));while(own.length>=20){const index=records.findIndex(item=>item.id===own.shift().id);records.splice(index,1);}record={id:randomUUID(),projectId:project.id,owner,createdAt:result.generatedAt,updatedAt:result.generatedAt,messages:[]};records.push(record);}
        record.messages.push({role:'user',content,createdAt:result.generatedAt},{role:'assistant',content:result.content,createdAt:result.generatedAt});
        if(record.messages.length>40)record.messages.splice(0,record.messages.length-40);
        record.updatedAt=result.generatedAt;
        return record;
      });
      const coverage=facts.xray?{checkedAt:facts.xray.checkedAt,fromBlock:facts.xray.observedTrading?.coverage?.fromBlock??null,toBlock:facts.xray.observedTrading?.coverage?.toBlock??null,note:facts.xray.scope}:null;
      return json(res,200,{chatId:saved.id,reply:result.content,coverage,generatedAt:result.generatedAt,messages:saved.messages});
    }
    const chatRemovePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/chats\/remove$/);
    if(req.method==='POST'&&chatRemovePath){const project=await findProject(chatRemovePath[1]),input=await body(req);await workspace.change('chats',records=>{const index=records.findIndex(item=>item.id===input.chatId&&item.projectId===project.id&&item.owner===owner);if(index<0)throw Object.assign(new Error('Chat not found.'),{status:404});records.splice(index,1);});return json(res,200,{ok:true});}
    const chatsPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/chats(\/([a-f0-9-]+))?$/);
    if(req.method==='GET'&&chatsPath){
      const project=await findProject(chatsPath[1]);
      if(!chatsPath[3])return json(res,200,{items:chatSummaries(workspace.read('chats'),project,owner)});
      const chat=workspace.read('chats').find(item=>item.id===chatsPath[3]&&item.projectId===project.id&&item.owner===owner);
      if(!chat)throw Object.assign(new Error('Chat not found.'),{status:404});
      return json(res,200,{id:chat.id,messages:chat.messages,createdAt:chat.createdAt,updatedAt:chat.updatedAt});
    }
    if(req.method==='POST'&&path==='/api/copilot'){
      const input=await body(req);const project=await findProject(input.projectId);if(!['brief','post','plan'].includes(input.task))throw new Error('Choose a daily brief, a post draft, or a community plan.');
      if(aiInFlight.has(owner))return json(res,429,{error:'Your draft is already being written.'});
      let facts=null;if(project.tokenAddress){try{const chain=await snapshot(project);let observedMarket=null;try{observedMarket=await market.details(project.tokenAddress);}catch{}facts={...chain,market:observedMarket};}catch{facts={error:'Chain data is currently unavailable.'};}}
      const operatingContext=await operations.context(project),result=await operations.write(project,input.task,()=>generateCopilot({project,facts:{chain:facts,operatingContext},task:input.task}));const titles={brief:'Daily brief',post:'Social draft',plan:'7-day plan'};const entry=await workspace.appendActivity(project.id,{kind:input.task,title:titles[input.task],content:result.content,createdAt:result.generatedAt,public:false});return json(res,200,{...result,activityId:entry.id});
    }
    if(req.method==='GET'&&path==='/api/launch/options')return json(res,200,{...(await pons.options(owner)),aiConfigured:aiConfigured()});
    if(req.method==='POST'&&path==='/api/launch/assist'){
      const input=await body(req);
      return json(res,200,await withAI(owner,async()=>{
        const task=String(input.task||'');
        if(!['identity','fee'].includes(task))throw new Error('Choose an available launch assist.');
        const cleanDraft={};for(const key of ['name','symbol','description','website','x','telegram'])if(typeof input.draft?.[key]==='string')cleanDraft[key]=String(input.draft[key]).slice(0,2000);
        if(Number.isSafeInteger(input.draft?.configId))cleanDraft.configId=input.draft.configId;
        const facts=task==='fee'?await pons.options(owner):null;
        return launchAssist({task,idea:input.idea,draft:cleanDraft,facts:facts?{maxCreatorTaxBps:facts.maxCreatorTaxBps,feeETH:facts.feeETH,configs:facts.configs.map(config=>({id:config.id,curveFeeBps:config.curveFeeBps,graduationThreshold:config.graduationThreshold}))}:null});
      }));
    }
    if(req.method==='POST'&&path==='/api/launch/prepare')return json(res,200,await pons.prepareLaunch(owner,await body(req)));
    if(req.method==='POST'&&path==='/api/vault/prepare')return json(res,200,await pons.prepareVault(owner,await body(req)));
    if(req.method==='POST'&&path==='/api/trade/quote')return json(res,200,await pons.quote(owner,await body(req)));
    if(req.method==='POST'&&path==='/api/trade/step'){const input=await body(req);return json(res,200,await pons.tradeStep(owner,input.id,input.index));}
    const revenuePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/revenue\/prepare$/);
    if(req.method==='POST'&&revenuePath){const project=await findProject(revenuePath[1]),input=await body(req);return json(res,200,await pons.revenueAction(owner,project,input.action,input.recipient));}
    const distributionPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/distribution\/prepare$/);
    if(req.method==='POST'&&distributionPath){const project=await findProject(distributionPath[1]);const holdersResult=await market.holders(project.tokenAddress);if(!holdersResult.holderDataAvailable)throw new Error('Holder data is temporarily unavailable. Try again shortly.');return json(res,200,await pons.prepareDistribution(owner,project,holdersResult));}
    const escrowPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/community\/(prepare|proposals)$/);
    if(escrowPath&&req.method==='POST'&&escrowPath[2]==='prepare'){const project=await findProject(escrowPath[1]),input=await body(req);if(String(input.action)==='execute'&&!social.get(project).account)throw new Error('Connect your project X account before releasing escrow.');return json(res,200,await pons.socialEscrowAction(owner,project,String(input.action||''),input));}
    if(escrowPath&&req.method==='GET'&&escrowPath[2]==='proposals'){const project=await findProject(escrowPath[1]);return json(res,200,await pons.socialProposals(project));}
    if(req.method==='GET'&&!path.startsWith('/api/')){
      const requested=resolve(root,'dist',path==='/'||/^\/project\/[a-f0-9-]+$/.test(path)?'index.html':`.${path}`);
      const distRoot=resolve(root,'dist');
      if(!requested.startsWith(`${distRoot}/`)&&!requested.startsWith(`${distRoot}\\`)&&requested!==resolve(distRoot,'index.html'))throw new Error('Invalid file path.');
      try{await stat(requested);const file=await readFile(requested);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(requested)]||'application/octet-stream'),'X-Content-Type-Options':'nosniff'});return res.end(file);}catch{res.writeHead(404);return res.end('Build the app with pnpm build, or use pnpm dev.');}
    }
    json(res,404,{error:'Route not found.'});
  }catch(error){const message=error.shortMessage||error.message||'The request failed.',technical=/URL:|Request body|Contract Call:|Version:|fetch failed|HTTP request|ECONN|SQLITE_|database|no such table/i.test(message);json(res,error.name==='Error'&&[404,409,429,503].includes(error.status)?error.status:400,{error:/insufficient funds|insufficient balance|exceeds the balance/i.test(message)?'Your wallet needs enough ETH for this action and network gas.':technical?'This service is temporarily unavailable. Please try again shortly.':message.slice(0,500),...(['AI_ACCESS','AI_BUSY','AI_TIMEOUT','AI_UNAVAILABLE','AI_RESPONSE_INVALID'].includes(error.code)?{code:error.code}:{})});}
}));
let monitorTimer;
server.on('listening',()=>{monitorTimer=setInterval(()=>{monitor.check().catch(()=>{});operations.tick().catch(()=>{});},60000);monitorTimer.unref();});
server.on('close',()=>clearInterval(monitorTimer));
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4318);server.listen(port,'127.0.0.1',()=>console.log(`MemeHelm: http://127.0.0.1:${port}`));}
