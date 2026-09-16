import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const boardSource = await readFile(new URL('../client/src/components/Board.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../client/src/styles.css', import.meta.url), 'utf8');

test('board renders stones on 15x15 line intersections instead of square cell centers', () => {
  assert.match(boardSource, /className="board-stage"/);
  assert.match(boardSource, /board-grid-line board-grid-line--vertical/);
  assert.match(boardSource, /board-grid-line board-grid-line--horizontal/);
  assert.match(boardSource, /className={`board-point/);
  assert.match(boardSource, /--x/);
  assert.match(boardSource, /--y/);
  assert.match(styles, /\.board-point\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /left:\s*var\(--x\)/);
  assert.match(styles, /top:\s*var\(--y\)/);
  assert.match(styles, /transform:\s*translate\(-50%,\s*-50%\)/);
});

test('board uses dark sci-fi HUD styling rather than a wooden board', () => {
  assert.doesNotMatch(styles, /#dcb56f/i);
  assert.match(styles, /\.board-stage\s*\{[^}]*background:/s);
  assert.match(styles, /\.board-grid-line\s*\{/);
  assert.match(styles, /box-shadow:[^;}]*rgba\(/s);
});
