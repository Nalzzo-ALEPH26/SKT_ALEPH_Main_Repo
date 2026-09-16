import type { Position, PublicPlayer } from '../types';

interface BoardProps {
  board: (string | null)[][];
  players: PublicPlayer[];
  selected: Position[];
  collisions: Position[];
  disabled?: boolean;
  onCellClick: (position: Position) => void;
}

const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚'];

export function Board({ board, players, selected, collisions, disabled, onCellClick }: BoardProps) {
  const selectedKeys = new Set(selected.map(({ row, col }) => `${row}:${col}`));
  const collisionKeys = new Set(collisions.map(({ row, col }) => `${row}:${col}`));
  const playerMap = new Map(players.map((player) => [player.id, player]));

  return (
    <div className="board" role="grid" aria-label="15 x 15 오목판">
      {board.map((rowCells, row) =>
        rowCells.map((playerId, col) => {
          const key = `${row}:${col}`;
          const player = playerId ? playerMap.get(playerId) : undefined;
          const isSelected = selectedKeys.has(key);
          const isCollision = collisionKeys.has(key);
          return (
            <button
              type="button"
              role="gridcell"
              aria-label={`${row + 1}행 ${col + 1}열`}
              key={key}
              className={`cell ${isSelected ? 'cell--selected' : ''} ${isCollision ? 'cell--collision' : ''}`}
              disabled={disabled || Boolean(playerId)}
              onClick={() => onCellClick({ row, col })}
            >
              {player ? (
                <span className={`stone stone--${player.colorIndex}`} title={player.nickname}>
                  <span>{SYMBOLS[player.colorIndex] ?? '●'}</span>
                </span>
              ) : isSelected ? (
                <span className="ghost-stone" />
              ) : isCollision ? (
                <span className="collision-mark">×</span>
              ) : null}
            </button>
          );
        }),
      )}
    </div>
  );
}
