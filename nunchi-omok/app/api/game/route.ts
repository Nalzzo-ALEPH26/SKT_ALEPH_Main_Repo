import { env } from 'cloudflare:workers';
import { Room,Player,startRound,tick,view,placementLimit,validPlacement,boardSizeForPlayers,resetHazards,initMatch,forbidden,completeMatch,requiredAnchors } from '@/lib/game';
export const dynamic='force-dynamic';
const response=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
let replaySchema:Promise<unknown>|undefined;
async function ensureReplay(db:D1Database){
 if(!replaySchema)replaySchema=(async()=>{
  await db.prepare('CREATE TABLE IF NOT EXISTS game_replays (room_code TEXT NOT NULL,match_id TEXT NOT NULL,round INTEGER NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(match_id,round))').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS game_replays_room ON game_replays(room_code)').run();
 })().catch(e=>{replaySchema=undefined;throw e;});
 await replaySchema;
}
function player(name:string,seat:number):Player{return {id:crypto.randomUUID(),token:crypto.randomUUID(),name:name.trim().slice(0,16)||'플레이어',seat,ready:false,submitted:false,positions:[],draft:[],seen:Date.now(),missed:0,active:true};}
export async function POST(req:Request){try{const raw:unknown=await req.json();if(!raw||typeof raw!=='object'||Array.isArray(raw))return response({error:'잘못된 요청입니다.'},400);const b=raw as Record<string,unknown>;const db=env.DB;if(!db)return response({error:'게임 서버를 준비 중입니다. 잠시 후 다시 시도해주세요.'},503);const now=Date.now();if(b.action==='create'){const p=player(String(b.name||''),0);const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');const r:Room={code,host:p.id,phase:'lobby',round:0,size:7,deadline:0,players:[p],collisions:[],winners:[]};await db.prepare('INSERT INTO rooms (code,state,version) VALUES (?,?,0)').bind(code,JSON.stringify(r)).run();return response({room:view(r,p.token,now),token:p.token});}
const code=String(b.code||'').toUpperCase();for(let attempt=0;attempt<12;attempt++){const row=await db.prepare('SELECT state,version FROM rooms WHERE code=?').bind(code).first<{state:string;version:number}>();if(!row)return response({error:'방 코드를 확인해주세요.'},404);const r:Room=JSON.parse(row.state);const priorFrame=r.lastReplay?.round,priorCompleted=r.completedMatch?.id;let p=r.players.find(p=>p.token===b.token);if(b.action!=='join'&&!p)return response({error:'참가 정보가 없습니다. 방에 다시 입장해주세요.'},401);if(b.action==='replay'){
 if(!r.completedMatch||b.matchId!==r.completedMatch.id)return response({error:'종료된 경기만 다시 볼 수 있습니다.'},409);
 const after=Number(b.after||0);if(!Number.isInteger(after)||after<0)return response({error:'잘못된 라운드입니다.'},400);
 await ensureReplay(db);const rows=await db.prepare('SELECT round,snapshot FROM game_replays WHERE match_id=? AND round>? ORDER BY round LIMIT 101').bind(r.completedMatch.id,after).all<{round:number;snapshot:string}>();
 const records=rows.results.slice(0,100);return response({match:r.completedMatch,frames:records.map(x=>JSON.parse(x.snapshot)),next:rows.results.length>100?records[records.length-1].round:null});
}
if(p)p.seen=now;tick(r,now);let token=typeof b.token==='string'?b.token:'';
if(b.action==='join'&&!p){if(r.players.length>=6)return response({error:'방이 가득 찼습니다.'},409);const seat=[0,1,2,3,4,5].find(n=>!r.players.some(x=>x.seat===n))!;p=player(String(b.name||''),seat);p.active=r.phase==='lobby';r.players.push(p);token=p.token;}
if(b.action==='ready'&&p&&r.phase==='lobby')p.ready=!p.ready;
if(b.action==='start'){if(p?.id!==r.host||r.phase!=='lobby'||r.players.length<2||!r.players.every(x=>x.ready))return response({error:'2명 이상 모두 준비를 완료해야 시작할 수 있어요.'},409);r.size=boardSizeForPlayers(r.players.filter(x=>x.active).length)!;r.round=0;r.reason=undefined;r.winners=[];r.bombRules=true;resetHazards(r);initMatch(r);await ensureReplay(db);for(const x of r.players){x.positions=[];x.draft=[];x.active=true;x.missed=0;}startRound(r,now);}
if(b.action==='draft'&&p){if(r.phase!=='select'||b.round!==r.round||!p.active)return response({room:view(r,token,now)});const cells=b.cells;if(Array.isArray(cells)&&cells.some((c:number)=>forbidden(r).includes(c)))return response({error:'잿더미 또는 영구 폐쇄 위치에는 배치할 수 없습니다.'},400);if(!Array.isArray(cells)||!validPlacement(r.round,p.positions,cells,r.size,forbidden(r),r.rulesVersion||3))return response({error:p.positions.length?`기존 돌을 최소 ${requiredAnchors(p.positions,r.rulesVersion||3)}개 유지해주세요.`:'첫 배치와 전멸 후 재시작은 최대 3개입니다.'},400);if(b.submit&&cells.length!==placementLimit(r.round,p.positions,r.rulesVersion||3))return response({error:'돌을 모두 선택해주세요.'},400);p.draft=cells;p.submitted=Boolean(b.submit);tick(r,now);}
if(b.action==='rematch'&&p?.id===r.host&&r.phase==='finished'){r.phase='lobby';resetHazards(r);r.round=0;r.winners=[];r.collisions=[];r.reason=undefined;r.players=r.players.filter(x=>now-x.seen<30000);for(const x of r.players){x.ready=false;x.positions=[];x.draft=[];x.active=true;}if(!r.players.some(x=>x.id===r.host))r.host=r.players[0]?.id;}
if(b.action==='leave'&&p){r.players=r.players.filter(x=>x.id!==p!.id);if(r.host===p.id)r.host=r.players[0]?.id||'';if(r.phase!=='lobby'&&r.players.filter(x=>x.active).length<2){r.winners=r.players.filter(x=>x.active).map(x=>x.id);r.reason='다른 참가자가 퇴장하여 기권승';r.phase='finished';}}
if(!r.players.some(x=>x.id===r.host&&now-x.seen<30000)){r.host=r.players.find(x=>now-x.seen<30000)?.id||r.host;}
// Never resize an ongoing match: departing players and spectators do not change its coordinates.
if(r.phase==='lobby')r.size=boardSizeForPlayers(r.players.filter(x=>x.active).length)??7;
completeMatch(r);
const update=db.prepare('UPDATE rooms SET state=?,version=version+1 WHERE code=? AND version=?').bind(JSON.stringify(r),code,row.version);
const newFrame=!!r.matchId&&!!r.lastReplay&&r.lastReplay.round!==priorFrame;
const ended=!!r.completedMatch&&r.completedMatch.id!==priorCompleted;
let changed:number;
if(newFrame||ended){
 await ensureReplay(db);const statements=[update];
 // Snapshot is taken from the committed room, never from a losing CAS request.
 if(newFrame)statements.push(db.prepare(`INSERT OR IGNORE INTO game_replays(room_code,match_id,round,snapshot)
 SELECT code,json_extract(state,'$.matchId'),json_extract(state,'$.lastReplay.round'),json_extract(state,'$.lastReplay')
 FROM rooms WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND json_extract(state,'$.lastReplay.round') IS NOT NULL`).bind(code,row.version+1,r.matchId));
 // Retain the latest completed match per room; a new active match has its own rows.
 if(ended)statements.push(db.prepare(`DELETE FROM game_replays WHERE room_code=? AND match_id<>?
 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND version=? AND json_extract(state,'$.completedMatch.id')=?)`).bind(code,r.completedMatch!.id,code,row.version+1,r.completedMatch!.id));
 const results=await db.batch(statements);changed=results[0].meta.changes;
}else changed=(await update.run()).meta.changes;
if(changed)return response({room:view(r,token,now),...(b.action==='join'?{token}: {})});}return response({error:'접속이 몰리고 있어요. 다시 시도해주세요.'},503);
}catch(e){console.error(e);return response({error:'연결이 원활하지 않습니다. 다시 시도해주세요.'},503);}}
