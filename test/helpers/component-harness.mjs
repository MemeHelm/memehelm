import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const time=require('../../src/time.ts');

// Execute a function component and its effects without a DOM. Rendering/visual QA remains separate.
export function componentHarness(file,exportName,props,imports,{expose=false}={}){
  const slots=[],pending=[];let cursor=0;
  const hooks={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useRef(initial){const index=cursor++;return slots[index]??=( {current:initial} );},
    useId(){return`component-${cursor++}`;},
    useMemo(work,deps){const index=cursor++,previous=slots[index];if(previous&&deps&&deps.length===previous.deps?.length&&deps.every((value,i)=>Object.is(value,previous.deps[i])))return previous.value;const value=work();slots[index]={deps,value};return value;},
    useEffect(work,deps){const index=cursor++,previous=slots[index];if(!previous||!deps||deps.some((value,i)=>!Object.is(value,previous.deps?.[i]))){slots[index]={deps,cleanup:previous?.cleanup};pending.push(()=>{slots[index].cleanup?.();slots[index].cleanup=work();});}},
  };
  hooks.useCallback=(callback,deps)=>hooks.useMemo(()=>callback,deps);
  // Both effect kinds run explicitly in this DOM-free harness; browser layout is verified separately.
  hooks.useLayoutEffect=hooks.useEffect;
  if(expose&&!/^[A-Za-z_$][\w$]*$/.test(exportName))throw new Error('A valid component name is required.');
  const source=ts.transpileModule(readFileSync(file,'utf8')+(expose?`\nexport {${exportName}};`:''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',source)(name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):imports[name]??(name==='./time'?time:{}),module,module.exports);
  return{
    render(){cursor=0;return module.exports[exportName](props);},
    effects(){while(pending.length)pending.shift()();},
    unmount(){for(const slot of slots)slot?.cleanup?.();},
  };
}
export function textOf(node){if(node==null||typeof node==='boolean')return'';if(typeof node==='string'||typeof node==='number')return String(node);if(Array.isArray(node))return node.map(textOf).join(' ');return textOf(node.props?.children);}
export function findNode(node,predicate){if(node==null||typeof node!=='object')return null;if(Array.isArray(node)){for(const item of node){const result=findNode(item,predicate);if(result)return result;}return null;}if(predicate(node))return node;return findNode(node.props?.children,predicate);}
export const settle=()=>new Promise(resolve=>setImmediate(resolve));
