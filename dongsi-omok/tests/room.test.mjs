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
  kickLobbyPlayer,
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


test('host can kick another player from the lobby', () => {
  const room = createRoom('KICK', 'host', 'Host');
  joinRoom(room, 'guest', 'Guest');
  kickLobbyPlayer(room, 'host', 'guest');
  assert.deepEqual(room.players.map((player) => player.id), ['host']);
});

test('kick is host-only, cannot target self, and is lobby-only', () => {
  const room = createRoom('KICK', 'host', 'Host');
  joinRoom(room, 'guest', 'Guest');
  assert.throws(() => kickLobbyPlayer(room, 'guest', 'host'), /HOST_ONLY/);
  assert.throws(() => kickLobbyPlayer(room, 'host', 'host'), /CANNOT_KICK_SELF/);
  startGame(room, () => 0.5, 1_000);
  assert.throws(() => kickLobbyPlayer(room, 'host', 'guest'), /GAME_IN_PROGRESS/);
});

test('requires at least two players and gives three sequential initial stones per player', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  assert.throws(() => startGame(room, () => 0.5, 1_000), /NOT_ENOUGH_PLAYERS/);
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0.5, 1_000);

  assert.equal(room.phase, 'INITIAL_PLACEMENT');
  const first = room.initialOrder[0];
  const second = room.initialOrder[1];
  placeInitialStone(room, first, pos(1, 1));
  assert.throws(() => placeInitialStone(room, second, pos(2, 1)), /NOT_YOUR_TURN/);
  placeInitialStone(room, first, pos(1, 2));
  placeInitialStone(room, first, pos(1, 3));
  assert.equal(room.initialTurnIndex, 1);
  assert.equal(room.initialPlaced[first], 3);
});

test('starts a 15 second planning round after all initial placements', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 5_000);

  for (const [index, playerId] of room.initialOrder.entries()) {
    const row = index * 2 + 1;
    placeInitialStone(room, playerId, pos(row, 1), 8_000);
    placeInitialStone(room, playerId, pos(row, 2), 8_000);
    placeInitialStone(room, playerId, pos(row, 3), 8_000);
  }

  assert.equal(room.phase, 'PLANNING');
  assert.equal(room.round, 1);
  assert.equal(room.roundEndsAt, 8_000 + ROUND_DURATION_MS);
});

test('keeps selections private, allows up to three, and resolves collisions', () => {
  const room = createRoom('ABCD', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 0);

  for (const [index, playerId] of room.initialOrder.entries()) {
    const row = index * 2 + 1;
    placeInitialStone(room, playerId, pos(row, 1), 100);
    placeInitialStone(room, playerId, pos(row, 2), 100);
    placeInitialStone(room, playerId, pos(row, 3), 100);
  }

  updateSelection(room, 'p1', [0, 1, 2].map((col) => pos(10, col)));
  assert.throws(
    () => updateSelection(room, 'p1', [0, 1, 2, 3].map((col) => pos(10, col))),
    /SELECTION_LIMIT/,
  );
  updateSelection(room, 'p2', [pos(10, 2), pos(11, 2)]);

  const publicState = toPublicRoom(room);
  assert.equal('selections' in publicState, false);

  readyPlayer(room, 'p1');
  readyPlayer(room, 'p2');
  assert.equal(allPlayersReady(room), true);

  const result = resolveRound(room, 1_000);
  assert.deepEqual(result.collisions, [pos(10, 2)]);
  assert.equal(result.board[10][2], null);
  assert.equal(room.round, 2);
  assert.equal(room.roundEndsAt, 1_000 + ROUND_DURATION_MS);
});


test('submits all three opening stones atomically and advances exactly one turn', () => {
  const room = createRoom('ATOM', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);

  const first = room.initialOrder[0];
  const second = room.initialOrder[1];
  placeInitialStones(room, first, [pos(1, 1), pos(1, 2), pos(1, 3)], 2_000);

  assert.equal(room.initialPlaced[first], 3);
  assert.equal(room.initialTurnIndex, 1);
  assert.equal(room.board[1][1], first);
  assert.equal(room.board[1][2], first);
  assert.equal(room.board[1][3], first);
  assert.throws(
    () => placeInitialStones(room, first, [pos(2, 1), pos(2, 2), pos(2, 3)], 2_100),
    /NOT_YOUR_TURN/,
  );

  placeInitialStones(room, second, [pos(3, 1), pos(3, 2), pos(3, 3)], 3_000);
  assert.equal(room.phase, 'PLANNING');
  assert.equal(room.roundEndsAt, 3_000 + ROUND_DURATION_MS);
});

test('opening batch rejects partial placement without mutating the board', () => {
  const room = createRoom('SAFE', 'p1', 'P1');
  joinRoom(room, 'p2', 'P2');
  startGame(room, () => 0, 1_000);
  const first = room.initialOrder[0];

  assert.throws(() => placeInitialStones(room, first, [pos(1, 1), pos(1, 2)]), /INITIAL_SELECTION_COUNT/);
  assert.equal(room.initialPlaced[first], 0);
  assert.equal(room.board[1][1], null);
  assert.equal(room.board[1][2], null);
});


function makePlanningRoom(playerIds) {
  const [host, ...guests] = playerIds;
  const room = createRoom('FAIR', host, host.toUpperCase());
  for (const guest of guests) joinRoom(room, guest, guest.toUpperCase());
  startGame(room, () => 0, 1_000);
  room.initialOrder.forEach((playerId, index) => {
    const row = index * 2 + 1;
    placeInitialStones(room, playerId, [pos(row, 1), pos(row, 2), pos(row, 3)], 2_000 + index);
  });
  return room;
}

test('conversion chance is successful once per player per game', () => {
  const room = makePlanningRoom(['p1', 'p2']);

  readyPlayer(room, 'p1', 'p2');
  assert.equal(room.players.find((player) => player.id === 'p1').conversionUsed, true);
  readyPlayer(room, 'p2');
  resolveRound(room, 5_000, () => 0);

  assert.equal(room.phase, 'PLANNING');
  assert.throws(() => readyPlayer(room, 'p1', 'p2'), /CONVERSION_ALREADY_USED/);
});

test('losing the round takeover race does not consume the later player chance', () => {
  const room = makePlanningRoom(['p1', 'p2', 'p3']);

  readyPlayer(room, 'p1', 'p2');
  assert.throws(() => readyPlayer(room, 'p3', 'p2'), /CONVERSION_ALREADY_CLAIMED/);
  assert.equal(room.players.find((player) => player.id === 'p3').conversionUsed, false);

  readyPlayer(room, 'p2');
  readyPlayer(room, 'p3');
  resolveRound(room, 5_000, () => 0);

  readyPlayer(room, 'p3', 'p2');
  assert.equal(room.players.find((player) => player.id === 'p3').conversionUsed, true);
});
