import {testDB} from './d1-mock.mjs';
import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');const gameURL=url(compile(fs.readFileSync('lib/game.ts','utf8')));
const {validPlacement,placementLimit,wins,tick,initMatch,startRound,pickBomb,makeBomb,forbidden,view,winningCells}=await import(gameURL);
assert.equal(placementLimit(1,[]),3);assert.equal(placementLimit(4,[]),3);assert.equal(placementLimit(4,[2]),6);
assert(!validPlacement(2,[0,1,2],[40,41,42,43,44],7));assert(!validPlacement(2,[0,1,2],[2,3,4,5,6],7));assert(validPlacement(2,[0,1,2],[1,2,3,4,5,6],7));assert(!validPlacement(2,[0],[0,0],7));assert(!validPlacement(4,[],[0,1,2,3],7));assert(!validPlacement(2,[0],[],7));
for(const cells of [[0,1,2,3,4],[0,7,14,21,28],[0,8,16,24,32],[4,10,16,22,28]])assert(wins(cells,7));assert(!wins([5,6,7,8,9],7));
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_deep_karnak.sql','utf8'));
globalThis.testEnv={DB:testDB(sql)};
const api=compile(fs.readFileSync('app/api/game/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.testEnv;").replace("'@/lib/game'",JSON.stringify(gameURL)));
const {POST}=await import(url(api));const call=async(action,s={},extra={})=>{const res=await POST(new Request('https://test/api/game',{method:'POST',body:JSON.stringify({action,...s,...extra})}));return {status:res.status,...await res.json()}};

const stamp=Date.now();
function fresh(n=2){const r={code:'UNIT',host:'0',round:0,size:n<=3?7:n===4?8:9,phase:'lobby',deadline:0,players:Array.from({length:n},(_,i)=>({id:String(i),token:'t'+i,name:'p'+i,seat:i,ready:true,active:true,submitted:false,positions:[],draft:[],seen:stamp,missed:0})),collisions:[],winners:[],bombRules:true};initMatch(r);return r;}
assert.equal(placementLimit(2,[0]),6);assert.equal(placementLimit(2,[0],3),5);
assert(validPlacement(2,[0],[0,8,9,10,11,12],7));assert(!validPlacement(2,[0],[1,2,3,4,5,6],7));assert(!validPlacement(2,[0],[0,1,2,3,4,5,6],7));
for(const size of [7,8,9])for(const [dx,dy,x,y] of [[1,0,0,0],[0,1,0,0],[1,1,0,0],[1,-1,0,5]]){
 const six=Array.from({length:6},(_,i)=>(y+dy*i)*size+x+dx*i);assert(!wins(six,size));assert(wins(six.slice(0,5),size));assert.equal(winningCells(six,size).length,0);
}
assert(wins([0,1,2,3,4,20],7));assert(!wins([0,1,3,4,5,20],7));
for(const count of [2,3,4,5,6]){
 const r=fresh(count),size=r.size,min=count<=3?5:count===4?6:7;let now=stamp;
 for(let round=1;round<=16;round++){
  startRound(r,now);assert.equal(r.deadline-now,25000);assert.equal(r.round,round);
  if(round===1)assert.equal(r.bomb,null);
  if([4,6,8,10].includes(round))assert.equal(r.bomb.permanent,true);
  if(round>=11)assert.equal(r.bomb.kind,'cell');
  assert(r.bomb?.cells.every(c=>!r.closed.includes(c))??true);
  for(const p of r.players){p.positions=[];p.draft=[];p.submitted=true;p.seen=now;}
  const oldClosed=[...r.closed],target=r.bomb;
  tick(r,now);assert.equal(r.phase,'reveal');
  if(target?.permanent){assert.equal(r.closed.length,oldClosed.length+target.cells.length);assert(target.cells.every(c=>r.closed.includes(c)));assert(!validPlacement(2,[],[target.cells[0]],size,forbidden(r)));}
  const closed=[...r.closed];tick(r,now+100);assert.deepEqual(r.closed,closed);
  assert(r.bounds.right-r.bounds.left+1>=min);assert(r.bounds.bottom-r.bounds.top+1>=min);assert.equal(r.size,size);now+=27000;
 }
 assert.equal(r.bounds.right-r.bounds.left+1,min);assert.equal(r.bounds.bottom-r.bounds.top+1,min);
 assert.equal(r.closed.length,size*size-min*min);
}
// Closure destroys anchors, then a wiped-out player receives three stones; snapshot stays private until reveal.
let r=fresh();r.round=3;startRound(r,stamp);r.bomb={...makeBomb('row',0,7),permanent:true};r.players[0].positions=[0];r.players[0].draft=[0,1,2,3,4,5];r.players[1].draft=[20,30,40];r.players.forEach(p=>p.submitted=true);tick(r,stamp);
assert.deepEqual(r.players[0].positions,[]);assert.equal(placementLimit(5,r.players[0].positions),3);assert.equal(r.lastReplay.closedBefore.length,0);assert.equal(r.lastReplay.closedAfter.length,7);assert.deepEqual(r.lastReplay.placed['0'],[0,1,2,3,4,5]);assert(!('lastReplay' in view(r,'t0',stamp)));
const replayURL=url(compile(fs.readFileSync('lib/replay.ts','utf8')));const {replayStage}=await import(replayURL);
assert.deepEqual(replayStage(r.lastReplay,0)['0'],[0]);assert.deepEqual(replayStage(r.lastReplay,1)['0'],[0,1,2,3,4,5]);assert.deepEqual(replayStage(r.lastReplay,3)['0'],[]);
const collisionFrame={...r.lastReplay,collisions:[1],placed:{a:[0,1,2],b:[1,20]}};assert.deepEqual(replayStage(collisionFrame,2),{a:[0,2],b:[20]});
// API + D1 transaction: failed archive insertion rolls back room resolution.
const a=await call('create',{}, {name:'A'}),A={code:a.room.code,token:a.token};const b=await call('join',{}, {code:A.code,name:'B'}),B={code:A.code,token:b.token};
await call('ready',A);await call('ready',B);let out=await call('start',A);assert.equal(out.room.rulesVersion,5);assert.equal(out.room.selectionSeconds,25);const matchId=out.room.matchId;
assert.equal((await call('replay',A,{matchId})).status,409);
await call('draft',A,{round:1,cells:[0,1,2],submit:true});
sql.exec("CREATE TRIGGER fail_replay BEFORE INSERT ON game_replays BEGIN SELECT RAISE(ABORT,'test rollback'); END");
const originalError=console.error;console.error=()=>{};out=await call('draft',B,{round:1,cells:[7,8,9],submit:true});console.error=originalError;assert.equal(out.status,503);
const read=()=>JSON.parse(sql.prepare('SELECT state FROM rooms WHERE code=?').get(A.code).state);
const write=r=>sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(r),A.code);
assert.equal(read().phase,'select');assert.equal(read().players[1].submitted,false);assert.equal(sql.prepare('SELECT count(*) n FROM game_replays').get().n,0);
sql.exec('DROP TRIGGER fail_replay');await call('draft',B,{round:1,cells:[7,8,9],submit:true});assert.equal(sql.prepare('SELECT count(*) n FROM game_replays').get().n,1);
// Repeated polls cannot append duplicate frames.
await call('poll',A);await call('poll',B);assert.equal(sql.prepare('SELECT count(*) n FROM game_replays').get().n,1);
let persisted=read();persisted.bombRules=false;persisted.deadline=Date.now()-1;write(persisted);out=await call('poll',A);assert.equal(out.room.stoneLimit,6);
assert.equal((await call('draft',A,{round:2,cells:[0,1,2,3,4],submit:true})).status,400);
await Promise.all([call('draft',A,{round:2,cells:[0,1,2,3,4,20],submit:true}),call('draft',B,{round:2,cells:[7,8,9,10,11,30],submit:true})]);
assert.equal(read().winners.length,2);assert.equal(sql.prepare('SELECT count(*) n FROM game_replays').get().n,2);
persisted=read();persisted.deadline=Date.now()-1;write(persisted);out=await call('poll',A);assert.equal(out.room.phase,'finished');assert.equal(out.room.completedMatch.id,matchId);
assert.equal((await call('replay',{code:A.code,token:'wrong'},{matchId})).status,401);
out=await call('replay',A,{matchId});assert.equal(out.frames.length,2);assert.deepEqual(out.frames.map(f=>f.round),[1,2]);assert.equal(out.next,null);assert(!JSON.stringify(out.frames).includes(A.token));assert(!JSON.stringify(out.frames).includes(B.token));assert.deepEqual(out.frames[1].after[read().players[0].id],[0,1,2,3,4,20]);
// Paginate a long completed match without losing round ordering.
const archived=out.frames[1];for(let i=3;i<=102;i++)sql.prepare('INSERT INTO game_replays(room_code,match_id,round,snapshot) VALUES(?,?,?,?)').run(A.code,matchId,i,JSON.stringify({...archived,round:i}));
let page=await call('replay',A,{matchId});assert.equal(page.frames.length,100);assert.equal(page.next,100);page=await call('replay',A,{matchId,after:page.next});assert.deepEqual(page.frames.map(x=>x.round),[101,102]);assert.equal(page.next,null);
sql.prepare('DELETE FROM game_replays WHERE round>2').run();
await call('rematch',A);assert.equal((await call('replay',B,{matchId})).frames.length,2);await call('ready',A);await call('ready',B);out=await call('start',A);assert.notEqual(out.room.matchId,matchId);assert.equal(out.room.bomb,null);assert.deepEqual(out.room.closed,[]);assert.equal((await call('replay',A,{matchId})).frames.length,2);
// A forfeit before any reveal gives an empty replay and removes the older archive.
await call('leave',B);out=await call('poll',A);const nextMatch=out.room.completedMatch.id;assert.notEqual(nextMatch,matchId);assert.equal((await call('replay',A,{matchId:nextMatch})).frames.length,0);assert.equal(sql.prepare('SELECT count(*) n FROM game_replays').get().n,0);
console.log('PASS evolution: exact-five/overline, six-stone anchor, 25s, 2–6 player closure schedules/floors, wipeout, replay stages/privacy/order, transaction rollback, concurrent submissions, deduplication, authentication, rematch/forfeit retention');
