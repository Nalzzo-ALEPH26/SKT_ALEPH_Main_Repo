import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');const gameURL=url(compile(fs.readFileSync('lib/game.ts','utf8')));
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_deep_karnak.sql','utf8'));
globalThis.testEnv={DB:{prepare(q){let v=[];return{bind(...values){v=values;return this},async first(){return sql.prepare(q).get(...v)},async run(){return{meta:{changes:sql.prepare(q).run(...v).changes}}}}}}};
const api=compile(fs.readFileSync('app/api/game/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.testEnv;").replace("'@/lib/game'",JSON.stringify(gameURL)));
const {POST}=await import(url(api));const call=async(action,s={},extra={})=>{const res=await POST(new Request('https://test/api/game',{method:'POST',body:JSON.stringify({action,...s,...extra})}));return {status:res.status,...await res.json()}};

const {boardSizeForPlayers,startRound}=await import(gameURL);
assert.deepEqual([1,2,3,4,5,6,7].map(boardSizeForPlayers),[null,7,7,8,9,9,null]);
async function makeRoom(count){const first=await call('create',{}, {name:'host'});const sessions=[{code:first.room.code,token:first.token}];assert.equal(first.room.nextBoardSize,null);for(let i=1;i<count;i++){const joined=await call('join',{}, {code:first.room.code,name:'p'+i});sessions.push({code:first.room.code,token:joined.token});assert.equal(joined.room.nextBoardSize,boardSizeForPlayers(i+1));assert.equal(joined.room.size,boardSizeForPlayers(i+1));}return sessions;}
for(const count of [2,3,4,5,6]){const sessions=await makeRoom(count);for(const s of sessions)await call('ready',s);const started=await call('start',sessions[0],{size:99});assert.equal(started.status,200);assert.equal(started.room.size,boardSizeForPlayers(count));assert.equal(started.room.nextBoardSize,null);for(const s of sessions){const state=await call('poll',s);assert.equal(state.room.size,started.room.size);}}
// Lobby leaving crosses both size thresholds and returns to the one-person waiting state.
const lobby=await makeRoom(6);for(let i=5;i>=1;i--){await call('leave',lobby[i]);const state=await call('poll',lobby[0]);assert.equal(state.room.nextBoardSize,boardSizeForPlayers(i));}
// Six-player match keeps its 9x9 coordinates after two departures; rematch switches to 8x8.
const six=await makeRoom(6);for(const s of six)await call('ready',s);await call('start',six[0]);await call('leave',six[5]);await call('leave',six[4]);let state=await call('poll',six[0]);assert.equal(state.room.size,9);
let persisted=JSON.parse(sql.prepare('SELECT state FROM rooms WHERE code=?').get(six[0].code).state);startRound(persisted,Date.now());assert.equal(persisted.size,9);persisted.phase='finished';sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(persisted),six[0].code);state=await call('rematch',six[0]);assert.equal(state.room.size,8);assert.equal(state.room.nextBoardSize,8);
// Spectator joins do not enlarge a running 3-player board.
const three=await makeRoom(3);for(const s of three)await call('ready',s);await call('start',three[0]);for(let i=0;i<3;i++){const joined=await call('join',{}, {code:three[0].code,name:'spectator'+i});assert.equal(joined.room.size,7);assert.equal(joined.room.players.find(p=>p.id===joined.room.me).active,false);}state=await call('poll',three[0]);assert.equal(state.room.size,7);
console.log('PASS board sizing: 2–6 players, one-person waiting, joins/leaves, server-authoritative start, consistent clients, fixed running board, spectators, rematch');
