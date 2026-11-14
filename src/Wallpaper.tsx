import {useId} from 'react';
import './wallpaper.css';

const body='M296 330 627 585 862 403V525L958 452V741L836 646V559L627 723 418 560V677L296 579V330ZM296 612 418 707V951L296 866V612ZM836 678 958 773V866L836 951V678Z';
const notch='M887 382 982 318V402L887 473V382Z';

export function Wallpaper({paused=false}:{paused?:boolean}){
  const id=useId().replace(/:/g,'');
  return <div className={`helm-wallpaper ${paused?'is-paused':''}`} aria-hidden="true">
    <div className="helm-wallpaper-plane plane-top"/><div className="helm-wallpaper-plane plane-bottom"/>
    <div className="helm-wallpaper-brand">
      <svg className="helm-wallpaper-mark" viewBox="250 280 780 710" fill="none">
        <defs>
          <linearGradient id={`${id}-graphite`} x1="310" y1="320" x2="850" y2="940" gradientUnits="userSpaceOnUse"><stop stopColor="#737c85"/><stop offset=".25" stopColor="#424a53"/><stop offset=".58" stopColor="#252b32"/><stop offset="1" stopColor="#11161b"/></linearGradient>
          <linearGradient id={`${id}-citron`} x1="890" y1="320" x2="960" y2="480" gradientUnits="userSpaceOnUse"><stop stopColor="#eeff68"/><stop offset=".48" stopColor="#d7ff00"/><stop offset="1" stopColor="#9eb900"/></linearGradient>
          <linearGradient id={`${id}-rim`} x1="296" y1="330" x2="958" y2="951" gradientUnits="userSpaceOnUse"><stop stopColor="#b8c3ce" stopOpacity=".7"/><stop offset=".5" stopColor="#64727f" stopOpacity=".1"/><stop offset="1" stopColor="#05070a" stopOpacity=".4"/></linearGradient>
        </defs>
        <path d={body} fill="#090d11" transform="translate(3 9)"/>
        <path d={body} fill={`url(#${id}-graphite)`} stroke={`url(#${id}-rim)`} strokeWidth="1.5"/>
        <path d={notch} fill="#0b1005" transform="translate(3 9)"/><path d={notch} fill={`url(#${id}-citron)`}/>
      </svg>
      <strong>MemeHelm</strong><p>Launch it. Steer it.</p>
    </div>
    <div className="helm-wallpaper-particles">{[0,1,2].map(index=><span key={index} className="helm-wallpaper-particle"/>)}</div>
    <div className="helm-wallpaper-vignette"/>
  </div>;
}
