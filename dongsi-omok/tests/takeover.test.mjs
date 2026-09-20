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
  toPublicRoom,
} from '../core-dist/room.js';

const pos = (row, col) => ({ row, col });

function makePlanningRoom() {
  const room = createRoom('TAKE', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  joinRoom(room, 'p3', 'P3');
  startGame(room, () => 0, 0);
  room.initialOrder.forEach((id, index) => {
    const row = index * 2 + 1;
    placeInitialStones(room, id, [pos(row, 1), pos(row, 2), pos(row, 3)], 100);
  });
  return room;
}

test('conversion claim is available before lock and only the first conversion LOCK succeeds', () => {
  const room = makePlanningRoom();
  assert.equal(toPublicRoom(room).conversionAvailable, true);

  readyPlayer(room, 'p1', 'p2');
  assert.equal(toPublicRoom(room).conversionAvailable, false);
  assert.equal(room.conversionClaimedBy, 'p1');

  assert.throws(() => readyPlayer(room, 'p3', 'p2'), /CONVERSION_ALREADY_CLAIMED/);
  assert.equal(room.players.find((player) => player.id === 'p3').ready, false);
});

test('conversion LOCK replaces own normal placement and stays target-private', () => {
  const room = makePlanningRoom();
  updateSelection(room, 'p1', [pos(8, 0), pos(8, 1), pos(8, 2)]);
  readyPlayer(room, 'p1', 'p2');

  assert.deepEqual(room.selections.p1, []);
  assert.equal(room.conversionTargets.p1, 'p2');
  const publicState = toPublicRoom(room);
  assert.equal('conversionTargets' in publicState, false);
  assert.equal('conversionClaimedBy' in publicState, false);
});

test('server converts up to two distinct original target selections', () => {
  const room = makePlanningRoom();
  updateSelection(room, 'p2', [pos(9, 0), pos(9, 1), pos(9, 2)]);
  readyPlayer(room, 'p1', 'p2');

  const result = resolveRound(room, 1_000, () => 0);
  assert.deepEqual(result.converted, [
    { fromPlayerId: 'p2', toPlayerId: 'p1', position: pos(9, 0) },
    { fromPlayerId: 'p2', toPlayerId: 'p1', position: pos(9, 1) },
  ]);
  assert.equal(result.board[9][0], 'p1');
  assert.equal(result.board[9][1], 'p1');
  assert.equal(result.board[9][2], 'p2');
});

test('conversion takes only one when the target selected one', () => {
  const room = makePlanningRoom();
  updateSelection(room, 'p2', [pos(9, 0)]);
  readyPlayer(room, 'p1', 'p2');
  const result = resolveRound(room, 1_000, () => 0.7);
  assert.equal(result.converted?.length, 1);
  assert.equal(result.board[9][0], 'p1');
});

test('converted stones still obey collision rules and are reported for UI marking', () => {
  const room = makePlanningRoom();
  updateSelection(room, 'p2', [pos(9, 0), pos(9, 1), pos(9, 2)]);
  updateSelection(room, 'p3', [pos(9, 0)]);
  readyPlayer(room, 'p1', 'p2');
  const result = resolveRound(room, 1_000, () => 0);

  assert.deepEqual(result.collisions, [pos(9, 0)]);
  assert.equal(result.board[9][0], null);
  assert.equal(result.converted?.length, 2);
  assert.deepEqual(result.converted?.[0].position, pos(9, 0));
});

test('conversion claim resets on the next round', () => {
  const room = makePlanningRoom();
  updateSelection(room, 'p2', [pos(9, 0), pos(9, 1)]);
  readyPlayer(room, 'p1', 'p2');
  resolveRound(room, 1_000, () => 0);
  assert.equal(toPublicRoom(room).conversionAvailable, true);
  assert.equal(room.conversionClaimedBy, null);
});

test('conversion target must be another player', () => {
  const room = makePlanningRoom();
  assert.throws(() => readyPlayer(room, 'p1', 'p1'), /CANNOT_TARGET_SELF/);
  assert.throws(() => readyPlayer(room, 'p1', 'missing'), /PLAYER_NOT_FOUND/);
});
