import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const boardSource = await readFile(new URL('../client/src/components/Board.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../client/src/styles.css', import.meta.url), 'utf8');

test('conversion target selection is local and the claim happens with LOCK', () => {
  assert.doesNotMatch(appSource, /round:set-conversion-target/);
  assert.match(appSource, /round:ready'[\s\S]*targetPlayerId: conversionTargetId \|\| null/);
  assert.match(appSource, /LOCK 선착순 1명/);
  assert.match(appSource, /CONVERSION_ALREADY_CLAIMED/);
});

test('planning UI explains two random converted stones and disables conversion after claim', () => {
  assert.match(appSource, /2 RANDOM/);
  assert.match(appSource, /선택 중 최대 2개를 내 돌로 전환/);
  assert.match(appSource, /!room\.conversionAvailable/);
});

test('converted coordinates are passed to the board and visibly marked', () => {
  assert.match(appSource, /converted=\{resolution\?\.converted \?\? \[\]\}/);
  assert.match(boardSource, /board-point--converted/);
  assert.match(boardSource, /conversion-mark/);
  assert.match(styles, /\.board-point--converted::after/);
  assert.match(styles, /@keyframes conversionPulse/);
});

test('clicking the game-over popup closes it while restart remains interactive', () => {
  assert.match(appSource, /game-over-modal[\s\S]*onClick=\{\(\) => setGameOverOpen\(false\)\}/);
  assert.match(appSource, /event\.stopPropagation\(\)/);
});
