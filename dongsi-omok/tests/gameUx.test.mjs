import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../client/src/styles.css', import.meta.url), 'utf8');

test('finished game uses a persistent winner modal', () => {
  assert.match(appSource, /game-over-modal/);
  assert.match(appSource, /GAME OVER/);
  assert.match(appSource, /winnerNames/);
  assert.match(styles, /\.game-over-modal/);
});

test('planning controls keep the lock action above the board and the timer in the header', () => {
  assert.match(appSource, /round-control-bar/);
  assert.match(appSource, /panel-header-actions/);
  assert.match(appSource, /round-timer/);
  assert.match(appSource, /LOCK COORDINATES/);
  assert.match(styles, /\.round-control-bar/);
  assert.match(styles, /\.round-timer/);
});

test('initial placement is selected locally and submitted as one three-stone batch', () => {
  assert.match(appSource, /initial:place-batch/);
  assert.match(appSource, /INITIAL LOCK/);
  assert.doesNotMatch(appSource, /emitAck\('initial:place',/);
});

test('placement controls are rendered at the top of the board panel before status and board', () => {
  const headerIndex = appSource.indexOf('className="panel-header"');
  const controlsIndex = appSource.indexOf('round-control-bar', headerIndex);
  const statusIndex = appSource.indexOf('className="status-line"', headerIndex);
  const boardIndex = appSource.indexOf('<Board', headerIndex);
  assert.ok(headerIndex >= 0 && controlsIndex > headerIndex);
  assert.ok(controlsIndex < statusIndex, 'round controls should appear before the status line');
  assert.ok(controlsIndex < boardIndex, 'round controls should appear before the board');
});

test('game over modal can be dismissed while a persistent result summary remains available', () => {
  assert.match(appSource, /gameOverOpen/);
  assert.match(appSource, /setGameOverOpen\(false\)/);
  assert.match(appSource, /결과 다시 보기/);
  assert.match(appSource, /game-result-summary/);
  assert.match(styles, /\.game-result-summary/);
});

test('there is only one live round timer and it occupies the board header action slot', () => {
  const timerMatches = appSource.match(/<div className=\{`round-timer/g) ?? [];
  assert.equal(timerMatches.length, 1, 'only one round timer should be rendered');
  const panelHeaderIndex = appSource.indexOf('className="panel-header"');
  const headerActionsIndex = appSource.indexOf('panel-header-actions', panelHeaderIndex);
  const timerIndex = appSource.indexOf('`round-timer ${', panelHeaderIndex);
  const boardIndex = appSource.indexOf('<Board', panelHeaderIndex);
  assert.ok(headerActionsIndex > panelHeaderIndex, 'header actions should exist in board panel header');
  assert.ok(timerIndex > headerActionsIndex && timerIndex < boardIndex, 'timer should live in the board header action area');
  assert.doesNotMatch(appSource, /phase-box[\s\S]{0,250}secondsLeft/);
});

test('host start button uses the same upper-right board header action area as the timer', () => {
  const panelHeaderIndex = appSource.indexOf('className="panel-header"');
  const headerActionsIndex = appSource.indexOf('panel-header-actions', panelHeaderIndex);
  const startButtonIndex = appSource.indexOf('INITIATE MISSION', headerActionsIndex);
  const boardIndex = appSource.indexOf('<Board', panelHeaderIndex);
  assert.ok(startButtonIndex > headerActionsIndex && startButtonIndex < boardIndex);
});
