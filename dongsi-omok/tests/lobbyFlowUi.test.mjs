import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../server/src/socketServer.ts', import.meta.url), 'utf8');
const roomSource = await readFile(new URL('../server/src/game/room.ts', import.meta.url), 'utf8');

test('lobby is a dedicated screen and does not render the board', () => {
  const lobbyStart = appSource.indexOf("if (room.phase === 'LOBBY')");
  const gameStart = appSource.indexOf('className="shell game-shell cockpit-grid gameplay-only"');
  assert.ok(lobbyStart > -1);
  assert.ok(gameStart > lobbyStart);
  const lobbySource = appSource.slice(lobbyStart, gameStart);
  assert.doesNotMatch(lobbySource, /<Board/);
  assert.match(lobbySource, /게임 대기실/);
  assert.match(lobbySource, /게임 시작/);
});

test('game screen omits room code and crew sidebar', () => {
  const gameStart = appSource.indexOf('className="shell game-shell cockpit-grid gameplay-only"');
  const gameSource = appSource.slice(gameStart);
  assert.ok(gameStart > -1);
  assert.doesNotMatch(gameSource, /CREW MANIFEST/);
  assert.doesNotMatch(gameSource, /<strong className="room-code">\{room\.id\}<\/strong>/);
  assert.match(gameSource, /<Board/);
});

test('host kick is wired end-to-end and restricted to lobby', () => {
  assert.match(appSource, /emitAck\('room:kick'/);
  assert.match(appSource, /socket\.on\('room:kicked'/);
  assert.match(serverSource, /socket\.on\('room:kick'/);
  assert.match(serverSource, /targetSocket\?\.emit\('room:kicked'\)/);
  assert.match(roomSource, /export function kickLobbyPlayer/);
  assert.match(roomSource, /room\.phase !== 'LOBBY'/);
  assert.match(roomSource, /room\.hostId !== actorPlayerId/);
});
