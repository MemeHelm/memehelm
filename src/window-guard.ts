import {useEffect} from 'react';

/** Bridge local editors to the desktop shell without moving their private draft state. */
export function useWindowGuard(id:string,blocked:boolean){
  useEffect(()=>{window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id,blocked}}));},[id,blocked]);
  useEffect(()=>()=>{window.dispatchEvent(new CustomEvent('memehelm-window-guard',{detail:{id,blocked:false}}));},[id]);
}
