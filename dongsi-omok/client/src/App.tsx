import { useEffect, useMemo, useState } from 'react';
import { Board } from './components/Board';
import { emitAck, socket } from './socket';
import type { Position, PublicRoom, RoundResolution } from './types';

const SESSION_KEY = 'simultaneous-omok-session-v1';
const INITIAL_SELECTIONS = 3;
const MAX_SELECTIONS = 3;

interface Session {
  roomId: string;
  playerId: string;
  nickname: string;
}

const ERROR_TEXT: Record<string, string> = {
  ROOM_FULL: '방 인원이 가득 찼습니다. (최대 6명)',
  GAME_IN_PROGRESS: '이미 게임이 시작된 방입니다.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  PLAYER_NOT_FOUND: '기존 게임 정보를 찾을 수 없습니다.',
  NOT_ENOUGH_PLAYERS: '게임 시작에는 최소 2명이 필요합니다.',
  HOST_ONLY: '방장만 실행할 수 있습니다.',
  CANNOT_KICK_SELF: '방장은 자기 자신을 강퇴할 수 없습니다.',
  CANNOT_TARGET_SELF: '자기 자신은 전환 대상으로 선택할 수 없습니다.',
  CONVERSION_ALREADY_CLAIMED: '다른 플레이어가 먼저 전환권을 선점했습니다.',
  CONVERSION_ALREADY_USED: '이번 게임에서 상대 돌 전환 기회를 이미 사용했습니다.',
  NOT_YOUR_TURN: '지금은 내 차례가 아닙니다.',
  CELL_OCCUPIED: '이미 돌이 놓인 칸입니다.',
  SELECTION_LIMIT: '한 라운드에는 최대 3곳까지 선택할 수 있습니다.',
  INITIAL_SELECTION_COUNT: '초기 착수는 정확히 3곳을 선택해야 합니다.',
  SERVER_TIMEOUT: '서버 응답이 없습니다. 연결 상태를 확인하세요.',
};

