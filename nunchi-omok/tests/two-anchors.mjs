import {testDB} from './d1-mock.mjs';
import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');const gameURL=url(compile(fs.readFileSync('lib/game.ts','utf8')));
const {validPlacement,placementLimit,wins,tick,requiredAnchors,view}=await import(gameURL);
assert.equal(placementLimit(1,[]),3);assert.equal(placementLimit(4,[]),3);assert.equal(placementLimit(4,[2]),6);
assert(!validPlacement(2,[0,1,2],[40,41,42,43,44],7));assert(!validPlacement(2,[0,1,2],[2,3,4,5,6],7));assert(validPlacement(2,[0,1,2],[1,2,3,4,5,6],7));assert(!validPlacement(2,[0],[0,0],7));assert(!validPlacement(4,[],[0,1,2,3],7));assert(!validPlacement(2,[0],[],7));
for(const cells of [[0,1,2,3,4],[0,7,14,21,28],[0,8,16,24,32],[4,10,16,22,28]])assert(wins(cells,7));assert(!wins([5,6,7,8,9],7));
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_deep_karnak.sql','utf8'));
globalThis.testEnv={DB:testDB(sql)};
const api=compile(fs.readFileSync('app/api/game/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.testEnv;").replace("'@/lib/game'",JSON.stringify(gameURL)));
const {POST}=await import(url(api));const call=async(action,s={},extra={})=>{const res=await POST(new Request('https://test/api/game',{method:'POST',body:JSON.stringify({action,...s,...extra})}));return {status:res.status,...await res.json()}};

assert.deepEqual([[],[0],[0,1],[0,1,2],[0,1,2,3,4,5]].map(p=>requiredAnchors(p)),[0,1,2,2,2]);
assert(validPlacement(2,[0,1,2],[0,1,10,11,12,13],7));
assert(!validPlacement(2,[0,1,2],[0,10,11,12,13,14],7));
assert(!validPlacement(2,[0,1,2],[0],7));
assert(validPlacement(2,[0,1,2],[1,2],7));
assert(validPlacement(2,[0],[0,10,11,12,13,14],7));
assert(!validPlacement(2,[0],[10,11,12,13,14,15],7));
assert(!validPlacement(2,[0,1],[0,0,10,11,12,13],7));
assert(!validPlacement(2,[0,1],[0,1,10,11,12,13],7,[1]));
assert(validPlacement(2,[0,1,2],[0,10,11,12,13,14],7,[],4));
assert.equal(placementLimit(2,[]),3);assert.equal(placementLimit(2,[0]),6);
const a=await call('create',{}, {name:'A'}),A={code:a.room.code,token:a.token};const b=await call('join',{}, {code:A.code,name:'B'}),B={code:A.code,token:b.token};
await call('ready',A);await call('ready',B);let out=await call('start',A);assert.equal(out.room.rulesVersion,5);assert.equal(out.room.selectionSeconds,25);assert.equal(out.room.anchorMinimum,0);assert.equal(out.room.stoneLimit,3);
const read=()=>JSON.parse(sql.prepare('SELECT state FROM rooms WHERE code=?').get(A.code).state);
const write=s=>sql.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(s),A.code);
let r=read();r.round=2;r.phase='select';r.bomb=null;r.players[0].positions=[0,1,2];r.players[0].draft=[0,1,2];r.players[1].positions=[14,15,16];r.players[1].draft=[14,15,16];write(r);
out=await call('poll',A);assert.equal(out.room.anchorMinimum,2);assert.equal(out.room.stoneLimit,6);
for(const submit of [false,true]){out=await call('draft',A,{round:2,cells:[0,8,9,10,11,12],submit});assert.equal(out.status,400);assert.match(out.error,/최소 2개/);assert.deepEqual(read().players[0].draft,[0,1,2]);}
out=await call('draft',A,{round:2,cells:[0,1,8,9,10,11],submit:true});assert.equal(out.status,200);assert(out.room.players[0].submitted);
// Reloads show the same minimum; a player with a single surviving stone keeps exactly that exception.
assert.equal((await call('poll',A)).room.anchorMinimum,2);
r=read();r.players[0].positions=[0];r.players[0].draft=[0];r.players[0].submitted=false;write(r);
out=await call('poll',A);assert.equal(out.room.anchorMinimum,1);
out=await call('draft',A,{round:2,cells:[0,8,9,10,11,12],submit:true});assert.equal(out.status,200);
r=read();r.players[0].positions=[];r.players[0].draft=[];r.players[0].submitted=false;write(r);
out=await call('poll',A);assert.equal(out.room.anchorMinimum,0);assert.equal(out.room.stoneLimit,3);
out=await call('draft',A,{round:2,cells:[8,9,10],submit:true});assert.equal(out.status,200);
// Existing BETA 04 rooms retain the old minimum until a new match starts.
r=read();r.rulesVersion=4;r.players[0].positions=[0,1,2];r.players[0].draft=[0,1,2];r.players[0].submitted=false;write(r);
out=await call('poll',A);assert.equal(out.room.anchorMinimum,1);out=await call('draft',A,{round:2,cells:[0,8,9,10,11,12],submit:true});assert.equal(out.status,200);
r=read();r.phase='finished';write(r);await call('rematch',A);await call('ready',A);await call('ready',B);out=await call('start',A);assert.equal(out.room.rulesVersion,5);
// Timeout resolution cannot sneak a one-anchor draft through the new rule.
r=read();r.round=2;r.players[0].positions=[0,1,2];r.players[0].draft=[0,8,9,10,11,12];r.players[1].positions=[14,15];r.players[1].draft=[14,15];r.players.forEach(p=>p.submitted=true);r.bomb=null;tick(r,Date.now());assert.deepEqual(r.players[0].positions,[0,1,2]);
console.log('PASS two anchors: 0/1/2+ survivors, draft and submit validation, duplicates, blocked cells, reconnect, legacy compatibility, new match, timeout fallback');
