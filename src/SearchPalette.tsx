import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {DesktopIcon,apps} from './Desktop';
import type {LaunchItem} from './MarketWorkspace';
import type {Page,Project} from './types';

type Result={kind:'page'|'project'|'token'|'lookup';id:string;title:string;sub:string;action:()=>void};
type Props={navigate:(page:Page)=>void;projects:Project[];openProject:(id:string)=>void;close:()=>void};
const kindLabels={page:'Page',project:'Your project',token:'Recent launch',lookup:'Token lookup'};

export function SearchPalette({navigate,projects,openProject,close}:Props){
  const [query,setQuery]=useState(''),[active,setActive]=useState(0),[launches,setLaunches]=useState<LaunchItem[]|null>(null),[unavailable,setUnavailable]=useState(false);
  const input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
  useEffect(()=>{input.current?.focus();setUnavailable(false);const controller=new AbortController();api<{items:LaunchItem[]}>('/market/launches',undefined,controller.signal).then(data=>setLaunches(data.items)).catch(()=>setUnavailable(true));return()=>controller.abort();},[]);
  function openToken(address:string){close();navigate('discover');history.pushState({},'','#app/discover/'+address);window.dispatchEvent(new HashChangeEvent('hashchange'));}
  const q=query.trim().toLowerCase();
  const lookup=q.match(/^0x[a-f0-9]{40}$/i)?[{kind:'lookup' as const,id:q,title:'Look up this token address',sub:q,action:()=>openToken(q)}]:[];
  const pages=apps.filter(app=>!q||`${app.title} ${app.description}`.toLowerCase().includes(q)).map(app=>({kind:'page' as const,id:app.id,title:app.title,sub:app.description,action:()=>{close();navigate(app.id);}}));
  const yours=projects.filter(project=>!q||`${project.name} ${project.symbol} ${project.tokenAddress||''}`.toLowerCase().includes(q)).slice(0,q?8:5).map(project=>({kind:'project' as const,id:project.id,title:project.name,sub:`$${project.symbol} · ${project.status}${project.tokenAddress?' · '+project.tokenAddress.slice(0,10)+'…':''}`,action:()=>{close();openProject(project.id);}}));
  const tokens=(launches||[]).filter(item=>!q||`${item.name} ${item.symbol} ${item.tokenAddress}`.toLowerCase().includes(q)).slice(0,q?8:6).map(item=>({kind:'token' as const,id:item.tokenAddress,title:item.name,sub:`$${item.symbol}${item.createdAt?' · '+new Date(item.createdAt).toLocaleDateString('en-US'):''}`,action:()=>openToken(item.tokenAddress)}));
  const results:Result[]=[...lookup,...pages,...yours,...tokens].slice(0,15);
  useEffect(()=>{setActive(0);},[query]);
  useEffect(()=>{list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active]);
  return <div className="search-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className="search-palette" role="dialog" aria-modal="true" aria-label="Search MemeHelm">
    <div className="search-input"><span aria-hidden="true">⌕</span><input ref={input} value={query} placeholder="Search pages, your projects and recent launches…" aria-label="Search MemeHelm" onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape')close();else if(event.key==='ArrowDown'){event.preventDefault();setActive(value=>Math.min(value+1,results.length-1));}else if(event.key==='ArrowUp'){event.preventDefault();setActive(value=>Math.max(value-1,0));}else if(event.key==='Enter'&&results[active]){event.preventDefault();results[active].action();}}}/><button className="text-button" onClick={close}>Esc</button></div>
    <div className="search-results" ref={list} role="listbox">
      {results.length===0?<p className="search-empty">{unavailable?'Recent launches could not be loaded. Search your pages and projects, or paste a token address.':`No matches for “${query}”. Paste a 0x token address to look it up.`}</p>
      :results.map((result,index)=><div key={result.kind+result.id} className="search-group">{index===0||results[index-1].kind!==result.kind?<div className="search-section">{kindLabels[result.kind]}{result.kind==='page'||result.kind==='project'||result.kind==='token'?'s':''}</div>:null}<button type="button" className={`search-row ${index===active?'active':''}`} data-index={index} role="option" aria-selected={index===active} onMouseEnter={()=>setActive(index)} onClick={result.action}><span className="search-row-icon"><DesktopIcon name={result.kind==='page'?apps.find(app=>app.id===result.id)?.icon||'home':result.kind==='project'?'projects':result.kind==='token'?'discover':'launch'} size={20}/></span><span className="search-row-text"><strong>{result.title}</strong><small>{result.sub}</small></span><span className="search-kind">{kindLabels[result.kind]}</span></button></div>)}
    </div>
    <div className="search-foot"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span><span className="search-foot-note">{launches?`${launches.length} recent indexed launches`:unavailable?'Launch feed unavailable':'Loading recent launches…'}</span></div>
  </section></div>;
}
