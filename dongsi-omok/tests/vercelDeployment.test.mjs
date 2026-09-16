import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const socketSource = await readFile(new URL('client/src/socket.ts', root), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('Vercel deployment exposes Socket.IO from an api function', async () => {
  const apiSource = await readFile(new URL('api/socket.ts', root), 'utf8');
  assert.match(apiSource, /createSocketServer/);
  assert.match(apiSource, /export default/);
  assert.equal(vercelConfig.fluid, true);
  assert.equal(vercelConfig.functions['api/socket.ts'].maxDuration, 300);
  assert.deepEqual(vercelConfig.functions['api/socket.ts'].regions, ['icn1']);
});

test('browser connects to the same Vercel origin using the api socket path', () => {
  assert.match(socketSource, /path:\s*['"]\/api\/socket['"]/);
  assert.doesNotMatch(socketSource, /VITE_SOCKET_URL/);
});

test('deployment build only builds the Vite client and does not require Railway', () => {
  assert.equal(vercelConfig.buildCommand, 'npm run build:client');
  assert.equal(vercelConfig.outputDirectory, 'dist-client');
  assert.equal(packageJson.scripts.build, 'npm run test && npm run build:client');
  assert.equal(packageJson.scripts['build:server'], undefined);
});
