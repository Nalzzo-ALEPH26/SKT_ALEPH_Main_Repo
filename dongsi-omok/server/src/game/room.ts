import {
  createEmptyBoard,
  getWinners,
  isCellEmpty,
  resolveSelections,
  validatePositions,
} from './engine.js';
import type { Player, PlayerId, Position, Room, RoundResolution } from './types.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const INITIAL_STONES_PER_PLAYER = 3;
export const ROUND_SELECTION_LIMIT = 3;
export const ROUND_DURATION_MS = 15_000;

export function createRoom(roomId: string, hostId: PlayerId, nickname: string): Room {
  const host = createPlayer(hostId, nickname, 0);
  return {
    id: roomId,
    hostId,
    players: [host],
    phase: 'LOBBY',
    board: createEmptyBoard(),
    round: 0,
    roundEndsAt: null,
    selections: { [hostId]: [] },
    conversionTargets: { [hostId]: null },
    conversionClaimedBy: null,
    initialOrder: [],
    initialTurnIndex: 0,
    initialPlaced: { [hostId]: 0 },
    winners: [],
  };
}

export function joinRoom(room: Room, playerId: PlayerId, nickname: string): Player {
  if (room.phase !== 'LOBBY') throw new Error('GAME_IN_PROGRESS');
  if (room.players.length >= MAX_PLAYERS) throw new Error('ROOM_FULL');
  if (room.players.some((player) => player.id === playerId)) throw new Error('PLAYER_ALREADY_EXISTS');

  const player = createPlayer(playerId, nickname, room.players.length);
  room.players.push(player);
  room.selections[playerId] = [];
  room.conversionTargets[playerId] = null;
  room.initialPlaced[playerId] = 0;
  return player;
}

export function removeLobbyPlayer(room: Room, playerId: PlayerId): void {
  if (room.phase !== 'LOBBY') throw new Error('GAME_IN_PROGRESS');
  if (room.hostId === playerId) throw new Error('HOST_CANNOT_LEAVE_WITHOUT_CLOSING_ROOM');
  room.players = room.players.filter((player) => player.id !== playerId);
  room.players.forEach((player, index) => {
    player.colorIndex = index;
  });
  delete room.selections[playerId];
  delete room.conversionTargets[playerId];
  delete room.initialPlaced[playerId];
}

export function kickLobbyPlayer(
  room: Room,
  actorPlayerId: PlayerId,
  targetPlayerId: PlayerId,
): void {
  if (room.phase !== 'LOBBY') throw new Error('GAME_IN_PROGRESS');
  if (room.hostId !== actorPlayerId) throw new Error('HOST_ONLY');
  if (targetPlayerId === room.hostId) throw new Error('CANNOT_KICK_SELF');
  if (!room.players.some((player) => player.id === targetPlayerId)) throw new Error('PLAYER_NOT_FOUND');
  removeLobbyPlayer(room, targetPlayerId);
}

export function setPlayerConnected(room: Room, playerId: PlayerId, connected: boolean): void {
  const player = getPlayer(room, playerId);
  player.connected = connected;
}

export function startGame(room: Room, rng: () => number = Math.random, now = Date.now()): void {
  if (room.phase !== 'LOBBY' && room.phase !== 'FINISHED') throw new Error('GAME_ALREADY_STARTED');
  if (room.players.length < MIN_PLAYERS) throw new Error('NOT_ENOUGH_PLAYERS');

  room.board = createEmptyBoard();
  room.round = 0;
  room.roundEndsAt = null;
  room.phase = 'INITIAL_PLACEMENT';
  room.winners = [];
  room.initialTurnIndex = 0;
  room.initialOrder = shuffled(room.players.map((player) => player.id), rng);
  room.initialPlaced = Object.fromEntries(room.players.map((player) => [player.id, 0]));
  room.selections = Object.fromEntries(room.players.map((player) => [player.id, []]));
  room.conversionTargets = Object.fromEntries(room.players.map((player) => [player.id, null]));
  room.conversionClaimedBy = null;
  room.players.forEach((player) => {
    player.ready = false;
  });

  // Keep now in the signature so deterministic callers can use one clock API for all transitions.
  void now;
}

