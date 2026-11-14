const number=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
export function projectIntelligence(data,address){
  const explorer=`https://robinhoodchain.blockscout.com/token/${address}`;
  let distribution=null;
  if(data.holderDataAvailable&&Array.isArray(data.holders)&&/^[1-9]\d*$/.test(data.totalSupply||'')){
    const supply=BigInt(data.totalSupply),balances=data.holders.filter(item=>/^0x[\da-f]{40}$/i.test(item.address||'')&&/^\d+$/.test(item.balance||'')).map(item=>({...item,value:BigInt(item.balance)})).sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:0);
    const largest=balances.slice(0,5),sum=largest.reduce((total,item)=>total+item.value,0n);
    if(balances.length&&sum<=supply)distribution={sampleSize:balances.length,largestCount:largest.length,share:Number(sum*10000n/supply)/100,holders:largest.map(item=>({address:item.address,share:Number(item.value*10000n/supply)/100})),checkedAt:data.holdersCheckedAt||data.checkedAt||null,source:explorer+'?tab=holders'};
  }
  return {checkedAt:data.checkedAt||null,source:explorer,currency:String(data.currency||'').slice(0,20),price:number(data.price),reserve:number(data.reserve),curveProgress:number(data.progress),phase:Number.isSafeInteger(data.phase)?data.phase:null,holdersCount:number(data.holdersCount),distribution,coverage:{market:data.price!=null,holders:!!data.holderDataAvailable,holderCount:data.holdersCount!=null},notes:['Balances use the returned explorer sample, not a complete ownership analysis.','Pool, curve, exchange and burn addresses may be included. Wallets are not identified as people.','Changes compare successful observations, not fixed 24-hour periods.']};
}
