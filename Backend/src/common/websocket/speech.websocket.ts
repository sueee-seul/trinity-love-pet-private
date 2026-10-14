import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  SPEECH_MAX_AUDIO_FRAME_BYTES,
  SPEECH_STREAM_PATH,
} from '../../contracts/speech.contract.js';
import type { AuthenticatedUser } from '../../services/auth.service.js';
import {
  SpeechStreamSession,
  type SpeechSessionSocket,
} from '../../services/speech.stream.session.js';
import { getDefaultSpeechStreamer } from '../../services/speech.provider.js';
import {
  SpeechConfigurationError,
  type TranscribeStreamer,
} from '../../services/speech.streamer.js';
import { loadAuthenticatedUserFromCookieHeader } from '../middlewares/auth.middleware.js';

/**
 * Mounts the live speech socket on the same HTTP server as the REST API.
 *
 * Authentication reuses the signed session cookie, so the browser needs nothing beyond being
 * signed in, and provider credentials never leave this process. The `Origin` header is checked the
 * way `requireTrustedOrigin` checks it for mutating routes: a WebSocket handshake is not covered by
 * CORS, so without this any site could open a dictation session with a visitor's cookie.
 *
 * The booking concierge is used before sign-in, so a deployment can admit guests. Every minute of
 * streaming costs GPU time on the local Whisper service (or is billed by Transcribe), so a guest is
 * keyed by address and gets a tighter concurrency limit plus an hourly start budget; a signed-in
 * account keeps the per-account limit.
 */

export interface AttachSpeechWebSocketOptions {
  server: Server;
  allowedOrigins: string[];
  streamer?: TranscribeStreamer;
  authenticate?: (request: IncomingMessage) => Promise<AuthenticatedUser | null>;
  /** How many dictations one account may run at once; a second tab is plausible, a tenth is not. */
  maxSessionsPerUser?: number;
  /** Admit visitors without a session (the public booking concierge). Off unless asked for. */
  allowGuests?: boolean;
  /** Concurrent dictations for one guest address. */
  maxSessionsPerGuest?: number;
  /** Dictations one guest address may start per hour. */
  guestStartsPerHour?: number;
  log?: (message: string, detail?: unknown) => void;
  now?: () => number;
}

const DEFAULT_MAX_SESSIONS_PER_USER = 2;
const DEFAULT_MAX_SESSIONS_PER_GUEST = 1;
const DEFAULT_GUEST_STARTS_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface SpeechClient {
  /** Key for the concurrency and budget maps; never logged. */
  key: string;
  isGuest: boolean;
}

interface StartBudget {
  count: number;
  resetAt: number;
}

const rejectUpgrade = (socket: Duplex, status: number, reason: string): void => {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
};

const toBytes = (data: RawData): Uint8Array => {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};

const wrapSocket = (webSocket: WebSocket): SpeechSessionSocket => ({
  send: (event): void => {
    if (webSocket.readyState === webSocket.OPEN) {
      webSocket.send(JSON.stringify(event));
    }
  },
  close: (code, reason): void => {
    if (webSocket.readyState === webSocket.OPEN || webSocket.readyState === webSocket.CONNECTING) {
      webSocket.close(code, reason);
    }
  },
});

const guestAddress = (request: IncomingMessage): string =>
  request.socket.remoteAddress ?? 'unknown';

export const attachSpeechWebSocket = (options: AttachSpeechWebSocketOptions): WebSocketServer => {
  const {
    server,
    allowedOrigins,
    authenticate = (request): Promise<AuthenticatedUser | null> =>
      loadAuthenticatedUserFromCookieHeader(request.headers.cookie),
    maxSessionsPerUser = DEFAULT_MAX_SESSIONS_PER_USER,
    allowGuests = false,
    maxSessionsPerGuest = DEFAULT_MAX_SESSIONS_PER_GUEST,
    guestStartsPerHour = DEFAULT_GUEST_STARTS_PER_HOUR,
    log = (message, detail): void => console.error(message, detail),
    now = (): number => Date.now(),
  } = options;

  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: SPEECH_MAX_AUDIO_FRAME_BYTES,
  });
  const activeSessionsByClient = new Map<string, number>();
  const guestStartBudgets = new Map<string, StartBudget>();

  const resolveStreamer = (): TranscribeStreamer => options.streamer ?? getDefaultSpeechStreamer();

  const identifyClient = async (request: IncomingMessage): Promise<SpeechClient | null> => {
    let user: AuthenticatedUser | null;
    try {
      user = await authenticate(request);
    } catch {
      user = null;
    }
    if (user) {
      return { key: `user:${user.id}`, isGuest: false };
    }
    return allowGuests ? { key: `guest:${guestAddress(request)}`, isGuest: true } : null;
  };

  /** Spends one guest start; false once the hourly budget is used up. */
  const spendGuestStart = (key: string): boolean => {
    const current = now();
    const budget = guestStartBudgets.get(key);
    if (!budget || budget.resetAt <= current) {
      guestStartBudgets.set(key, { count: 1, resetAt: current + ONE_HOUR_MS });
      return true;
    }
    if (budget.count >= guestStartsPerHour) {
      return false;
    }
    budget.count += 1;
    return true;
  };

  const releaseSession = (key: string): void => {
    const remaining = (activeSessionsByClient.get(key) ?? 1) - 1;
    if (remaining <= 0) {
      activeSessionsByClient.delete(key);
    } else {
      activeSessionsByClient.set(key, remaining);
    }
  };

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== SPEECH_STREAM_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    void (async (): Promise<void> => {
      const client = await identifyClient(request);
      if (!client) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const concurrencyLimit = client.isGuest ? maxSessionsPerGuest : maxSessionsPerUser;
      const activeSessions = activeSessionsByClient.get(client.key) ?? 0;
      if (activeSessions >= concurrencyLimit) {
        rejectUpgrade(socket, 429, 'Too Many Requests');
        return;
      }
      if (client.isGuest && !spendGuestStart(client.key)) {
        rejectUpgrade(socket, 429, 'Too Many Requests');
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        const sessionSocket = wrapSocket(webSocket);
        let streamer: TranscribeStreamer;
        try {
          streamer = resolveStreamer();
        } catch (error: unknown) {
          const message =
            error instanceof SpeechConfigurationError
              ? error.message
              : 'Speech service is not configured';
          log('Speech service is not configured', { message });
          sessionSocket.send({
            type: 'error',
            code: 'not_configured',
            message: 'Speech service is not configured',
          });
          sessionSocket.close(1011, 'not_configured');
          return;
        }

        activeSessionsByClient.set(client.key, activeSessions + 1);
        const session = new SpeechStreamSession({ streamer, socket: sessionSocket, log });

        webSocket.on('message', (data: RawData, isBinary: boolean) => {
          session.handleMessage(toBytes(data), isBinary);
        });
        webSocket.on('error', (error: Error) => {
          log('Speech socket error', { sessionId: session.sessionId, message: error.message });
        });
        webSocket.on('close', () => {
          session.handleClose();
          releaseSession(client.key);
        });
      });
    })();
  });

  return webSocketServer;
};
