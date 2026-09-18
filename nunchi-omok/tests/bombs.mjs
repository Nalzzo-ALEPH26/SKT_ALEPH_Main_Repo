import {testDB} from './d1-mock.mjs';
import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');const gameURL=url(compile(fs.readFileSync('lib/game.ts','utf8')));
const {validPlacement,placementLimit,wins,tick,startRound,makeBomb,pickBomb,view,resetHazards}=await import(gameURL);
assert.equal(placementLimit(1,[]),3);assert.equal(placementLimit(4,[]),3);assert.equal(placementLimit(4,[2]),6);
assert(!validPlacement(2,[0,1,2],[40,41,42,43,44],7));assert(!validPlacement(2,[0,1,2],[2,3,4,5,6],7));assert(validPlacement(2,[0,1,2],[1,2,3,4,5,6],7));assert(!validPlacement(2,[0],[0,0],7));assert(!validPlacement(4,[],[0,1,2,3],7));assert(!validPlacement(2,[0],[],7));
for(const cells of [[0,1,2,3,4],[0,7,14,21,28],[0,8,16,24,32],[4,10,16,22,28]])assert(wins(cells,7));assert(!wins([5,6,7,8,9],7));
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_deep_karnak.sql','utf8'));
globalThis.testEnv={DB:testDB(sql)};
const api=compile(fs.readFileSync('app/api/game/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.testEnv;").replace("'@/lib/game'",JSON.stringify(gameURL)));
const {POST}=await import(url(api));const call=async(action,s={},extra={})=>{const res=await POST(new Request('https://test/api/game',{method:'POST',body:JSON.stringify({action,...s,...extra})}));return {status:res.status,...await res.json()}};

const now=Date.now();
const player=(id,positions,draft)=>({id,token:id,name:id,seat:0,ready:true,submitted:true,positions,draft,seen:now,missed:0,active:true});
const room=()=>({code:'test',host:'a',phase:'select',round:2,size:7,deadline:now+15000,players:[player('a',[0],[0,1,2,3,4]),player('b',[7],[7,8,9,10,11])],collisions:[],winners:[],bombRules:true,blocked:[],bomb:makeBomb('cell',2,7)});
let r=room();tick(r,now);assert.deepEqual(r.winners,['b']);assert.deepEqual(r.players[0].positions,[0,1,3,4]);assert.deepEqual(r.revealPositions.a,[0,1,2,3,4]);assert.equal(r.phase,'reveal');
r=room();r.bomb=makeBomb('row',6,7);tick(r,now);assert.deepEqual(r.winners,['a','b']);
r=room();r.players[1].draft=[7,1,9];r.bomb=makeBomb('row',0,7);tick(r,now);assert.deepEqual(r.collisions,[1]);assert.deepEqual(r.players[0].positions,[]);assert.equal(placementLimit(3,r.players[0].positions),3);assert.deepEqual(r.players[1].positions,[7,9]);assert.deepEqual(r.winners,[]);
// Ash lasts exactly one selection round and invalid placements are rejected.
startRound(r,now+2000);assert.deepEqual(r.blocked,[0,1,2,3,4,5,6]);assert(!validPlacement(3,[],[0,20,21],7,r.blocked));assert(validPlacement(3,[],[20,21,22],7,r.blocked));
r.bomb=makeBomb('cell',30,7);startRound(r,now+19000);assert.deepEqual(r.blocked,[30]);assert(validPlacement(4,[],[0,1,2],7,r.blocked));
// Four edge turns consume each edge once, with no future schedule in the public view.
r=room();r.edgeBag=[];const edges=[];for(const round of [2,4,6,8]){r.round=round;r.blocked=[];edges.push(pickBomb(r,()=>.4).label);}assert.equal(new Set(edges).size,4);assert(!('edgeBag' in view(r,'a',now)));assert.equal(view(r,'a',now).revealPositions,undefined);assert(!('draft' in view(r,'a',now).players[1]));
for(const size of [7,8,9])for(const roll of [.1,.6,.9]){r=room();r.size=size;r.round=3;r.blocked=makeBomb('row',0,size).cells;const bomb=pickBomb(r,()=>roll);assert(bomb.cells.every(c=>c>=0&&c<size*size));assert(!bomb.cells.every(c=>r.blocked.includes(c)));assert.equal(bomb.kind,roll<.5?'cell':roll<.75?'row':'column');}
r=room();r.edgeBag=[0];r.blocked=makeBomb('row',0,7).cells;assert.notEqual(pickBomb(r).label,'1행');assert.deepEqual(r.edgeBag,[0]);
// Timeout has the same collision/explosion ordering; legacy rooms have no surprise forecast.
r=room();r.players.forEach(p=>p.submitted=false);tick(r,now+15001);assert.deepEqual(r.winners,['b']);
r=room();r.round=0;resetHazards(r);startRound(r,now);assert.equal(r.bomb,null);assert.deepEqual(r.blocked,[]);r.bombRules=undefined;startRound(r,now);assert.equal(r.bomb,null);
// Actual API validates ash, persists one forecast, and resets the hazards on rematch.
const a=await call('create',{}, {name:'A'}),A={code:a.room.code,token:a.token};const b=await call('join',{}, {code:A.code,name:'B'}),B={code:A.code,token:b.token};
await call('ready',A);await call('ready',B);let result=await call('start',A);assert.equal(result.room.bombRules,true);assert.equal(result.room.bomb,null);
const read=()=>JSON.parse(sql.prepare('SELECT state FROM rooms WHERE code=?').get(A.code).state);
const write=s=>sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(s),A.code);
let state=read();state.round=2;state.blocked=[48];state.bomb=makeBomb('row',0,7);write(state);
result=await call('draft',A,{round:2,cells:[48],submit:false});assert.equal(result.status,400);
const forecast=(await call('poll',A)).room.bomb;assert.deepEqual((await call('poll',B)).room.bomb,forecast);assert.deepEqual((await call('poll',A)).room.bomb,forecast);
state=read();state.phase='finished';state.revealPositions={secret:[1]};state.edgeBag=[1];write(state);
result=await call('rematch',A);assert.deepEqual(result.room.blocked,[]);assert.equal(result.room.bomb,null);assert.equal(result.room.revealPositions,undefined);
console.log('PASS bombs: forecast, edge rotation, ranges, collision then explosion then win, shared win, wipeout, timeout, ash expiry/rejection, privacy, legacy rooms, API persistence/rematch');
