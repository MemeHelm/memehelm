import {useEffect,useRef} from 'react';
import type {RefObject} from 'react';

/** Keep a real modal's background and keyboard focus out of reach, then restore both. */
export function useModalFocus(ref:RefObject<HTMLElement|null>,close:()=>void){
  const dismiss=useRef(close);dismiss.current=close;
  useEffect(()=>{
    const panel=ref.current;if(!panel)return;
    const previous=document.activeElement as HTMLElement|null;
    const saved=new Map<HTMLElement,boolean>();
    for(let child:HTMLElement=panel;child.parentElement;child=child.parentElement){
      for(const sibling of child.parentElement.children){if(sibling!==child&&sibling instanceof HTMLElement&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){saved.set(sibling,sibling.inert);sibling.inert=true;}}
      if(child.parentElement===document.body)break;
    }
    const targets=()=>Array.from(panel.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(element=>!element.matches(':disabled,[tabindex="-1"]')&&!element.closest('[inert]')&&element.getClientRects().length>0);
    const first=()=>{(targets()[0]||panel).focus({preventScroll:true});};
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismiss.current();}
      if(event.key!=='Tab')return;
      const items=targets(),current=document.activeElement,index=items.indexOf(current as HTMLElement);
      if(!items.length){event.preventDefault();panel.focus();return;}
      if(event.shiftKey&&index<=0){event.preventDefault();items[items.length-1].focus();}
      else if(!event.shiftKey&&(index===items.length-1||index<0)){event.preventDefault();items[0].focus();}
    };
    const focus=(event:FocusEvent)=>{if(!panel.contains(event.target as Node))first();};
    document.addEventListener('keydown',key,true);document.addEventListener('focusin',focus,true);first();
    return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('focusin',focus,true);saved.forEach((inert,node)=>node.inert=inert);if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});};
  },[ref]);
}
