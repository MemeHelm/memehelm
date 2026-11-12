import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAddress, getAddress, zeroAddress, encodeFunctionData, parseEther,erc20Abi,parseEventLogs } from 'viem';
import { NETWORK } from '../shared/config.mjs';
import { buildLaunchParams, validateLaunch } from '../shared/launch.mjs';
import { publicClient, artifact, chainStatus, snapshot, verifyChain,verifyFactory } from './chain.mjs';
import { aiConfigured, generateCopilot } from './copilot.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createAuth} from './auth.mjs';
import {createMarket} from './market.mjs';
import {createMonitor} from './monitor.mjs';
import {createWorkspaceStore} from './workspace.mjs';
import {imageLink,projectLink,publicProject} from '../shared/project.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const dataDirectory = resolve(root, process.env.DATA_DIRECTORY || 'data/robinhood-independent');
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
async function body(req) { let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>20000)throw new Error('Request is too large.');}return content?JSON.parse(content):{}; }
function address(value,optional=false) { if(optional&&!value)return null;if(typeof value!=='string'||!isAddress(value,{strict:false})||value.toLowerCase()===zeroAddress)throw new Error('A valid nonzero EVM address is required.');return getAddress(value.toLowerCase()); }
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data,(_,value)=>typeof value==='bigint'?String(value):value));}
async function findProject(id){const project=(await projects()).find(p=>p.id===id);if(!project)throw Object.assign(new Error('Project not found.'),{status:404});return project;}
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
    const publicApi=req.method==='GET'&&(path==='/api/status'||path.startsWith('/api/artifacts/')||path.startsWith('/api/public/')||path.startsWith('/api/market/'));
    if(path.startsWith('/api/')&&!publicApi&&!context.getStore()?.owner)return json(res,401,{error:'Sign in with your wallet to open your private workspace.'});
    const owner=context.getStore()?.owner;
    if(req.method==='GET'&&path==='/api/public/discover')return json(res,200,{projects:(await allProjects()).filter(item=>item.published&&item.tokenAddress).map(publicProject)});
    if(req.method==='GET'&&path==='/api/market/launches')return json(res,200,await market.feed());
    const marketPath=path.match(/^\/api\/market\/tokens\/(0x[a-fA-F0-9]{40})$/);
    if(req.method==='GET'&&marketPath){const token=await market.details(marketPath[1]),trades=await market.trades(marketPath[1]);return json(res,200,{token,history:market.history(marketPath[1]),trades});}
    if(req.method==='GET'&&path==='/api/watches')return json(res,200,workspace.read('watches').filter(item=>item.owner===owner));
    if(req.method==='POST'&&path==='/api/watches'){
      const input=await body(req),tokenAddress=address(input.address).toLowerCase(),priceThreshold=Number(input.priceThreshold??10);if(!Number.isFinite(priceThreshold)||priceThreshold<1||priceThreshold>100)throw new Error('Choose a price threshold from 1% to 100%.');
      const token=await market.details(tokenAddress);return json(res,200,await workspace.change('watches',records=>{let item=records.find(item=>item.owner===owner&&item.address===tokenAddress);if(!item){if(records.filter(item=>item.owner===owner).length>=20)throw new Error('Your watchlist supports up to 20 tokens.');item={id:randomUUID(),owner,address:tokenAddress};records.push(item);}Object.assign(item,{symbol:token.symbol||'TOKEN',enabled:input.enabled!==false,priceThreshold,last:{price:token.price,holdersCount:token.holdersCount,graduated:null},priceAvailable:token.price!==null,checkedAt:token.checkedAt,error:null});return item;}));
    }
    if(req.method==='POST'&&path==='/api/watches/check')return json(res,200,await monitor.check(owner));
    if(req.method==='POST'&&path==='/api/watches/remove'){const input=await body(req);await workspace.change('watches',records=>{const index=records.findIndex(item=>item.id===input.id&&item.owner===owner);if(index<0)throw Object.assign(new Error('Watch not found.'),{status:404});records.splice(index,1);});return json(res,200,{ok:true});}
    if(req.method==='GET'&&path==='/api/watches/briefs')return json(res,200,workspace.read('briefs').filter(item=>item.owner===owner).reverse().slice(0,30));
    if(req.method==='POST'&&path==='/api/watches/brief'){
      const input=await body(req),watch=workspace.read('watches').find(item=>item.id===input.id&&item.owner===owner);if(!watch)throw new Error('Watch not found.');
      if(aiInFlight.has(owner))return json(res,429,{error:'Your brief is already being written.'});
      reserveAIRequest(owner);aiInFlight.add(owner);
      try{const token=await market.details(watch.address),alerts=workspace.read('alerts').filter(item=>item.owner===owner&&item.address===watch.address).slice(-10);const result=await generateCopilot({project:{name:token.name||watch.symbol,symbol:token.symbol||watch.symbol,description:'A watched Robinhood Testnet token. Explain observed changes and missing information without recommending trades.',status:'watched'},facts:{market:token,alerts},task:'brief'});const entry={id:randomUUID(),owner,address:watch.address,symbol:watch.symbol,content:result.content,createdAt:result.generatedAt};await workspace.change('briefs',records=>{records.push(entry);if(records.length>2000)records.splice(0,records.length-2000);});return json(res,200,entry);}finally{aiInFlight.delete(owner);}
    }
    if(req.method==='GET'&&path==='/api/alerts')return json(res,200,workspace.read('alerts').filter(item=>item.owner===owner).reverse().slice(0,100));
    if(req.method==='POST'&&path==='/api/alerts/read'){const input=await body(req);await workspace.change('alerts',records=>{for(const item of records)if(item.owner===owner&&(!input.id||item.id===input.id))item.read=true;});return json(res,200,{ok:true});}

    if(req.method==='GET'&&path==='/api/status')return json(res,200,{network:NETWORK,chain:await chainStatus(),aiConfigured:aiConfigured(),factory:process.env.MEMEHELM_LAUNCH_FACTORY_ADDRESS||null,mode:'testnet',auditStatus:'unaudited'});
    if(req.method==='GET'&&path.startsWith('/api/artifacts/'))return json(res,200,await artifact(path.split('/').pop()));
    if(req.method==='GET'&&path==='/api/projects')return json(res,200,await projects());
    if(req.method==='POST'&&path==='/api/projects'){
      const input=await body(req);
      if(input.chainId!==undefined&&Number(input.chainId)!==NETWORK.id)throw new Error('This project belongs to another network.');
      const name=String(input.name||'').trim().slice(0,32),symbol=String(input.symbol||'').trim().toUpperCase();
      if(!name||!/^[A-Z0-9]{2,10}$/.test(symbol))throw new Error('A project name and 2–10 character symbol are required.');
      const tokenAddress=address(input.tokenAddress,true),vaultAddress=address(input.vaultAddress,true);
      if(vaultAddress&&!tokenAddress)throw new Error('A vault needs a token address.');
      const launchHash=input.launchHash?String(input.launchHash):null;
      if(launchHash&&!/^0x[0-9a-fA-F]{64}$/.test(launchHash))throw new Error('Invalid launch transaction hash.');
      // A receipt is checked before a project can be called a confirmed launch.
      let launchFactory=address(input.launchFactory,true);
      if(launchHash){await verifyChain();const receipt=await publicClient.getTransactionReceipt({hash:launchHash});if(receipt.from?.toLowerCase()!==owner||receipt.status!=='success'||!receipt.to)throw new Error('Launch transaction could not be verified.');if(launchFactory&&launchFactory.toLowerCase()!==receipt.to.toLowerCase())throw new Error('Launch factory does not match the receipt.');launchFactory=receipt.to;const {abi}=await verifyFactory(launchFactory);const events=parseEventLogs({abi,logs:receipt.logs,eventName:'TokenCreated'});if(!events.some(e=>e.address.toLowerCase()===launchFactory.toLowerCase()&&e.args.creator?.toLowerCase()===owner&&e.args.token?.toLowerCase()===tokenAddress?.toLowerCase()&&e.args.vault?.toLowerCase()===vaultAddress?.toLowerCase()&&e.args.name===name&&e.args.symbol===symbol))throw new Error('Launch receipt does not contain this token, creator and vault.');}
      const previous=input.draftId?await findProject(input.draftId):null;if(previous&&previous.status!=='draft')throw new Error('This project has already launched. Start a new draft.');
      const project={id:previous?.id||randomUUID(),owner,name,symbol,description:String(input.description||'').slice(0,2000),image:imageLink(input.image),website:projectLink(input.website),x:projectLink(input.x,'x'),telegram:projectLink(input.telegram,'telegram'),tokenAddress,vaultAddress,launchHash,launchFactory,status:launchHash?'launched':tokenAddress?'imported':'draft',chainId:NETWORK.id,createdAt:previous?.createdAt||new Date().toISOString(),published:false};
      if(!tokenAddress&&input.draft&&typeof input.draft==='object')project.draft=Object.fromEntries(['name','symbol','description','meta','image','website','x','telegram','projectTreasury','auditTreasury','factory','auditBps','totalSupply','initialFunding'].filter(key=>['string','number'].includes(typeof input.draft[key])).map(key=>[key,typeof input.draft[key]==='string'?input.draft[key].slice(0,2000):input.draft[key]]));
      await mutate(list=>{const index=list.findIndex(item=>item.id===project.id);if(index>=0)list[index]=project;else list.push(project);return project;});
      if(launchHash)await workspace.appendActivity(project.id,{kind:'launch',title:'Token launched',content:`$${symbol} launched on Robinhood Testnet.`,transactionHash:launchHash,public:true});
      return json(res,201,project);
    }
    const activityPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity$/);
    if(req.method==='GET'&&activityPath){await findProject(activityPath[1]);return json(res,200,await workspace.activity(activityPath[1]));}
    const publishUpdatePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity\/([a-f0-9-]+)\/visibility$/);
    if(req.method==='POST'&&publishUpdatePath){const project=await findProject(publishUpdatePath[1]);const input=await body(req);if(typeof input.public!=='boolean')throw new Error('Choose whether to share this update.');if(input.public&&!project.published)throw new Error('Publish your project page before sharing an update.');return json(res,200,await workspace.publishActivity(project.id,publishUpdatePath[2],input.public));}
    const publishPagePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/publication$/);
    if(req.method==='POST'&&publishPagePath){const project=await findProject(publishPagePath[1]),input=await body(req);if(typeof input.published!=='boolean')throw new Error('Choose whether to publish your project.');if(input.published){if(!project.tokenAddress)throw new Error('Launch or import an onchain token before publishing its page.');await verifyChain();const code=await publicClient.getCode({address:project.tokenAddress});if(!code||code==='0x')throw new Error('This token could not be verified on Robinhood Testnet.');let tokenInfo;try{tokenInfo=await Promise.all(['symbol','decimals','totalSupply'].map(functionName=>publicClient.readContract({address:project.tokenAddress,abi:erc20Abi,functionName})));}catch{throw new Error('This address could not be verified as a token on Robinhood Testnet.');}if(String(tokenInfo[0]).toUpperCase()!==project.symbol.toUpperCase())throw new Error('The project symbol does not match the onchain token. Import the correct token details.');if(!project.launchHash){const launch=(await market.feed()).items.find(item=>item.tokenAddress.toLowerCase()===project.tokenAddress.toLowerCase());if(launch?.creator?.toLowerCase()!==owner)throw new Error('Only the verified creating wallet can publish this project. Imported tokens can still be tracked privately.');}}return json(res,200,await mutate(list=>{const record=list.find(item=>item.id===project.id);record.published=input.published;if(input.published)record.publishedAt=new Date().toISOString();return record;}));}
    const publicPath=path.match(/^\/api\/public\/projects\/([a-f0-9-]+)(\/snapshot)?$/);
    if(req.method==='GET'&&publicPath){const project=(await allProjects()).find(item=>item.id===publicPath[1]&&item.published&&item.tokenAddress);if(!project)return json(res,404,{error:'This project page is not available.'});if(publicPath[2])return json(res,200,await snapshot(project));return json(res,200,{project:publicProject(project),activity:(await workspace.activity(project.id,{publicOnly:true})).map(({id,kind,title,content,createdAt,transactionHash})=>({id,kind,title,content,createdAt,transactionHash}))});}
    const snapshotPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/snapshot$/);
    if(req.method==='GET'&&snapshotPath)return json(res,200,await snapshot(await findProject(snapshotPath[1])));
    if(req.method==='POST'&&path==='/api/copilot'){
      const input=await body(req);const project=await findProject(input.projectId);if(!['brief','post','plan'].includes(input.task))throw new Error('Choose a daily brief, a post draft, or a community plan.');
      if(aiInFlight.has(owner))return json(res,429,{error:'Your draft is already being written.'});
      reserveAIRequest(owner);aiInFlight.add(owner);
      try{let facts=null;if(project.tokenAddress){try{const chain=await snapshot(project);let observedMarket=null;try{observedMarket=await market.details(project.tokenAddress);}catch{}facts={...chain,market:observedMarket};}catch{facts={error:'Chain data is currently unavailable.'};}}
        const result=await generateCopilot({project,facts,task:input.task});const titles={brief:'Daily brief',post:'Social draft',plan:'7-day plan'};const entry=await workspace.appendActivity(project.id,{kind:input.task,title:titles[input.task],content:result.content,createdAt:result.generatedAt,public:false});return json(res,200,{...result,activityId:entry.id});
      }finally{aiInFlight.delete(owner);}
    }
    if(req.method==='POST'&&path==='/api/launch/prepare'){
      const input=validateLaunch(await body(req));await verifyChain();
      const {abi}=await verifyFactory(input.factory),params=buildLaunchParams(input),salt=`0x${randomBytes(32).toString('hex')}`;
      const predictedToken=await publicClient.readContract({address:input.factory,abi,functionName:'predictTokenAddress',args:[owner,params,salt]});
      const existing=await publicClient.getCode({address:predictedToken});if(existing&&existing!=='0x')throw new Error('Prepared address is already in use. Try again.');
      return json(res,200,{chainId:NETWORK.id,to:input.factory,data:encodeFunctionData({abi,functionName:'createToken',args:[params,salt]}),value:parseEther(input.initialFunding).toString(),salt,predictedToken,settings:input});
    }
    if(req.method==='GET'&&!path.startsWith('/api/')){
      const requested=resolve(root,'dist',path==='/'||/^\/project\/[a-f0-9-]+$/.test(path)?'index.html':`.${path}`);
      const distRoot=resolve(root,'dist');
      if(!requested.startsWith(`${distRoot}/`)&&!requested.startsWith(`${distRoot}\\`)&&requested!==resolve(distRoot,'index.html'))throw new Error('Invalid file path.');
      try{await stat(requested);const file=await readFile(requested);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(requested)]||'application/octet-stream'),'X-Content-Type-Options':'nosniff'});return res.end(file);}catch{res.writeHead(404);return res.end('Build the app with pnpm build, or use pnpm dev.');}
    }
    json(res,404,{error:'Route not found.'});
  }catch(error){const technical=/URL:|Request body|Contract Call:|Version:|fetch failed|HTTP request|ECONN|SQLITE_|database|no such table/i.test(error.message||'');json(res,error.name==='Error'&&[404,429].includes(error.status)?error.status:400,{error:technical?'This service is temporarily unavailable. Please try again shortly.':error.message?.slice(0,500)||'The request failed.'});}
}));
let monitorTimer;
server.on('listening',()=>{monitorTimer=setInterval(()=>monitor.check().catch(()=>{}),60000);monitorTimer.unref();});
server.on('close',()=>clearInterval(monitorTimer));
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4318);server.listen(port,'127.0.0.1',()=>console.log(`MemeHelm: http://127.0.0.1:${port}`));}
