import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../client/src/styles.css', import.meta.url), 'utf8');

const gameplayStart = appSource.indexOf('className="shell game-shell cockpit-grid gameplay-only"');
const gameplaySource = appSource.slice(gameplayStart);
const lobbyStart = appSource.indexOf("if (room.phase === 'LOBBY')");
const lobbyEnd = gameplayStart;
const lobbySource = appSource.slice(lobbyStart, lobbyEnd);

test('finished game uses a persistent winner modal', () => {
  assert.match(appSource, /game-over-modal/);
  assert.match(appSource, /GAME OVER/);
  assert.match(appSource, /winnerNames/);
  assert.match(styles, /\.game-over-modal/);
});

test('planning controls keep lock and the single timer above the board', () => {
  assert.ok(gameplayStart > -1);
  const planningIndex = gameplaySource.indexOf('round-control-bar round-control-bar--planning');
  const timerIndex = gameplaySource.indexOf('compact-round-timer', planningIndex);
  const lockIndex = gameplaySource.indexOf('LOCK COORDINATES', planningIndex);
  const boardIndex = gameplaySource.indexOf('<Board', planningIndex);

  assert.ok(planningIndex > -1);
  assert.ok(timerIndex > planningIndex);
  assert.ok(lockIndex > timerIndex);
  assert.ok(boardIndex > lockIndex);
  assert.match(styles, /\.round-control-bar/);
  assert.match(styles, /\.round-timer/);
});

test('initial placement is selected locally and submitted as one three-stone batch', () => {
  assert.match(appSource, /initial:place-batch/);
  assert.match(appSource, /INITIAL LOCK/);
  assert.doesNotMatch(appSource, /emitAck\('initial:place',/);
});

test('opening and planning controls are rendered before the board without the removed decorative header', () => {
  const openingIndex = gameplaySource.indexOf('OPENING TURN');
  const planningIndex = gameplaySource.indexOf('round-control-bar round-control-bar--planning');
  const boardIndex = gameplaySource.indexOf('<Board');

  assert.ok(openingIndex > -1 && openingIndex < boardIndex);
  assert.ok(planningIndex > -1 && planningIndex < boardIndex);
  assert.doesNotMatch(gameplaySource, /panel-header-actions/);
  assert.doesNotMatch(gameplaySource, /className="status-line"/);
});

test('game over modal can be dismissed while a persistent result summary remains available', () => {
  assert.match(appSource, /gameOverOpen/);
  assert.match(appSource, /setGameOverOpen\(false\)/);
  assert.match(appSource, /결과 다시 보기/);
  assert.match(appSource, /game-result-summary/);
  assert.match(styles, /\.game-result-summary/);
});

test('there is only one live round timer in the gameplay planning bar', () => {
  const timerMatches = appSource.match(/compact-round-timer/g) ?? [];
  assert.equal(timerMatches.length, 1, 'only one round timer should be rendered');
  assert.match(gameplaySource, /TURN TIMER/);
  assert.doesNotMatch(gameplaySource, /panel-header-actions/);
});

test('game start stays in the dedicated lobby and the lobby does not render the board', () => {
  assert.ok(lobbyStart > -1);
  assert.match(lobbySource, /게임 시작/);
  assert.doesNotMatch(lobbySource, /<Board/);
});
