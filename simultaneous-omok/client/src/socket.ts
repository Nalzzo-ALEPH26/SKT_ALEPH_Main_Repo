import { io } from 'socket.io-client';

const serverUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;

export const socket = io(serverUrl || undefined, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
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
