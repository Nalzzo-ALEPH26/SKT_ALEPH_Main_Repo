import { createSocketServer } from './socketServer.js';

const PORT = Number(process.env.PORT ?? 3001);
const { httpServer } = createSocketServer();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Dongsi Omok server listening on http://0.0.0.0:${PORT}`);
});
