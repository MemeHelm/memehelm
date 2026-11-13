export function HelmMark({className=''}:{className?:string}) {
  return <svg className={className} viewBox="250 280 780 710" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M296 330 627 585 862 403V525L958 452V741L836 646V559L627 723 418 560V677L296 579V330ZM296 612 418 707V951L296 866V612ZM836 678 958 773V866L836 951V678Z"/>
    <path fill="var(--brand-accent,#d7ff00)" d="M887 382 982 318V402L887 473V382Z"/>
  </svg>;
}

export function Wordmark(){return <span className="helm-wordmark"><HelmMark/><span>MemeHelm<span className="wordmark-dot">.</span></span></span>;}

export function Arrow({diagonal=false}:{diagonal?:boolean}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={diagonal?'M6 18 18 6M6 6h12v12':'M4 12h16m-6-6 6 6-6 6'}/></svg>;}

export function TokenPlaceholder({symbol=''}:{symbol?:string}){
  return <span className="token-placeholder" aria-hidden="true">{symbol?symbol.slice(0,2).toUpperCase():<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="24" height="24" rx="3"/><circle cx="12" cy="12" r="2"/><path d="m5 24 8-8 5 5 4-4 6 6"/></svg>}</span>;
}
