import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAddress, getAddress, zeroAddress, encodeFunctionData, parseAbi,erc20Abi } from 'viem';
import { NETWORK, AUDIT_REFERENCE_BNB } from '../shared/config.mjs';
import { buildLaunchParams, validateLaunch } from '../shared/launch.mjs';
import { publicClient, artifact, chainStatus, snapshot, verifyChain } from './chain.mjs';
import { aiConfigured, generateCopilot } from './copilot.mjs';
import {createWorkspaceStore} from './workspace.mjs';
import {imageLink,projectLink,publicProject} from '../shared/project.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const dataDirectory = resolve(root, process.env.DATA_DIRECTORY || 'data');
const workspace=createWorkspaceStore(dataDirectory);
const projects=workspace.projects,mutate=workspace.mutateProjects;
const aiRequests=new Map();
const aiInFlight=new Set();
let mining = false;
async function body(req) { let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>20000)throw new Error('Request is too large.');}return content?JSON.parse(content):{}; }
function address(value,optional=false) { if(optional&&!value)return null;if(typeof value!=='string'||!isAddress(value,{strict:false})||value.toLowerCase()===zeroAddress)throw new Error('A valid nonzero EVM address is required.');return getAddress(value.toLowerCase()); }
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data,(_,value)=>typeof value==='bigint'?String(value):value));}
async function findProject(id){const project=(await projects()).find(p=>p.id===id);if(!project)throw new Error('Project not found.');return project;}
function writable(req){const origin=req.headers.origin;if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):(4317|4318)$/.test(origin))throw new Error('This local workspace rejects requests from other sites.');if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON content type is required.');}
export const server=createServer(async(req,res)=>{
  try {
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))throw new Error('Invalid local workspace host.');
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(req.method==='POST')writable(req);
    if(req.method==='GET'&&path==='/api/status')return json(res,200,{network:NETWORK,chain:await chainStatus(),aiConfigured:aiConfigured(),factory:process.env.SPLIT_FACTORY_ADDRESS||null,auditReferenceBNB:AUDIT_REFERENCE_BNB,mode:'testnet',auditStatus:'unaudited'});
    if(req.method==='GET'&&path.startsWith('/api/artifacts/'))return json(res,200,await artifact(path.split('/').pop()));
    if(req.method==='GET'&&path==='/api/projects')return json(res,200,await projects());
    if(req.method==='POST'&&path==='/api/projects'){
      const input=await body(req);
      const name=String(input.name||'').trim().slice(0,32),symbol=String(input.symbol||'').trim().toUpperCase();
      if(!name||!/^[A-Z0-9]{2,10}$/.test(symbol))throw new Error('A project name and 2–10 character symbol are required.');
      const tokenAddress=address(input.tokenAddress,true),vaultAddress=address(input.vaultAddress,true);
      if(vaultAddress&&!tokenAddress)throw new Error('A vault needs a token address.');
      const launchHash=input.launchHash?String(input.launchHash):null;
      if(launchHash&&!/^0x[0-9a-fA-F]{64}$/.test(launchHash))throw new Error('Invalid launch transaction hash.');
      // A receipt is checked before a project can be called a confirmed launch.
      if(launchHash){await verifyChain();const receipt=await publicClient.getTransactionReceipt({hash:launchHash});if(receipt.status!=='success'||receipt.to?.toLowerCase()!==NETWORK.vaultPortal.toLowerCase())throw new Error('Launch transaction could not be verified.');const eventAbi=(await artifact('IVaultPortal')).abi;const {parseEventLogs}=await import('viem');const events=parseEventLogs({abi:eventAbi,logs:receipt.logs,eventName:'FlapTaxVaultTokenCreated'});if(!events.some(e=>e.address.toLowerCase()===NETWORK.vaultPortal.toLowerCase()&&e.args.token?.toLowerCase()===tokenAddress?.toLowerCase()&&e.args.vault?.toLowerCase()===vaultAddress?.toLowerCase()))throw new Error('Launch receipt does not contain this token and vault.');}
      const previous=input.draftId?await findProject(input.draftId):null;if(previous&&previous.status!=='draft')throw new Error('This project has already launched. Start a new draft.');
      const project={id:previous?.id||randomUUID(),name,symbol,description:String(input.description||'').slice(0,2000),image:imageLink(input.image),website:projectLink(input.website),x:projectLink(input.x,'x'),telegram:projectLink(input.telegram,'telegram'),tokenAddress,vaultAddress,launchHash,status:launchHash?'launched':tokenAddress?'imported':'draft',chainId:97,createdAt:previous?.createdAt||new Date().toISOString(),published:false};
      if(!tokenAddress&&input.draft&&typeof input.draft==='object')project.draft=Object.fromEntries(['name','symbol','description','meta','image','website','x','telegram','projectTreasury','auditTreasury','factory','auditBps','buyTaxRate','sellTaxRate','taxDays','antiFarmerDays','initialBuy'].filter(key=>['string','number'].includes(typeof input.draft[key])).map(key=>[key,typeof input.draft[key]==='string'?input.draft[key].slice(0,2000):input.draft[key]]));
      await mutate(list=>{const index=list.findIndex(item=>item.id===project.id);if(index>=0)list[index]=project;else list.push(project);return project;});
      if(launchHash)await workspace.appendActivity(project.id,{kind:'launch',title:'Token launched',content:`$${symbol} launched on BNB Testnet.`,transactionHash:launchHash,public:true});
      return json(res,201,project);
    }
    const activityPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity$/);
    if(req.method==='GET'&&activityPath){await findProject(activityPath[1]);return json(res,200,await workspace.activity(activityPath[1]));}
    const publishUpdatePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/activity\/([a-f0-9-]+)\/visibility$/);
    if(req.method==='POST'&&publishUpdatePath){const project=await findProject(publishUpdatePath[1]);const input=await body(req);if(typeof input.public!=='boolean')throw new Error('Choose whether to share this update.');if(input.public&&!project.published)throw new Error('Publish your project page before sharing an update.');return json(res,200,await workspace.publishActivity(project.id,publishUpdatePath[2],input.public));}
    const publishPagePath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/publication$/);
    if(req.method==='POST'&&publishPagePath){const project=await findProject(publishPagePath[1]),input=await body(req);if(typeof input.published!=='boolean')throw new Error('Choose whether to publish your project.');if(input.published){if(!project.tokenAddress)throw new Error('Launch or import an onchain token before publishing its page.');await verifyChain();const code=await publicClient.getCode({address:project.tokenAddress});if(!code||code==='0x')throw new Error('This token could not be verified on BNB Testnet.');let tokenInfo;try{tokenInfo=await publicClient.multicall({contracts:['symbol','decimals','totalSupply'].map(functionName=>({address:project.tokenAddress,abi:erc20Abi,functionName})),allowFailure:false});}catch{throw new Error('This address could not be verified as a token on BNB Testnet.');}if(String(tokenInfo[0]).toUpperCase()!==project.symbol.toUpperCase())throw new Error('The project symbol does not match the onchain token. Import the correct token details.');}return json(res,200,await mutate(list=>{const record=list.find(item=>item.id===project.id);record.published=input.published;if(input.published)record.publishedAt=new Date().toISOString();return record;}));}
    const publicPath=path.match(/^\/api\/public\/projects\/([a-f0-9-]+)(\/snapshot)?$/);
    if(req.method==='GET'&&publicPath){const project=(await projects()).find(item=>item.id===publicPath[1]&&item.published&&item.tokenAddress);if(!project)return json(res,404,{error:'This project page is not available.'});if(publicPath[2])return json(res,200,await snapshot(project));return json(res,200,{project:publicProject(project),activity:(await workspace.activity(project.id,{publicOnly:true})).map(({id,kind,title,content,createdAt,transactionHash})=>({id,kind,title,content,createdAt,transactionHash}))});}
    const snapshotPath=path.match(/^\/api\/projects\/([a-f0-9-]+)\/snapshot$/);
    if(req.method==='GET'&&snapshotPath)return json(res,200,await snapshot(await findProject(snapshotPath[1])));
    if(req.method==='POST'&&path==='/api/copilot'){
      const input=await body(req);const project=await findProject(input.projectId);if(!['brief','post','plan'].includes(input.task))throw new Error('Choose a daily brief, a post draft, or a community plan.');
      if(!aiConfigured())throw new Error('Copilot is temporarily unavailable. Please try again later.');
      if(aiInFlight.has(project.id))return json(res,429,{error:'A draft for this project is already being written.'});
      const requestTimes=(aiRequests.get(project.id)||[]).filter(time=>Date.now()-time<60000);if(requestTimes.length>=5)return json(res,429,{error:'Please wait a moment before creating another draft.'});requestTimes.push(Date.now());aiRequests.set(project.id,requestTimes);aiInFlight.add(project.id);
      try{let facts=null;if(project.tokenAddress){try{facts=await snapshot(project);}catch{facts={error:'Chain data is currently unavailable.'};}}
        const result=await generateCopilot({project,facts,task:input.task});const titles={brief:'Daily brief',post:'Social draft',plan:'7-day plan'};const entry=await workspace.appendActivity(project.id,{kind:input.task,title:titles[input.task],content:result.content,createdAt:result.generatedAt,public:false});return json(res,200,{...result,activityId:entry.id});
      }finally{aiInFlight.delete(project.id);}
    }
    if(req.method==='POST'&&path==='/api/launch/prepare'){
      if(mining)return json(res,429,{error:'A launch address is being prepared. Try again shortly.'});
      const input=validateLaunch(await body(req));await verifyChain();
      const factoryArtifact=await artifact('RevenueSplitFactory');
      const factoryCode=await publicClient.getCode({address:input.factory});
      // This immutable-field artifact has a beacon reference, so validate its public behavior too.
      if(!factoryCode||factoryCode==='0x')throw new Error('Enable revenue splits on BNB Testnet before preparing this launch.');
      const supports=await publicClient.readContract({address:input.factory,abi:factoryArtifact.abi,functionName:'isQuoteTokenSupported',args:[zeroAddress]});
      if(!supports)throw new Error('Factory does not support native BNB.');
      const beacon=await publicClient.readContract({address:input.factory,abi:factoryArtifact.abi,functionName:'beacon'});
      const beaconAbi=parseAbi(['function owner() view returns (address)','function implementation() view returns (address)']);
      const [beaconOwner,implementation]=await Promise.all(['owner','implementation'].map(functionName=>publicClient.readContract({address:beacon,abi:beaconAbi,functionName})));
      if(beaconOwner.toLowerCase()!==NETWORK.guardian.toLowerCase())throw new Error('The factory beacon is not controlled by the expected Flap Guardian.');
      const implementationCode=await publicClient.getCode({address:implementation});
      if(implementationCode!==(await artifact('RevenueSplitVault')).deployedBytecode)throw new Error('The factory implementation does not match this local build. Review the deployment before continuing.');
      mining=true;
      let mined;
      try{mined=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./vanity-worker.mjs',import.meta.url),{workerData:{implementation:NETWORK.taxTokenImplementation,portal:NETWORK.portal,seed:BigInt(`0x${randomBytes(8).toString('hex')}`).toString()}});const timer=setTimeout(()=>{worker.terminate();reject(new Error('Address preparation timed out. Try again.'));},45000);worker.once('message',result=>{clearTimeout(timer);worker.terminate();resolve(result);});worker.once('error',error=>{clearTimeout(timer);reject(error);});});}finally{mining=false;}
      const existing=await publicClient.getCode({address:mined.predicted});if(existing&&existing!=='0x')throw new Error('Prepared address is already in use. Try again.');
      const params=buildLaunchParams(input,mined.salt);const {abi}=await artifact('IVaultPortal');
      return json(res,200,{chainId:97,to:NETWORK.vaultPortal,data:encodeFunctionData({abi,functionName:'newTokenV6WithVault',args:[params]}),value:params.quoteAmt.toString(),salt:mined.salt,predictedToken:mined.predicted,settings:input});
    }
    if(req.method==='GET'&&!path.startsWith('/api/')){
      const requested=resolve(root,'dist',path==='/'||/^\/project\/[a-f0-9-]+$/.test(path)?'index.html':`.${path}`);
      const distRoot=resolve(root,'dist');
      if(!requested.startsWith(`${distRoot}/`)&&!requested.startsWith(`${distRoot}\\`)&&requested!==resolve(distRoot,'index.html'))throw new Error('Invalid file path.');
      try{await stat(requested);const file=await readFile(requested);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(requested)]||'application/octet-stream'),'X-Content-Type-Options':'nosniff'});return res.end(file);}catch{res.writeHead(404);return res.end('Build the app with pnpm build, or use pnpm dev.');}
    }
    json(res,404,{error:'Route not found.'});
  }catch(error){json(res,400,{error:error.message?.slice(0,1500)||'The request failed.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4318);server.listen(port,'127.0.0.1',()=>console.log(`Flap Copilot API: http://127.0.0.1:${port}`));}
