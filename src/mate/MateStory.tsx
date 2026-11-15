import {HelmMark} from '../Brand';
import {MateCharacter} from './MateCharacter';

export function MateStory(){
  return <div className="mate-story" aria-hidden="true">
    <div className="mate-wake-light" data-mate-wake-light/>
    <svg className="mate-wake-point" data-mate-wake-point viewBox="0 0 20 26"><path d="M3 10 17 1v15L3 25Z" fill="#d7ff00"/></svg>
    <div className="mate-wrist-bloom" data-mate-wrist-bloom/>
    {Array.from({length:6},(_,index)=><svg key={index} className="mate-spark" data-mate-spark={index} viewBox="0 0 12 18"><path d="M2 7 10 1v10l-8 6Z" fill={index%2?'#edf2f5':'#d7ff00'}/></svg>)}
    <div className="mate-story-shadow" data-mate-shadow/>
    <svg className="mate-market mate-candles" data-market="candles" viewBox="0 0 90 120"><path d="M25 4v106M63 18v98" stroke="#d6dce0" strokeWidth="4" strokeLinecap="round"/><rect x="9" y="27" width="32" height="60" rx="5" fill="#bd7279" stroke="#df959c" strokeWidth="2"/><rect x="49" y="44" width="28" height="44" rx="5" fill="#a8b872" stroke="#c2d28d" strokeWidth="2"/></svg>
    <svg className="mate-market mate-chart" data-market="chart" viewBox="0 0 110 88"><rect x="2" y="2" width="106" height="84" rx="13" fill="#23303b" stroke="#7b8996" strokeWidth="2"/><path d="M19 20v49h74" fill="none" stroke="#637481" strokeWidth="2"/><path d="m25 56 19-20 17 13 23-26" fill="none" stroke="#d7ff00" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/><path d="M74 23h10v10" fill="none" stroke="#d7ff00" strokeWidth="4" strokeLinejoin="round"/></svg>
    <svg className="mate-market mate-bars" data-market="bars" viewBox="0 0 90 92"><rect x="5" y="53" width="17" height="32" rx="4" fill="#b1bcc5"/><rect x="33" y="29" width="17" height="56" rx="4" fill="#d6dde3"/><rect x="61" y="6" width="17" height="79" rx="4" fill="#8394a2"/></svg>
    <svg className="mate-impact mate-impact-first" data-impact="first" viewBox="0 0 60 60"><path d="m30 3 5 17 17-8-10 17 15 6-19 4-3 17-9-16-18 6 10-16L4 20l18 1Z" fill="#d7ff00"/></svg>
    <svg className="mate-impact mate-impact-second" data-impact="second" viewBox="0 0 60 60"><path d="m30 3 5 17 17-8-10 17 15 6-19 4-3 17-9-16-18 6 10-16L4 20l18 1Z" fill="#edf2f5"/></svg>
    <svg className="mate-key" data-mate-key viewBox="0 0 24 30"><path d="M3 11 21 1v18L3 29Z" fill="#d7ff00" stroke="#eaff70" strokeWidth="1.5"/></svg>
    <div className="mate-portal" data-mate-portal><svg viewBox="0 0 190 248"><g data-mate-window><path d="M3 3h161l23 23v219H26L3 222Z" fill="#10171e" stroke="#d7ff00" strokeWidth="3"/><path d="M4 35h181" stroke="#4d5a43"/><circle cx="18" cy="19" r="3" fill="#d7ff00"/><circle cx="29" cy="19" r="3" fill="#85916d"/><path d="m166 5 19 20M9 222l17 17" stroke="#edff93" strokeWidth="2"/></g><g data-mate-window-corners fill="#d7ff00"><path d="M1 1h9v9H1ZM180 236h9v9h-9ZM1 233h9v9H1Z"/></g></svg></div>
    <div className="mate-actor" data-mate-actor><div className="mate-pose" data-mate-pose><MateCharacter/></div><div className="mate-folded-mark" data-mate-compact><HelmMark/></div></div>
    <div className="mate-intro-title"><strong>MATE<span>.</span></strong><p>Your project’s first mate.</p></div>
  </div>;
}
