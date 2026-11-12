import {randomUUID} from 'node:crypto';
export function createMonitor(store,market,{now=()=>Date.now()}={}){
  let running=false;
  async function check(owner){
    if(running)return {checked:0,busy:true};running=true;let checked=0;
    try{const rules=store.read('watches').filter(item=>item.enabled&&(!owner||item.owner===owner)).slice(0,100);
      for(const rule of rules){try{const data=await market.details(rule.address);if(!store.read('watches').some(item=>item.id===rule.id&&item.owner===rule.owner&&item.enabled))continue;const previous=rule.last;const events=[];
        if(previous?.graduated===false&&data.graduated===true)events.push({kind:'graduation',title:(data.symbol||rule.symbol)+' graduated to its pool',content:'Pons reports that the Uniswap v4 pool is created. Review its current liquidity and trading conditions.'});
        if(previous?.price&&data.price){const change=(Number(data.price)/Number(previous.price)-1)*100;if(Math.abs(change)>=rule.priceThreshold)events.push({kind:'price',title:`${data.symbol||rule.symbol} moved ${change>0?'+':''}${change.toFixed(1)}%`,content:'Change since your previous successful check. Review the token before acting.'});}
        if(previous?.holdersCount!==null&&previous?.holdersCount!==undefined&&data.holdersCount!==null&&previous.holdersCount!==data.holdersCount)events.push({kind:'holders',title:`${data.symbol||rule.symbol} holder count changed`,content:`${previous.holdersCount.toLocaleString()} → ${data.holdersCount.toLocaleString()} holders.`});
        await store.change('alerts',records=>{for(const event of events)records.push({...event,id:randomUUID(),owner:rule.owner,address:rule.address,createdAt:new Date(now()).toISOString(),read:false});if(records.length>10000)records.splice(0,records.length-10000);});
        await store.change('watches',records=>{const item=records.find(item=>item.id===rule.id);if(item){item.last={price:data.price??previous?.price??null,holdersCount:data.holdersCount??previous?.holdersCount??null,graduated:data.graduated??previous?.graduated??null};item.checkedAt=data.checkedAt;item.error=null;item.priceAvailable=data.price!==null;}});checked++;
      }catch{await store.change('watches',records=>{const item=records.find(item=>item.id===rule.id);if(item)item.error='This token could not be checked. Your previous observation is preserved.';});}}
      return {checked,busy:false};
    }finally{running=false;}
  }
  return {check};
}
