import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import type {ChatSummary,ChatRecord,ChatReply,ChatTurn,Project,TokenIntel,IntelForensics} from './types';
import './workflows.css';

const suggestions=['Summarize today’s observed facts.','What changed since the last observation?','Which addresses hold the largest returned balances?','Review the trades observed in the last 20,000 blocks.'];
const when=(value:string)=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const amount=(value:string|null|undefined,max=6)=>value===null||value===undefined?'Unavailable':Number(value).toLocaleString('en-US',{maximumSignificantDigits:max});
type Props={project:Project;available:boolean};
export function ProjectChat({project,available}:Props){
  const [chats,setChats]=useState<ChatSummary[]>([]),[activeChatId,setActiveChatId]=useState(''),[messages,setMessages]=useState<ChatTurn[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[coverage,setCoverage]=useState<ChatReply['coverage']>(null),[removing,setRemoving]=useState('');
  const identity=useRef(project.id);identity.current=project.id;
  const end=useRef<HTMLDivElement|null>(null);
  const [intelVersion,setIntelVersion]=useState(0);
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages,busy]);
  useEffect(()=>{
    const id=project.id,controller=new AbortController();
    setChats([]);setActiveChatId('');setMessages([]);setInput('');setError('');setCoverage(null);setBusy(false);setRemoving('');
    api<{items:ChatSummary[]}>(`/projects/${id}/chats`,undefined,controller.signal).then(({items})=>{
      if(identity.current!==id||controller.signal.aborted)return;
      setChats(items);
      if(items[0])api<ChatRecord>(`/projects/${id}/chats/${items[0].id}`,undefined,controller.signal).then(record=>{if(identity.current===id&&!controller.signal.aborted){setMessages(record.messages);setActiveChatId(record.id);}}).catch(()=>{});
    }).catch(reason=>{if(identity.current===id&&!controller.signal.aborted)setError(reason.message);});
    return()=>controller.abort();
  },[project.id]);
  const [token,setToken]=useState<TokenIntel|null>(null),[xray,setXray]=useState<IntelForensics|null>(null),[intelError,setIntelError]=useState('');
  useEffect(()=>{
    const id=project.id,controller=new AbortController();
    setToken(null);setXray(null);setIntelError('');
    if(!project.tokenAddress)return()=>controller.abort();
    const address=project.tokenAddress;
    Promise.all([
      api<{token:TokenIntel}>(`/market/tokens/${address}`,undefined,controller.signal),
      api<IntelForensics>(`/market/tokens/${address}/forensics`,undefined,controller.signal),
    ]).then(([detail,forensics])=>{
      if(identity.current!==id||controller.signal.aborted)return;
      setToken(detail.token);setXray(forensics);
    }).catch(reason=>{if(identity.current===id&&!controller.signal.aborted)setIntelError(reason.message);});
    return()=>controller.abort();
  },[project.id,project.tokenAddress,intelVersion]);
  async function refreshChats(signal?:AbortSignal){
    const id=project.id,{items}=await api<{items:ChatSummary[]}>(`/projects/${id}/chats`,undefined,signal);
    if(identity.current===id)setChats(items);
  }
  async function openChat(chatId:string){
    const id=project.id;
    try{
      const record=await api<ChatRecord>(`/projects/${id}/chats/${chatId}`);
      if(identity.current!==id)return;
      setMessages(record.messages);setActiveChatId(chatId);setCoverage(null);setError('');
    }catch(reason:any){if(identity.current===id)setError(reason.message);}
  }
  async function removeChat(chatId:string){
    if(removing||busy)return;
    const id=project.id;setRemoving(chatId);setError('');
    try{
      await api(`/projects/${id}/chats/remove`,{chatId});
      if(identity.current!==id)return;
      if(activeChatId===chatId){setActiveChatId('');setMessages([]);setCoverage(null);}
      await refreshChats();
    }catch(reason:any){if(identity.current===id)setError(reason.message);}
    finally{if(identity.current===id)setRemoving('');}
  }
  function newChat(){setActiveChatId('');setMessages([]);setCoverage(null);setError('');}
  async function send(question:string){
    const text=question.trim();if(busy||!text||!available)return;
    const id=project.id,optimistic={role:'user',content:text.slice(0,4000),createdAt:new Date().toISOString()} as ChatTurn,chatId=activeChatId;
    setMessages(current=>[...current,optimistic]);setInput('');setBusy(true);setError('');
    try{
      const result=await api<ChatReply>(`/projects/${id}/chat`,{chatId:chatId||undefined,content:text.slice(0,4000)});
      if(identity.current!==id)return;
      setMessages(result.messages);setActiveChatId(result.chatId);setCoverage(result.coverage);
      refreshChats().catch(()=>{});setIntelVersion(value=>value+1);
    }catch(reason:any){if(identity.current===id){setError(reason.message);setMessages(current=>current.filter(turn=>turn!==optimistic));}}
    finally{if(identity.current===id)setBusy(false);}
  }
  const assistant=project.aiName||'Copilot';
  return <div className="chat-workspace"><section className="panel chat-panel" aria-label="Project chat">
    <div className="section-title"><h2>Chat with {assistant}</h2>{(messages.length>0||activeChatId)&&!busy&&<button className="text-button" onClick={newChat}>New chat</button>}</div>
    <p className="panel-copy">{assistant} answers only from observed chain facts, X-Ray checks, recent trades and your saved project context. Missing data is reported as missing, and nothing is ever executed.</p>
    <div className="chat-thread" role="log" aria-live="polite">
      {messages.length===0&&!busy&&<div className="chat-empty"><strong>Ask about your project.</strong><p>Prices and phase, holders, recent trades, launch settings, revenue — or what changed since the last check.</p></div>}
      {messages.map((turn,index)=><div key={index} className={`chat-bubble ${turn.role}`}><span className="chat-author">{turn.role==='user'?'You':assistant}<time>{when(turn.createdAt)}</time></span><div className="chat-content">{turn.content}</div>{turn.role==='assistant'&&coverage&&index===messages.length-1&&<p className="chat-coverage">Facts observed {when(coverage.checkedAt)}{coverage.fromBlock?`, blocks ${Number(coverage.fromBlock).toLocaleString('en-US')}–${Number(coverage.toBlock).toLocaleString('en-US')}`:''}. {coverage.note}</p>}</div>)}
      {busy&&<div className="chat-bubble assistant"><span className="chat-author">{assistant}</span><div className="chat-content chat-pending"><span className="spinner"/>Reading the observed facts…</div></div>}
      <div ref={end}/>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {!available&&<p className="inline-note">Chat is temporarily unavailable. Your saved project data is still here.</p>}
    <form className="chat-composer" onSubmit={event=>{event.preventDefault();send(input);}}>
      <textarea rows={2} maxLength={4000} value={input} placeholder={`Ask ${assistant} about $${project.symbol}…`} disabled={busy||!available} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send(input);}}}/>
      <button className="button primary" type="submit" disabled={busy||!available||!input.trim()}>{busy?'Answering…':'Send'}</button>
    </form>
    <div className="chat-suggestions">{suggestions.map(suggestion=><button key={suggestion} type="button" disabled={busy||!available} onClick={()=>send(suggestion)}>{suggestion}</button>)}</div>
    <p className="ai-privacy-note">Market and holder facts cover the most recent 20,000 blocks and the explorer’s current snapshot. This is a bounded read, not an audit or financial advice.</p>
  </section>
  <aside className="chat-side">
    <section className="panel intel-panel" aria-label="Live observations">
      <div className="section-title"><h3>Live observations</h3>{project.tokenAddress&&<button className="text-button" onClick={()=>setIntelVersion(value=>value+1)}>Refresh</button>}</div>
      {!project.tokenAddress?<p className="data-note">Link an issued token to see its observed price, holders and recent trades here.</p>
      :intelError?<p className="data-note">Live observations are unavailable right now. Try again shortly.</p>
      :!token&&!xray?<p role="status" className="data-note">Reading observed facts…</p>
      :<><dl className="intel-facts">
        <div><dt>Observed price</dt><dd>{token?.price===null||token?.price===undefined?'Unavailable':`${amount(token.price)} ${token.currency||''}`}</dd></div>
        <div><dt>Phase</dt><dd>{token?.phase===0?'Bonding curve':token?.phase===1?'Graduating':token?.phase===2?'Graduated pool':'Unavailable'}{token?.progress!=null&&token.progress!==null?` · ${Math.min(100,Math.round(token.progress))}%` :''}</dd></div>
        <div><dt>Holders</dt><dd>{xray?.concentration?.holdersCount!=null?amount(String(xray.concentration.holdersCount),8):'Unavailable'}</dd></div>
        <div><dt>Largest {xray?.concentration?.largestCount||10} balances</dt><dd>{xray?.concentration?`${xray.concentration.share.toFixed(2)}% of supply`:'Unavailable'}</dd></div>
        <div><dt>Trades in window</dt><dd>{xray?.observedTrading?`${xray.observedTrading.buys} buys · ${xray.observedTrading.sells} sells · ${xray.observedTrading.distinctWallets} wallets${xray.observedTrading.partial?' · partial':''}`:'Unavailable'}</dd></div>
        <div><dt>Market cap</dt><dd>{token?.marketCap?amount(token.marketCap,8)+' '+(token.currency||''):'Unavailable'}</dd></div>
      </dl>
      <p className="data-note">{xray?.observedTrading?`Blocks ${Number(xray.observedTrading.coverage.fromBlock).toLocaleString('en-US')}–${Number(xray.observedTrading.coverage.toBlock).toLocaleString('en-US')}. `:''}{token?.checkedAt?`Price observed ${when(token.checkedAt)}. `:''}{xray?.checkedAt?`Checks observed ${when(xray.checkedAt)}.`:''}A bounded read, not an audit. No price predictions.</p></>}
    </section>
    <section className="panel chats-panel" aria-label="Open chats">
      <div className="section-title"><h3>Open chats <span className="count">{chats.length}</span></h3><button className="text-button" disabled={busy||removing!==''} onClick={newChat}>New chat</button></div>
      {chats.length===0?<p className="data-note">Your saved conversations stay in this workspace. Ask your first question to start one.</p>
      :<div className="chat-history-list">{chats.map(chat=><div key={chat.id} className={`chat-history-item ${chat.id===activeChatId?'active':''}`}><button type="button" disabled={busy||removing!==''} onClick={()=>{if(chat.id!==activeChatId)openChat(chat.id);}}><strong>{chat.preview||'Untitled chat'}</strong><small>{chat.messageCount} messages · {when(chat.updatedAt)}</small></button><button type="button" className="chat-history-remove" aria-label={'Delete chat: '+(chat.preview||'Untitled chat')} disabled={removing!==''||busy} onClick={()=>removeChat(chat.id)}>{removing===chat.id?'Deleting…':'Delete'}</button></div>)}</div>}
    </section>
  </aside></div>;
}
