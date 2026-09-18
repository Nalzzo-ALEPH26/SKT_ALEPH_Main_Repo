import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, createEmptyBoard, isInBounds } from '../core-dist/engine.js';

test('game board is 14 by 14', () => {
  assert.equal(BOARD_SIZE, 14);
  const board = createEmptyBoard();
  assert.equal(board.length, 14);
  assert.ok(board.every((row) => row.length === 14));
});

test('14 by 14 board accepts 0..13 and rejects index 14', () => {
  assert.equal(isInBounds({ row: 13, col: 13 }), true);
  assert.equal(isInBounds({ row: 14, col: 13 }), false);
  assert.equal(isInBounds({ row: 13, col: 14 }), false);
});
