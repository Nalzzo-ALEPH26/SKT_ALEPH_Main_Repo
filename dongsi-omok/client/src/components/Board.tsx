import type { CSSProperties } from 'react';
import type { Position, PublicPlayer, RoundResolution } from '../types';

interface BoardProps {
  board: (string | null)[][];
  players: PublicPlayer[];
  selected: Position[];
  collisions: Position[];
  converted: NonNullable<RoundResolution['converted']>;
  urgent?: boolean;
  disabled?: boolean;
  onCellClick: (position: Position) => void;
}

const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚'];
const BLOCKER_ID = '__BLACK_CORNER__';
const BOARD_MARGIN_PERCENT = 5;
const STAR_POINTS = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
] as const;

type PointStyle = CSSProperties & {
  '--x': string;
  '--y': string;
};

function axisPercent(index: number, size: number): string {
  if (size <= 1) return '50%';
  const usable = 100 - BOARD_MARGIN_PERCENT * 2;
  return `${BOARD_MARGIN_PERCENT + (index / (size - 1)) * usable}%`;
}

export function Board({
  board,
  players,
  selected,
  collisions,
  converted,
  urgent = false,
  disabled,
  onCellClick,
}: BoardProps) {
  const size = board.length;
  const selectedKeys = new Set(selected.map(({ row, col }) => `${row}:${col}`));
  const collisionKeys = new Set(collisions.map(({ row, col }) => `${row}:${col}`));
  const convertedKeys = new Set(converted.map(({ position }) => `${position.row}:${position.col}`));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const indexes = Array.from({ length: size }, (_, index) => index);

  return (
    <div className={`board-frame ${urgent ? 'board-frame--urgent' : ''}`}>
      <div className={`board-stage ${urgent ? 'board-stage--urgent' : ''}`} role="grid" aria-label={`${size} x ${size} 오목 교차점 보드`}>
        <div className="board-scan" aria-hidden="true" />

        {indexes.map((index) => (
          <span
            aria-hidden="true"
            className="board-grid-line board-grid-line--vertical"
            key={`v-${index}`}
            style={{ left: axisPercent(index, size) }}
          />
        ))}
        {indexes.map((index) => (
          <span
            aria-hidden="true"
            className="board-grid-line board-grid-line--horizontal"
            key={`h-${index}`}
            style={{ top: axisPercent(index, size) }}
          />
        ))}

        {STAR_POINTS.filter(([row, col]) => row < size && col < size).map(([row, col]) => (
          <span
            aria-hidden="true"
            className="board-star"
            key={`star-${row}-${col}`}
            style={{
              left: axisPercent(col, size),
              top: axisPercent(row, size),
            }}
          />
        ))}

        {board.map((rowCells, row) =>
          rowCells.map((playerId, col) => {
            const key = `${row}:${col}`;
            const isBlocker = playerId === BLOCKER_ID;
            const player = playerId && !isBlocker ? playerMap.get(playerId) : undefined;
            const isSelected = selectedKeys.has(key);
            const isCollision = collisionKeys.has(key);
            const isConverted = convertedKeys.has(key);
            const pointStyle: PointStyle = {
              '--x': axisPercent(col, size),
              '--y': axisPercent(row, size),
            };

            return (
              <button
                type="button"
                role="gridcell"
                aria-label={`${row + 1}행 ${col + 1}열 교차점`}
                key={key}
                className={`board-point ${isSelected ? 'board-point--selected' : ''} ${isCollision ? 'board-point--collision' : ''} ${isConverted ? 'board-point--converted' : ''} ${isBlocker ? 'board-point--blocker' : ''}`}
                style={pointStyle}
                disabled={disabled || Boolean(playerId)}
                onClick={() => onCellClick({ row, col })}
              >
                {isBlocker ? (
                  <span className="blocker-stone" title="중립 검은 돌" aria-label="중립 검은 돌" />
                ) : player ? (
                  <span className={`stone stone--${player.colorIndex}`} title={player.nickname}>
                    <span>{SYMBOLS[player.colorIndex] ?? '●'}</span>
                  </span>
                ) : isSelected ? (
                  <span className="ghost-stone" />
                ) : isCollision ? (
                  <span className="collision-mark">×</span>
                ) : (
                  <span className="aim-dot" aria-hidden="true" />
                )}
                {isConverted && <span className="conversion-mark" title="상대 돌 전환" aria-label="전환된 돌">↺</span>}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
