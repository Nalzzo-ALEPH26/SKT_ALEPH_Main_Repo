import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');

const gameStart = appSource.indexOf('className="shell game-shell cockpit-grid gameplay-only"');
const gameSource = appSource.slice(gameStart);

test('gameplay removes decorative headers above the board', () => {
  assert.ok(gameStart > -1);
  assert.doesNotMatch(gameSource, /PRIMARY DISPLAY/);
  assert.doesNotMatch(gameSource, /TACTICAL GRID/);
  assert.doesNotMatch(gameSource, /className="panel-header"/);
  assert.doesNotMatch(gameSource, /className="status-line"/);
});

test('opening controls remain as the first gameplay controls', () => {
  const opening = gameSource.indexOf('OPENING TURN');
  const yourTurn = gameSource.indexOf('YOUR TURN', opening);
  const initialLock = gameSource.indexOf('INITIAL LOCK', opening);
  const board = gameSource.indexOf('<Board', opening);
  assert.ok(opening > -1);
  assert.ok(yourTurn > opening);
  assert.ok(initialLock > yourTurn);
  assert.ok(board > initialLock);
});

test('planning timer is between selection readout and lock control', () => {
  const planning = gameSource.indexOf('round-control-bar round-control-bar--planning');
  const selection = gameSource.indexOf('selection-readout', planning);
  const timer = gameSource.indexOf('compact-round-timer', planning);
  const lock = gameSource.indexOf('control-lock-button', timer);
  assert.ok(planning > -1);
  assert.ok(selection > planning);
  assert.ok(timer > selection);
  assert.ok(lock > timer);
});
