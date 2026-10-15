const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));

export function fitWindow(rect,bounds){
  const width=clamp(rect.width,Math.min(360,bounds.width),bounds.width);
  const height=clamp(rect.height,Math.min(280,bounds.height),bounds.height);
  return {width,height,x:clamp(rect.x,0,bounds.width-width),y:clamp(rect.y,0,bounds.height-height)};
}

export function initialWindow(page,bounds,index=0){
  const compact=['home','guide','calculator'].includes(page);
  const desiredWidth=page==='calculator'?490:page==='home'?720:page==='guide'?660:1000;
  const desiredHeight=page==='home'?610:page==='calculator'?650:page==='guide'?650:740;
  return fitWindow({x:(compact?160:138)+(index%3)*22,y:28+(index%3)*22,width:Math.min(desiredWidth,bounds.width-180),height:Math.min(desiredHeight,bounds.height-60)},bounds);
}

export function moveWindow(rect,dx,dy,bounds){return fitWindow({...rect,x:rect.x+dx,y:rect.y+dy},bounds);}
export function resizeWindow(rect,dx,dy,bounds){return fitWindow({...rect,width:clamp(rect.width+dx,Math.min(360,bounds.width-rect.x),bounds.width-rect.x),height:clamp(rect.height+dy,Math.min(280,bounds.height-rect.y),bounds.height-rect.y)},bounds);}
