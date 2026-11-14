import {useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiError} from './api';

export function useWorkspaceData<T>(path:string){
  const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[notice,setNotice]=useState('');
  const alive=useRef(true),pending=useRef(false);
  const reload=useCallback(async()=>{setLoading(true);try{const next=await api<T>(path);if(alive.current){setData(next);setError('');setConflict(false);return true;}}catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:'Could not load this workspace. Try again.');}finally{if(alive.current)setLoading(false);}return false;},[path]);
  useEffect(()=>{alive.current=true;void reload();return()=>{alive.current=false;};},[reload]);
  async function save(section:string,input:unknown,message:string){
    if(pending.current||conflict)return false;pending.current=true;setBusy(true);setError('');setNotice('');
    try{const next=await api<T>(path+section,input);if(!alive.current)return false;setData(next);setNotice(message);return true;}
    catch(reason){if(alive.current){setError(reason instanceof Error?reason.message:'Could not save. Your edits are still here.');setConflict(reason instanceof ApiError&&reason.status===409);}return false;}
    finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  return{data,loading,busy,error,conflict,notice,reload,save,setNotice};
}
