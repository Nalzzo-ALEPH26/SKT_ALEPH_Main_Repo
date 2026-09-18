import type { Board, PlayerId, Position, RoundResolution } from './types.js';

export const BOARD_SIZE = 14;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
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

export function getWinners(board: Board): PlayerId[] {
  const winners = new Set<PlayerId>();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const playerId = board[row][col];
      if (!playerId || winners.has(playerId)) continue;

      for (const [dr, dc] of DIRECTIONS) {
        const previousRow = row - dr;
        const previousCol = col - dc;
        if (
          previousRow >= 0 &&
          previousRow < BOARD_SIZE &&
          previousCol >= 0 &&
          previousCol < BOARD_SIZE &&
          board[previousRow][previousCol] === playerId
        ) {
          continue;
        }

        let count = 0;
        let cursorRow = row;
        let cursorCol = col;
        while (
          cursorRow >= 0 &&
          cursorRow < BOARD_SIZE &&
          cursorCol >= 0 &&
          cursorCol < BOARD_SIZE &&
          board[cursorRow][cursorCol] === playerId
        ) {
          count += 1;
          cursorRow += dr;
          cursorCol += dc;
        }

        if (count >= 5) winners.add(playerId);
      }
    }
  }

  return [...winners];
}

function comparePositions(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}