export function currentInitialPlayerId(room: Room): PlayerId | null {
  if (room.phase !== 'INITIAL_PLACEMENT') return null;
  return room.initialOrder[room.initialTurnIndex] ?? null;
}

export function placeInitialStone(
  room: Room,
  playerId: PlayerId,
  position: Position,
  now = Date.now(),
): void {
  if (room.phase !== 'INITIAL_PLACEMENT') throw new Error('INVALID_PHASE');
  const currentPlayerId = currentInitialPlayerId(room);
  if (currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');
  if (!isCellEmpty(room.board, position)) throw new Error('CELL_OCCUPIED');

  room.board[position.row][position.col] = playerId;
  room.initialPlaced[playerId] = (room.initialPlaced[playerId] ?? 0) + 1;

  if (room.initialPlaced[playerId] >= INITIAL_STONES_PER_PLAYER) {
    room.initialTurnIndex += 1;
    if (room.initialTurnIndex >= room.initialOrder.length) {
      beginPlanningRound(room, now, 1);
    }
  }
}

export function placeInitialStones(
  room: Room,
  playerId: PlayerId,
  positions: Position[],
  now = Date.now(),
): void {
  if (room.phase !== 'INITIAL_PLACEMENT') throw new Error('INVALID_PHASE');
  const currentPlayerId = currentInitialPlayerId(room);
  if (currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');
  if (positions.length !== INITIAL_STONES_PER_PLAYER) throw new Error('INITIAL_SELECTION_COUNT');

  // Validate the complete opening move before mutating the board so a rejected
  // coordinate can never leave another client in a partially advanced turn.
  validatePositions(room.board, positions, INITIAL_STONES_PER_PLAYER);

  for (const position of positions) {
    room.board[position.row][position.col] = playerId;
  }
  room.initialPlaced[playerId] = INITIAL_STONES_PER_PLAYER;
  room.initialTurnIndex += 1;

  if (room.initialTurnIndex >= room.initialOrder.length) {
    beginPlanningRound(room, now, 1);
  }
}

export function updateSelection(room: Room, playerId: PlayerId, positions: Position[]): void {
  if (room.phase !== 'PLANNING') throw new Error('INVALID_PHASE');
  const player = getPlayer(room, playerId);
  if (player.ready) throw new Error('ALREADY_READY');

  validatePositions(room.board, positions, ROUND_SELECTION_LIMIT);
  if (positions.length > 0) room.conversionTargets[playerId] = null;
  room.selections[playerId] = positions.map((position) => ({ ...position }));
}

export function readyPlayer(
  room: Room,
  playerId: PlayerId,
  targetPlayerId: PlayerId | null = null,
): void {
  if (room.phase !== 'PLANNING') throw new Error('INVALID_PHASE');
  const player = getPlayer(room, playerId);
  if (player.ready) throw new Error('ALREADY_READY');

  // 전환권은 대상을 고른 순간이 아니라 LOCK을 확정한 순간 선착순으로 획득한다.
  if (targetPlayerId) {
    if (targetPlayerId === playerId) throw new Error('CANNOT_TARGET_SELF');
    getPlayer(room, targetPlayerId);
    if (room.conversionClaimedBy && room.conversionClaimedBy !== playerId) {
      throw new Error('CONVERSION_ALREADY_CLAIMED');
    }
    room.conversionClaimedBy = playerId;
    room.conversionTargets[playerId] = targetPlayerId;
    room.selections[playerId] = [];
  } else {
    room.conversionTargets[playerId] = null;
  }

  player.ready = true;
}

export function allPlayersReady(room: Room): boolean {
  return room.players.length > 0 && room.players.every((player) => player.ready);
}

export function resolveRound(
  room: Room,
  now = Date.now(),
  rng: () => number = Math.random,
): RoundResolution {
  if (room.phase !== 'PLANNING') throw new Error('INVALID_PHASE');
  room.phase = 'RESOLVING';

  const activeSelections = Object.fromEntries(
    room.players.map((player) => [
      player.id,
      (room.selections[player.id] ?? []).map((position) => ({ ...position })),
    ]),
  );
  // 전환은 각 플레이어가 원래 선택한 좌표만 대상으로 한다.
  // 전환으로 새로 생긴 돌을 다른 전환이 다시 빼앗는 연쇄 효과는 만들지 않는다.
  const remainingOriginalSelections = Object.fromEntries(
    room.players.map((player) => [
      player.id,
      (room.selections[player.id] ?? []).map((position) => ({ ...position })),
    ]),
  );
  const converted: NonNullable<RoundResolution['converted']> = [];

  for (const player of room.players) {
    const targetPlayerId = room.conversionTargets[player.id];
    if (!targetPlayerId) continue;

    // 특수 행동은 자신의 일반 3수 착수를 완전히 대체한다.
    // 상대가 고른 원래 좌표 중 최대 2개를 중복 없이 무작위로 가져온다.
    activeSelections[player.id] = [];
    const candidates = remainingOriginalSelections[targetPlayerId] ?? [];

    for (let convertedCount = 0; convertedCount < 2 && candidates.length > 0; convertedCount += 1) {
      const randomIndex = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
      const [position] = candidates.splice(randomIndex, 1);
      activeSelections[targetPlayerId] = (activeSelections[targetPlayerId] ?? []).filter(
        (candidate) => candidate.row !== position.row || candidate.col !== position.col,
      );
      activeSelections[player.id].push({ ...position });
      converted.push({
        fromPlayerId: targetPlayerId,
        toPlayerId: player.id,
        position: { ...position },
      });
    }
  }

  const resolution = resolveSelections(room.board, activeSelections);
  resolution.converted = converted;
  room.board = resolution.board;
  room.winners = getWinners(room.board);
  resolution.winners = [...room.winners];

  if (room.winners.length > 0) {
    room.phase = 'FINISHED';
    room.roundEndsAt = null;
    room.players.forEach((player) => {
      player.ready = false;
    });
    return resolution;
  }

  beginPlanningRound(room, now, room.round + 1);
  return resolution;
}

export function toPublicRoom(room: Room) {
  return {
    id: room.id,
    hostId: room.hostId,
    phase: room.phase,
    board: room.board.map((row) => [...row]),
    round: room.round,
    roundEndsAt: room.roundEndsAt,
    initialOrder: [...room.initialOrder],
    initialTurnIndex: room.initialTurnIndex,
    initialPlaced: { ...room.initialPlaced },
    winners: [...room.winners],
    players: room.players.map((player) => ({ ...player })),
    conversionAvailable: room.conversionClaimedBy === null,
  };
}

function beginPlanningRound(room: Room, now: number, round: number): void {
  room.phase = 'PLANNING';
  room.round = round;
  room.roundEndsAt = now + ROUND_DURATION_MS;
  room.selections = Object.fromEntries(room.players.map((player) => [player.id, []]));
  room.conversionTargets = Object.fromEntries(room.players.map((player) => [player.id, null]));
  room.conversionClaimedBy = null;
  room.players.forEach((player) => {
    player.ready = false;
  });
}

function createPlayer(id: PlayerId, nickname: string, colorIndex: number): Player {
  const normalizedNickname = nickname.trim().slice(0, 16);
  if (!normalizedNickname) throw new Error('INVALID_NICKNAME');
  return {
    id,
    nickname: normalizedNickname,
    colorIndex,
    connected: true,
    ready: false,
  };
}

function getPlayer(room: Room, playerId: PlayerId): Player {
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('PLAYER_NOT_FOUND');
  return player;
}

function shuffled<T>(values: T[], rng: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
