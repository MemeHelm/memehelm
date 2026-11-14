import {useEffect,useState} from 'react';
import {api} from './api';
import {WalletSession} from './WalletSession';
import {DraftText} from './DraftText';
import type {PublicCommunityData,PublicEvent} from './community-types';
import './community.css';
import {PublicGoals} from './PublicGoals';
import type {PublicGrowth} from './growth-types';

const date=(value:string)=>new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
export function PublicCommunity({projectId,initial,initialGrowth={goals:[],scoreboard:[]}}:{projectId:string;initial:PublicCommunityData;initialGrowth?:PublicGrowth}){
  return <WalletSession>{(wallet,connect,logout,signing)=><Events key={wallet||'guest'} projectId={projectId} initial={initial} initialGrowth={initialGrowth} wallet={wallet} connect={connect} logout={logout} signing={signing}/>}</WalletSession>;
}
function Events({projectId,initial,initialGrowth,wallet,connect,logout,signing}:{projectId:string;initial:PublicCommunityData;initialGrowth:PublicGrowth;wallet:string;connect:()=>Promise<void>;logout:()=>Promise<void>;signing:boolean}){
  const [growth,setGrowth]=useState<PublicGrowth>({goals:[],scoreboard:[]}),[ready,setReady]=useState(false),[growthBlocked,setGrowthBlocked]=useState(false),[retry,setRetry]=useState(0);
  const [data,setData]=useState(initial),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();api<{community:PublicCommunityData;growth?:PublicGrowth}>(`/public/projects/${projectId}`,undefined,controller.signal).then(result=>{setData(result.community);setGrowth(result.growth||initialGrowth);setReady(true);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[wallet,projectId,retry]);
  async function rsvp(event:PublicEvent){if(!wallet){await connect();return;}if(busy)return;setBusy(event.id);setError('');setNotice('');try{setData(await api<PublicCommunityData>(`/public/projects/${projectId}/events/${event.id}/rsvp`,{attending:!event.attending}));setNotice(event.attending?'Your registration was removed.':'You are registered. Save the event time and open its join link when it starts.');}catch(reason:any){setError(reason.message);}finally{setBusy('');}}
  if(!ready)return <div className="data-note" role={error?'alert':'status'}>{error||'Loading community contributions…'}{error&&<button className="button secondary" onClick={()=>{setError('');setRetry(value=>value+1);}}>Retry community</button>}</div>;
  return <>{wallet&&(data.events.length>0||growth.goals.length>0)&&<div className="public-community-session"><span>Signed in · {wallet.slice(0,6)}…{wallet.slice(-4)}</span><button className="text-button" disabled={!!busy||signing||growthBlocked} onClick={logout}>Sign out</button></div>}<PublicGoals projectId={projectId} data={growth} onChange={setGrowth} wallet={wallet} connect={connect} signing={signing} onBlocked={setGrowthBlocked}/>{data.events.length>0&&<section className="public-community-events" aria-labelledby="community-events-title"><header><h2 id="community-events-title">Meet the community.</h2><p>Creator-hosted conversations, calls and shared moments. Times are shown in your local timezone.</p></header>
    {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice success" role="status">{notice}</div>}
    <div className="public-event-list">{[...data.events].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).map(event=>{const closed=event.status!=='upcoming'||Date.parse(event.startsAt)<=Date.now(),full=event.going>=(event.capacity??500);return <article className="public-event" id={'event-'+event.id} key={event.id}><span className="community-status">{event.status==='upcoming'?(closed?'Registration closed':'Upcoming event'):event.status==='completed'?'Event completed':'Event cancelled'}</span><h3>{event.title}</h3><time dateTime={event.startsAt}>{date(event.startsAt)} – {date(event.endsAt)}</time><p>{event.description}</p><p className="data-note">{event.going} registered{event.capacity?` · ${event.capacity} places`:''}. Registration does not verify attendance or community membership.</p>{event.cancellation&&<p role="status">Cancellation note: {event.cancellation}</p>}
      <div className="button-row">{event.attending?<button className="button secondary" disabled={!!busy||signing} onClick={()=>rsvp(event)}>{busy===event.id?'Updating…':'Cancel my registration'}</button>:!closed&&<button className="button primary" disabled={!!busy||signing||full} onClick={()=>rsvp(event)}>{busy===event.id?'Registering…':full?'Event full':wallet?'Register for event':'Sign in to register'}</button>}{event.url&&event.status!=='cancelled'&&<a className="button secondary" href={event.url} target="_blank" rel="noreferrer">Open event link ↗</a>}</div>
      {!wallet&&!closed&&!full&&<p className="data-note">Wallet sign-in is a message signature. No purchase, gas payment or wallet transaction is required.</p>}{event.recap&&<div className="public-event-recap"><h4>From the host</h4><DraftText text={event.recap}/></div>}
    </article>;})}</div>
  </section>}</>;
}
