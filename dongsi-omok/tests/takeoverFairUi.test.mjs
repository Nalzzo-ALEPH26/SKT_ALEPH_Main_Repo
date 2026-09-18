import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const typeSource = await readFile(new URL('../client/src/types.ts', import.meta.url), 'utf8');

test('takeover exposes a per-player one-use state', () => {
  assert.match(typeSource, /conversionUsed: boolean/);
  assert.match(appSource, /이번 게임의 전환 기회를 이미 사용했습니다/);
  assert.match(appSource, /Boolean\(me\?\.conversionUsed\)/);
});

test('takeover preemption is shown as a temporary status notice', () => {
  assert.match(appSource, /takeoverNotice/);
  assert.match(appSource, /다른 플레이어가 먼저 전환권을 선점했습니다/);
  assert.match(appSource, /setTimeout\(\(\) => setTakeoverNotice\(''\), 2000\)/);
  assert.match(appSource, /role="status"/);
});
