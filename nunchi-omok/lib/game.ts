export type Player={id:string;token:string;name:string;seat:number;ready:boolean;submitted:boolean;positions:number[];draft:number[];seen:number;missed:number;active:boolean};
export type Bomb={kind:'cell'|'row'|'column';index:number;cells:number[];label:string};
export type Room={code:string;host:string;phase:'lobby'|'select'|'reveal'|'finished';round:number;size:number;deadline:number;players:Player[];collisions:number[];winners:string[];reason?:string;bombRules?:boolean;bomb?:Bomb|null;blocked?:number[];edgeBag?:number[];revealPositions?:Record<string,number[]>;revealAt?:number};
export function wins(cells:number[],size:number){const s=new Set(cells);for(const c of cells){const x=c%size,y=Math.floor(c/size);for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){if(Array.from({length:5},(_,i)=>[x+dx*i,y+dy*i]).every(([a,b])=>a>=0&&a<size&&b>=0&&b<size&&s.has(b*size+a)))return true;}}return false;}
export function makeBomb(kind:Bomb['kind'],index:number,size:number):Bomb {
 const cells=kind==='cell'?[index]:Array.from({length:size},(_,i)=>kind==='row'?index*size+i:i*size+index);
 const label=kind==='row'?`${index+1}행`:kind==='column'?`${String.fromCharCode(65+index)}열`:`${String.fromCharCode(65+index%size)}${Math.floor(index/size)+1}`;
 return {kind,index,cells,label};
}
export function resetHazards(r:Room){r.bomb=null;r.blocked=[];r.edgeBag=[];r.revealPositions={};r.revealAt=undefined;}
export function pickBomb(r:Room,random= Math.random):Bomb|null {
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
export function startRound(r:Room,now:number){
 r.blocked=r.bombRules?[...(r.bomb?.cells||[])]:[];
 r.round++;r.phase='select';r.deadline=now+15000;r.collisions=[];
 r.revealPositions={};r.revealAt=undefined;r.bomb=pickBomb(r);
 for(const p of r.players){p.draft=[...p.positions];p.submitted=false;}
}
export function tick(r:Room,now:number){if(r.phase==='select'&&(now>=r.deadline||r.players.filter(p=>p.active).every(p=>p.submitted))){let ps=r.players.filter(p=>p.active);for(const p of ps){p.missed=now-p.seen>12000?p.missed+1:0;if(p.missed>=2){p.active=false;p.positions=[];p.draft=[];}}ps=r.players.filter(p=>p.active);if(ps.length<2){r.phase='finished';r.winners=ps.map(p=>p.id);r.reason=ps.length?'다른 참가자가 퇴장하여 기권승':'참가자가 없어 종료되었습니다';return;}for(const p of ps){if(!validPlacement(r.round,p.positions,p.draft,r.size,r.blocked))p.draft=[...p.positions];}r.revealPositions=Object.fromEntries(ps.map(p=>[p.id,[...p.draft]]));r.revealAt=now;const count=new Map<number,number>();for(const p of ps)for(const c of p.draft)count.set(c,(count.get(c)||0)+1);r.collisions=[...count].filter(([,n])=>n>1).map(([c])=>c);for(const p of ps)p.positions=p.draft.filter(c=>count.get(c)===1&&!r.bomb?.cells.includes(c));r.winners=ps.filter(p=>wins(p.positions,r.size)).map(p=>p.id);r.phase='reveal';r.deadline=now+2000;}else if(r.phase==='reveal'&&now>=r.deadline){if(r.winners.length)r.phase='finished';else startRound(r,now);}}
export function view(r:Room,token:string,now:number){const me=r.players.find(p=>p.token===token);const {edgeBag,revealPositions,...publicRoom}=r;return {...publicRoom,revealPositions:r.phase==='reveal'?revealPositions:undefined,now,nextBoardSize:r.phase==='lobby'?boardSizeForPlayers(r.players.filter(p=>p.active).length):null,me:me?.id,players:r.players.map(({token,draft,...p})=>({...p,...(p.id===me?.id?{draft}: {})}))};}

export function placementLimit(round:number, positions:number[]){return round===1||positions.length===0?3:5;}
export function validPlacement(round:number,positions:number[],cells:number[],size:number,blocked:number[]=[]){return cells.length<=placementLimit(round,positions)&&new Set(cells).size===cells.length&&cells.every(c=>Number.isInteger(c)&&c>=0&&c<size*size&&!blocked.includes(c))&&(positions.length===0||cells.some(c=>positions.includes(c)));}

// Lobby preview and match start share one board-size policy.
export function boardSizeForPlayers(count:number):number|null {
  if(!Number.isInteger(count)||count<2||count>6)return null;
  return count<=3?7:count===4?8:9;
}
