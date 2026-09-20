import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKER_ID, BOARD_SIZE } from '../core-dist/engine.js';
import { createRoom, joinRoom, startGame, placeInitialStones, updateSelection, readyPlayer, resolveRound } from '../core-dist/room.js';

const pos = (row, col) => ({ row, col });

function planningRoom() {
  const room = createRoom('EDGE', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);
  const first = room.initialOrder[0];
  const second = room.initialOrder[1];
  placeInitialStones(room, first, [pos(2, 2), pos(2, 3), pos(2, 4)], 2_000);
  placeInitialStones(room, second, [pos(4, 2), pos(4, 3), pos(4, 4)], 2_100);
  return room;
}
function lockBoth(room) { readyPlayer(room, 'p1'); readyPlayer(room, 'p2'); }

test('all four corners are permanent black blockers', () => {
  const room = createRoom('CORN', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);
  const last = BOARD_SIZE - 1;
  assert.equal(room.board[0][0], BLOCKER_ID);
  assert.equal(room.board[0][last], BLOCKER_ID);
  assert.equal(room.board[last][0], BLOCKER_ID);
  assert.equal(room.board[last][last], BLOCKER_ID);
  const first = room.initialOrder[0];
  assert.throws(() => placeInitialStones(room, first, [pos(0, 0), pos(1, 1), pos(1, 2)]), /CELL_OCCUPIED/);
});

test('first successful edge placement fixes the player side', () => {
  const room = createRoom('SIDE', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);
  const first = room.initialOrder[0];
  placeInitialStones(room, first, [pos(0, 2), pos(BOARD_SIZE - 1, 2), pos(2, 2)], 2_000);
  assert.equal(room.players.find((p) => p.id === first).edgeSide, 'TOP');
});

test('edge stone is removed when both side neighbors are hostile, black corner included', () => {
  const room = planningRoom();
  room.board[0][1] = 'p1';
  room.board[0][2] = 'p2';
  lockBoth(room);
  const result = resolveRound(room, 5_000, () => 0);
  assert.equal(result.board[0][1], null);
  assert.deepEqual(result.edgeRemoved, [{ playerId: 'p1', position: pos(0, 1) }]);
});

test('old five does not become a win by satisfying edge requirement later', () => {
  const room = planningRoom();
  const p1 = room.players.find((p) => p.id === 'p1');
  p1.edgeSide = 'TOP';
  room.board[0][2] = 'p1';
  for (let col = 2; col <= 6; col += 1) room.board[7][col] = 'p1';
  updateSelection(room, 'p1', [pos(0, 6)]);
  lockBoth(room);
  const result = resolveRound(room, 5_000, () => 0);
  assert.equal(result.board[0][6], 'p1');
  assert.equal(room.winners.length, 0);
  assert.equal(room.phase, 'PLANNING');
});

test('after edge requirement is met, a newly created five wins', () => {
  const room = planningRoom();
  const p1 = room.players.find((p) => p.id === 'p1');
  p1.edgeSide = 'TOP';
  room.board[0][2] = 'p1';
  room.board[0][6] = 'p1';
  for (let col = 2; col <= 6; col += 1) room.board[7][col] = 'p1';
  for (let col = 2; col <= 5; col += 1) room.board[9][col] = 'p1';
  updateSelection(room, 'p1', [pos(9, 6)]);
  lockBoth(room);
  const result = resolveRound(room, 6_000, () => 0);
  assert.deepEqual(result.winners, ['p1']);
  assert.equal(room.phase, 'FINISHED');
});
