type TimeValue=string|number|Date|null|undefined;

function instant(value:TimeValue):Date|null{
  if(value===null||value===undefined||value==='')return null;
  const input=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)?value+'Z':value;
  const date=new Date(input);
  return Number.isFinite(date.getTime())?date:null;
}
function optionsUTC(options:Intl.DateTimeFormatOptions={}){
  const {timeZoneName:unused,...rest}=options;
  return {...rest,timeZone:'UTC'};
}
export function utcDateTime(value:TimeValue,options:Intl.DateTimeFormatOptions={}){
  const date=instant(value);return date?date.toLocaleString('en-US',optionsUTC(options))+' UTC':'Time unavailable';
}
export function utcDate(value:TimeValue,options:Intl.DateTimeFormatOptions={}){
  const date=instant(value);return date?date.toLocaleDateString('en-US',optionsUTC(options))+' UTC':'Time unavailable';
}
export function utcTime(value:TimeValue,options:Intl.DateTimeFormatOptions={}){
  const date=instant(value);return date?date.toLocaleTimeString('en-US',optionsUTC(options))+' UTC':'Time unavailable';
}
/** datetime-local is a zone-free editor; its fields always represent UTC here. */
export function utcInput(value:string|null|undefined){return instant(value)?.toISOString().slice(0,16)||'';}
export function utcFromInput(value:string):string|null{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value))return null;
  const date=instant(value);if(!date)return null;
  const normalized=value.length===16?value+':00.000':value.includes('.')?value.padEnd(23,'0'):value+'.000';
  return date.toISOString()===normalized+'Z'?date.toISOString():null;
}
