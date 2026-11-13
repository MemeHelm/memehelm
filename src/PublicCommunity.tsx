import {useEffect,useState} from 'react';
import {api} from './api';
import {WalletSession} from './WalletSession';
import {DraftText} from './DraftText';
import type {PublicCommunityData,PublicEvent} from './community-types';
import './community.css';

const date=(value:string)=>new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
export function PublicCommunity({projectId,initial}:{projectId:string;initial:PublicCommunityData}){
  return <WalletSession>{(wallet,connect,logout,signing)=><Events key={wallet||'guest'} projectId={projectId} initial={initial} wallet={wallet} connect={connect} logout={logout} signing={signing}/>}</WalletSession>;
}
function Events({projectId,initial,wallet,connect,logout,signing}:{projectId:string;initial:PublicCommunityData;wallet:string;connect:()=>Promise<void>;logout:()=>Promise<void>;signing:boolean}){
  const [data,setData]=useState(initial),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();api<{community:PublicCommunityData}>(`/public/projects/${projectId}`,undefined,controller.signal).then(result=>setData(result.community)).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[wallet,projectId]);
  async function rsvp(event:PublicEvent){if(!wallet){await connect();return;}if(busy)return;setBusy(event.id);setError('');setNotice('');try{setData(await api<PublicCommunityData>(`/public/projects/${projectId}/events/${event.id}/rsvp`,{attending:!event.attending}));setNotice(event.attending?'Your registration was removed.':'You are registered. Save the event time and open its join link when it starts.');}catch(reason:any){setError(reason.message);}finally{setBusy('');}}
  if(!data?.events.length)return null;
  return <section className="public-community-events" aria-labelledby="community-events-title"><header><h2 id="community-events-title">Meet the community.</h2><p>Creator-hosted conversations, calls and shared moments. Times are shown in your local timezone.</p></header>
    {wallet&&<div className="public-community-session"><span>Signed in · {wallet.slice(0,6)}…{wallet.slice(-4)}</span><button className="text-button" disabled={!!busy||signing} onClick={logout}>Sign out</button></div>}
    {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice success" role="status">{notice}</div>}
    <div className="public-event-list">{[...data.events].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).map(event=>{const closed=event.status!=='upcoming'||Date.parse(event.startsAt)<=Date.now(),full=event.going>=(event.capacity??500);return <article className="public-event" id={'event-'+event.id} key={event.id}><span className="community-status">{event.status==='upcoming'?(closed?'Registration closed':'Upcoming event'):event.status==='completed'?'Event completed':'Event cancelled'}</span><h3>{event.title}</h3><time dateTime={event.startsAt}>{date(event.startsAt)} – {date(event.endsAt)}</time><p>{event.description}</p><p className="data-note">{event.going} registered{event.capacity?` · ${event.capacity} places`:''}. Registration does not verify attendance or community membership.</p>{event.cancellation&&<p role="status">Cancellation note: {event.cancellation}</p>}
      <div className="button-row">{event.attending?<button className="button secondary" disabled={!!busy||signing} onClick={()=>rsvp(event)}>{busy===event.id?'Updating…':'Cancel my registration'}</button>:!closed&&<button className="button primary" disabled={!!busy||signing||full} onClick={()=>rsvp(event)}>{busy===event.id?'Registering…':full?'Event full':wallet?'Register for event':'Sign in to register'}</button>}{event.url&&event.status!=='cancelled'&&<a className="button secondary" href={event.url} target="_blank" rel="noreferrer">Open event link ↗</a>}</div>
      {!wallet&&!closed&&!full&&<p className="data-note">Wallet sign-in is a message signature. No purchase, gas payment or wallet transaction is required.</p>}{event.recap&&<div className="public-event-recap"><h4>From the host</h4><DraftText text={event.recap}/></div>}
    </article>;})}</div>
  </section>;
}
