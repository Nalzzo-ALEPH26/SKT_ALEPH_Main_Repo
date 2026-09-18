export type Player={id:string;token:string;name:string;seat:number;ready:boolean;submitted:boolean;positions:number[];draft:number[];seen:number;missed:number;active:boolean};
export type Bomb={kind:'cell'|'row'|'column';index:number;cells:number[];label:string;permanent?:boolean};
export type Bounds={top:number;bottom:number;left:number;right:number};
export type ReplayFrame={round:number;size:number;players:{id:string;name:string;seat:number}[];before:Record<string,number[]>;placed:Record<string,number[]>;after:Record<string,number[]>;collisions:number[];bomb:Bomb|null;blocked:number[];closedBefore:number[];closedAfter:number[];winners:string[]};
export type CompletedMatch={id:string;rounds:number;winners:string[];names:string[];reason?:string};
export type Room={code:string;host:string;phase:'lobby'|'select'|'reveal'|'finished';round:number;size:number;deadline:number;players:Player[];collisions:number[];winners:string[];reason?:string;bombRules?:boolean;bomb?:Bomb|null;blocked?:number[];edgeBag?:number[];revealPositions?:Record<string,number[]>;revealAt?:number;rulesVersion?:number;bounds?:Bounds;minArea?:number;closed?:number[];startCount?:number;matchId?:string;lastReplay?:ReplayFrame;resolvedRounds?:number;completedMatch?:CompletedMatch};
export function winningCells(cells:number[],size:number){
 const s=new Set(cells),result=new Set<number>();
 const has=(x:number,y:number)=>x>=0&&x<size&&y>=0&&y<size&&s.has(y*size+x);
 for(const c of s){const x=c%size,y=Math.floor(c/size);for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
  if(has(x-dx,y-dy))continue;
  const line:number[]=[];for(let i=0;has(x+dx*i,y+dy*i);i++)line.push((y+dy*i)*size+x+dx*i);
  if(line.length===5)line.forEach(n=>result.add(n));
 }}return [...result];
}
export function wins(cells:number[],size:number){return winningCells(cells,size).length>0;}
export function placementLimit(round:number,positions:number[],version=4){return round===1||positions.length===0?3:version>=4?6:5;}
export function validPlacement(round:number,positions:number[],cells:number[],size:number,blocked:number[]=[],version=4){return cells.length<=placementLimit(round,positions,version)&&new Set(cells).size===cells.length&&cells.every(c=>Number.isInteger(c)&&c>=0&&c<size*size&&!blocked.includes(c))&&(positions.length===0||cells.some(c=>positions.includes(c)));}
export function boardSizeForPlayers(count:number):number|null {if(!Number.isInteger(count)||count<2||count>6)return null;return count<=3?7:count===4?8:9;}
export function forbidden(r:Room){return [...(r.blocked||[]),...(r.closed||[])];}
export function initMatch(r:Room){
 r.rulesVersion=4;r.startCount=r.players.filter(p=>p.active).length;r.minArea=r.startCount<=3?5:r.startCount===4?6:7;
 r.bounds={top:0,left:0,bottom:r.size-1,right:r.size-1};r.closed=[];r.matchId=crypto.randomUUID();r.resolvedRounds=0;r.lastReplay=undefined;
}
export function makeBomb(kind:Bomb['kind'],index:number,size:number):Bomb {
 const cells=kind==='cell'?[index]:Array.from({length:size},(_,i)=>kind==='row'?index*size+i:i*size+index);
 const label=kind==='row'?`${index+1}행`:kind==='column'?`${String.fromCharCode(65+index)}열`:`${String.fromCharCode(65+index%size)}${Math.floor(index/size)+1}`;
 return {kind,index,cells,label};
}
export function resetHazards(r:Room){r.bomb=null;r.blocked=[];r.edgeBag=[];r.revealPositions={};r.revealAt=undefined;}
function legacyBomb(r:Room,random= Math.random):Bomb|null {
 if(!r.bombRules||r.round<2)return null;
 const available=(b:Bomb)=>!b.cells.every(c=>(r.blocked||[]).includes(c));
 if(r.round%2===0){
  if(!r.edgeBag?.length){r.edgeBag=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[r.edgeBag[i],r.edgeBag[j]]=[r.edgeBag[j],r.edgeBag[i]];}}
  const edge=(n:number)=>makeBomb(n<2?'row':'column',n%2===0?0:r.size-1,r.size);
  const at=r.edgeBag.findIndex(n=>available(edge(n)));
  // Keep a blocked edge in the bag for the next outer-edge turn.
  if(at>=0)return edge(r.edgeBag.splice(at,1)[0]);
  return [0,1,2,3].map(edge).find(available)!;
 }
 const roll=random();const kind=roll<.5?'cell':roll<.75?'row':'column';
 const choices=Array.from({length:kind==='cell'?r.size*r.size:r.size},(_,i)=>makeBomb(kind,i,r.size)).filter(available);
 return choices[Math.floor(random()*choices.length)];
}

