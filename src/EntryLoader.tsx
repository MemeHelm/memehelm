import {useEffect,useRef,useState} from 'react';
import {Arrow,HelmMark} from './Brand';

export function prefersLessMotion(){return typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}

export function EntryLoader({onDone}:{onDone:()=>void}){
  const [leaving,setLeaving]=useState(false);
  const done=useRef(onDone),exiting=useRef(false),exitTimer=useRef<number|undefined>(undefined);
  done.current=onDone;
  function enter(){
    if(exiting.current)return;
    exiting.current=true;setLeaving(true);
    exitTimer.current=window.setTimeout(()=>done.current(),prefersLessMotion()?0:240);
  }
  useEffect(()=>{
    let alive=true,minimumPassed=false,fontsReady=!document.fonts;
    const minimum=window.setTimeout(()=>{minimumPassed=true;if(fontsReady&&alive)enter();},780);
    // The intro can prepare the font, but a slow font must never block entry.
    const fallback=window.setTimeout(()=>{if(alive)enter();},1150);
    document.fonts?.ready.then(()=>{fontsReady=true;if(minimumPassed&&alive)enter();}).catch(()=>{fontsReady=true;if(minimumPassed&&alive)enter();});
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();enter();}};
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>{if(preference.matches)enter();};
    document.addEventListener('keydown',key);preference.addEventListener('change',changed);
    return()=>{alive=false;window.clearTimeout(minimum);window.clearTimeout(fallback);window.clearTimeout(exitTimer.current);document.removeEventListener('keydown',key);preference.removeEventListener('change',changed);};
  },[]);
  return <section className={`entry-loader ${leaving?'is-leaving':''}`} aria-label="Welcome to MemeHelm"><div className="entry-grid" aria-hidden="true"/><div className="entry-loader-center"><div className="entry-mark" aria-hidden="true"><span className="entry-orbit"/><span className="entry-corner corner-a"/><span className="entry-corner corner-b"/><HelmMark/></div><h1>MemeHelm<span>.</span></h1><p className="entry-tagline">Launch it. Steer it.</p><div className="entry-track" aria-hidden="true"><span/></div><p className="entry-status" role="status">Opening your workspace<span aria-hidden="true">…</span></p></div><span className="entry-signature" aria-hidden="true">YOUR COIN. YOUR DIRECTION.</span><button className="entry-skip" onClick={enter}>Enter workspace <Arrow/></button></section>;
}
