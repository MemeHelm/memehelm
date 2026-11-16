type Viewport={width:number;height:number};
const targets=[
 '#workspace-mate-panel [data-mate-landing="welcome"]',
 '#workspace-mate-panel [data-mate-landing="identity"]',
 'button[aria-controls="workspace-mate-panel"]',
 '[aria-label="Open MATE assistant"]',
];

/** Follow the live portrait, not a viewport coordinate or a hidden copy of the assistant. */
export function resolveMateAnchor(doc:Pick<Document,'querySelectorAll'>,viewport:Viewport={width:window.innerWidth,height:window.innerHeight}):HTMLElement|null{
 for(const selector of targets)for(const node of doc.querySelectorAll<HTMLElement>(selector)){
  const rect=node.getBoundingClientRect(),style=node.ownerDocument.defaultView?.getComputedStyle(node);
  // The workspace is intentionally inert/aria-hidden during the intro. Those are not layout visibility.
  if(node.closest('[hidden]')||style?.display==='none'||['hidden','collapse'].includes(style?.visibility||''))continue;
  if(rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<viewport.width&&rect.top<viewport.height)return node;
 }
 return null;
}
