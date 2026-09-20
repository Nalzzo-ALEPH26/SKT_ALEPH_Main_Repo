import type { Board, PlayerId, Position, RoundResolution } from './types.js';

export const BOARD_SIZE = 14;
export const BLOCKER_ID = '__BLACK_CORNER__';

export function createEmptyBoard(): Board {
  const board: Board = Array.from(
    { length: BOARD_SIZE },
    () => Array.from({ length: BOARD_SIZE }, () => null),
  );
  const last = BOARD_SIZE - 1;
  board[0][0] = BLOCKER_ID;
  board[0][last] = BLOCKER_ID;
  board[last][0] = BLOCKER_ID;
  board[last][last] = BLOCKER_ID;
  return board;
}

export function isInBounds(position: Position): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

export function isCellEmpty(board: Board, position: Position): boolean {
  return isInBounds(position) && board[position.row][position.col] === null;
}

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function validatePositions(board: Board, positions: Position[], limit: number): void {
  if (positions.length > limit) throw new Error('SELECTION_LIMIT');

  const seen = new Set<string>();
  for (const position of positions) {
    if (!isInBounds(position)) throw new Error('OUT_OF_BOUNDS');
    const key = positionKey(position);
    if (seen.has(key)) throw new Error('DUPLICATE_POSITION');
    if (!isCellEmpty(board, position)) throw new Error('CELL_OCCUPIED');
    seen.add(key);
  }
}

export function resolveSelections(
  board: Board,
  selections: Record<PlayerId, Position[]>,
): RoundResolution {
  const nextBoard = cloneBoard(board);
  const byCoordinate = new Map<string, { position: Position; players: PlayerId[] }>();

  for (const [playerId, positions] of Object.entries(selections)) {
    for (const position of positions) {
      if (!isCellEmpty(board, position)) continue;
      const key = positionKey(position);
      const entry = byCoordinate.get(key) ?? { position, players: [] };
      entry.players.push(playerId);
      byCoordinate.set(key, entry);
    }
  }

  const collisions: Position[] = [];
  const placed: RoundResolution['placed'] = [];

  for (const { position, players } of byCoordinate.values()) {
    if (players.length >= 2) {
      collisions.push(position);
      continue;
    }

    const [playerId] = players;
    nextBoard[position.row][position.col] = playerId;
    placed.push({ playerId, position });
  }

  collisions.sort(comparePositions);
  placed.sort((a, b) => comparePositions(a.position, b.position));

  return {
    board: nextBoard,
    collisions,
    placed,
    revealedSelections: Object.fromEntries(
      Object.entries(selections).map(([playerId, positions]) => [
        playerId,
        positions.map((position) => ({ ...position })),
      ]),
    ),
    winners: getWinners(nextBoard),
  };
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function getWinningLineKeys(board: Board, playerId: PlayerId): string[] {
  if (!playerId || playerId === BLOCKER_ID) return [];

  const size = board.length;
  const lines = new Set<string>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] !== playerId) continue;

      for (const [dr, dc] of DIRECTIONS) {
        const previousRow = row - dr;
        const previousCol = col - dc;
        if (
          previousRow >= 0 &&
          previousRow < size &&
          previousCol >= 0 &&
          previousCol < size &&
          board[previousRow][previousCol] === playerId
        ) {
          continue;
        }

        const run: Position[] = [];
        let cursorRow = row;
        let cursorCol = col;
        while (
          cursorRow >= 0 &&
          cursorRow < size &&
          cursorCol >= 0 &&
          cursorCol < size &&
          board[cursorRow][cursorCol] === playerId
        ) {
          run.push({ row: cursorRow, col: cursorCol });
          cursorRow += dr;
          cursorCol += dc;
        }

        for (let offset = 0; offset <= run.length - 5; offset += 1) {
          const start = run[offset];
          lines.add(`${start.row}:${start.col}:${dr}:${dc}`);
        }
      }
    }
  }

  return [...lines];
}

export function getWinners(board: Board): PlayerId[] {
  const playerIds = new Set<PlayerId>();
  for (const row of board) {
    for (const playerId of row) {
      if (playerId && playerId !== BLOCKER_ID) playerIds.add(playerId);
    }
  }
  return [...playerIds].filter((playerId) => getWinningLineKeys(board, playerId).length > 0);
}

function comparePositions(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}
