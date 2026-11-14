import {useEffect,useRef,useState} from 'react';
import type {Project} from './types';

export function MemeStudio({project,onDirty}:{project:Project;onDirty:(value:boolean)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),image=useRef<HTMLImageElement|null>(null),file=useRef<HTMLInputElement>(null),generation=useRef(0);
  const [top,setTop]=useState(''),[bottom,setBottom]=useState(''),[layout,setLayout]=useState<'caption'|'poster'>('caption'),[name,setName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[drawing,setDrawing]=useState(false),[dirty,setDirty]=useState(false),[imageVersion,setImageVersion]=useState(0);
  useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
  useEffect(()=>{const current=canvas.current,ctx=current?.getContext('2d');if(!current||!ctx)return;let alive=true;
    setDrawing(true);void document.fonts.ready.then(()=>{if(!alive)return;const w=1080;ctx.clearRect(0,0,w,w);ctx.fillStyle='#13161b';ctx.fillRect(0,0,w,w);
      const photo=image.current;if(photo){const height=layout==='caption'?760:1080,scale=Math.min(w/photo.width,height/photo.height),pw=photo.width*scale,ph=photo.height*scale;ctx.drawImage(photo,(w-pw)/2,(height-ph)/2,pw,ph);}
      if(layout==='poster'&&photo){ctx.fillStyle='rgba(9,11,14,.65)';ctx.fillRect(0,760,w,320);}
      ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#d7ff00';ctx.font='600 24px "DM Sans", sans-serif';ctx.fillText('$'+project.symbol,60,photo?790:180,960);
      const lines=(text:string,y:number,size:number,color:string,height:number)=>{let rows:string[]=[];const wrap=()=>{ctx.font=`700 ${size}px "DM Sans", sans-serif`;rows=[];let row='';for(const word of text.trim().split(/\s+/)){const candidate=row?row+' '+word:word;if(ctx.measureText(candidate).width<=960){row=candidate;continue;}if(row)rows.push(row);row='';for(const char of Array.from(word)){if(ctx.measureText(row+char).width>960){rows.push(row);row='';}row+=char;}}if(row)rows.push(row);};wrap();while(rows.length*size*1.16>height&&size>12){size--;wrap();}ctx.fillStyle=color;rows.forEach((row,index)=>ctx.fillText(row,60,y+index*size*1.16));return y+rows.length*size*1.16;};
      const y=lines(top||project.name,photo?830:250,photo?44:64,'#f1f4f7',photo?110:520);if(bottom)lines(bottom,y+12,25,'#b9c2cd',photo?65:180);
      ctx.font='500 20px "DM Sans", sans-serif';ctx.fillStyle='#b9c2cd';ctx.fillText('MemeHelm',60,1030);setDrawing(false);
    });return()=>{alive=false;};
  },[top,bottom,layout,imageVersion,project.name,project.symbol]);
  async function load(selected:File|undefined){if(!selected)return;const version=++generation.current;setError('');setNotice('');
    if(!['image/png','image/jpeg','image/webp'].includes(selected.type)||selected.size>5*1024*1024){setError('Choose a PNG, JPEG or WebP image under 5 MB.');return;}
    const url=URL.createObjectURL(selected),next=new Image();setDrawing(true);
    try{await new Promise<void>((resolve,reject)=>{next.onload=()=>resolve();next.onerror=reject;next.src=url;});if(version!==generation.current)return;if(next.width>6000||next.height>6000)throw new Error('Choose an image no larger than 6,000 × 6,000 pixels.');image.current=next;setName(selected.name);setDirty(true);setImageVersion(value=>value+1);}
    catch(reason){if(version===generation.current){setError(reason instanceof Error?reason.message:'This image could not be opened. Choose another file.');setDrawing(false);}}
    finally{URL.revokeObjectURL(url);}
  }
  function reset(){generation.current++;image.current=null;setTop('');setBottom('');setName('');setDirty(false);setDrawing(false);setError('');setNotice('');setImageVersion(value=>value+1);if(file.current)file.current.value='';}
  async function download(){setError('');try{const blob=await new Promise<Blob>((resolve,reject)=>canvas.current?.toBlob(value=>value?resolve(value):reject(new Error('Could not export this image.')),'image/png'));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.symbol.toLowerCase()}-meme.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDirty(false);setNotice('PNG prepared for download. Review it before publishing.');}catch(reason){setError(reason instanceof Error?reason.message:'Export failed. Please try again.');}}
  return <div className="meme-studio"><section className="studio-controls"><h3>Make a shareable visual.</h3><p className="data-note">Compose a square image with your artwork and captions. Your image stays in this browser; download it to keep a copy.</p>
    {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice success" role="status">{notice}</div>}
    <label className="field"><span>Artwork (optional)</span><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>void load(event.target.files?.[0])}/><small>{name||'PNG, JPEG or WebP · up to 5 MB'}</small></label>
    <label className="field"><span>Layout</span><select value={layout} onChange={event=>{setLayout(event.target.value as 'caption'|'poster');setDirty(true);}}><option value="caption">Image with caption</option><option value="poster">Full image poster</option></select></label>
    <label className="field"><span>Main caption</span><input maxLength={42} value={top} placeholder={project.name} onChange={event=>{setTop(event.target.value);setDirty(true);}}/></label>
    <label className="field"><span>Supporting line</span><input maxLength={55} value={bottom} onChange={event=>{setBottom(event.target.value);setDirty(true);}}/></label>
    <div className="button-row"><button className="button primary" disabled={drawing} onClick={download}>{drawing?'Preparing image…':'Download PNG'}</button><button className="button secondary" disabled={drawing} onClick={reset}>Clear composition</button></div>
    {dirty&&<p className="data-note">Download your composition or clear it before leaving this tool.</p>}
  </section><figure className="studio-preview"><canvas ref={canvas} width={1080} height={1080} role="img" aria-label={`Preview for ${project.name}. Caption: ${top||project.name}. ${bottom}`}/><figcaption>1080 × 1080 · PNG export</figcaption></figure></div>;
}
