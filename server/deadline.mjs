/** Bounds a read workflow even when a dependency never settles. */
export async function withDeadline(work,milliseconds,message='This data is taking too long to load. Please try again.'){
  let timer;
  try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
