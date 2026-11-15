import {flightGeometry,mateTime,MATE_DURATION,MATE_REVEAL,MATE_STORY_END,MATE_STORY_REVEAL,MATE_STORY_LAND} from './choreography';

type Options={onFrame:(seconds:number)=>void;onComplete:()=>void;onFailure:()=>void;anchor:()=>DOMRect|null};
type Frame={at:number;transform?:string;opacity?:number;clipPath?:string};
const END=MATE_STORY_END;
const offset=(storySeconds:number)=>mateTime(storySeconds)/(MATE_DURATION/1000);

export function createMateSequence(surface:HTMLElement,options:Options){
  const animations:Animation[]=[],transients:Element[]=[];
  let disposed=false,frame=0,observer:ResizeObserver|undefined;
  const query=(selector:string)=>{
    const node=surface.querySelector<HTMLElement|SVGElement>(selector);
    if(!node)throw new Error('Missing MATE story layer');return node;
  };
  const actor=query('[data-mate-actor]') as HTMLElement,pose=query('[data-mate-pose]');
  const start=document.timeline.currentTime??performance.now(),styles=getComputedStyle(surface);
  const out=styles.getPropertyValue('--mh-ease').trim()||'cubic-bezier(.23,1,.32,1)';
  const move=styles.getPropertyValue('--mh-move').trim()||'cubic-bezier(.77,0,.175,1)';
  function animate(node:Element,frames:Frame[],easing=out){
    const animation=node.animate(frames.map(({at,...values})=>({...values,offset:offset(at),easing})),{duration:MATE_DURATION,fill:'both',easing:'linear'});
    animation.startTime=start;animations.push(animation);return animation;
  }
  function transform(node:Element,keys:[number,string][],easing=out){return animate(node,keys.map(([at,transform])=>({at,transform})),easing);}
  function fade(node:Element,keys:[number,number][]){return animate(node,keys.map(([at,opacity])=>({at,opacity})));}
  const part=(name:string)=>query(`[data-mate-actor] [data-mate-part="${name}"]`);
  const shell=(name:string)=>query(`[data-mate-actor] [data-mate-shell="${name}"]`);
  const rotate=(name:string,keys:[number,number][])=>transform(part(name),keys.map(([at,degrees])=>[at,`rotate(${degrees}deg)`]));
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
    animations.forEach(animation=>animation.cancel());transients.forEach(node=>node.remove());
  }
  function assemble(node:Element,at:number,x:number,y:number,turn:number,duration=.65,trail=false){
    animate(node,[
      {at:0,opacity:0,transform:`translate(${x}px,${y}px) rotate(${turn}deg)`},
      {at,opacity:0,transform:`translate(${x}px,${y}px) rotate(${turn}deg)`},
      {at:at+.06,opacity:1,transform:`translate(${x*.8}px,${y*.8}px) rotate(${turn*.8}deg)`},
      {at:at+duration*.58,opacity:1,transform:`translate(${x*.25}px,${y*.25-15}px) rotate(${turn*.2}deg)`},
      {at:at+duration*.82,opacity:1,transform:`translate(${-x*.025}px,${-y*.025}px) rotate(${-turn*.05}deg)`},
      {at:at+duration,opacity:1,transform:'translate(0,0) rotate(0deg)'},{at:END,opacity:1,transform:'translate(0,0) rotate(0deg)'},
    ]);
    if(!trail)return;
    const ghost=node.cloneNode(true) as SVGElement;
    ghost.querySelectorAll('defs').forEach(node=>node.remove());
    for(const item of [ghost,...ghost.querySelectorAll('*')]){
      for(const attr of [...item.attributes])if(attr.name==='id'||attr.name.startsWith('data-mate-'))item.removeAttribute(attr.name);
    }
    ghost.setAttribute('data-mate-afterimage','true');ghost.style.opacity='0';
    node.parentNode?.insertBefore(ghost,node);transients.push(ghost);
    animate(ghost,[
      {at:0,opacity:0,transform:`translate(${x}px,${y}px) rotate(${turn}deg)`},
      {at:at+.05,opacity:0,transform:`translate(${x}px,${y}px) rotate(${turn}deg)`},
      {at:at+.14,opacity:.18,transform:`translate(${x*.75}px,${y*.75}px) rotate(${turn*.8}deg)`},
      {at:at+duration*.65,opacity:0,transform:'translate(0,-7px) rotate(0deg)'},{at:END,opacity:0},
    ]);
  }
  try{
    const compact=!!surface.ownerDocument.querySelector('[data-mate-anchor]')?.closest('.is-compact');
    fade(pose,[[0,0],[.28,.15],[.9,.8],[1.2,1],[14.72,1],[14.96,compact?0:1],[END,compact?0:1]]);
    if(compact)fade(query('[data-mate-compact]'),[[0,0],[14.72,0],[14.96,1],[END,1]]);
    transform(pose,[
      [0,'translateY(4px) scale(.98)'],[1.2,'translateY(0) scale(1)'],
      [1.65,'translate(0,0) rotate(0deg) scale(1)'],[1.85,'translate(10px,5px) rotate(10deg) scale(1.07,.93)'],
      [2.1,'translate(-3px,-2px) rotate(-4deg) scale(.98,1.02)'],[2.25,'translate(0,0) rotate(0deg) scale(1)'],
      [2.48,'translate(-9px,6px) rotate(-9deg) scale(.94,1.05)'],[2.7,'translate(2px,2px) rotate(3deg) scale(1.04,.96)'],
      [2.88,'translateY(30px) rotate(-9deg) scale(1.12,.78)'],[3.12,'translateY(26px) rotate(-7deg) scale(1.1,.8)'],
      [3.4,'translateY(0) rotate(0deg) scale(1)'],[4.6,'translateY(0) rotate(0deg) scale(1)'],
      [4.85,'translateY(3px) rotate(-2deg) scale(1.025,.98)'],[5.15,'translateY(0) rotate(1deg) scale(1)'],
      [6.8,'translateY(0) rotate(0deg) scale(1)'],[7.86,'translateY(0) rotate(0deg) scale(1)'],
      [7.98,'translateY(5px) rotate(0deg) scale(1.035,.97)'],[8.25,'translateY(-5px) rotate(-2deg) scale(1.06)'],
      [8.9,'translateY(-5px) rotate(-2deg) scale(1.06)'],[9.2,'translateY(0) rotate(0deg) scale(1)'],
      [10.6,'translateY(0) rotate(0deg) scale(1)'],[10.86,'translateY(12px) rotate(-5deg) scale(1.1,.88)'],
      [11.05,'translateY(-4px) rotate(0deg) scale(.95,1.06)'],[11.45,'translateY(0) rotate(0deg) scale(1)'],
      [MATE_STORY_LAND,'translateY(0) rotate(0deg) scale(1)'],[14.3,'translateY(5px) rotate(0deg) scale(1.08,.92)'],
      [14.48,'translateY(0) rotate(0deg) scale(1)'],[END,'translateY(0) rotate(0deg) scale(1)'],
    ]);
    rotate('head',[[0,-9],[.55,-6],[1.2,0],[1.85,11],[2.2,0],[2.48,-14],[2.7,4],[2.88,-9],[3.15,-7],[3.4,4],[3.65,10],[4.5,0],[7.8,0],[7.94,4],[8.2,-5],[8.9,-5],[9.2,0],[10.3,5],[10.6,0],[END,0]]);
    rotate('left-arm',[[0,8],[1.85,-30],[2.18,8],[2.48,28],[2.7,8],[2.9,-22],[3.2,-22],[3.4,8],[3.6,-68],[4.3,-68],[4.6,8],[10.6,8],[11.1,46],[11.8,8],[END,0]]);
    rotate('right-arm',[[0,-8],[2.48,32],[2.7,-8],[2.9,20],[3.2,20],[3.4,-8],[3.63,63],[3.76,75],[3.9,63],[4.13,75],[4.32,63],[4.6,-8],[8.2,-15],[8.85,-15],[9.1,-70],[9.35,-106],[9.7,-12],[10.6,-8],[11.1,-48],[11.8,-8],[14.35,-8],[14.52,-100],[14.66,-78],[14.79,-100],[14.98,0],[END,0]]);
    rotate('left-leg',[[0,0],[2.85,-9],[3.2,-9],[3.4,0],[4.65,-5],[4.95,0],[8.05,0],[8.22,-10],[8.5,0],[END,0]]);
    rotate('right-leg',[[0,0],[2.85,9],[3.2,9],[3.4,0],[4.9,5],[5.15,0],[10.7,0],[11.15,18],[11.8,0],[END,0]]);
    const eyes=part('eyes') as SVGGraphicsElement,bounds=eyes.getBBox();
    eyes.style.transformOrigin=`${bounds.x+bounds.width/2}px ${bounds.y+bounds.height/2}px`;
    transform(eyes,[[0,'translateY(-4px) scaleY(.15)'],[.5,'translateY(-4px) scaleY(1)'],[.9,'translateY(-3px) scaleY(1)'],[1,'scaleY(.12)'],[1.15,'scaleY(1)'],[1.78,'scaleY(1)'],[1.85,'scaleY(.1)'],[2.03,'scaleY(1)'],[2.4,'scaleY(1)'],[2.48,'scaleY(.1)'],[2.65,'scaleY(.55)'],[2.8,'translateY(-3px) scaleY(1.15)'],[3.18,'scaleY(.55)'],[3.5,'scaleY(.7)'],[4.3,'scaleY(1)'],[7.75,'scaleY(1)'],[7.87,'scaleY(.1)'],[8.05,'scaleY(1)'],[14.75,'scaleY(1)'],[14.82,'scaleY(.1)'],[14.95,'scaleY(1)'],[END,'scaleY(1)']]);

    const wake=query('[data-mate-wake-point]');
    animate(wake,[{at:0,opacity:0,transform:'translate(-55px,-240px) rotate(-15deg)'},{at:.12,opacity:1,transform:'translate(-45px,-210px) rotate(-8deg)'},{at:.6,opacity:1,transform:'translate(45px,-115px) rotate(14deg)'},{at:1.08,opacity:1,transform:'translate(70px,-90px) rotate(0deg)'},{at:1.35,opacity:0,transform:'translate(95px,-55px) rotate(15deg)'},{at:END,opacity:0}],move);
    fade(query('[data-mate-wake-light]'),[[0,0],[.5,.65],[1.1,.45],[1.55,0],[END,0]]);
    fade(query('[data-mate-wrist-bloom]'),[[0,0],[3.68,0],[3.77,.4],[3.94,0],[4.06,0],[4.17,1],[4.55,0],[END,0]]);
    const wrist=query('[data-mate-wrist]');
    fade(wrist,[[0,.3],[3.7,.3],[3.76,1],[3.95,.35],[4.12,1],[4.6,1],[END,1]]);
    for(let index=0;index<6;index++){
      const angle=-Math.PI*.88+index*Math.PI*.3,x=Math.cos(angle)*54,y=38+Math.sin(angle)*48;
      animate(query(`[data-mate-spark="${index}"]`),[{at:0,opacity:0,transform:'translate(0,38px) rotate(0deg) scale(.94)'},{at:4.12,opacity:0,transform:'translate(0,38px) rotate(0deg) scale(.94)'},{at:4.2,opacity:1,transform:`translate(${x*.2}px,${38+(y-38)*.2}px) rotate(${index*16}deg)`},{at:4.72,opacity:0,transform:`translate(${x}px,${y}px) rotate(${index*38}deg)`},{at:END,opacity:0}]);
    }
    for(const [name,at,x,y,turn] of [
      ['left-boot',4.6,-90,85,-25],['right-boot',4.79,90,85,25],['left-arm',5.1,-145,-40,-35],['right-arm',5.28,145,-40,35],
      ['left-gauntlet',5.43,-100,60,-26],['right-gauntlet',5.6,100,60,26],['chest',6.05,0,105,6],
    ] as const)assemble(query(`[data-mate-actor] [data-mate-armor="${name}"]`),at,x,y,turn,.65,true);
    assemble(shell('chest-left'),6.25,-34,0,-4,.55);assemble(shell('chest-right'),6.4,34,0,4,.55);
    fade(query('[data-mate-actor] [data-mate-armor="helmet"]'),[[0,0],[6.98,0],[7,1],[END,1]]);
    assemble(shell('left'),7.0,-115,-14,-24,.64);assemble(shell('right'),7.16,115,-14,24,.64);
    assemble(shell('chin'),7.42,0,65,0,.48);assemble(shell('tab'),7.78,36,-80,-12,.26);
    animate(query('[data-mate-highlight]'),[{at:0,opacity:0,transform:'translate(-7px,-4px)'},{at:6.75,opacity:0,transform:'translate(-7px,-4px)'},{at:6.9,opacity:.85,transform:'translate(0,0)'},{at:7.12,opacity:0,transform:'translate(7px,4px)'},{at:END,opacity:0}]);

    animate(query('[data-market="candles"]'),[{at:0,opacity:0,transform:'translate(-290px,-150px) rotate(-18deg)'},{at:1.2,opacity:0,transform:'translate(-265px,-125px) rotate(-14deg)'},{at:1.35,opacity:1,transform:'translate(-210px,-110px) rotate(-10deg)'},{at:1.82,opacity:1,transform:'translate(-64px,-72px) rotate(12deg)'},{at:2.1,opacity:1,transform:'translate(-150px,-92px) rotate(-18deg)'},{at:4.18,opacity:.85,transform:'translate(-150px,-92px) rotate(-18deg)'},{at:4.7,opacity:0,transform:'translate(-330px,-200px) rotate(-48deg)'},{at:END,opacity:0}],move);
    animate(query('[data-market="chart"]'),[{at:0,opacity:0,transform:'translate(280px,-200px) rotate(20deg)'},{at:1.88,opacity:0,transform:'translate(260px,-175px) rotate(18deg)'},{at:2.05,opacity:1,transform:'translate(200px,-155px) rotate(10deg)'},{at:2.46,opacity:1,transform:'translate(52px,-120px) rotate(-16deg)'},{at:2.7,opacity:1,transform:'translate(145px,-145px) rotate(15deg)'},{at:4.18,opacity:.85,transform:'translate(145px,-145px) rotate(15deg)'},{at:4.75,opacity:0,transform:'translate(315px,-235px) rotate(45deg)'},{at:END,opacity:0}],move);
    animate(query('[data-market="bars"]'),[{at:0,opacity:0,transform:'translate(-15px,-300px) rotate(-8deg)'},{at:2.5,opacity:0,transform:'translate(-15px,-285px) rotate(-8deg)'},{at:2.65,opacity:1,transform:'translate(-5px,-225px) rotate(-5deg)'},{at:2.98,opacity:1,transform:'translate(0,-85px) rotate(12deg)'},{at:3.24,opacity:.8,transform:'translate(110px,45px) rotate(35deg)'},{at:4.18,opacity:.65,transform:'translate(135px,65px) rotate(32deg)'},{at:4.8,opacity:0,transform:'translate(280px,145px) rotate(55deg)'},{at:END,opacity:0}],move);
    for(const [name,at,turn] of [['first',1.82,-15],['second',2.46,16]] as const)animate(query(`[data-impact="${name}"]`),[{at:0,opacity:0,transform:`rotate(${turn}deg) scale(.94)`},{at:at-.02,opacity:0,transform:`rotate(${turn}deg) scale(.94)`},{at:at+.02,opacity:1,transform:`rotate(${turn}deg) scale(1)`},{at:at+.23,opacity:0,transform:`rotate(${turn}deg) scale(1.16)`},{at:END,opacity:0}]);
    animate(query('[data-mate-shadow]'),[{at:0,opacity:0,transform:'translate(-50%,-50%) scaleX(.94)'},{at:1.2,opacity:.5,transform:'translate(-50%,-50%) scaleX(1)'},{at:8.25,opacity:.6,transform:'translate(-50%,-50%) scaleX(1.06)'},{at:10.65,opacity:.5,transform:'translate(-50%,-50%) scaleX(1)'},{at:11.4,opacity:0,transform:'translate(-50%,-50%) scaleX(.7)'},{at:END,opacity:0}]);
    fade(query('.mate-intro-backdrop'),[[0,1],[MATE_STORY_REVEAL,1],[12.7,0],[END,0]]);
    fade(query('.mate-intro-title'),[[0,0],[8,0],[8.2,1],[9,1],[9.3,0],[END,0]]);
    const closed='polygon(86% 0,100% 10%,100% 16%,96% 16%,86% 6%,86% 0)';
    animate(query('[data-mate-window]'),[{at:0,opacity:0,clipPath:closed},{at:9.78,opacity:0,clipPath:closed},{at:9.9,opacity:1,clipPath:closed},{at:10.6,opacity:1,clipPath:'polygon(0 0,86% 0,100% 10%,100% 100%,14% 100%,0 90%)'},{at:END,opacity:1,clipPath:'polygon(0 0,86% 0,100% 10%,100% 100%,14% 100%,0 90%)'}],move);
    fade(query('[data-mate-window-corners]'),[[0,0],[9.7,0],[9.85,1],[10.1,.4],[10.5,0],[END,0]]);
    const portal=query('[data-mate-portal]') as HTMLElement;
    const complete=animate(portal,[{at:0,opacity:0},{at:9.65,opacity:0},{at:9.8,opacity:1},{at:12.4,opacity:1},{at:12.65,opacity:0},{at:END,opacity:0}]);
    const portalMove=transform(portal,[[0,'translate(-50%,-50%)'],[END,'translate(-50%,-50%)']],move);
    const key=animate(query('[data-mate-key]'),[{at:0,opacity:0},{at:END,opacity:0}],move);
    const flight=transform(actor,[[0,'translate(-50%,-50%)'],[END,'translate(-50%,-50%)']],move);
    function resize(){
      const rect=surface.getBoundingClientRect(),anchor=options.anchor()??new DOMRect(rect.right-92,rect.bottom-112,56,64);
      const path=flightGeometry({width:rect.width,height:rect.height,actorWidth:actor.offsetWidth,actorHeight:actor.offsetHeight,target:{x:anchor.x-rect.x,y:anchor.y-rect.y,width:anchor.width,height:anchor.height}});
      const actorTransform=(x=0,y=0,scale=1,turn=0)=>`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale}) rotate(${turn}deg)`;
      const actorKeys=[
        {at:0,transform:actorTransform(),opacity:1},{at:10.7,transform:actorTransform(),opacity:1},
        {at:11.22,transform:actorTransform(path.portalX*.5,-55,.94,-13),opacity:1},{at:11.87,transform:actorTransform(path.portalX,0,.58,6),opacity:0},
        {at:12.4,transform:actorTransform(path.portalX,0,.58,6),opacity:0},{at:12.58,transform:actorTransform(path.portalX,0,.58,6),opacity:1},
        {at:13.35,transform:actorTransform(path.portalX+(path.x-path.portalX)*.52,path.y*.52-36,(.58+path.scale)/2,-5),opacity:1},
        {at:MATE_STORY_LAND,transform:actorTransform(path.x,path.y,path.scale),opacity:1},{at:END,transform:actorTransform(path.x,path.y,path.scale),opacity:1},
      ];
      (flight.effect as KeyframeEffect).setKeyframes(actorKeys.map(({at,...values})=>({...values,offset:offset(at),easing:move})));
      portal.style.left=`${rect.width/2+path.portalX}px`;
      const portalWidth=portal.offsetWidth,portalHeight=portal.offsetHeight,takeover=Math.max(rect.width/portalWidth,rect.height/portalHeight)*1.3;
      const portalKeys=[{at:0,transform:'translate(-50%,-50%) scale(.96)'},{at:9.65,transform:'translate(-50%,-50%) scale(.96)'},{at:10.6,transform:'translate(-50%,-50%) scale(1)'},{at:11.85,transform:'translate(-50%,-50%) scale(1)'},{at:12.4,transform:`translate(-50%,-50%) translate(${-path.portalX}px,${rect.height*.06}px) scale(${takeover})`},{at:END,transform:`translate(-50%,-50%) translate(${-path.portalX}px,${rect.height*.06}px) scale(${takeover})`}];
      (portalMove.effect as KeyframeEffect).setKeyframes(portalKeys.map(({at,...values})=>({...values,offset:offset(at),easing:move})));
      const keyX=path.portalX+portalWidth*.425,keyY=-portalHeight*.435;
      const keyKeys=[{at:0,opacity:0,transform:'translate(95px,26px) rotate(-20deg)'},{at:9.12,opacity:0,transform:'translate(95px,26px) rotate(-20deg)'},{at:9.22,opacity:1,transform:'translate(105px,15px) rotate(0deg)'},{at:9.58,opacity:1,transform:`translate(${(105+keyX)/2}px,${keyY-30}px) rotate(160deg)`},{at:9.86,opacity:1,transform:`translate(${keyX}px,${keyY}px) rotate(360deg)`},{at:10.08,opacity:0,transform:`translate(${keyX}px,${keyY}px) rotate(360deg)`},{at:END,opacity:0}];
      (key.effect as KeyframeEffect).setKeyframes(keyKeys.map(({at,...values})=>({...values,offset:offset(at),easing:move})));
      const folded=query('[data-mate-compact]') as HTMLElement;
      folded.style.width=`${anchor.width/path.scale}px`;folded.style.height=`${anchor.height/path.scale}px`;
      folded.style.borderWidth=`${1/path.scale}px`;folded.style.borderRadius=`${10/path.scale}px`;
      const foldedIcon=folded.querySelector('svg');if(foldedIcon){foldedIcon.style.width=`${27/path.scale}px`;foldedIcon.style.height=`${27/path.scale}px`;}
    }
    observer=new ResizeObserver(resize);observer.observe(surface);
    const anchor=surface.ownerDocument.querySelector('[data-mate-anchor]');if(anchor)observer.observe(anchor);
    resize();
    let revealed=false,lastStep=-1;
    function tick(){
      if(disposed)return;
      const seconds=Math.min(Number(flight.currentTime??0)/1000,MATE_DURATION/1000),step=Math.floor(seconds*20);
      try{
        if(step!==lastStep){lastStep=step;options.onFrame(seconds);}
        if(seconds>=MATE_REVEAL&&!revealed){revealed=true;resize();}
      }catch{dispose();options.onFailure();return;}
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
    complete.finished.then(()=>{if(!disposed)options.onComplete();}).catch(()=>{});
    return{dispose};
  }catch(error){dispose();throw error;}
}
