import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  joinRoom,
  startGame,
  placeInitialStones,
  updateSelection,
  readyPlayer,
  resolveRound,
} from '../core-dist/room.js';

const pos = (row, col) => ({ row, col });

function planningRoom() {
  const room = createRoom('EDGEPAIR', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);

  const first = room.initialOrder[0];
  const second = room.initialOrder[1];

  placeInitialStones(room, first, [pos(2, 2), pos(2, 3), pos(2, 4)], 2_000);
  placeInitialStones(room, second, [pos(4, 2), pos(4, 3), pos(4, 4)], 2_100);
  return room;
}

test('two separated stones on the designated edge do not qualify for victory', () => {
  const room = planningRoom();
  const p1 = room.players.find((player) => player.id === 'p1');
  p1.edgeSide = 'TOP';

  room.board[0][2] = 'p1';
  room.board[0][6] = 'p1';

  for (let col = 2; col <= 5; col += 1) room.board[9][col] = 'p1';
  updateSelection(room, 'p1', [pos(9, 6)]);

  readyPlayer(room, 'p1');
  readyPlayer(room, 'p2');
  const result = resolveRound(room, 6_000, () => 0);

  assert.deepEqual(result.winners, []);
  assert.ok(result.invalidFivePlayers?.includes('p1'));
  assert.equal(room.phase, 'PLANNING');
});

test('two adjacent stones on the designated edge qualify for a newly created five', () => {
  const room = planningRoom();
  const p1 = room.players.find((player) => player.id === 'p1');
  p1.edgeSide = 'TOP';

  room.board[0][2] = 'p1';
  room.board[0][3] = 'p1';

  for (let col = 2; col <= 5; col += 1) room.board[9][col] = 'p1';
  updateSelection(room, 'p1', [pos(9, 6)]);

  readyPlayer(room, 'p1');
  readyPlayer(room, 'p2');
  const result = resolveRound(room, 6_000, () => 0);

  assert.deepEqual(result.winners, ['p1']);
  assert.equal(room.phase, 'FINISHED');
});
