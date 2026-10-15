import {useId} from 'react';
import {HelmMark} from './Brand';
import './wallpaper.css';

export function Wallpaper(){
  const id=useId().replace(/:/g,'');
  const paint=(name:string)=>`url(#${id}-${name})`;
  return <div className="helm-wallpaper" aria-hidden="true">
    <div className="helm-wallpaper-atmosphere"/>
    <svg className="helm-wallpaper-sculpture" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id={`${id}-fold`} x1="650" y1="1000" x2="1350" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0a1013"/>
          <stop offset=".38" stopColor="#1c292c"/>
          <stop offset=".57" stopColor="#29362c"/>
          <stop offset=".74" stopColor="#111b1b"/>
          <stop offset="1" stopColor="#080e11"/>
        </linearGradient>
        <linearGradient id={`${id}-underfold`} x1="810" y1="1040" x2="1420" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#070b0d"/>
          <stop offset=".55" stopColor="#182321"/>
          <stop offset=".78" stopColor="#35412a"/>
          <stop offset="1" stopColor="#0b1113"/>
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="450" y1="1010" x2="1550" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8aa2a6" stopOpacity="0"/>
          <stop offset=".3" stopColor="#8aa2a6" stopOpacity=".18"/>
          <stop offset=".64" stopColor="#d7ff00" stopOpacity=".72"/>
          <stop offset=".83" stopColor="#a6bd79" stopOpacity=".24"/>
          <stop offset="1" stopColor="#8aa2a6" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id={`${id}-contour`} x1="200" y1="950" x2="1450" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#96b0b7" stopOpacity="0"/>
          <stop offset=".5" stopColor="#96b0b7" stopOpacity=".12"/>
          <stop offset="1" stopColor="#96b0b7" stopOpacity=".02"/>
        </linearGradient>
        <path id={`${id}-stream`} d="M-180 1090C230 1050 485 760 790 760C1100 760 1240 900 1450 610C1630 360 1380 60 1690-170"/>
        <path id={`${id}-stream-back`} d="M-100 1030C240 1010 400 660 790 650C1170 640 1230 790 1390 530C1550 270 1320 0 1530-170"/>
      </defs>
      <g className="helm-wallpaper-ribbons">
        <path fill={paint('underfold')} d="M-180 1090C230 1050 485 760 790 760C1100 760 1240 900 1450 610C1630 360 1380 60 1690-170L1840-120C1530 80 1790 470 1560 750C1340 1010 1120 880 850 890C500 900 330 1190-180 1200Z"/>
        <path fill={paint('fold')} d="M-100 1030C240 1010 400 660 790 650C1170 640 1230 790 1390 530C1550 270 1320 0 1530-170L1690-170C1380 60 1630 360 1450 610C1240 900 1100 760 790 760C485 760 230 1050-180 1090Z"/>
        <g stroke={paint('contour')} strokeWidth="1">
          <path d="M-120 980C230 970 410 620 790 610C1170 600 1220 740 1355 510C1515 240 1290-40 1490-190"/>
          <path d="M-100 950C230 940 410 580 790 570C1170 560 1200 690 1320 490C1480 220 1250-60 1450-200"/>
          <path d="M-80 920C230 910 410 540 790 530C1140 520 1170 640 1285 470C1440 200 1210-80 1410-210"/>
          <path d="M-180 1130C230 1090 485 800 800 800C1110 800 1270 950 1490 645C1670 390 1440 80 1740-170"/>
          <path d="M-180 1170C230 1130 485 840 820 840C1130 840 1300 1000 1530 680C1720 420 1490 110 1790-160"/>
        </g>
        <use href={`#${id}-stream-back`} stroke={paint('edge')} strokeWidth="1"/>
        <use href={`#${id}-stream`} stroke={paint('edge')} strokeWidth="1.5"/>
      </g>
    </svg>
    <div className="helm-wallpaper-particles">{Array.from({length:7},(_,index)=><span key={index} className="helm-wallpaper-particle"/>)}</div>
    <div className="helm-wallpaper-vignette"/>
    <div className="helm-wallpaper-brand">
      <HelmMark/>
      <strong>MemeHelm<span>.</span></strong>
      <p>Launch it. Steer it.</p>
    </div>
    <div className="helm-wallpaper-signature"><span/>A little direction. Infinite possibility.</div>
  </div>;
}
