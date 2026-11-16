// A brand sequence, not a network or transaction loading indicator.
import {useEffect,useRef,useState} from 'react';
import {Arrow} from './Brand';
import {MateStory} from './mate/MateStory';
import {MATE_DEADLINE,MATE_REVEAL,mateStage} from './mate/choreography';
import {resolveMateAnchor} from './mate/landing-target';

export function prefersLessMotion(){return typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}

export function EntryLoader({onDone,onReveal,fullMotion=false}:{onDone:()=>void;onReveal?:()=>void;fullMotion?:boolean}){
  const [leaving,setLeaving]=useState<'automatic'|'skip'|null>(null);
  const surface=useRef<HTMLElement>(null);
  const done=useRef(onDone),reveal=useRef(onReveal),exiting=useRef(false),exitTimer=useRef<number|undefined>(undefined);
  done.current=onDone;reveal.current=onReveal;
  function enter(skip=false){
    if(exiting.current)return;
    exiting.current=true;setLeaving(skip?'skip':'automatic');
    exitTimer.current=window.setTimeout(()=>done.current(),prefersLessMotion()&&!fullMotion?0:180);
  }
  useEffect(()=>{
    let alive=true,controller:{dispose:()=>void}|undefined,revealed=false;
    // A module or animation failure must always release the private workspace.
    const deadline=window.setTimeout(()=>enter(),MATE_DEADLINE);
    let fallback:number|undefined;
    import('./mate/sequence').then(({createMateSequence})=>{
      if(!alive||exiting.current||!surface.current)return;
      controller=createMateSequence(surface.current,{
        anchor:()=>resolveMateAnchor(document),
        onFrame:seconds=>{
          if(!alive||exiting.current)return;
          if(surface.current)surface.current.dataset.mateStage=mateStage(seconds);
          if(seconds>=MATE_REVEAL&&!revealed){revealed=true;reveal.current?.();}
        },
        onComplete:()=>enter(),
        onFailure:()=>enter(true),
      });
    }).catch(()=>{if(alive&&!exiting.current)fallback=window.setTimeout(()=>enter(),1800);});
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();enter(true);}};
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>{if(preference.matches)enter(true);};
    if(preference.matches&&!fullMotion)enter(true);
    document.addEventListener('keydown',key);preference.addEventListener('change',changed);
    return()=>{alive=false;controller?.dispose();window.clearTimeout(deadline);window.clearTimeout(fallback);window.clearTimeout(exitTimer.current);document.removeEventListener('keydown',key);preference.removeEventListener('change',changed);};
  },[]);
  return <section ref={surface} className={`entry-loader mate-intro ${fullMotion?'is-motion-preview':''} ${leaving?'is-leaving':''} ${leaving==='skip'?'is-skipped':''}`} aria-label="Welcome to MemeHelm">
    <div className="mate-intro-backdrop" aria-hidden="true"/>
    <MateStory/>
    <button className="entry-skip" onClick={()=>enter(true)} aria-label="Skip intro and enter desktop" aria-keyshortcuts="Escape">Skip intro <kbd>Esc</kbd><Arrow/></button>
  </section>;
}
