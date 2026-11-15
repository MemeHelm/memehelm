import {useState} from 'react';
import {HelmMark} from './Brand';
import {MateCharacter} from './mate/MateCharacter';

export function MateCompanion({open,ready=true}:{open:()=>void;ready?:boolean}){
  const [compact,setCompact]=useState(false);
  return <aside className={`mate-companion ${compact?'is-compact':''} ${ready?'':'is-arriving'}`} aria-label="Mate assistant">
    <button className="mate-launcher" data-mate-anchor aria-label="Open Mate AI assistant" onClick={open}>
      {compact?<HelmMark/>:<MateCharacter armored/>}
      <span className="mate-launcher-label">Ask Mate</span>
    </button>
    <button className="mate-collapse" aria-label={compact?'Expand Mate character':'Minimize Mate character'} aria-pressed={compact} onClick={()=>setCompact(value=>!value)}>{compact?<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>:<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10h12"/></svg>}</button>
  </aside>;
}
