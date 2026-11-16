/** One primary route, independent from the persistent assistant. */
export const workspaceToolPages = ['workspace','memory','goals','calendar','community','activity','writing','assets','publishing','publication'];
const views = {workspace:'today',memory:'memory',goals:'goals',calendar:'content',community:'community',activity:'activity',writing:'writing',assets:'assets',publishing:'publishing',publication:'publication'};
export function workspaceViewFor(page){return views[page]||'today';}
export function workspacePageFor(view){return Object.keys(views).find(page=>views[page]===view)||'workspace';}
export function primaryContentKey(page){return workspaceToolPages.includes(page)?'workspace':page==='copilot'?'workspace':page;}
export function routePage(hash){
  if(/^#app\/discover\/0x[a-fA-F0-9]{40}$/.test(hash))return 'discover';
  const match=hash.match(/^#app\/(discover|signals|overview|launch|treasury|copilot|calculator|guide|workspace|memory|goals|calendar|community|activity|writing|assets|publishing|publication)$/);
  return match?(match[1]==='copilot'?'workspace':match[1]):'home';
}
/** Global navigation describes the task area, while detailed routes keep their own state. */
export function mainAreaFor(page){
  if(page==='home'||page==='guide')return 'home';
  if(page==='launch'||page==='calculator')return 'launch';
  if(page==='discover'||page==='signals')return 'discover';
  return 'overview';
}
export function guardDestination(id){
  if(id==='assistant-chat')return 'copilot';
  if(id.startsWith('workspace-'))return workspacePageFor(id.slice(10));
  if(id==='copilot')return 'workspace';
  return ['launch','treasury','overview','discover','signals'].includes(id)?id:'workspace';
}
