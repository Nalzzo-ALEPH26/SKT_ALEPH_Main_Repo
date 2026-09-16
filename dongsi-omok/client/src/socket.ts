import { io } from 'socket.io-client';

export const socket = io({
  path: '/api/socket',
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
});

export function emitAck<T extends Record<string, unknown>>(
  event: string,
  payload: unknown = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (error: Error | null, response: T) => {
      if (error) {
        reject(new Error('SERVER_TIMEOUT'));
        return;
      }
      if (response && response.ok === false) {
        reject(new Error(String(response.error ?? 'UNKNOWN_ERROR')));
        return;
      }
      resolve(response);
    });
  });
}
