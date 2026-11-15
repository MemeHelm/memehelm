export const MATE_INTRO_SEEN_KEY='memehelm:intro:mate-v2';

type IntroStorage=Pick<Storage,'getItem'|'setItem'>;

function browserStorage():IntroStorage|null{
  try{return typeof window==='undefined'?null:window.localStorage;}
  catch{return null;}
}

// A blocked or full browser store must never block entry to the workspace.
export function hasSeenMateIntro(storage:IntroStorage|null=browserStorage()):boolean{
  try{return storage?.getItem(MATE_INTRO_SEEN_KEY)==='1';}
  catch{return false;}
}

export function markMateIntroSeen(storage:IntroStorage|null=browserStorage()):boolean{
  try{
    if(!storage)return false;
    storage.setItem(MATE_INTRO_SEEN_KEY,'1');
    return true;
  }catch{return false;}
}
