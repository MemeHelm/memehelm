// Preserve the authored poses while trimming quiet holds more than assembly.
export const MATE_STORY_END=15;
export const MATE_STORY_REVEAL=12.4;
export const MATE_STORY_LAND=14.2;
const pacing=[
  [0,0],[1.2,.65],[3.4,2.15],[4.6,2.9],[8,5.35],
  [9,5.8],[10.6,6.9],[MATE_STORY_REVEAL,8.1],[MATE_STORY_LAND,9.25],[MATE_STORY_END,10],
] as const;

export function mateTime(storySeconds:number):number{
  if(storySeconds<=0)return 0;
  for(let index=1;index<pacing.length;index++){
    const [storyEnd,end]=pacing[index],[storyStart,start]=pacing[index-1];
    if(storySeconds<=storyEnd)return start+(storySeconds-storyStart)/(storyEnd-storyStart)*(end-start);
  }
  return 10;
}

export const MATE_DURATION=mateTime(MATE_STORY_END)*1000;
export const MATE_REVEAL=mateTime(MATE_STORY_REVEAL);
export const MATE_LAND=mateTime(MATE_STORY_LAND);
export const MATE_DEADLINE=MATE_DURATION+4000;
export function mateStage(seconds:number){
  return seconds<mateTime(1.2)?'wake':seconds<mateTime(3.4)?'chaos':seconds<mateTime(4.6)?'summon':seconds<mateTime(8)?'armor':seconds<mateTime(9)?'identity':seconds<mateTime(10.6)?'window':seconds<MATE_REVEAL?'portal':seconds<MATE_LAND?'landing':'settle';
}
type Layout={width:number;height:number;actorWidth:number;actorHeight:number;target:{x:number;y:number;width:number;height:number}};

// The SVG keeps its aspect ratio inside the actual assistant button.
export function flightGeometry({width,height,actorWidth,actorHeight,target}:Layout){
  return{
    portalX:Math.min(170,width*.23),
    x:target.x+target.width/2-width*.5,
    y:target.y+target.height/2-height*.44,
    scale:Math.min(target.width/Math.max(1,actorWidth),target.height/Math.max(1,actorHeight)),
  };
}
