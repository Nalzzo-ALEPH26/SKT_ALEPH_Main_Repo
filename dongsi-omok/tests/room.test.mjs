import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  INITIAL_STONES_PER_PLAYER,
  ROUND_SELECTION_LIMIT,
  ROUND_DURATION_MS,
  createRoom,
  joinRoom,
  startGame,
  placeInitialStone,
  placeInitialStones,
  updateSelection,
  readyPlayer,
  allPlayersReady,
  resolveRound,
  toPublicRoom,
} from '../core-dist/room.js';

const pos = (row, col) => ({ row, col });

test('room constants match the agreed rules', () => {
  assert.equal(MIN_PLAYERS, 2);
  assert.equal(MAX_PLAYERS, 6);
  assert.equal(INITIAL_STONES_PER_PLAYER, 3);
  assert.equal(ROUND_SELECTION_LIMIT, 3);
  assert.equal(ROUND_DURATION_MS, 15_000);
});

test('accepts 2 to 6 players and rejects a seventh', () => {
  const room = createRoom('ABCD', 'host', 'Host');
  for (let i = 2; i <= 6; i += 1) joinRoom(room, `p${i}`, `P${i}`);
  assert.equal(room.players.length, 6);
  assert.throws(() => joinRoom(room, 'p7', 'P7'), /ROOM_FULL/);
});

test('only allows joins while in the lobby', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0.5, 1_000);
  assert.throws(() => joinRoom(room, 'p3', 'P3'), /GAME_IN_PROGRESS/);
});

test('requires at least two players and gives three sequential initial stones per player', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  assert.throws(() => startGame(room, () => 0.5, 1_000), /NOT_ENOUGH_PLAYERS/);
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0.5, 1_000);

  assert.equal(room.phase, 'INITIAL_PLACEMENT');
  const first = room.initialOrder[0];
  const second = room.initialOrder[1];
  placeInitialStone(room, first, pos(0, 0));
  assert.throws(() => placeInitialStone(room, second, pos(1, 0)), /NOT_YOUR_TURN/);
  placeInitialStone(room, first, pos(0, 1));
  placeInitialStone(room, first, pos(0, 2));
  assert.equal(room.initialTurnIndex, 1);
  assert.equal(room.initialPlaced[first], 3);
});

test('starts a 15 second planning round after all initial placements', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 5_000);

  for (const [index, playerId] of room.initialOrder.entries()) {
    const row = index * 2;
    placeInitialStone(room, playerId, pos(row, 0), 8_000);
    placeInitialStone(room, playerId, pos(row, 1), 8_000);
    placeInitialStone(room, playerId, pos(row, 2), 8_000);
  }

  assert.equal(room.phase, 'PLANNING');
  assert.equal(room.round, 1);
  assert.equal(room.roundEndsAt, 8_000 + ROUND_DURATION_MS);
});

test('keeps selections private, allows up to five, and resolves collisions', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 0);

  for (const [index, playerId] of room.initialOrder.entries()) {
    const row = index * 2;
    placeInitialStone(room, playerId, pos(row, 0), 100);
    placeInitialStone(room, playerId, pos(row, 1), 100);
    placeInitialStone(room, playerId, pos(row, 2), 100);
  }

  updateSelection(room, 'p1', [0, 1, 2, 3, 4].map((col) => pos(10, col)));
  assert.throws(
    () => updateSelection(room, 'p1', [0, 1, 2, 3, 4, 5].map((col) => pos(10, col))),
    /SELECTION_LIMIT/,
  );
  updateSelection(room, 'p2', [pos(10, 4), pos(11, 4)]);

  const publicState = toPublicRoom(room);
  assert.equal('selections' in publicState, false);

  readyPlayer(room, 'p1');
  readyPlayer(room, 'p2');
  assert.equal(allPlayersReady(room), true);

  const result = resolveRound(room, 1_000);
  assert.deepEqual(result.collisions, [pos(10, 4)]);
  assert.equal(result.board[10][4], null);
  assert.equal(room.round, 2);
  assert.equal(room.roundEndsAt, 1_000 + ROUND_DURATION_MS);
});


test('submits all three opening stones atomically and advances exactly one turn', () => {
  const room = createRoom('ATOM', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);

  const first = room.initialOrder[0];
  const second = room.initialOrder[1];
  placeInitialStones(room, first, [pos(0, 0), pos(0, 1), pos(0, 2)], 2_000);

  assert.equal(room.initialPlaced[first], 3);
  assert.equal(room.initialTurnIndex, 1);
  assert.equal(room.board[0][0], first);
  assert.equal(room.board[0][1], first);
  assert.equal(room.board[0][2], first);
  assert.throws(
    () => placeInitialStones(room, first, [pos(1, 0), pos(1, 1), pos(1, 2)], 2_100),
    /NOT_YOUR_TURN/,
  );

  placeInitialStones(room, second, [pos(2, 0), pos(2, 1), pos(2, 2)], 3_000);
  assert.equal(room.phase, 'PLANNING');
  assert.equal(room.roundEndsAt, 3_000 + ROUND_DURATION_MS);
});

test('opening batch rejects partial placement without mutating the board', () => {
  const room = createRoom('SAFE', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);
  const first = room.initialOrder[0];

  assert.throws(() => placeInitialStones(room, first, [pos(0, 0), pos(0, 1)]), /INITIAL_SELECTION_COUNT/);
  assert.equal(room.initialPlaced[first], 0);
  assert.equal(room.board[0][0], null);
  assert.equal(room.board[0][1], null);
});
