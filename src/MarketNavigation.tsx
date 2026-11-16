import type {Page} from './types';
import {DesktopIcon} from './Desktop';

export function MarketNavigation({page,navigate}:{page:Page;navigate:(page:Page)=>void}){
 return <nav className="market-area-navigation" aria-label="Market tools">
  <div><DesktopIcon name="discover" size={19}/><strong>Market</strong></div>
  <button type="button" aria-current={page==='discover'?'page':undefined} onClick={()=>navigate('discover')}>Discover</button>
  <button type="button" aria-current={page==='signals'?'page':undefined} onClick={()=>navigate('signals')}>Watchlist &amp; alerts</button>
 </nav>;
}