export function pickBomb(r:Room,random=Math.random):Bomb|null {
 if((r.rulesVersion||0)<4)return legacyBomb(r,random);
 if(!r.bombRules||r.round<2)return null;
 const b=r.bounds!,min=r.minArea!;const width=b.right-b.left+1,height=b.bottom-b.top+1;
 const active=(c:number)=>!r.closed?.includes(c);
 const trim=(bomb:Bomb)=>({...bomb,cells:bomb.cells.filter(active)});
 if(r.round>=4&&r.round%2===0&&(width>min||height>min)){
  const options:Bomb[]=[];
  if(height>min)options.push(trim(makeBomb('row',b.top,r.size)),trim(makeBomb('row',b.bottom,r.size)));
  if(width>min)options.push(trim(makeBomb('column',b.left,r.size)),trim(makeBomb('column',b.right,r.size)));
  return {...options[Math.floor(random()*options.length)],permanent:true};
 }
 const roll=random(),kind=width===min&&height===min?'cell':roll<.5?'cell':roll<.75?'row':'column';
 const choices=Array.from({length:kind==='cell'?r.size*r.size:r.size},(_,i)=>trim(makeBomb(kind,i,r.size)))
  .filter(b=>b.cells.length&&!b.cells.every(c=>r.blocked?.includes(c)));
 return choices[Math.floor(random()*choices.length)]||null;
}
export function startRound(r:Room,now:number){
 r.blocked=r.bombRules&&!r.bomb?.permanent?[...(r.bomb?.cells||[])]:[];
 r.round++;r.phase='select';r.deadline=now+((r.rulesVersion||0)>=4?25000:15000);r.collisions=[];
 r.revealPositions={};r.revealAt=undefined;r.lastReplay=undefined;r.bomb=pickBomb(r);
 for(const p of r.players){p.draft=[...p.positions];p.submitted=false;}
}
function closeEdge(r:Room){
 if(!r.bomb?.permanent||!r.bounds)return;
 r.closed=[...new Set([...(r.closed||[]),...r.bomb.cells])];const b=r.bounds;
 if(r.bomb.kind==='row'){if(r.bomb.index===b.top)b.top++;else b.bottom--;}
 else if(r.bomb.kind==='column'){if(r.bomb.index===b.left)b.left++;else b.right--;}
}
export function completeMatch(r:Room){if(r.phase==='finished'&&r.matchId&&r.completedMatch?.id!==r.matchId)r.completedMatch={id:r.matchId,rounds:r.resolvedRounds||0,winners:[...r.winners],names:r.players.filter(p=>r.winners.includes(p.id)).map(p=>p.name),reason:r.reason};}
export function tick(r:Room,now:number){
 if(r.phase==='select'&&(now>=r.deadline||r.players.filter(p=>p.active).every(p=>p.submitted))){
  let ps=r.players.filter(p=>p.active);
  for(const p of ps){p.missed=now-p.seen>12000?p.missed+1:0;if(p.missed>=2){p.active=false;p.positions=[];p.draft=[];}}
  ps=r.players.filter(p=>p.active);
  if(ps.length<2){r.phase='finished';r.winners=ps.map(p=>p.id);r.reason=ps.length?'다른 참가자가 퇴장하여 기권승':'참가자가 없어 종료되었습니다';completeMatch(r);return;}
  for(const p of ps)if(!validPlacement(r.round,p.positions,p.draft,r.size,forbidden(r),r.rulesVersion||3))p.draft=[...p.positions];
  const before=Object.fromEntries(ps.map(p=>[p.id,[...p.positions]])),closedBefore=[...(r.closed||[])];
  r.revealPositions=Object.fromEntries(ps.map(p=>[p.id,[...p.draft]]));r.revealAt=now;
  const count=new Map<number,number>();for(const p of ps)for(const c of p.draft)count.set(c,(count.get(c)||0)+1);
  r.collisions=[...count].filter(([,n])=>n>1).map(([c])=>c);
  for(const p of ps)p.positions=p.draft.filter(c=>count.get(c)===1&&!r.bomb?.cells.includes(c));
  closeEdge(r);r.winners=ps.filter(p=>wins(p.positions,r.size)).map(p=>p.id);
  r.phase='reveal';r.deadline=now+2000;r.resolvedRounds=r.round;
  if(r.matchId)r.lastReplay={round:r.round,size:r.size,players:ps.map(({id,name,seat})=>({id,name,seat})),before,placed:r.revealPositions,after:Object.fromEntries(ps.map(p=>[p.id,[...p.positions]])),collisions:[...r.collisions],bomb:r.bomb?{...r.bomb,cells:[...r.bomb.cells]}:null,blocked:[...(r.blocked||[])],closedBefore,closedAfter:[...(r.closed||[])],winners:[...r.winners]};
 }else if(r.phase==='reveal'&&now>=r.deadline){if(r.winners.length)r.phase='finished';else startRound(r,now);}
 completeMatch(r);
}
export function view(r:Room,token:string,now:number){
 const me=r.players.find(p=>p.token===token);const {edgeBag,revealPositions,lastReplay,...publicRoom}=r;
 return {...publicRoom,stoneLimit:me?placementLimit(r.round,me.positions,r.rulesVersion||3):3,selectionSeconds:(r.rulesVersion||0)>=4?25:15,revealPositions:r.phase==='reveal'?revealPositions:undefined,now,nextBoardSize:r.phase==='lobby'?boardSizeForPlayers(r.players.filter(p=>p.active).length):null,me:me?.id,players:r.players.map(({token,draft,...p})=>({...p,...(p.id===me?.id?{draft}: {})}))};
}
