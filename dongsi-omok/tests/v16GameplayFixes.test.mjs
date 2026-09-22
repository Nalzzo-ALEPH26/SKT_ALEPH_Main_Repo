import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, startGame, placeInitialStones, removeLobbyPlayer, readyPlayer, resolveRound } from '../core-dist/room.js';
const pos = (row, col) => ({ row, col });
function planningRoom() {
  const room = createRoom('V16', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1000);
  const [first, second] = room.initialOrder;
  placeInitialStones(room, first, [pos(2,2), pos(2,3), pos(2,4)], 2000);
  placeInitialStones(room, second, [pos(4,2), pos(4,3), pos(4,4)], 2100);
  return room;
}
test('contiguous edge stones die together when their run is flanked', () => {
  const room = planningRoom();
  room.board[0][2] = 'p2'; room.board[0][3] = 'p1'; room.board[0][4] = 'p1'; room.board[0][5] = 'p2';
  readyPlayer(room, 'p1'); readyPlayer(room, 'p2');
  const result = resolveRound(room, 5000, () => 0);
  assert.equal(result.board[0][3], null); assert.equal(result.board[0][4], null);
  assert.deepEqual(result.edgeRemoved?.map((x) => x.position), [pos(0,3), pos(0,4)]);
});
test('opening placements also resolve a completed edge flank', () => {
  const room = createRoom('OPEN', 'p1', 'P1'); joinRoom(room, 'p2', 'P2'); startGame(room, () => 0, 1000);
  const [first, second] = room.initialOrder;
  placeInitialStones(room, first, [pos(0,3), pos(0,4), pos(2,2)], 2000);
  placeInitialStones(room, second, [pos(0,2), pos(0,5), pos(4,4)], 2100);
  assert.equal(room.board[0][3], null); assert.equal(room.board[0][4], null);
});
test('lobby host leaving transfers host to a remaining player', () => {
  const room = createRoom('HOST', 'host', 'Host'); joinRoom(room, 'p2', 'P2');
  removeLobbyPlayer(room, 'host');
  assert.deepEqual(room.players.map((p) => p.id), ['p2']); assert.equal(room.hostId, 'p2');
});
