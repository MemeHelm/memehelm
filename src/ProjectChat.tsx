import {useEffect,useRef,useState} from 'react';
import {api,saveFile,ApiError,resetAIRequest} from './api';
import {AIRequestRecovery} from './AIRequestRecovery';
import {AssistantActions} from './AssistantActions';
import type {ChatSummary,ChatRecord,ChatReply,ChatTurn,Project,TokenIntel,IntelForensics} from './types';
import './workflows.css';

const suggestions=['Summarize today’s observed facts.','What changed since the last observation?','Which addresses hold the largest returned balances?','Review the trades observed in the last 20,000 blocks.'];
const when=(value:string)=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const amount=(value:string|null|undefined,max=6)=>value===null||value===undefined?'Unavailable':Number(value).toLocaleString('en-US',{maximumSignificantDigits:max});
type ChatPage=ChatRecord&{hasMore?:boolean;before?:number|null;totalMessages?:number};
type ChatList={items:ChatSummary[];hasMore?:boolean;nextOffset?:number|null};
type Props={project:Project;available:boolean;onBlocked?:(blocked:boolean)=>void};
export function ProjectChat({project,available,onBlocked}:Props){
  const [chats,setChats]=useState<ChatSummary[]>([]),[activeChatId,setActiveChatId]=useState(''),[messages,setMessages]=useState<ChatTurn[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[coverage,setCoverage]=useState<ChatReply['coverage']>(null),[removing,setRemoving]=useState('');
  const [opening,setOpening]=useState(false),[olderBusy,setOlderBusy]=useState(false),[before,setBefore]=useState<number|null>(null),[moreChats,setMoreChats]=useState(false),[listOffset,setListOffset]=useState<number|null>(null),[listBusy,setListBusy]=useState(false),[failedQuestion,setFailedQuestion]=useState(''),[exporting,setExporting]=useState(false);
  const selection=useRef(0),alive=useRef(true),skipScroll=useRef(false),requesting=useRef(false);
  const [recoveryCode,setRecoveryCode]=useState('');
  const failedRequest=useRef<{chatId:string|undefined;content:string}|null>(null);
  const identity=useRef(project.id);identity.current=project.id;
  const end=useRef<HTMLDivElement|null>(null);
  const [intelVersion,setIntelVersion]=useState(0);
  const [actionMode,setActionMode]=useState(false),[actionBlocked,setActionBlocked]=useState(false);
  useEffect(()=>{if(skipScroll.current){skipScroll.current=false;return;}end.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});},[messages,busy]);
  useEffect(()=>{onBlocked?.(busy||!!input.trim()||actionBlocked);return()=>onBlocked?.(false);},[busy,input,actionBlocked,onBlocked]);
  useEffect(()=>{
    alive.current=true;
    const id=project.id,controller=new AbortController();
    setChats([]);setActiveChatId('');setMessages([]);setInput('');setError('');setCoverage(null);setBusy(false);setRemoving('');setOpening(true);setBefore(null);setActionMode(false);setActionBlocked(false);
    api<ChatList>(`/projects/${id}/chats?limit=20`,undefined,controller.signal).then(({items,hasMore,nextOffset})=>{
      if(identity.current!==id||controller.signal.aborted)return;
      setChats(items);setMoreChats(!!hasMore);setListOffset(nextOffset??null);
      if(items[0]){const epoch=++selection.current;api<ChatPage>(`/projects/${id}/chats/${items[0].id}?limit=40`,undefined,controller.signal).then(record=>{if(identity.current===id&&!controller.signal.aborted&&selection.current===epoch){setMessages(record.messages);setActiveChatId(record.id);setBefore(record.hasMore?record.before??null:null);}}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);}).finally(()=>{if(!controller.signal.aborted&&selection.current===epoch)setOpening(false);});}else setOpening(false);
    }).catch(reason=>{if(identity.current===id&&!controller.signal.aborted){setError(reason.message);setOpening(false);}});
    return()=>{alive.current=false;selection.current++;controller.abort();};
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
    const id=project.id,{items,hasMore,nextOffset}=await api<ChatList>(`/projects/${id}/chats?limit=20`,undefined,signal);
    if(identity.current===id&&alive.current){setChats(items);setMoreChats(!!hasMore);setListOffset(nextOffset??null);}
  }
  async function openChat(chatId:string){
    if(busy||input.trim()||actionBlocked)return;const id=project.id,epoch=++selection.current;setOpening(true);setError('');
    try{
      const record=await api<ChatPage>(`/projects/${id}/chats/${chatId}?limit=40`);
      if(identity.current!==id||!alive.current||selection.current!==epoch)return;
      setMessages(record.messages);setActiveChatId(chatId);setBefore(record.hasMore?record.before??null:null);setCoverage(null);setFailedQuestion('');
    }catch(reason:any){if(identity.current===id&&alive.current&&selection.current===epoch)setError(reason.message);}
    finally{if(alive.current&&selection.current===epoch)setOpening(false);}
  }
  async function loadOlder(){
    if(before===null||olderBusy||busy||opening)return;const id=project.id,chatId=activeChatId,epoch=selection.current;setOlderBusy(true);setError('');
    try{const page=await api<ChatPage>(`/projects/${id}/chats/${chatId}?limit=40&before=${before}`);if(!alive.current||selection.current!==epoch)return;skipScroll.current=true;setMessages(current=>[...page.messages,...current]);setBefore(page.hasMore?page.before??null:null);}
    catch(reason:any){if(alive.current&&selection.current===epoch)setError(reason.message);}finally{if(alive.current)setOlderBusy(false);}
  }
  async function loadMoreChats(){
    if(!moreChats||listOffset===null||listBusy)return;setListBusy(true);setError('');
    try{const page=await api<ChatList>(`/projects/${project.id}/chats?limit=20&offset=${listOffset}`);if(!alive.current)return;setChats(current=>[...current,...page.items.filter(item=>!current.some(existing=>existing.id===item.id))]);setMoreChats(!!page.hasMore);setListOffset(page.nextOffset??null);}
    catch(reason:any){if(alive.current)setError(reason.message);}finally{if(alive.current)setListBusy(false);}
  }
  async function exportChat(){
    if(!activeChatId||exporting)return;setExporting(true);setError('');try{const record=await api<ChatRecord>(`/projects/${project.id}/chats/${activeChatId}/export`);if(alive.current)saveFile(`${project.symbol.toLowerCase()}-chat-${record.id}.json`,record);}catch(reason:any){if(alive.current)setError(reason.message);}finally{if(alive.current)setExporting(false);}
  }
  async function inspectSavedChats(){
    const list=await api<ChatList>(`/projects/${project.id}/chats?limit=20`);setChats(list.items);setMoreChats(!!list.hasMore);setListOffset(list.nextOffset??null);
    const ids=failedRequest.current?.chatId?[failedRequest.current.chatId]:list.items.slice(0,3).map(item=>item.id);
    if(!ids.length)return 'No saved conversations were found for this project.';
    const pages=await Promise.all(ids.map(chatId=>api<ChatPage>(`/projects/${project.id}/chats/${chatId}?limit=4`)));
    return 'Most recent saved messages. Open the conversation or download its full history if you need more context.\n\n'+pages.map(page=>page.messages.map(turn=>(turn.role==='user'?'You: ':'Assistant: ')+turn.content).join('\n\n')).join('\n\n——\n\n');
  }
  async function startFreshQuestion(){
    const failed=failedRequest.current;if(!failed)return;await resetAIRequest(`/projects/${project.id}/chat`,failed);setInput(failed.content);await send(failed.content);
  }
  async function removeChat(chatId:string){
    if(removing||busy||actionBlocked)return;
    const id=project.id;setRemoving(chatId);setError('');
    try{
      await api(`/projects/${id}/chats/remove`,{chatId});
      if(identity.current!==id)return;
      if(activeChatId===chatId){setActiveChatId('');setMessages([]);setCoverage(null);}
      await refreshChats();
    }catch(reason:any){if(identity.current===id)setError(reason.message);}
    finally{if(identity.current===id)setRemoving('');}
  }
  function newChat(){if(busy||input.trim()||actionBlocked)return;selection.current++;setOpening(false);setActiveChatId('');setMessages([]);setBefore(null);setCoverage(null);setError('');setFailedQuestion('');}
  async function send(question:string){
    const text=question.trim();if(requesting.current||busy||opening||!text||!available)return;requesting.current=true;
    const id=project.id,optimistic={role:'user',content:text.slice(0,4000),createdAt:new Date().toISOString()} as ChatTurn,chatId=activeChatId;
    setMessages(current=>[...current,optimistic]);setInput('');setBusy(true);setError('');setFailedQuestion('');setRecoveryCode('');
    try{
      const result=await api<ChatReply&{hasMore?:boolean;before?:number|null}>(`/projects/${id}/chat`,{chatId:chatId||undefined,content:text.slice(0,4000)});
      if(identity.current!==id||!alive.current)return;
      setMessages(result.messages);setActiveChatId(result.chatId);setCoverage(result.coverage);
      setBefore(result.hasMore?result.before??null:null);
      refreshChats().catch(()=>{});setIntelVersion(value=>value+1);
    }catch(reason:any){if(identity.current===id&&alive.current){setError(reason.message);setMessages(current=>current.filter(turn=>turn!==optimistic));setInput(text);setFailedQuestion(text);failedRequest.current={chatId:chatId||undefined,content:text.slice(0,4000)};setRecoveryCode(reason instanceof ApiError?reason.code||'':'');}}
    finally{requesting.current=false;if(identity.current===id&&alive.current)setBusy(false);}
  }
  const assistant=project.aiName||'Copilot';
  return <div className="chat-workspace"><section className="panel chat-panel" aria-label="Project chat">
    <div className="section-title"><h2>Chat with {assistant}</h2><div className="button-row">{activeChatId&&<button className="text-button" disabled={exporting||busy||opening} onClick={exportChat}>{exporting?'Preparing download…':'Download chat'}</button>}{(messages.length>0||activeChatId)&&!busy&&<button className="text-button" disabled={opening||!!input.trim()} onClick={newChat}>New chat</button>}</div></div>
    <p className="panel-copy">{assistant} uses observed chain facts and saved project context. Ask a question, or turn an idea into private drafts you review before creating. Payouts always need a separate review and wallet signature.</p>
    <div className="chat-mode-switch" role="group" aria-label="Assistant mode"><button type="button" aria-pressed={!actionMode} disabled={busy||actionBlocked} onClick={()=>setActionMode(false)}>Ask a question</button><button type="button" aria-pressed={actionMode} disabled={busy||!!input.trim()} onClick={()=>setActionMode(true)}>Plan an action</button></div>
    {actionMode?<AssistantActions key={project.id} projectId={project.id} chatId={activeChatId||undefined} available={available} onBlocked={setActionBlocked}/>:<>
    <div className="chat-thread" role="log" aria-live="polite">{before!==null&&<button className="button secondary" disabled={olderBusy||busy||opening} onClick={loadOlder}>{olderBusy?'Loading earlier messages…':'Load earlier messages'}</button>}{opening&&<p role="status" className="data-note">Opening your conversation…</p>}
      {messages.length===0&&!busy&&<div className="chat-empty"><strong>Ask about your project.</strong><p>Prices and phase, holders, recent trades, launch settings, revenue — or what changed since the last check.</p></div>}
      {messages.map((turn,index)=><div key={index} className={`chat-bubble ${turn.role}`}><span className="chat-author">{turn.role==='user'?'You':assistant}<time>{when(turn.createdAt)}</time></span><div className="chat-content">{turn.content}</div>{turn.role==='assistant'&&coverage&&index===messages.length-1&&<p className="chat-coverage">Facts observed {when(coverage.checkedAt)}{coverage.fromBlock?`, blocks ${Number(coverage.fromBlock).toLocaleString('en-US')}–${Number(coverage.toBlock).toLocaleString('en-US')}`:''}. {coverage.note}</p>}</div>)}
      {busy&&<div className="chat-bubble assistant"><span className="chat-author">{assistant}</span><div className="chat-content chat-pending"><span className="spinner"/>Reading the observed facts…</div></div>}
      <div ref={end}/>
    </div>
    {error&&<div className="notice error" role="alert"><span>{error}</span>{failedQuestion&&(['AI_REQUEST_INTERRUPTED','AI_REQUEST_FAILED'].includes(recoveryCode)?<AIRequestRecovery key={recoveryCode+failedQuestion} label="chats" disabled={busy||!available} inspect={inspectSavedChats} restart={startFreshQuestion}/>:<button className="button secondary" disabled={busy||!available||input.trim()!==failedQuestion} onClick={()=>send(failedQuestion)}>Retry question</button>)}</div>}
    {!available&&<p className="inline-note">Chat is temporarily unavailable. Your saved project data is still here.</p>}
    <form className="chat-composer" onSubmit={event=>{event.preventDefault();send(input);}}>
      <textarea rows={2} maxLength={4000} value={input} placeholder={`Ask ${assistant} about $${project.symbol}…`} disabled={busy||opening||!available} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send(input);}}}/>
      <button className="button primary" type="submit" disabled={busy||opening||!available||!input.trim()}>{busy?'Answering…':'Send'}</button>
    </form>{input.trim()&&<button className="text-button" disabled={busy} onClick={()=>{setInput('');setFailedQuestion('');setError('');}}>Discard unsent question</button>}
    <div className="chat-suggestions">{suggestions.map(suggestion=><button key={suggestion} type="button" disabled={busy||opening||!!input.trim()||!available} onClick={()=>send(suggestion)}>{suggestion}</button>)}</div>
    <p className="ai-privacy-note">Market and holder facts cover the most recent 20,000 blocks and the explorer’s current snapshot. This is a bounded read, not an audit or financial advice.</p>
    </>}
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
      <div className="section-title"><h3>Open chats <span className="count">{chats.length}</span></h3><button className="text-button" disabled={busy||opening||!!input.trim()||actionBlocked||removing!==''} onClick={newChat}>New chat</button></div>
      {chats.length===0?<p className="data-note">Your saved conversations stay in this workspace. Ask your first question to start one.</p>
      :<div className="chat-history-list">{chats.map(chat=><div key={chat.id} className={`chat-history-item ${chat.id===activeChatId?'active':''}`}><button type="button" disabled={busy||opening||!!input.trim()||actionBlocked||removing!==''} onClick={()=>{if(chat.id!==activeChatId)openChat(chat.id);}}><strong>{chat.preview||'Untitled chat'}</strong><small>{chat.messageCount} messages · {when(chat.updatedAt)}</small></button><button type="button" className="chat-history-remove" aria-label={'Delete chat: '+(chat.preview||'Untitled chat')} disabled={removing!==''||busy||opening||!!input.trim()||actionBlocked} onClick={()=>removeChat(chat.id)}>{removing===chat.id?'Deleting…':'Delete'}</button></div>)}</div>}
      {moreChats&&<button className="button secondary" disabled={listBusy||busy||opening||!!input.trim()} onClick={loadMoreChats}>{listBusy?'Loading conversations…':'Load more conversations'}</button>}
      <p className="data-note">Saved chats remain until you delete them. Longer conversations open with the latest 40 messages; earlier messages and full downloads stay available.</p>
    </section>
  </aside></div>;
}
