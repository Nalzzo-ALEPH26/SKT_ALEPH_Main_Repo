import { createSocketServer } from '../server/src/socketServer.js';

const { httpServer } = createSocketServer();

// Vercel WebSocket Public Beta accepts a standard Node HTTP server as a Function export.
export default httpServer;
