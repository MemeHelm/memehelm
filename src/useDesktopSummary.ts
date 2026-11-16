import {useEffect,useRef,useState} from 'react';
import {api} from './api';

export type SummaryAction={id:string;title:string;status:string;dueAt:string|null};
export type SummaryAlert={id:string;title:string;createdAt:string;read:boolean};
export type SummaryAgenda={title:string;at:string;kind:'Content plan'|'Community event'};
type Summary={loading:boolean;watchCount:number|null;unreadCount:number|null;alerts:SummaryAlert[]|null;agenda:SummaryAgenda[]|null;actions:SummaryAction[]|null;errors:string[]};
type ScopedSummary=Summary&{scope:string};
type Watch={enabled:boolean};
type Overview={content:{title:string;scheduledAt:string;status:string}[];events:{title:string;startsAt:string;status:string}[]};
type Resource='watches'|'alerts'|'agenda'|'actions';
const empty=(scope:string,loading=false):ScopedSummary=>({scope,loading,watchCount:null,unreadCount:null,alerts:null,agenda:null,actions:null,errors:[]});
const validTime=(value:string)=>Number.isFinite(Date.parse(value));

/** Reads saved workspace records only. Opening the desktop never checks markets or runs AI. */
export function useDesktopSummary({wallet,projectId,enabled}:{wallet:string;projectId?:string;enabled:boolean}){
  const address=wallet.toLowerCase(),scope=JSON.stringify([address,projectId||'']),active=!!address&&enabled;
  const [state,setState]=useState<ScopedSummary>(()=>empty(scope,active));
  const [version,setVersion]=useState(0);
  const refresh=useRef(()=>setVersion(value=>value+1)).current;
  // Bind responses during render as well as effect cleanup: a switched wallet must never
  // expose the previous wallet's data, even before the new effect has run.
  const binding=JSON.stringify([scope,active,version]),current=useRef(binding);current.current=binding;
  useEffect(()=>{
    if(!active){setState(empty(scope));return;}
    const controller=new AbortController(),errors=new Map<Resource,string>();
    const currentRequest=()=>!controller.signal.aborted&&current.current===binding;
    setState(previous=>({...((previous.scope===scope)?previous:empty(scope)),loading:true,errors:[]}));
    const load=async<T,>(resource:Resource,path:string,message:string,accept:(value:T)=>Partial<Summary>)=>{
      try{
        const value=await api<T>(path,undefined,controller.signal);
        if(!currentRequest())return;
        const changes=accept(value);
        setState(previous=>currentRequest()?{...previous,...changes}:previous);
      }catch{
        if(!currentRequest())return;
        errors.set(resource,message);
        setState(previous=>currentRequest()?{...previous,errors:[...errors.values()]}:previous);
      }
    };
    const requests:Promise<void>[]=[
      load<Watch[]>('watches','/watches','Your watchlist could not be refreshed.',items=>{
        if(!Array.isArray(items))throw new Error('Invalid watchlist.');
        return{watchCount:items.filter(item=>item.enabled).length};
      }),
      load<SummaryAlert[]>('alerts','/alerts','Your signals could not be refreshed.',items=>{
        if(!Array.isArray(items))throw new Error('Invalid signals.');
        return{unreadCount:items.filter(item=>!item.read).length,alerts:[...items].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3)};
      }),
    ];
    if(projectId){
      requests.push(load<Overview>('agenda',`/projects/${projectId}/overview`,'Your upcoming plans could not be refreshed.',overview=>{
        if(!Array.isArray(overview.content)||!Array.isArray(overview.events))throw new Error('Invalid plans.');
        const agenda:SummaryAgenda[]=[...overview.content.filter(item=>item.status==='planned').map(item=>({title:item.title,at:item.scheduledAt,kind:'Content plan' as const})),...overview.events.filter(item=>item.status==='upcoming').map(item=>({title:item.title,at:item.startsAt,kind:'Community event' as const}))];
        return{agenda:agenda.filter(item=>validTime(item.at)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(0,4)};
      }));
      requests.push(load<{actions:SummaryAction[]}>('actions',`/projects/${projectId}/operations`,'Your action queue could not be refreshed.',result=>{
        if(!Array.isArray(result.actions))throw new Error('Invalid actions.');
        return{actions:result.actions.filter(item=>item.status==='proposed'||item.status==='approved').slice(0,3).map(({id,title,status,dueAt})=>({id,title,status,dueAt:dueAt||null}))};
      }));
    }
    void Promise.allSettled(requests).then(()=>{if(currentRequest())setState(previous=>({...previous,loading:false}));});
    return()=>controller.abort();
  },[scope,active,version]);
  const visible=active&&state.scope===scope?state:empty(scope,active);
  return{loading:visible.loading,watchCount:visible.watchCount,unreadCount:visible.unreadCount,alerts:visible.alerts,agenda:visible.agenda,actions:visible.actions,errors:visible.errors,refresh};
}
