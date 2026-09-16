import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  createEmptyBoard,
  isCellEmpty,
  resolveSelections,
  getWinners,
  validatePositions,
} from '../core-dist/engine.js';

const pos = (row, col) => ({ row, col });

test('creates a 15x15 empty board', () => {
  const board = createEmptyBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(board.every((row) => row.length === BOARD_SIZE));
  assert.equal(isCellEmpty(board, pos(0, 0)), true);
});

test('rejects out-of-bounds, occupied, duplicate, and over-limit selections', () => {
  const board = createEmptyBoard();
  board[1][1] = 'p1';
  assert.throws(() => validatePositions(board, [pos(-1, 0)], 5), /OUT_OF_BOUNDS/);
  assert.throws(() => validatePositions(board, [pos(1, 1)], 5), /CELL_OCCUPIED/);
  assert.throws(() => validatePositions(board, [pos(2, 2), pos(2, 2)], 5), /DUPLICATE_POSITION/);
  assert.throws(
    () => validatePositions(board, [0, 1, 2, 3, 4, 5].map((col) => pos(3, col)), 5),
    /SELECTION_LIMIT/,
  );
});

test('cancels a coordinate selected by two or more players', () => {
  const board = createEmptyBoard();
  const result = resolveSelections(board, {
    p1: [pos(1, 1), pos(1, 2)],
    p2: [pos(1, 2), pos(1, 3)],
    p3: [pos(2, 2)],
  });

  assert.deepEqual(result.collisions, [pos(1, 2)]);
  assert.equal(result.board[1][1], 'p1');
  assert.equal(result.board[1][2], null);
  assert.equal(result.board[1][3], 'p2');
  assert.equal(result.board[2][2], 'p3');
});

test('detects five or more stones and joint winners', () => {
  const board = createEmptyBoard();
  for (let i = 0; i < 6; i += 1) board[4][i] = 'p1';
  for (let i = 0; i < 5; i += 1) board[i][8] = 'p2';
  for (let i = 0; i < 5; i += 1) board[i + 6][i + 6] = 'p3';

  assert.deepEqual(new Set(getWinners(board)), new Set(['p1', 'p2', 'p3']));
});
