'use client';
import {useEffect,useState} from 'react';
import {winningCells,type ReplayFrame,type CompletedMatch} from '@/lib/game';
import {replayStage} from '@/lib/replay';
const colors=['#c7f35b','#8b9dff','#ff9c70','#65dfd1','#ee8fc8','#ffd36a'];
const symbols=['●','◆','▲','■','★','✚'];
const stages=['선택 전 · 위험 예고','배치 동시 공개','충돌 처리','폭격·폐쇄 후 결과'];
export default function GameReplay({frames,match,onClose}:{frames:ReplayFrame[];match:CompletedMatch;onClose:()=>void}){
 const [step,setStep]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
 const total=frames.length*4;
 useEffect(()=>{if(!playing||!total)return;const t=setInterval(()=>setStep(v=>{if(v>=total-1){return v;}return v+1;}),Math.max(80,Math.min(650,15000/total))/speed);return()=>clearInterval(t);},[playing,speed,total]);
 useEffect(()=>{if(step===total-1)setPlaying(false);},[step,total]);
 if(!frames.length)return <section className="replay-panel"><h2>이번 경기 다시 보기</h2><p>공개된 라운드 없이 종료된 경기입니다.</p><button className="secondary" onClick={onClose}>닫기</button></section>;
 const frame=frames[Math.floor(step/4)],stage=step%4,positions=replayStage(frame,stage),closed=stage===3?frame.closedAfter:frame.closedBefore;
 const highlight=new Set(stage===3?frame.players.filter(p=>frame.winners.includes(p.id)).flatMap(p=>winningCells(frame.after[p.id]||[],frame.size)):[]);
 function move(value:number){setPlaying(false);setStep(Math.max(0,Math.min(total-1,value)));}
 return <section className="replay-panel" aria-label="경기 다시 보기"><div className="replay-heading"><div><span className="eyebrow">MATCH REPLAY</span><h2>이번 경기 다시 보기</h2></div><button className="secondary" onClick={onClose}>닫기</button></div>
 <p>{match.names.length?`승리: ${match.names.join(' · ')}`:'경기 종료'}{match.reason?` · ${match.reason}`:''}</p>
 <div className="replay-status" role="status">{frame.round}라운드 / {match.rounds} · {stages[stage]}{frame.bomb?` · ${frame.bomb.permanent?'영구 폐쇄':'폭격'} ${frame.bomb.label}`:''}</div>
 <div className="board-frame"><div className="board-columns" style={{gridTemplateColumns:`repeat(${frame.size},1fr)`}}>{Array.from({length:frame.size},(_,i)=><span key={i}>{String.fromCharCode(65+i)}</span>)}</div><div className="board-rows" style={{gridTemplateRows:`repeat(${frame.size},1fr)`}}>{Array.from({length:frame.size},(_,i)=><span key={i}>{i+1}</span>)}</div><div className="board" style={{gridTemplateColumns:`repeat(${frame.size},1fr)`}}>
 {Array.from({length:frame.size*frame.size},(_,i)=>{const ps=frame.players.filter(p=>positions[p.id]?.includes(i)),danger=frame.bomb?.cells.includes(i),collision=stage>=2&&frame.collisions.includes(i);return <div key={i} className={`cell ${closed.includes(i)?'closed':frame.blocked.includes(i)?'ash':''} ${danger?'danger':''} ${highlight.has(i)?'winning':''}`} aria-label={`${String.fromCharCode(65+i%frame.size)}${Math.floor(i/frame.size)+1} ${ps.map(p=>p.name).join(', ')}`}>
 {ps.length===1?<span className="stone" style={{background:colors[ps[0].seat]}}>{symbols[ps[0].seat]}</span>:ps.length>1?<span className="replay-overlap">{ps.map(p=><i key={p.id} style={{background:colors[p.seat]}}>{symbols[p.seat]}</i>)}</span>:null}
 {collision&&<span className="ash-mark">×</span>}{closed.includes(i)&&<span className="ash-mark">▣</span>}{danger&&stage<3&&<span className="hazard-mark">!</span>}
 </div>;})}</div></div>
 <div className="replay-legend">{frame.players.map(p=><span key={p.id} style={{color:colors[p.seat]}}>{symbols[p.seat]} {p.name}</span>)}</div>
 <label htmlFor="replay-position">라운드 이동</label><input id="replay-position" type="range" min={0} max={frames.length-1} value={Math.floor(step/4)} onChange={e=>move(Number(e.target.value)*4)}/>
 <div className="replay-controls"><button className="secondary" disabled={step===0} onClick={()=>move((Math.floor(step/4)-1)*4)}>이전 라운드</button><button className="primary" onClick={()=>{if(step===total-1)setStep(0);setPlaying(!playing);}}>{playing?'일시정지':step===total-1?'처음부터 재생':'재생'}</button><button className="secondary" disabled={Math.floor(step/4)===frames.length-1} onClick={()=>move((Math.floor(step/4)+1)*4)}>다음 라운드</button><label>배속 <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(n=><option key={n} value={n}>{n}배</option>)}</select></label></div>
 <p className="replay-note">내 화면에서만 재생됩니다. 다음 경기에 참여하려면 다시 보기를 닫아주세요.</p></section>;
}
