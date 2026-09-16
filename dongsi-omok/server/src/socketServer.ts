import express from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import {
  allPlayersReady,
  createRoom,
  joinRoom,
  placeInitialStones,
  removeLobbyPlayer,
  resolveRound,
  setPlayerConnected,
  startGame,
  toPublicRoom,
  updateSelection,
  readyPlayer,
} from './game/room.js';
import type { Position, Room } from './game/types.js';

export interface SocketServerBundle {
  httpServer: HttpServer;
  io: Server;
}

type Ack = (payload: Record<string, unknown>) => void;

export function createSocketServer(): SocketServerBundle {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
  });

  const rooms = new Map<string, Room>();
  const sessions = new Map<string, { roomId: string; playerId: string }>();
  const roundTimers = new Map<string, NodeJS.Timeout>();

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  io.on('connection', (socket) => {
    socket.on('room:create', (payload: { nickname?: string }, ack?: Ack) => {
      handle(ack, () => {
        const nickname = payload?.nickname ?? '';
        const roomId = createRoomCode();
        const playerId = randomUUID();
        const room = createRoom(roomId, playerId, nickname);
        rooms.set(roomId, room);
        sessions.set(socket.id, { roomId, playerId });
        socket.join(roomId);
        broadcastRoom(room);
        return { ok: true, roomId, playerId };
      });
    });

    socket.on('room:join', (payload: { roomId?: string; nickname?: string }, ack?: Ack) => {
      handle(ack, () => {
        const roomId = normalizeRoomId(payload?.roomId);
        const room = requireRoom(roomId);
        const playerId = randomUUID();
        joinRoom(room, playerId, payload?.nickname ?? '');
        sessions.set(socket.id, { roomId, playerId });
        socket.join(roomId);
        broadcastRoom(room);
        return { ok: true, roomId, playerId };
      });
    });

    socket.on('room:reconnect', (payload: { roomId?: string; playerId?: string }, ack?: Ack) => {
      handle(ack, () => {
        const roomId = normalizeRoomId(payload?.roomId);
        const playerId = payload?.playerId ?? '';
        const room = requireRoom(roomId);
        if (!room.players.some((player) => player.id === playerId)) throw new Error('PLAYER_NOT_FOUND');
        setPlayerConnected(room, playerId, true);
        sessions.set(socket.id, { roomId, playerId });
        socket.join(roomId);
        broadcastRoom(room);
        return { ok: true, roomId, playerId };
      });
    });

    socket.on('room:leave', (_payload: unknown, ack?: Ack) => {
      handle(ack, () => {
        const session = requireSession(socket.id);
        const room = requireRoom(session.roomId);
        if (room.phase !== 'LOBBY') throw new Error('GAME_IN_PROGRESS');

        if (room.hostId === session.playerId) {
          clearRoundTimer(room.id);
          rooms.delete(room.id);
          io.to(room.id).emit('room:closed');
        } else {
          removeLobbyPlayer(room, session.playerId);
          broadcastRoom(room);
        }
        sessions.delete(socket.id);
        socket.leave(room.id);
        return { ok: true };
      });
    });

    socket.on('game:start', (_payload: unknown, ack?: Ack) => {
      handle(ack, () => {
        const { room, playerId } = roomForSocket(socket.id);
        if (room.hostId !== playerId) throw new Error('HOST_ONLY');
        startGame(room);
        clearRoundTimer(room.id);
        broadcastRoom(room);
        return { ok: true };
      });
    });

    socket.on('initial:place-batch', (payload: { positions?: Position[] }, ack?: Ack) => {
      handle(ack, () => {
        const { room, playerId } = roomForSocket(socket.id);
        const previousPhase = room.phase;
        placeInitialStones(room, playerId, payload?.positions ?? [], Date.now());
        broadcastRoom(room);
        if (previousPhase === 'INITIAL_PLACEMENT' && room.phase === 'PLANNING') {
          scheduleRoundTimer(room);
        }
        return { ok: true };
      });
    });

    socket.on('round:update-selection', (payload: { positions?: Position[] }, ack?: Ack) => {
      handle(ack, () => {
        const { room, playerId } = roomForSocket(socket.id);
        updateSelection(room, playerId, payload?.positions ?? []);
        return { ok: true, count: room.selections[playerId].length };
      });
    });

    socket.on('round:ready', (_payload: unknown, ack?: Ack) => {
      handle(ack, () => {
        const { room, playerId } = roomForSocket(socket.id);
        readyPlayer(room, playerId);
        broadcastRoom(room);
        if (allPlayersReady(room)) resolveAndBroadcast(room);
        return { ok: true };
      });
    });

    socket.on('game:restart', (_payload: unknown, ack?: Ack) => {
      handle(ack, () => {
        const { room, playerId } = roomForSocket(socket.id);
        if (room.hostId !== playerId) throw new Error('HOST_ONLY');
        if (room.phase !== 'FINISHED') throw new Error('INVALID_PHASE');
        startGame(room);
        clearRoundTimer(room.id);
        broadcastRoom(room);
        return { ok: true };
      });
    });

    socket.on('disconnect', () => {
      const session = sessions.get(socket.id);
      sessions.delete(socket.id);
      if (!session) return;
      const room = rooms.get(session.roomId);
      if (!room) return;
      try {
        setPlayerConnected(room, session.playerId, false);
        broadcastRoom(room);
        if (room.phase === 'PLANNING' && allPlayersReady(room)) resolveAndBroadcast(room);
      } catch {
        // The room/player may have been removed immediately before disconnect.
      }
    });
  });

  function broadcastRoom(room: Room): void {
    io.to(room.id).emit('room:state', toPublicRoom(room));
  }

  function resolveAndBroadcast(room: Room): void {
    if (room.phase !== 'PLANNING') return;
    clearRoundTimer(room.id);
    const resolution = resolveRound(room, Date.now());
    io.to(room.id).emit('round:resolved', resolution);
    broadcastRoom(room);
    if (room.phase === 'PLANNING') scheduleRoundTimer(room);
  }

  function scheduleRoundTimer(room: Room): void {
    clearRoundTimer(room.id);
    if (room.phase !== 'PLANNING' || room.roundEndsAt === null) return;
    const expectedRound = room.round;
    const expectedEndsAt = room.roundEndsAt;
    const delay = Math.max(0, expectedEndsAt - Date.now());
    const timer = setTimeout(() => {
      roundTimers.delete(room.id);
      if (
        room.phase === 'PLANNING' &&
        room.round === expectedRound &&
        room.roundEndsAt === expectedEndsAt
      ) {
        resolveAndBroadcast(room);
      }
    }, delay + 5);
    roundTimers.set(room.id, timer);
  }

  function clearRoundTimer(roomId: string): void {
    const timer = roundTimers.get(roomId);
    if (timer) clearTimeout(timer);
    roundTimers.delete(roomId);
  }

  function createRoomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt += 1) {
      let code = '';
      for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!rooms.has(code)) return code;
    }
    throw new Error('ROOM_CODE_EXHAUSTED');
  }

  function normalizeRoomId(value?: string): string {
    const roomId = (value ?? '').trim().toUpperCase();
    if (!roomId) throw new Error('ROOM_ID_REQUIRED');
    return roomId;
  }

  function requireRoom(roomId: string): Room {
    const room = rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    return room;
  }

  function requireSession(socketId: string) {
    const session = sessions.get(socketId);
    if (!session) throw new Error('NOT_IN_ROOM');
    return session;
  }

  function roomForSocket(socketId: string): { room: Room; playerId: string } {
    const session = requireSession(socketId);
    return { room: requireRoom(session.roomId), playerId: session.playerId };
  }

  return { httpServer, io };
}

function handle(ack: Ack | undefined, fn: () => Record<string, unknown>): void {
  try {
    const result = fn();
    ack?.(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    ack?.({ ok: false, error: code });
  }
}
