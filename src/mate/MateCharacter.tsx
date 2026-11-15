import {useId} from 'react';

/** Original layered character artwork. All animated joints use their local (0, 0). */
export function MateCharacter({className='',armored=false}:{className?:string;armored?:boolean}){
  const id=`mate-${useId().replace(/:/g,'')}`;
  const paint=(name:string)=>`url(#${id}-${name})`;
  return <svg className={`mate-character ${className}`} viewBox="0 0 280 340" fill="none" aria-hidden="true" focusable="false" data-armored={armored?'true':'false'}>
    <defs>
      <linearGradient id={`${id}-core`} x1="-58" y1="-68" x2="58" y2="73" gradientUnits="userSpaceOnUse">
        <stop stopColor="#35404b"/><stop offset=".43" stopColor="#1b232c"/><stop offset="1" stopColor="#10161d"/>
      </linearGradient>
      <linearGradient id={`${id}-limb`} x1="-18" y1="0" x2="18" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#303a45"/><stop offset=".54" stopColor="#18212a"/><stop offset="1" stopColor="#0c131a"/>
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="-66" y1="-64" x2="58" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff"/><stop offset=".45" stopColor="#e7edf2"/><stop offset=".76" stopColor="#b5c1cc"/><stop offset="1" stopColor="#8d9eac"/>
      </linearGradient>
      <linearGradient id={`${id}-shell`} x1="-23" y1="-6" x2="20" y2="61" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f6f9fc"/><stop offset=".56" stopColor="#d9e2e9"/><stop offset="1" stopColor="#91a2b0"/>
      </linearGradient>
      <linearGradient id={`${id}-visor`} x1="-52" y1="-24" x2="48" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#26323e"/><stop offset=".5" stopColor="#121c26"/><stop offset="1" stopColor="#080f17"/>
      </linearGradient>
      <linearGradient id={`${id}-citron`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#ebff65"/><stop offset=".44" stopColor="#d7ff00"/><stop offset="1" stopColor="#b3d600"/>
      </linearGradient>
      <clipPath id={`${id}-left-half`} clipPathUnits="userSpaceOnUse"><rect x="-100" y="-110" width="100" height="230"/></clipPath>
      <clipPath id={`${id}-right-half`} clipPathUnits="userSpaceOnUse"><rect x="0" y="-110" width="100" height="230"/></clipPath>
      <g id={`${id}-chest-art`}>
        <path d="M-29-46L0-29L29-46L40-31L34 22L19 38Q0 45-19 38L-34 22L-40-31Z" fill={paint('silver')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M-29-43L0-22L29-43L34-34L0-8L-34-34Z" fill="#f4f8fb"/>
        <path d="M-32-25L0-2L32-25L30-12L0 10L-30-12Z" fill="#aab9c5"/>
        <path d="M-29-11L0 12L29-11L25 20L14 31Q0 36-14 31L-25 20Z" fill="#e7eef3" stroke="#b2c0ca" strokeWidth="1.5"/>
        <path d="M-5 17L10 13L6 23L-9 27Z" fill="#d7ff00" stroke="#94ad29" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M-34-29L-29 17L-17 31" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      </g>
      <g id={`${id}-helmet-art`}>
        <path d="M-73-62L-62-72L0-25L62-72L73-62L79-12L70 31L53 41L48-4L0 34L-48-4L-53 41L-70 31L-79-12Z" fill={paint('silver')} stroke="#101922" strokeWidth="3.5" strokeLinejoin="round"/>
        <path d="M-62-72L0-25L62-72L59-51L0-5L-59-51Z" fill="#f5f8fa"/>
        <path d="M-73-62L-59-51L-48-4L-53 41L-64 27L-67-16Z" fill="#c1cdd6"/>
        <path d="M73-62L59-51L48-4L53 41L64 27L67-16Z" fill="#91a3b2"/>
        <path d="M-59-51L0-5L59-51L48-4L0 34L-48-4Z" fill={paint('silver')}/>
        <path d="M-60-65L0-19L59-64" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      </g>
    </defs>

    <g transform="translate(140 230)">
      <g data-mate-part="body">
        <g transform="translate(-23 29)">
          <g data-mate-part="left-leg">
            <path d="M-15-7Q-1-15 14-5L14 31Q10 43-4 44Q-17 41-17 29Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3"/>
            <path d="M-17 32Q-26 39-27 52Q-27 57-20 57H15Q19 55 18 48L13 33Q-2 27-17 32Z" fill="#18222c" stroke="#0a1118" strokeWidth="3"/>
            <path d="M-20 49H12" stroke="#394653" strokeWidth="2" strokeLinecap="round"/>
            <g data-mate-armor="left-boot">
              <path d="M-17 13L15 13L19 35L6 42L-17 35Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-17 17L-11 34L5 39L19 32" stroke="#f4f8fa" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M-17 35L6 42L18 36L22 51Q22 56 16 57H-22Q-28 56-27 50L-25 43Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-26 52H21V56Q21 60 15 60H-22Q-27 59-26 52Z" fill="#25313d" stroke="#101922" strokeWidth="2"/>
              <path d="M-20 44L-12 40L1 45V51H-23Z" fill="#eef4f8"/>
            </g>
          </g>
        </g>
        <g transform="translate(23 29)">
          <g data-mate-part="right-leg">
            <path d="M-14-5Q1-15 15-7L17 29Q17 41 4 44Q-10 43-14 31Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3"/>
            <path d="M-13 33L-18 48Q-19 55-15 57H20Q27 57 27 52Q26 39 17 32Q2 27-13 33Z" fill="#18222c" stroke="#0a1118" strokeWidth="3"/>
            <path d="M-12 49H20" stroke="#394653" strokeWidth="2" strokeLinecap="round"/>
            <g data-mate-armor="right-boot">
              <path d="M-15 13H17L17 35L-6 42L-19 35Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-14 17H12L13 31L-6 38L-18 32" stroke="#f4f8fa" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M-18 36L-6 42L17 35L25 43L27 50Q28 56 22 57H-16Q-22 56-22 51Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-21 52H26Q27 59 22 60H-15Q-21 60-21 56Z" fill="#25313d" stroke="#101922" strokeWidth="2"/>
              <path d="M-15 44L-5 41L8 45V51H-18Z" fill="#eef4f8"/>
            </g>
          </g>
        </g>

        <path d="M-31-42Q-14-52 0-51Q14-52 31-42L38 4Q37 34 21 43Q0 49-21 43Q-37 34-38 4Z" fill={paint('core')} stroke="#0a1118" strokeWidth="3.5"/>
        <path d="M-27-32Q-31-5-27 15" stroke="#4b5865" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round"/>
        <path d="M-24 30Q0 39 24 30" stroke="#0d141c" strokeWidth="7" strokeLinecap="round"/>
        <path d="M-15-54H15L18-40Q0-30-18-40Z" fill="#26323e" stroke="#0a1118" strokeWidth="3"/>

        <g transform="translate(-49 -34)">
          <g data-mate-part="left-arm">
            <path d="M-12-5Q0-13 12-4Q22 9 17 24L8 46Q-1 53-13 46Q-21 41-18 30L-17 13Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3"/>
            <path d="M-12 43Q-22 48-21 61L-18 73Q-15 81-10 79Q-6 83-1 79Q4 82 8 76L11 67Q18 68 20 62Q23 56 17 51L9 44Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3" strokeLinejoin="round"/>
            <path d="M-11 61L-9 73M-2 62L-1 74M8 59L8 68" stroke="#3e4c59" strokeWidth="2" strokeLinecap="round"/>
            <g data-mate-wrist="true">
              <path d="M-16 35L-3 37L-4 45L-17 43Z" fill="#141d26" stroke="#576974" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M-13 38L-6 39L-7 42L-14 41Z" fill="#d7ff00"/>
            </g>
            <g data-mate-armor="left-arm">
              <path d="M-17-8Q-4-15 10-8L17 6L12 19Q-4 11-22 17L-24 5Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-17-6Q-6-11 7-6L12 3Q-5 0-19 7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M-22 17Q-4 11 12 19L9 23L-18 24Z" fill="#94a6b5"/>
            </g>
            <g data-mate-armor="left-gauntlet">
              <path d="M-19 28L12 32L14 52L5 60L-18 56L-24 45Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-17 31L-19 43L-14 52" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M-16 36L-4 38L-5 44L-17 42Z" fill="#d7ff00" stroke="#78901d" strokeWidth="1"/>
              <path d="M-18 56L5 60L14 52" stroke="#8e9fad" strokeWidth="3"/>
            </g>
          </g>
        </g>
        <g transform="translate(49 -34)">
          <g data-mate-part="right-arm">
            <path d="M-12-4Q0-13 12-5L17 13L18 30Q21 41 13 46Q1 53-8 46L-17 24Q-22 9-12-4Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3"/>
            <path d="M-9 44L-17 51Q-23 56-20 62Q-18 68-11 67L-8 76Q-4 82 1 79Q6 83 10 79Q15 81 18 73L21 61Q22 48 12 43Z" fill={paint('limb')} stroke="#0a1118" strokeWidth="3" strokeLinejoin="round"/>
            <path d="M11 61L9 73M2 62L1 74M-8 59L-8 68" stroke="#3e4c59" strokeWidth="2" strokeLinecap="round"/>
            <g data-mate-armor="right-arm">
              <path d="M-10-8Q4-15 17-8L24 5L22 17Q4 11-12 19L-17 6Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-7-6Q6-11 17-6L19 7Q5 0-12 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M-12 19Q4 11 22 17L18 24L-9 23Z" fill="#94a6b5"/>
            </g>
            <g data-mate-armor="right-gauntlet">
              <path d="M-12 32L19 28L24 45L18 56L-5 60L-14 52Z" fill={paint('shell')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
              <path d="M-9 35L13 31L18 43" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M-5 60L18 56L24 45" stroke="#8e9fad" strokeWidth="3"/>
            </g>
          </g>
        </g>

        <g data-mate-armor="chest">
          <g data-mate-shell="chest-left"><g clipPath={paint('left-half')}><use href={`#${id}-chest-art`}/></g></g>
          <g data-mate-shell="chest-right"><g clipPath={paint('right-half')}><use href={`#${id}-chest-art`}/></g></g>
          <path data-mate-highlight="true" d="M-26-32L0-13L26-32" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0}}/>
        </g>

        <g transform="translate(0 -113)">
          <g data-mate-part="head">
            <path d="M-65-48Q-58-67-34-69L34-69Q58-67 65-48Q77-14 72 20Q70 49 50 61Q0 80-50 61Q-70 49-72 20Q-77-14-65-48Z" fill={paint('core')} stroke="#0a1118" strokeWidth="3.5"/>
            <path d="M-57-40Q-43-49-25-49H25Q43-49 57-40Q66-7 61 22Q57 47 39 53Q0 65-39 53Q-57 47-61 22Q-66-7-57-40Z" fill={paint('visor')} stroke="#374653" strokeWidth="1.5"/>
            <path d="M-56-32Q-44-42-24-42H9" stroke="#526471" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round"/>
            <g data-mate-armor="helmet">
              <g data-mate-shell="left"><g clipPath={paint('left-half')}><use href={`#${id}-helmet-art`}/></g></g>
              <g data-mate-shell="right"><g clipPath={paint('right-half')}><use href={`#${id}-helmet-art`}/></g></g>
              <g data-mate-shell="chin">
                <path d="M-65 28L-42 49L0 57L42 49L65 28L68 46Q62 61 46 66L0 74L-46 66Q-62 61-68 46Z" fill={paint('silver')} stroke="#101922" strokeWidth="3.5" strokeLinejoin="round"/>
                <path d="M-64 32L-41 53L0 61L41 53L64 32" stroke="#f6fafc" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M-46 66L0 74L46 66L42 59L0 67L-42 59Z" fill="#91a3b2"/>
              </g>
              <g data-mate-shell="tab">
                <path d="M48-72L77-94L77-74L48-52Z" fill={paint('citron')} stroke="#101922" strokeWidth="3" strokeLinejoin="round"/>
                <path d="M51-72L74-89" stroke="#f1ff9b" strokeWidth="2" strokeLinecap="round"/>
              </g>
            </g>
            <g data-mate-part="eyes">
              <rect x="-33" y="21" width="10" height="21" rx="5" fill="#f0f7fa"/>
              <rect x="23" y="21" width="10" height="21" rx="5" fill="#f0f7fa"/>
              <path d="M-5 45Q0 48 5 45" stroke="#728797" strokeWidth="2" strokeLinecap="round"/>
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>;
}
