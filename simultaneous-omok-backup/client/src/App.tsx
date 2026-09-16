import { useEffect, useMemo, useState } from 'react';
import { Board } from './components/Board';
import { emitAck, socket } from './socket';
import type { Position, PublicRoom, RoundResolution } from './types';

const SESSION_KEY = 'simultaneous-omok-session-v1';
const MAX_SELECTIONS = 5;

interface Session {
  roomId: string;
  playerId: string;
  nickname: string;
}

const ERROR_TEXT: Record<string, string> = {
  ROOM_FULL: '방 인원이 가득 찼습니다. (최대 6명)',
  GAME_IN_PROGRESS: '이미 게임이 시작된 방입니다.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  NOT_ENOUGH_PLAYERS: '게임 시작에는 최소 2명이 필요합니다.',
  HOST_ONLY: '방장만 실행할 수 있습니다.',
  NOT_YOUR_TURN: '지금은 내 차례가 아닙니다.',
  CELL_OCCUPIED: '이미 돌이 놓인 칸입니다.',
  SELECTION_LIMIT: '한 라운드에는 최대 5곳까지 선택할 수 있습니다.',
  SERVER_TIMEOUT: '서버 응답이 없습니다. 연결 상태를 확인하세요.',
};

export default function App() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [nickname, setNickname] = useState(() => loadSession()?.nickname ?? '');
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [selected, setSelected] = useState<Position[]>([]);
  const [resolution, setResolution] = useState<RoundResolution | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const onState = (nextRoom: PublicRoom) => setRoom(nextRoom);
    const onResolved = (result: RoundResolution) => {
      setResolution(result);
      setSelected([]);
      window.setTimeout(() => setResolution(null), 1800);
    };
    const onClosed = () => {
      clearSession();
      setSession(null);
      setRoom(null);
      setError('방장이 방을 닫았습니다.');
    };

    socket.on('room:state', onState);
    socket.on('round:resolved', onResolved);
    socket.on('room:closed', onClosed);
    return () => {
      socket.off('room:state', onState);
      socket.off('round:resolved', onResolved);
      socket.off('room:closed', onClosed);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return;
    const reconnect = async () => {
      try {
        await emitAck('room:reconnect', {
          roomId: session.roomId,
          playerId: session.playerId,
        });
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'PLAYER_NOT_FOUND') {
          clearSession();
          setSession(null);
          setRoom(null);
        }
      }
    };

    if (socket.connected) void reconnect();
    socket.on('connect', reconnect);
    return () => {
      socket.off('connect', reconnect);
    };
  }, [session?.roomId, session?.playerId]);

  useEffect(() => {
    setSelected([]);
  }, [room?.round, room?.phase]);

  const me = useMemo(
    () => room?.players.find((player) => player.id === session?.playerId) ?? null,
    [room, session?.playerId],
  );
  const isHost = Boolean(room && session && room.hostId === session.playerId);
  const currentInitialId = room?.initialOrder[room.initialTurnIndex] ?? null;
  const isMyInitialTurn = room?.phase === 'INITIAL_PLACEMENT' && currentInitialId === session?.playerId;
  const secondsLeft = room?.roundEndsAt
    ? Math.max(0, Math.ceil((room.roundEndsAt - now) / 1000))
    : null;

  const run = async (task: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await task();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'UNKNOWN_ERROR';
      setError(ERROR_TEXT[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const cleanNickname = nickname.trim();
      if (!cleanNickname) throw new Error('닉네임을 입력하세요.');
      const response = await emitAck<{ ok: true; roomId: string; playerId: string }>('room:create', {
        nickname: cleanNickname,
      });
      const nextSession = { roomId: response.roomId, playerId: response.playerId, nickname: cleanNickname };
      saveSession(nextSession);
      setSession(nextSession);
      history.replaceState(null, '', `?room=${response.roomId}`);
    });

  const join = () =>
    run(async () => {
      const cleanNickname = nickname.trim();
      const cleanRoom = roomCode.trim().toUpperCase();
      if (!cleanNickname) throw new Error('닉네임을 입력하세요.');
      if (!cleanRoom) throw new Error('방 코드를 입력하세요.');
      const response = await emitAck<{ ok: true; roomId: string; playerId: string }>('room:join', {
        roomId: cleanRoom,
        nickname: cleanNickname,
      });
      const nextSession = { roomId: response.roomId, playerId: response.playerId, nickname: cleanNickname };
      saveSession(nextSession);
      setSession(nextSession);
      history.replaceState(null, '', `?room=${response.roomId}`);
    });

  const handleBoardClick = (position: Position) => {
    if (!room || !session) return;
    if (room.phase === 'INITIAL_PLACEMENT') {
      if (!isMyInitialTurn) return;
      void run(async () => {
        await emitAck('initial:place', { position });
      });
      return;
    }

    if (room.phase !== 'PLANNING' || me?.ready) return;
    const exists = selected.some((item) => item.row === position.row && item.col === position.col);
    const next = exists
      ? selected.filter((item) => item.row !== position.row || item.col !== position.col)
      : [...selected, position];
    if (next.length > MAX_SELECTIONS) {
      setError(ERROR_TEXT.SELECTION_LIMIT);
      return;
    }
    setSelected(next);
    void emitAck('round:update-selection', { positions: next }).catch((cause) => {
      setSelected(selected);
      const code = cause instanceof Error ? cause.message : 'UNKNOWN_ERROR';
      setError(ERROR_TEXT[code] ?? code);
    });
  };

  const leave = () =>
    run(async () => {
      if (room?.phase === 'LOBBY') await emitAck('room:leave');
      clearSession();
      setSession(null);
      setRoom(null);
      setSelected([]);
      history.replaceState(null, '', location.pathname);
    });

  if (!session || !room) {
    return (
      <main className="shell landing">
        <section className="hero-card">
          <p className="eyebrow">2–6 PLAYER REAL-TIME</p>
          <h1>동시 오목</h1>
          <p className="lead">
            첫 3수는 순서대로. 이후 15초 안에 최대 5수를 숨겨 고르고 동시에 공개합니다.
          </p>
          <label>
            닉네임
            <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} />
          </label>
          <div className="home-actions">
            <button className="primary" disabled={busy} onClick={create}>방 만들기</button>
            <div className="join-row">
              <input
                value={roomCode}
                maxLength={6}
                placeholder="방 코드"
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              />
              <button disabled={busy} onClick={join}>참가</button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="rules-mini">
            <span>15×15</span><span>초기 3수</span><span>라운드 5수</span><span>충돌 시 무효</span>
          </div>
        </section>
      </main>
    );
  }

  const winnerNames = room.winners
    .map((id) => room.players.find((player) => player.id === id)?.nickname)
    .filter(Boolean)
    .join(', ');

  return (
    <main className="shell game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ROOM</p>
          <strong className="room-code">{room.id}</strong>
        </div>
        <div className="phase-box">
          <span>{phaseLabel(room.phase)}</span>
          {room.phase === 'PLANNING' && <strong>{secondsLeft}s</strong>}
        </div>
      </header>

      <section className="layout">
        <div className="board-panel">
          <div className="status-line">
            {room.phase === 'LOBBY' && <span>2명 이상 모이면 방장이 게임을 시작할 수 있습니다.</span>}
            {room.phase === 'INITIAL_PLACEMENT' && (
              <span>
                {isMyInitialTurn
                  ? `내 차례 · ${room.initialPlaced[session.playerId] ?? 0}/3 착수`
                  : `${playerName(room, currentInitialId)} 님이 초기 돌을 놓는 중`}
              </span>
            )}
            {room.phase === 'PLANNING' && (
              <span>{me?.ready ? '선택 확정 완료' : `비공개 선택 ${selected.length}/5`}</span>
            )}
            {room.phase === 'FINISHED' && <span>승자: {winnerNames}</span>}
          </div>

          <Board
            board={room.board}
            players={room.players}
            selected={room.phase === 'PLANNING' ? selected : []}
            collisions={resolution?.collisions ?? []}
            disabled={
              room.phase === 'LOBBY' ||
              room.phase === 'FINISHED' ||
              room.phase === 'RESOLVING' ||
              (room.phase === 'INITIAL_PLACEMENT' && !isMyInitialTurn) ||
              (room.phase === 'PLANNING' && Boolean(me?.ready))
            }
            onCellClick={handleBoardClick}
          />

          {room.phase === 'PLANNING' && !me?.ready && (
            <button className="primary ready-button" onClick={() => run(async () => { await emitAck('round:ready'); })}>
              READY · {selected.length}/5
            </button>
          )}
          {room.phase === 'LOBBY' && isHost && (
            <button
              className="primary ready-button"
              disabled={room.players.length < 2 || busy}
              onClick={() => run(async () => { await emitAck('game:start'); })}
            >
              게임 시작 ({room.players.length}/6)
            </button>
          )}
          {room.phase === 'FINISHED' && isHost && (
            <button className="primary ready-button" onClick={() => run(async () => { await emitAck('game:restart'); })}>
              같은 멤버로 다시 하기
            </button>
          )}
        </div>

        <aside className="side-panel">
          <div className="side-title">
            <h2>플레이어</h2>
            <span>{room.players.length}/6</span>
          </div>
          <div className="players">
            {room.players.map((player) => (
              <div className={`player-card ${player.id === session.playerId ? 'player-card--me' : ''}`} key={player.id}>
                <span className={`player-dot player-dot--${player.colorIndex}`} />
                <div>
                  <strong>{player.nickname}</strong>
                  <small>
                    {player.id === room.hostId ? '방장 · ' : ''}
                    {player.connected ? '접속 중' : '재접속 대기'}
                  </small>
                </div>
                {room.phase === 'PLANNING' && <b>{player.ready ? 'READY' : '선택 중'}</b>}
              </div>
            ))}
          </div>

          <div className="rule-card">
            <h3>현재 룰</h3>
            <p>① 랜덤 순서로 각자 초기 돌 3개를 순차 착수</p>
            <p>② 매 라운드 15초 동안 빈 칸 최대 5곳 선택</p>
            <p>③ 같은 칸을 2명 이상 고르면 그 칸은 전부 무효</p>
            <p>④ 5목 이상 완성 시 승리 · 동시 완성은 공동 승리</p>
          </div>

          <button className="secondary" onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?room=${room.id}`)}>
            초대 링크 복사
          </button>
          {room.phase === 'LOBBY' && <button className="text-button" onClick={leave}>방 나가기</button>}
          {error && <p className="error">{error}</p>}
        </aside>
      </section>

      {resolution && (
        <div className="reveal-toast">
          <strong>ROUND {Math.max(1, room.round - (room.phase === 'PLANNING' ? 1 : 0))} 공개</strong>
          <span>충돌 {resolution.collisions.length}곳 · 착수 성공 {resolution.placed.length}개</span>
        </div>
      )}
    </main>
  );
}

function playerName(room: PublicRoom, playerId: string | null): string {
  if (!playerId) return '-';
  return room.players.find((player) => player.id === playerId)?.nickname ?? '-';
}

function phaseLabel(phase: PublicRoom['phase']): string {
  return {
    LOBBY: '대기실',
    INITIAL_PLACEMENT: '초기 착수',
    PLANNING: '동시 선택',
    RESOLVING: '판정 중',
    FINISHED: '게임 종료',
  }[phase];
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
