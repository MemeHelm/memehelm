export function DraftText({text}:{text:string}){
  const inline=(line:string)=>line.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part);
  return <div className="draft-text">{text.split('\n').map((line,index)=>/^#{1,3}\s/.test(line)?<h4 key={index}>{inline(line.replace(/^#{1,3}\s+/,''))}</h4>:line.trim()?<p key={index}>{inline(line)}</p>:<div key={index} className="draft-text-space"/>)}</div>;
}
