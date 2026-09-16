import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../client/src/styles.css', import.meta.url), 'utf8');

test('player identity is explicitly confirmed before entering or reconnecting', () => {
  assert.match(appSource, /useState<Session \| null>\(null\)/);
  assert.doesNotMatch(appSource, /const \[session, setSession\] = useState<Session \| null>\(\(\) => loadSession\(\)\)/);
  assert.match(appSource, /플레이어명/);
  assert.match(appSource, /CALLSIGN/);
  assert.match(appSource, /기존 게임 재접속/);
});

test('landing page restores the spacecraft mission-control HUD language and layout', () => {
  assert.match(appSource, /mission-console/);
  assert.match(appSource, /hud-strip/);
  assert.match(appSource, /SYSTEM ONLINE/);
  assert.match(appSource, /MISSION CONTROL/);
  assert.match(styles, /\.mission-console/);
  assert.match(styles, /\.hud-strip/);
  assert.match(styles, /\.cockpit-grid/);
  assert.match(styles, /\.system-light/);
});

test('pressing Enter in the room code field joins the room', () => {
  assert.match(appSource, /onKeyDown=\{\(event\) => \{/);
  assert.match(appSource, /event\.key === 'Enter'/);
  assert.match(appSource, /void join\(\)/);
});
