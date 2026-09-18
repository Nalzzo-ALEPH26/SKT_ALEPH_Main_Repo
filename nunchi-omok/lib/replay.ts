import type {ReplayFrame} from './game';
export function replayStage(frame:ReplayFrame,stage:number){
 if(stage===0)return frame.before;
 if(stage===1)return frame.placed;
 if(stage===2)return Object.fromEntries(Object.entries(frame.placed).map(([id,cells])=>[id,cells.filter(c=>!frame.collisions.includes(c))]));
 return frame.after;
}
