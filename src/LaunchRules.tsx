import {utcDateTime} from './time';
import {useId} from 'react';
import {formatEther,formatUnits} from 'viem';
import {PONS} from '../shared/pons-addresses.mjs';
import {NETWORK} from '../shared/config.mjs';
import type {LaunchDraft,LaunchOptions,Prepared} from './types';
import './launch-rules.css';

type ProtocolRules={snipeTaxSeconds?:number;snipeTaxStartBps?:number;checkedAt?:string;block?:string};
type PinnedPrepared=Prepared&{protocolRules?:ProtocolRules};
type Props={draft:LaunchDraft;wallet:string;options:LaunchOptions|null;prepared:Prepared|null};
const same=(a:unknown,b:string)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
const rate=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10000?`${value/100}%`:'Unavailable';
const units=(value:unknown,eth=false)=>{try{if(typeof value!=='string'||!/^\d+$/.test(value))return'Unavailable';const number=eth?formatEther(BigInt(value)):formatUnits(BigInt(value),18);const[integer,fraction]=number.split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'')+(eth?' ETH':'');}catch{return'Unavailable';}};
const address=(value:unknown)=>typeof value==='string'&&/^0x[a-f\d]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value)?value:null;
const walletLink=(value:string)=><a className="launch-rule-address" href={`${NETWORK.explorer}/address/${value}`} target="_blank" rel="noreferrer">{value}</a>;

export function openingProtectionText(start:unknown,seconds:unknown){
 if(typeof start!=='number'||!Number.isInteger(start)||start<0||start>10000||typeof seconds!=='number'||!Number.isSafeInteger(seconds)||seconds<0)return'Opening protection is unavailable. Review fresh launch terms before signing.';
 if(start===0||seconds===0)return'No opening anti-snipe fee is configured in these terms. Base and creator fees still apply.';
 const duration=seconds%60===0?`${seconds/60} minute${seconds===60?'':'s'}`:`${seconds} second${seconds===1?'':'s'}`;
 return`An opening anti-snipe fee of up to ${start/100}% decays to zero over ${duration}. Each buy quote includes the actual rate for its recipient.`;
}