export default function App() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [savedSession, setSavedSession] = useState<Session | null>(() => loadSession());
  const [nickname, setNickname] = useState(() => loadSession()?.nickname ?? '');
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [selected, setSelected] = useState<Position[]>([]);
  const [resolution, setResolution] = useState<RoundResolution | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [conversionTargetId, setConversionTargetId] = useState('');
  const [takeoverNotice, setTakeoverNotice] = useState('');

  useEffect(() => {
    const onState = (nextRoom: PublicRoom) => setRoom(nextRoom);
    const onResolved = (result: RoundResolution) => {
      setResolution(result);
      setSelected([]);
      setConversionTargetId('');
      window.setTimeout(() => setResolution(null), 1800);
    };
    const onClosed = () => {
      clearSession();
      setSavedSession(null);
      setSession(null);
      setRoom(null);
      setError('방장이 방을 닫았습니다.');
    };
    const onKicked = () => {
      clearSession();
      setSavedSession(null);
      setSession(null);
      setRoom(null);
      setSelected([]);
      history.replaceState(null, '', location.pathname);
      setError('방장에 의해 방에서 강퇴되었습니다.');
    };

    socket.on('room:state', onState);
    socket.on('round:resolved', onResolved);
    socket.on('room:closed', onClosed);
    socket.on('room:kicked', onKicked);
    return () => {
      socket.off('room:state', onState);
      socket.off('round:resolved', onResolved);
      socket.off('room:closed', onClosed);
      socket.off('room:kicked', onKicked);
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
          setSavedSession(null);
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
    setConversionTargetId('');
  }, [room?.round, room?.phase, room?.initialTurnIndex]);

  useEffect(() => {
    if (room?.phase === 'FINISHED') setGameOverOpen(true);
    else setGameOverOpen(false);
  }, [room?.phase]);

  const me = useMemo(
    () => room?.players.find((player) => player.id === session?.playerId) ?? null,
    [room, session?.playerId],
  );
  useEffect(() => {
    if (!takeoverNotice) return;
    const timer = window.setTimeout(() => setTakeoverNotice(''), 2000);
    return () => window.clearTimeout(timer);
  }, [takeoverNotice]);

  useEffect(() => {
    if (!me?.conversionUsed && !me?.ready) return;
    setConversionTargetId('');
  }, [me?.conversionUsed, me?.ready]);
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
      if (code === 'CONVERSION_ALREADY_CLAIMED') {
        setConversionTargetId('');
        setTakeoverNotice('다른 플레이어가 먼저 전환권을 선점했습니다. 다음 라운드에 다시 시도할 수 있습니다.');
      } else {
        setError(ERROR_TEXT[code] ?? code);
      }
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const cleanNickname = nickname.trim();
      if (!cleanNickname) throw new Error('플레이어명을 입력하세요.');
      const response = await emitAck<{ ok: true; roomId: string; playerId: string }>('room:create', {
        nickname: cleanNickname,
      });
      const nextSession = { roomId: response.roomId, playerId: response.playerId, nickname: cleanNickname };
      saveSession(nextSession);
      setSavedSession(nextSession);
      setSession(nextSession);
      history.replaceState(null, '', `?room=${response.roomId}`);
    });

  const join = () =>
    run(async () => {
      const cleanNickname = nickname.trim();
      const cleanRoom = roomCode.trim().toUpperCase();
      if (!cleanNickname) throw new Error('플레이어명을 입력하세요.');
      if (!cleanRoom) throw new Error('방 코드를 입력하세요.');
      const response = await emitAck<{ ok: true; roomId: string; playerId: string }>('room:join', {
        roomId: cleanRoom,
        nickname: cleanNickname,
      });
      const nextSession = { roomId: response.roomId, playerId: response.playerId, nickname: cleanNickname };
      saveSession(nextSession);
      setSavedSession(nextSession);
      setSession(nextSession);
      history.replaceState(null, '', `?room=${response.roomId}`);
    });

  const reconnectExisting = () =>
    run(async () => {
      const cleanNickname = nickname.trim();
      if (!savedSession) throw new Error('기존 게임 정보가 없습니다.');
      if (!cleanNickname) throw new Error('플레이어명을 입력하세요.');
      if (cleanNickname !== savedSession.nickname) {
        throw new Error('기존 게임의 플레이어명과 일치하지 않습니다.');
      }
      await emitAck('room:reconnect', {
        roomId: savedSession.roomId,
        playerId: savedSession.playerId,
      });
      setSession(savedSession);
      history.replaceState(null, '', `?room=${savedSession.roomId}`);
    });

  const handleBoardClick = (position: Position) => {
    if (!room || !session) return;

    const exists = selected.some((item) => item.row === position.row && item.col === position.col);
    const toggled = exists
      ? selected.filter((item) => item.row !== position.row || item.col !== position.col)
      : [...selected, position];

    if (room.phase === 'INITIAL_PLACEMENT') {
      if (!isMyInitialTurn || busy) return;
      if (toggled.length > INITIAL_SELECTIONS) {
        setError(ERROR_TEXT.INITIAL_SELECTION_COUNT);
        return;
      }
      setError('');
      setSelected(toggled);
      return;
    }

    if (room.phase !== 'PLANNING' || me?.ready) return;
    if (toggled.length > MAX_SELECTIONS) {
      setError(ERROR_TEXT.SELECTION_LIMIT);
      return;
    }
    setSelected(toggled);
    void emitAck('round:update-selection', { positions: toggled }).catch((cause) => {
      setSelected(selected);
      const code = cause instanceof Error ? cause.message : 'UNKNOWN_ERROR';
      setError(ERROR_TEXT[code] ?? code);
    });
  };

  const confirmInitialPlacement = () =>
    run(async () => {
      if (selected.length !== INITIAL_SELECTIONS) throw new Error('INITIAL_SELECTION_COUNT');
      await emitAck('initial:place-batch', { positions: selected });
      setSelected([]);
    });

  const chooseConversionTarget = (targetPlayerId: string) => {
    setError('');

    if (targetPlayerId && me?.conversionUsed) {
      setConversionTargetId('');
      setTakeoverNotice('이번 게임의 상대 돌 전환 기회는 이미 사용했습니다.');
      return;
    }

    if (targetPlayerId && room && !room.conversionAvailable) {
      setConversionTargetId('');
      setTakeoverNotice('다른 플레이어가 먼저 전환권을 선점했습니다. 다음 라운드에 다시 시도할 수 있습니다.');
      return;
    }

    setConversionTargetId(targetPlayerId);
    if (!targetPlayerId) return;

    // 대상 선택만으로는 전환권을 차지하지 않는다. LOCK 직전에 내 일반 착수만 비운다.
    setSelected([]);
    void emitAck('round:update-selection', { positions: [] }).catch((cause) => {
      const code = cause instanceof Error ? cause.message : 'UNKNOWN_ERROR';
      setError(ERROR_TEXT[code] ?? code);
    });
  };

  const leave = () =>
    run(async () => {
      if (room?.phase === 'LOBBY') await emitAck('room:leave');
      clearSession();
      setSavedSession(null);
      setSession(null);
      setRoom(null);
      setSelected([]);
      history.replaceState(null, '', location.pathname);
    });


  const kickPlayer = (playerId: string) =>
    run(async () => {
      await emitAck('room:kick', { playerId });
    });

  if (!session || !room) {
    return (
      <main className="shell landing cockpit-grid">
        <div className="space-stars space-stars--a" aria-hidden="true" />
        <div className="space-stars space-stars--b" aria-hidden="true" />
        <section className="mission-console">
          <div className="hud-strip">
            <span className="hud-status"><i className="system-light" /> SYSTEM ONLINE</span>
            <span>MISSION CONTROL // OMOK PROTOCOL</span>
            <span>CREW 2–6</span>
          </div>

          <div className="mission-heading">
            <p className="eyebrow">TACTICAL SIMULATION / REAL-TIME</p>
            <h1><span>DONGSI</span> OMOK</h1>
            <p className="lead">
              첫 3수는 순서대로 배치하고, 이후 15초 동안 최대 3개의 좌표를 비공개로 지정합니다.
              같은 좌표가 겹치면 해당 착수는 소멸합니다.
            </p>
          </div>

          <div className="mission-body">
            <div className="identity-panel">
              <div className="panel-label"><span>01</span> PILOT IDENTITY</div>
              <label className="callsign-field">
                <span>CALLSIGN / 플레이어명</span>
                <input
                  value={nickname}
                  maxLength={16}
                  autoComplete="off"
                  placeholder="플레이어명을 입력하세요"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>

              {savedSession && (
                <div className="resume-panel">
                  <div>
                    <small>RECOVERY SIGNAL DETECTED</small>
                    <strong>ROOM {savedSession.roomId}</strong>
                  </div>
                  <button className="secondary" disabled={busy || !nickname.trim()} onClick={reconnectExisting}>
                    기존 게임 재접속
                  </button>
                </div>
              )}
            </div>

            <div className="mission-actions-panel">
              <div className="panel-label"><span>02</span> MISSION ACCESS</div>
              <div className="home-actions">
                <button className="primary mission-button" disabled={busy || !nickname.trim()} onClick={create}>
                  <small>NEW SESSION</small>
                  방 만들기
                </button>
                <div className="join-row">
                  <input
                    value={roomCode}
                    maxLength={6}
                    placeholder="ROOM CODE"
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !busy) {
                        event.preventDefault();
                        void join();
                      }
                    }}
                  />
                  <button disabled={busy || !nickname.trim()} onClick={join}>참가</button>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="error console-error">{error}</p>}

          <div className="telemetry-grid">
            <div><small>GRID</small><strong>15 × 15</strong></div>
            <div><small>OPENING</small><strong>3 STONES</strong></div>
            <div><small>ROUND</small><strong>15 SEC</strong></div>
            <div><small>INPUT</small><strong>MAX 3</strong></div>
            <div><small>COLLISION</small><strong>VOID</strong></div>
          </div>
        </section>
      </main>
    );
  }

  const winnerNames = room.winners
    .map((id) => room.players.find((player) => player.id === id)?.nickname)
    .filter(Boolean)
    .join(', ');

  if (room.phase === 'LOBBY') {
    return (
      <main className="shell game-shell cockpit-grid lobby-shell">
        <header className="topbar command-bar">
          <div className="command-brand">
            <span className="hud-status"><i className="system-light" /> READY ROOM</span>
            <div>
              <p className="eyebrow">ROOM CODE</p>
              <strong className="room-code">{room.id}</strong>
            </div>
          </div>
          <div className="phase-box">
            <small>CREW</small>
            <span>{room.players.length}/6</span>
          </div>
        </header>

        <section className="lobby-screen">
          <div className="tactical-panel lobby-room-panel">
            <div className="panel-header">
              <div>
                <small>READY ROOM</small>
                <strong>게임 대기실</strong>
              </div>
              <span className="round-index">WAITING</span>
            </div>

            <p className="lobby-guide">플레이어가 준비되면 방장이 게임을 시작합니다. 게임 시작 전에는 게임판이 표시되지 않습니다.</p>

            <div className="players lobby-players">
              {room.players.map((player) => (
                <div className={`player-card ${player.id === session.playerId ? 'player-card--me' : ''}`} key={player.id}>
                  <span className={`player-dot player-dot--${player.colorIndex}`} />
                  <div className="lobby-player-info">
                    <strong>{player.nickname}</strong>
                    <small>
                      {player.id === room.hostId ? 'COMMANDER · ' : ''}
                      {player.connected ? 'LINKED' : 'SIGNAL LOST'}
                    </small>
                  </div>
                  {isHost && player.id !== room.hostId && (
                    <button className="kick-button" disabled={busy} onClick={() => kickPlayer(player.id)}>
                      강퇴
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="lobby-actions">
              <button
                className="secondary"
                onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?room=${room.id}`)}
              >
                INVITE LINK 복사
              </button>
              <button className="text-button" disabled={busy} onClick={leave}>방 나가기</button>
              {isHost ? (
                <button
                  className="primary lobby-start-button"
                  disabled={room.players.length < 2 || busy}
                  onClick={() => run(async () => { await emitAck('game:start'); })}
                >
                  게임 시작 · {room.players.length}/6
                </button>
              ) : (
                <div className="lobby-waiting">방장이 게임을 시작할 때까지 대기 중</div>
              )}
            </div>

            {error && <p className="error">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell game-shell cockpit-grid gameplay-only">
      <section className="layout gameplay-layout">
        <div className="board-panel tactical-panel">
          {room.phase === 'INITIAL_PLACEMENT' && (
            <div className={`round-control-bar ${isMyInitialTurn ? 'round-control-bar--active' : ''}`}>
              <div className="turn-readout">
                <small>OPENING TURN</small>
                <strong>{isMyInitialTurn ? 'YOUR TURN' : playerName(room, currentInitialId)}</strong>
                <span>{isMyInitialTurn ? `좌표 ${selected.length}/3` : '상대 착수 대기 중'}</span>
              </div>
              {isMyInitialTurn && (
                <button
                  className="primary control-lock-button"
                  disabled={busy || selected.length !== INITIAL_SELECTIONS}
                  onClick={confirmInitialPlacement}
                >
                  INITIAL LOCK · {selected.length}/3
                </button>
              )}
            </div>
          )}

          {room.phase === 'PLANNING' && (
            <div className="round-control-bar round-control-bar--planning">
              <div className="selection-readout">
                <small>{conversionTargetId ? 'OVERRIDE' : 'COORDINATES'}</small>
                <strong>{conversionTargetId ? '2 RANDOM' : `${selected.length} / ${MAX_SELECTIONS}`}</strong>
                <span>
                  {me?.ready
                    ? 'LOCKED'
                    : conversionTargetId
                      ? `${playerName(room, conversionTargetId)}의 선택 중 최대 2개를 내 돌로 전환`
                      : `최대 ${MAX_SELECTIONS}곳 · 다시 누르면 취소`}
                </span>
              </div>
              <div className={`round-timer compact-round-timer ${secondsLeft !== null && secondsLeft <= 5 ? 'round-timer--urgent' : ''}`} aria-live="polite">
                <small>TURN TIMER</small>
                <strong>{String(secondsLeft ?? 0).padStart(2, '0')}</strong>
                <span>SEC</span>
              </div>
              {!me?.ready && (
                <button
                  className="primary control-lock-button"
                  disabled={busy}
                  onClick={() => run(async () => {
                    await emitAck('round:ready', { targetPlayerId: conversionTargetId || null });
                  })}
                >
                  {conversionTargetId
                    ? `OVERRIDE LOCK · ${playerName(room, conversionTargetId)}`
                    : `LOCK COORDINATES · ${selected.length}/${MAX_SELECTIONS}`}
                </button>
              )}
              {me?.ready && <div className="locked-indicator">COORDINATES LOCKED</div>}

              <div className="conversion-control">
                <button
                  className={!conversionTargetId ? 'conversion-mode conversion-mode--active' : 'conversion-mode'}
                  disabled={busy || Boolean(me?.ready)}
                  onClick={() => chooseConversionTarget('')}
                >
                  직접 3수
                </button>
                <label className="conversion-target-field">
                  <span>상대 돌 전환</span>
                  <select
                    value={conversionTargetId}
                    disabled={busy || Boolean(me?.ready) || Boolean(me?.conversionUsed)}
                    onChange={(event) => chooseConversionTarget(event.target.value)}
                  >
                    <option value="">사용 안 함</option>
                    {room.players
                      .filter((player) => player.id !== session.playerId)
                      .map((player) => (
                        <option key={player.id} value={player.id}>{player.nickname}</option>
                      ))}
                  </select>
                </label>
                <small>
                  {me?.conversionUsed
                    ? '이번 게임의 전환 기회를 이미 사용했습니다.'
                    : room.conversionAvailable
                      ? '게임당 1회 사용 · 같은 라운드에서는 먼저 LOCK한 1명만 성공 · 직접 3수를 포기합니다.'
                      : '이번 라운드는 다른 플레이어가 먼저 선점했습니다. 다음 라운드에 다시 시도할 수 있습니다.'}
                </small>
              </div>
            </div>
          )}
          {error && <p className="error gameplay-error">{error}</p>}
          {takeoverNotice && (
            <div className="takeover-notice" role="status" aria-live="polite">
              <strong>TAKEOVER BLOCKED</strong>
              <span>{takeoverNotice}</span>
            </div>
          )}

          {room.phase === 'FINISHED' && (
            <div className="game-result-summary">
              <div>
                <small>MISSION RESULT</small>
                <strong>{winnerNames || '승자 확인 중'} · {room.winners.length > 1 ? '공동 승리' : '승리'}</strong>
              </div>
              <div className="game-result-actions">
                <button className="secondary" onClick={() => setGameOverOpen(true)}>결과 다시 보기</button>
                {isHost && (
                  <button className="primary" onClick={() => run(async () => { await emitAck('game:restart'); })}>
                    RESTART MISSION
                  </button>
                )}
              </div>
            </div>
          )}

          <Board
            board={room.board}
            players={room.players}
            selected={
              ((room.phase === 'PLANNING' && !conversionTargetId) ||
                (room.phase === 'INITIAL_PLACEMENT' && isMyInitialTurn))
                ? selected
                : []
            }
            collisions={resolution?.collisions ?? []}
            converted={resolution?.converted ?? []}
            disabled={
              room.phase === 'LOBBY' ||
              room.phase === 'FINISHED' ||
              room.phase === 'RESOLVING' ||
              busy ||
              (room.phase === 'INITIAL_PLACEMENT' && !isMyInitialTurn) ||
              (room.phase === 'PLANNING' && Boolean(me?.ready || conversionTargetId))
            }
            onCellClick={handleBoardClick}
          />
        </div>
      </section>

      {resolution && (
        <div className="reveal-toast">
          <small>TACTICAL RESOLUTION</small>
          <strong>ROUND {Math.max(1, room.round - (room.phase === 'PLANNING' ? 1 : 0))} 공개</strong>
          <span>
            충돌 {resolution.collisions.length}곳 · 착수 성공 {resolution.placed.length}개
            {(resolution.converted?.length ?? 0) > 0 ? ` · 돌 전환 ${resolution.converted?.length ?? 0}개` : ''}
          </span>
        </div>
      )}

      {room.phase === 'FINISHED' && gameOverOpen && (
        <div
          className="game-over-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          onClick={() => setGameOverOpen(false)}
        >
          <div className="game-over-card">
            <button className="game-over-close" aria-label="결과 팝업 닫기" onClick={() => setGameOverOpen(false)}>×</button>
            <small>MISSION COMPLETE</small>
            <p className="game-over-kicker">GAME OVER</p>
            <h2 id="game-over-title">{winnerNames || '승자 확인 중'}</h2>
            <strong className="winner-label">{room.winners.length > 1 ? '공동 승리' : '승리'}</strong>
            <p>오목이 완성되어 게임이 종료되었습니다.</p>
            {isHost ? (
              <button
                className="primary game-over-action"
                onClick={(event) => {
                  event.stopPropagation();
                  void run(async () => { await emitAck('game:restart'); });
                }}
              >
                RESTART MISSION
              </button>
            ) : (
              <div className="game-over-wait">방장이 재시작할 때까지 대기 중</div>
            )}
          </div>
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
