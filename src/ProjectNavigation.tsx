import {useLayoutEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import type {Page,Project} from './types';
import './project-navigation.css';

const groups:{label:string;page:Page;pages:Page[];sections:{label:string;page:Page}[]}[]=[
 {label:'Overview',page:'workspace',pages:['workspace','activity'],sections:[{label:'Overview',page:'workspace'},{label:'Activity',page:'activity'}]},
 {label:'Content',page:'writing',pages:['writing','assets','calendar','publishing'],sections:[{label:'Writing',page:'writing'},{label:'Assets',page:'assets'},{label:'Calendar',page:'calendar'},{label:'Publishing',page:'publishing'}]},
 {label:'Community',page:'community',pages:['community','goals','publication'],sections:[{label:'Events & links',page:'community'},{label:'Goals',page:'goals'},{label:'Public page',page:'publication'}]},
 {label:'Treasury',page:'treasury',pages:['treasury'],sections:[]},
 {label:'AI setup',page:'memory',pages:['memory'],sections:[]},
];

/** The only project selector and project navigation inside the primary canvas. */
export function ProjectNavigation({page,project,selector,navigate,blocked=false}:{page:Page;project?:Project;selector:ReactNode;navigate:(page:Page)=>void;blocked?:boolean}){
 const navigation=useRef<HTMLDivElement>(null),active=groups.find(group=>group.pages.includes(page));
 useLayoutEffect(()=>{
  const nav=navigation.current;if(!nav)return;
  const reveal=()=>{for(const row of nav.querySelectorAll<HTMLElement>('nav')){const item=row.querySelector<HTMLElement>('[aria-current="page"]');if(!item)continue;const bounds=row.getBoundingClientRect(),button=item.getBoundingClientRect();if(button.left<bounds.left+8)row.scrollLeft+=button.left-bounds.left-8;else if(button.right>bounds.right-8)row.scrollLeft+=button.right-bounds.right+8;}};
  reveal();const observer=new ResizeObserver(reveal);observer.observe(nav);return()=>observer.disconnect();
 },[page]);
 return <div className="project-navigation" ref={navigation}>
  <div className="project-navigation-context">
   <button type="button" className="project-back" onClick={()=>navigate('overview')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Projects</button>
   {selector?<fieldset className="project-navigation-selector" disabled={blocked} aria-label="Current project">{selector}</fieldset>:<strong className="project-navigation-name">{project?.name||'Choose a project'}</strong>}
   {project&&<span className="project-navigation-private">Private workspace</span>}
  </div>
  <nav className="project-primary-navigation" aria-label="Project sections">{groups.map(group=><button key={group.page} type="button" aria-current={active===group?'page':undefined} onClick={()=>navigate(group.page)}>{group.label}</button>)}</nav>
  {!!active?.sections.length&&<nav className="project-secondary-navigation" aria-label={`${active.label} tools`}>{active.sections.map(section=><button key={section.page} type="button" aria-current={page===section.page?'page':undefined} onClick={()=>navigate(section.page)}>{section.label}</button>)}</nav>}
 </div>;
}