export function LaunchRules({draft,wallet,options,prepared}:Props){
 const heading=useId(),settings=prepared?.settings||draft;
 const verified=prepared?prepared.chainId===4663&&same(prepared.to,PONS.factory.address):options?.chainId===4663&&same(options.factory,PONS.factory.address);
 const config=verified?(prepared?.config||options?.configs.find(item=>item.id===settings.configId)):null;
 // Prepared transactions must use their own rule snapshot, never an older options response.
 const protection:ProtocolRules|undefined=verified?(prepared?(prepared as PinnedPrepared).protocolRules:options||undefined):undefined;
 const checked=protection?.checkedAt&&Number.isFinite(Date.parse(protection.checkedAt))?utcDateTime(protection.checkedAt,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):null;
 const recipient=address(settings.creatorFeeRecipient),exemptions=Array.isArray(settings.snipeTaxExemptions)?settings.snipeTaxExemptions:[];
 const automatic=[{value:address(wallet),label:'Launching wallet'},{value:recipient,label:'Fee recipient'}].filter(item=>item.value);
 const automaticWallets=Array.from(new Set(automatic.map(item=>item.value!)));
 const mode=settings.splitEnabled?'Two-wallet split':settings.holdersEnabled?'Holder payouts':settings.socialEnabled?'Community escrow':'Direct to wallet';
 return <section className="launch-rules" aria-labelledby={heading}>
  <header><h3 id={heading}>Launch rules</h3><p>{settings.name||'Your coin'}{settings.symbol?` · $${settings.symbol}`:''}</p></header>
  {!verified?<p className="launch-rule-unavailable" role="status">Live rules are unavailable. Refresh the launch terms to check fees, supply and opening protection.</p>:<>
  <dl className="launch-rule-facts">
   <div><dt>Network & issuance</dt><dd>Robinhood Chain · mainnet (4663) · pons v2</dd></div>
   <div><dt>Launch fee</dt><dd>{units(prepared?.value??options?.fee,true)} + gas</dd></div>
   <div><dt>Fixed token supply</dt><dd>{units(config?.supply)}</dd></div>
   <div><dt>Additional creator fee</dt><dd>{rate(settings.creatorTaxBps)}</dd></div>
   <div className="launch-rule-wide"><dt>Creator fee recipient · {mode}</dt><dd>{recipient?walletLink(recipient):'Not selected'}</dd></div>
  </dl>
  <details className="launch-rule-details">
   <summary>Trading & opening protection</summary>
   <dl className="launch-rule-facts">
    <div><dt>Base curve trading fee</dt><dd>{rate(config?.curveFeeBps)}</dd></div>
    <div><dt>Graduation target</dt><dd>{units(config?.graduationThreshold,true)}</dd></div>
   </dl>
   <p>All tokens start in the bonding curve, with no creator preallocation. A reserved share seeds the Uniswap v4 pool when the curve graduates; that liquidity is permanently locked.</p>
   <p>{openingProtectionText(protection?.snipeTaxStartBps,protection?.snipeTaxSeconds)}</p>
   <h4>Opening fee exemptions</h4>
   <p>The launching wallet and creator fee recipient are automatically exempt. Your additional exemptions are fixed at launch and public onchain. Other trading fees still apply.</p>
   {automaticWallets.length>0&&<ul className="launch-rule-wallets">{automaticWallets.map(value=><li key={value}><span>{automatic.filter(item=>same(item.value,value)).map(item=>item.label).join(' · ')} <small>Automatic</small></span>{walletLink(value)}</li>)}</ul>}
   <p className="launch-rule-list-label">{exemptions.length?`${exemptions.length} additional wallet${exemptions.length===1?'':'s'}`:'No additional exempt wallets'}</p>
   {exemptions.length>0&&<ol className="launch-rule-wallets">{exemptions.map((value,index)=><li key={`${value}-${index}`}><span>Additional wallet {index+1}</span>{address(value)?walletLink(value):<span>Address unavailable</span>}</li>)}</ol>}
   <p>These launch terms do not add custom wallet caps, transfer limits or an AI trading controller.</p>
  </details>
  <details className="launch-rule-details">
   <summary>Revenue rules & control</summary>
   {settings.splitEnabled?<>
    <p>The split applies to ETH collected by your vault. Its recipients and percentages are fixed when the vault is activated.</p>
    <dl className="launch-rule-facts"><div className="launch-rule-wide"><dt>Project wallet · {rate(10000-settings.auditBps)}</dt><dd>{address(settings.projectTreasury)?walletLink(settings.projectTreasury):'Unavailable'}</dd></div><div className="launch-rule-wide"><dt>Reserve wallet · {rate(settings.auditBps)}</dt><dd>{address(settings.auditTreasury)?walletLink(settings.auditTreasury):'Unavailable'}</dd></div></dl>
   </>:settings.holdersEnabled?<p>Fees collect in your holders vault. Each payout uses a reviewed balance snapshot from an explorer sample and requires the controller wallet’s signature. Wallets outside the sample receive nothing in that round; no amount is reserved for them. Excluded, below-minimum and unselected shares stay in the vault; they are not redistributed.</p>:settings.socialEnabled?<p>Each community-escrow release is proposed publicly and waits 48 hours before the controller wallet can sign it. The controller chooses the recipient. The waiting window does not verify a social identity or give the community a veto.</p>:<p>Settled creator fees accrue in the pons escrow. The recipient wallet claims its balance; fees are not automatically pushed to the wallet.</p>}
   <p>The creator can redirect future creator fees through pons controls. This does not alter an activated vault’s own rules. Supply, creator tax and curve economics are fixed at launch.</p>
   <p>Your wallet signs financial actions. No transaction, payout or public post is executed by MATE from this review.</p>
  </details>
  <footer className="launch-rule-source">{checked&&<span>Terms read {checked}{protection?.block?` · block ${protection.block}`:''}.</span>}<a href="https://docs.ponsfamily.com/v2" target="_blank" rel="noreferrer">Read pons rules</a><a href={`${NETWORK.explorer}/address/${PONS.factory.address}`} target="_blank" rel="noreferrer">View launch contract</a></footer>
  </>}
 </section>;
}
